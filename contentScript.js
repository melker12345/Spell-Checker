/**
 * SpellCheck Fixer - Optimized Firefox Addon
 * 
 * This addon provides fast and accurate spell checking for text inputs
 * with an improved UI and performance optimizations.
 */

// ===== SpellChecker Class =====
class SpellChecker {
    constructor() {
        // All spell checking (check and suggest) will now go through the worker.
        // No more main-thread Typo instance or its specific initialization.
        this.wordCheckCache = new Map(); // This cache might still be useful for .check() results to avoid repeated worker calls for the same word.

        this.worker = new Worker(browser.runtime.getURL('spellcheck_worker.js'));
        this.pendingRequests = new Map();
        this.workerRequestIdCounter = 0;
        this.workerInitialized = false;
        this.workerInitPromise = null;

        this.worker.onmessage = this.handleWorkerMessage.bind(this);
        this._initializeWorker(); // Start worker initialization
    }

    /**
     * Initialize the spell checker
     * @returns {Promise} - Resolves when initialization is complete
     */
    _initializeWorker() {
        if (this.workerInitPromise) return this.workerInitPromise;

        this.workerInitPromise = new Promise((resolve, reject) => {
            const affURL = browser.runtime.getURL("en_US.aff");
            const dicURL = browser.runtime.getURL("en_US.dic");

            this.worker.postMessage({
                action: 'init',
                payload: { affURL, dicURL }
            });

            // The promise will be resolved/rejected in handleWorkerMessage
            // based on 'initComplete' message from worker.
            // We'll store resolve/reject for this specific init sequence.
            this.pendingRequests.set('worker_init', { resolve, reject });
        });
        return this.workerInitPromise;
    }

    // Main thread Typo initialization is removed. Worker handles all dictionary loading.
    /**
     * Check if a word is spelled correctly
     * @param {string} word - The word to check
     * @returns {boolean} - True if the word is spelled correctly
     */
    async check(word) {
        if (!this.workerInitialized) {
            console.warn("SpellCheck Worker not initialized yet for .check(). Waiting for worker init...");
            try {
                await this._initializeWorker(); // Ensure worker init is awaited
            } catch (error) {
                console.error("Worker initialization failed, cannot perform check:", error);
                return true; // Assume correct if worker fails to init
            }
        }

        // Skip checking for very short words (likely not misspelled)
        if (word.length <= 2) {
            return true;
        }

        const lowerWord = word.toLowerCase();
        if (this.wordCheckCache.has(lowerWord)) {
            return this.wordCheckCache.get(lowerWord);
        }

        const requestId = `check_${this.workerRequestIdCounter++}`;
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, { resolve, reject });
            this.worker.postMessage({
                action: 'check',
                payload: { word },
                requestId: requestId
            });

            // Optional: Timeout for the request
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    // On timeout, assume word is correct to avoid blocking UI indefinitely
                    console.warn(`Check request for "${word}" timed out. Assuming correct.`);
                    resolve(true); 
                }
            }, 3000); // 3 second timeout for check
        }).then(isCorrect => {
            this.wordCheckCache.set(lowerWord, isCorrect);
            return isCorrect;
        }).catch(error => {
            console.error(`Error during check for "${word}":`, error);
            this.wordCheckCache.set(lowerWord, true); // Cache as correct on error to avoid re-checking problematic word
            return true; // Assume correct on error
        });
    }

    /**
     * Get suggestions for a misspelled word
     * @param {string} word - The misspelled word
     * @param {number} limit - Maximum number of suggestions
     * @returns {string[]} - Array of suggestions
     */
    async suggest(word, limit = 5) {
        // console.log(`[SpellChecker] Requesting suggestions for: "${word}"`);
        
        if (!this.workerInitialized) {
            console.warn("[SpellChecker] Worker not initialized, initializing...");
            try {
                await this._initializeWorker();
                console.log("[SpellChecker] Worker initialized successfully");
            } catch (error) {
                console.error("[SpellChecker] Worker initialization failed:", error);
                throw new Error(`Worker initialization failed: ${error.message}`);
            }
        }

        const requestId = `suggest_${this.workerRequestIdCounter++}`;
        // console.log(`[SpellChecker] Created request ${requestId} for "${word}"`);
        
        return new Promise((resolve, reject) => {
            // console.log(`[SpellChecker] Setting up message handler for ${requestId}`);
            
            // Set up a one-time message handler for this specific request
            const handleMessage = (event) => {
                const { action, requestId: responseId, suggestions, error } = event.data;
                if (action === 'suggestionResult' && responseId === requestId) {
                    // console.log(`[SpellChecker] Received response for ${requestId}`);
                    this.worker.removeEventListener('message', handleMessage);
                    
                    if (error) {
                        console.error(`[SpellChecker] Error in suggestion response:`, error);
                        reject(new Error(error));
                    } else {
                        // console.log(`[SpellChecker] Got ${suggestions.length} suggestions for "${word}"`);
                        resolve(suggestions);
                    }
                }
            };
            
            this.worker.addEventListener('message', handleMessage);
            
            // Store the cleanup function
            this.pendingRequests.set(requestId, { 
                resolve: (suggestions) => {
                    this.worker.removeEventListener('message', handleMessage);
                    resolve(suggestions);
                },
                reject: (error) => {
                    this.worker.removeEventListener('message', handleMessage);
                    reject(error);
                }
            });
            
            // console.log(`[SpellChecker] Sending suggest message to worker for "${word}"`);
            this.worker.postMessage({
                action: 'suggest',
                payload: { 
                    word, 
                    limit, 
                    requestId 
                }
            });

            // Set timeout for the request
            const timeoutId = setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    console.error(`[SpellChecker] Suggestion request for "${word}" timed out after 10s`);
                    this.worker.removeEventListener('message', handleMessage);
                    this.pendingRequests.delete(requestId);
                    reject(new Error(`Suggestion request for "${word}" timed out after 10s`));
                }
            }, 10000);
            
            // Store the timeout ID so we can clear it if the request completes
            const request = this.pendingRequests.get(requestId);
            if (request) {
                request.timeoutId = timeoutId;
            }
        });
    }

    /**
     * Clear the caches
     */
    clearCaches() {
        this.wordCheckCache.clear();
        // To clear worker cache, we'd need to send a message like { action: 'clearCache' } to the worker.
        // For now, worker manages its own (non-persistent) state and Nspell doesn't have an explicit cache to clear via API.
        // console.log("SpellChecker wordCheckCache cleared (main thread)");
    }

    handleWorkerMessage(event) {
        const { action, requestId, suggestions, success, error, isCorrect } = event.data;
        // console.log(`[SpellChecker] Received message:`, { action, requestId, hasError: !!error });

        if (requestId === 'worker_init' && action === 'initComplete') {
            const initRequest = this.pendingRequests.get('worker_init');
            if (initRequest) {
                if (success) {
                    this.workerInitialized = true;
                    // console.log("[SpellChecker] Worker initialized successfully");
                    initRequest.resolve();
                } else {
                    const errorMsg = error || 'Unknown worker initialization error';
                    console.error("[SpellChecker] Worker initialization failed:", errorMsg);
                    initRequest.reject(new Error(errorMsg));
                }
                this.pendingRequests.delete('worker_init');
            }
            return;
        }

        const request = this.pendingRequests.get(requestId);
        if (!request) {
            console.warn(`[SpellChecker] Received response for unknown request: ${requestId}`);
            return;
        }

        // Clear the timeout if it exists
        if (request.timeoutId) {
            clearTimeout(request.timeoutId);
        }

        if (action === 'suggestionResult') {
            // console.log(`[SpellChecker] Processing suggestion result for ${requestId}`);
            if (error) {
                console.error(`[SpellChecker] Error in suggestion response for ${requestId}:`, error);
                request.reject(new Error(error));
            } else {
                // console.log(`[SpellChecker] Resolving with ${suggestions.length} suggestions for ${requestId}`);
                request.resolve(suggestions);
            }
        } else if (action === 'checkResult') {
            // console.log(`[SpellChecker] Processing check result for ${requestId}:`, isCorrect);
            if (error) {
                console.error(`[SpellChecker] Error in check response for ${requestId}:`, error);
                request.reject(new Error(error));
            } else {
                request.resolve(isCorrect);
            }
        } else {
            console.warn(`[SpellChecker] Unknown action: ${action} for request ${requestId}`);
            return;
        }

        // Clean up the request
        this.pendingRequests.delete(requestId);
    }
}

// ===== TextProcessor Class =====
class TextProcessor {
    constructor() {
        this.inputElements = new Set();
        this.observer = null;
    }

    /**
     * Initialize the text processor
     */
    initialize() {
        // Set up mutation observer to detect new input elements
        this.observer = new MutationObserver(this.handleDomMutations.bind(this));
        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Find and register existing input elements
        this.findAndRegisterInputElements(document);
    }

    /**
     * Handle DOM mutations to detect new input elements
     * @param {MutationRecord[]} mutations - DOM mutations
     */
    handleDomMutations(mutations) {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Check if the node is an input element
                    if (this.isTextInputField(node)) {
                        this.registerInputElement(node);
                    }
                    
                    // Check for shadow DOM
                    if (node.shadowRoot) {
                        this.findAndRegisterInputElements(node.shadowRoot);
                    }
                    
                    // Check children
                    this.findAndRegisterInputElements(node);
                }
            });
        });
    }

    /**
     * Find and register all input elements in a container
     * @param {Node} container - Container to search in
     */
    findAndRegisterInputElements(container) {
        if (!container) return;
        
        // Find all input elements
        const inputs = Array.from(container.querySelectorAll('input, textarea, [contenteditable="true"]'));
        inputs.forEach(input => this.registerInputElement(input));
        
        // Check for shadow roots
        const shadowHosts = Array.from(container.querySelectorAll('*')).filter(el => el.shadowRoot);
        shadowHosts.forEach(host => this.findAndRegisterInputElements(host.shadowRoot));
    }

    /**
     * Register an input element for spell checking
     * @param {HTMLElement} element - Input element
     */
    registerInputElement(element) {
        if (this.inputElements.has(element)) return;
        this.inputElements.add(element);
    }

    /**
     * Check if an element is a text input field
     * @param {HTMLElement} element - Element to check
     * @returns {boolean} - True if element is a text input field
     */
    isTextInputField(element) {
        if (!element || !element.tagName) return false;
        
        const tagName = element.tagName.toLowerCase();
        const type = element.type ? element.type.toLowerCase() : '';
        
        // Check for contenteditable
        if (element.getAttribute('contenteditable') === 'true') return true;
        
        // Check for textarea
        if (tagName === 'textarea') return true;
        
        // Check for text input
        if (tagName === 'input') {
            const validTypes = ['text', 'search', 'email', 'url', ''];
            return validTypes.includes(type);
        }
        
        return false;
    }

    /**
     * Extract the word to the left of the cursor
     * @param {string} text - Text content
     * @param {number} position - Cursor position
     * @returns {Object} - {word, start, end}
     */
    getWordToLeftOfCursor(text, position) {
        if (!text || position === 0) return { word: '', start: 0, end: 0 };
        
        // Find the start of the word
        let start = position;
        while (start > 0 && /[a-zA-Z''-]/.test(text.charAt(start - 1))) {
            start--;
        }
        
        // If we didn't find a word, return empty
        if (start === position) return { word: '', start: position, end: position };
        
        // Extract the word
        const word = text.substring(start, position);
        
        // Skip very short words or words with numbers
        if (word.length <= 1 || /\d/.test(word)) {
            return { word: '', start: position, end: position };
        }
        
        return { word, start, end: position };
    }

    /**
     * Get the current word at cursor in active element
     * @returns {Object} - {word, start, end, element}
     */
    getCurrentWordAtCursor() {
        const element = document.activeElement;
        
        if (!this.isTextInputField(element)) {
            return { word: '', start: 0, end: 0, element: null };
        }
        
        // Handle contenteditable
        if (element.getAttribute('contenteditable') === 'true') {
            const selection = window.getSelection();
            if (!selection.rangeCount) return { word: '', start: 0, end: 0, element: null };
            
            const cursorPosition = selection.focusOffset;
            const textNode = selection.focusNode;
            
            if (textNode.nodeType !== Node.TEXT_NODE) {
                return { word: '', start: 0, end: 0, element: null };
            }
            
            const textValue = textNode.textContent;
            const wordInfo = this.getWordToLeftOfCursor(textValue, cursorPosition);
            
            return { ...wordInfo, element };
        }
        
        // Handle input/textarea
        const cursorPosition = element.selectionStart;
        const textValue = element.value;
        const wordInfo = this.getWordToLeftOfCursor(textValue, cursorPosition);
        
        return { ...wordInfo, element };
    }
}

// ===== UIManager Class =====
class UIManager {
    constructor() {
        this.currentIndex = -1;
        this.suggestionsArray = [];
        this.wordStartPosition = 0;
        this.wordEndPosition = 0;
        this.activeElement = null;
        this.menuVisible = false;
        this.originalValue = null;

        // Pre-bind event handlers to ensure correct removal
        this.boundNavigateSuggestions = this.navigateSuggestions.bind(this);
        this.boundPreventFocusChange = this.preventFocusChange.bind(this);
        this.boundHandleBlur = this.handleBlur.bind(this);
    }

    /**
     * Display the suggestions menu
     * @param {string[]} suggestions - Array of word suggestions
     * @param {number} start - Start position of the word
     * @param {number} end - End position of the word
     */
    displaySuggestionsMenu(suggestions, start, end) {
        if (suggestions.length === 0) return;
        
        // Clear any existing menu
        this.closeSuggestionMenu();
        
        // Store the active element and word positions
        this.activeElement = document.activeElement;
        this.wordStartPosition = start;
        this.wordEndPosition = end;
        this.suggestionsArray = suggestions;
        
        // Store the original value for reverting if needed
        if (this.activeElement) {
            this.originalValue = this.activeElement.getAttribute('contenteditable') === 'true' 
                ? this.activeElement.textContent 
                : this.activeElement.value;
            // console.log('[UIManager] Stored original value for potential reversion');
        }
        
        // Get cursor coordinates
        const { x, y } = this.getCursorCoordinates();
        
        // Create new menu
        const suggestionMenu = document.createElement('div');
        suggestionMenu.setAttribute('id', 'suggestionMenu');
        
        // Style the menu - centered on screen
        Object.assign(suggestionMenu.style, {
            position: 'fixed',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: '9999',
            backgroundColor: '#2b2b2b',
            color: 'white',
            border: '1px solid #3088fb',
            borderRadius: '4px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
            maxHeight: '300px',
            overflowY: 'auto',
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            minWidth: '200px'
        });
        
        // Add suggestions to menu
        suggestions.forEach((suggestion, index) => {
            const suggestionItem = document.createElement('div');
            suggestionItem.textContent = suggestion;
            suggestionItem.setAttribute('data-index', index);
            
            // Style the suggestion item
            Object.assign(suggestionItem.style, {
                padding: '8px 16px',
                cursor: 'pointer',
                borderBottom: index < suggestions.length - 1 ? '1px solid #444' : 'none'
            });
            
            // Hover effect
            suggestionItem.addEventListener('mouseenter', () => {
                this.currentIndex = index;
                this.updateSuggestionHighlight();
            });
            
            // Click handler
            suggestionItem.addEventListener('click', () => {
                this.replaceWordInInput(suggestion);
            });
            
            suggestionMenu.appendChild(suggestionItem);
        });
        
        // Add event listeners to prevent focus loss and block typing
        document.addEventListener('blur', this.boundHandleBlur, true);
        document.addEventListener('keydown', this.boundPreventFocusChange, true);
        
        // Set menu as visible
        this.menuVisible = true;
        
        // Add keyboard shortcut hints with icons
        const shortcutHint = document.createElement('div');
        Object.assign(shortcutHint.style, {
            fontSize: '12px',
            padding: '8px',
            borderTop: '1px solid #3088fb',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            opacity: '0.9'
        });
            
        // Create the navigation hint (j/k + up/down arrows)
        const navHint = document.createElement('div');
        const navText = document.createElement('span');
        navText.textContent = 'J/K';
        navText.style.fontSize = '12px';
        navText.style.marginRight = '4px';
        navHint.appendChild(navText);
        Object.assign(navHint.style, {
            display: 'flex',
            alignItems: 'center',
            marginRight: '5px',
            fontWeight: 'bold',
            fontSize: '12px'
        });
            
        // Create the select hint (space/enter + enter icon)
        const selectHint = document.createElement('div');
        const selectText = document.createElement('span');
        selectText.textContent = 'Space/Tab';
        selectText.style.fontSize = '12px';
        selectText.style.marginRight = '4px';
        selectHint.appendChild(selectText);
        Object.assign(selectHint.style, {
            display: 'flex',
            alignItems: 'center',
            marginRight: '5px',
            fontWeight: 'bold',
            fontSize: '14px'
        });
            
        // Create the close hint (q/esc + X icon)
        const closeHint = document.createElement('div');
        const closeText = document.createElement('span');
        closeText.textContent = 'Q/Escape';
        closeText.style.fontSize = '12px';
        closeHint.appendChild(closeText);
        Object.assign(closeHint.style, {
            display: 'flex',
            alignItems: 'center',
            fontWeight: 'bold',
            fontSize: '14px'
        });
        
        // Add all hints to the container - selection first, then navigation, then close
        shortcutHint.appendChild(selectHint);
        shortcutHint.appendChild(navHint);
        shortcutHint.appendChild(closeHint);
        suggestionMenu.appendChild(shortcutHint);
        
        // Reset current index
        this.currentIndex = -1;
        
        // Add to DOM
        document.body.appendChild(suggestionMenu);
        this.menuVisible = true;
        
        // Add keyboard navigation
        document.addEventListener('keydown', this.boundNavigateSuggestions);
    }

    /**
     * Get coordinates for cursor position
     * @returns {Object} - {x, y} coordinates
     */
    getCursorCoordinates() {
        const element = this.activeElement;
        
        if (!element) return { x: 100, y: 100 };
        
        // Get element position
        const rect = element.getBoundingClientRect();
        
        // For contenteditable elements
        if (element.getAttribute('contenteditable') === "true") {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const tempRange = range.cloneRange();
                tempRange.collapse(true);
                const tempElement = document.createElement('span');
                tempElement.textContent = '|';
                tempRange.insertNode(tempElement);
                const position = tempElement.getBoundingClientRect();
                tempElement.parentNode.removeChild(tempElement);
                return {
                    x: position.left,
                    y: position.bottom
                };
            }
        }
        
        // For input/textarea elements
        let x = rect.left;
        let y = rect.top;
        
        // Try to position near cursor for input elements
        if (element.selectionStart !== undefined) {
            // Create a dummy element to measure cursor position
            const dummy = document.createElement('div');
            const computed = window.getComputedStyle(element);
            
            // Copy styles to make accurate measurement
            ['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 
             'paddingLeft', 'paddingTop', 'borderLeft', 'borderTop'].forEach(prop => {
                dummy.style[prop] = computed[prop];
            });
            
            dummy.textContent = element.value.substring(0, element.selectionStart);
            dummy.style.position = 'absolute';
            dummy.style.visibility = 'hidden';
            dummy.style.whiteSpace = 'pre-wrap';
            dummy.style.wordWrap = 'break-word';
            dummy.style.width = computed.width;
            
            document.body.appendChild(dummy);
            x = rect.left + dummy.offsetWidth;
            y = rect.top + dummy.offsetHeight;
            document.body.removeChild(dummy);
        }
        
        // Ensure menu stays within viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        x = Math.min(x, viewportWidth - 250);
        y = Math.min(y, viewportHeight - 300);
        
        return { x, y };
    }

    /**
     * Replace the misspelled word with the selected suggestion
     * @param {string} word - The replacement word
     */
    async replaceWordInInput(word) {
        if (!this.activeElement) {
            // console.log('[UIManager] No active element to replace word in');
            return;
        }
        
        // console.log('[UIManager] Replacing word with:', word);
        
        // Store references to elements we're working with
        const activeElement = this.activeElement;
        const isContentEditable = activeElement.getAttribute('contenteditable') === 'true';
        
        // Store the active element's ID or other identifier for debugging
        const elementId = activeElement.id || activeElement.name || 'unknown';
        // console.log('[UIManager] Working with element:', { tag: activeElement.tagName, id: elementId });
        
        try {
            // For contenteditable elements
            if (isContentEditable) {
                // console.log('[UIManager] Handling contenteditable element');
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    range.setStart(range.startContainer, this.wordStartPosition);
                    range.setEnd(range.startContainer, this.wordEndPosition);
                    range.deleteContents();
                    
                    // Insert the word with a space
                    const textNode = document.createTextNode(word + ' ');
                    range.insertNode(textNode);
                    
                    // Move cursor to the end of the inserted text
                    const newRange = document.createRange();
                    newRange.setStart(textNode, textNode.length);
                    newRange.setEnd(textNode, textNode.length);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                }
            } 
            // For regular input/textarea elements
            else {
                // console.log('[UIManager] Handling regular input element');
                const originalValue = activeElement.value;
                const newValue = originalValue.substring(0, this.wordStartPosition) + 
                                 word + ' ' + 
                                 originalValue.substring(this.wordEndPosition);
                
                // Set the new value
                activeElement.value = newValue;
                
                // Set cursor position after the inserted word + space
                const newPosition = this.wordStartPosition + word.length + 1;
                activeElement.setSelectionRange(newPosition, newPosition);
            }
            
            // Make the element editable again
            if (activeElement.hasAttribute('readonly')) {
                activeElement.removeAttribute('readonly');
            }
            
            // Focus the element immediately
            activeElement.focus();
            
            // Clear the menu after successful replacement
            this.closeSuggestionMenu();
            
            // Clear the active element reference
            this.activeElement = null;
            
            // Use a delayed focus to ensure the element stays focused
            setTimeout(() => {
                try {
                    // Only focus if it's not already focused
                    if (document.activeElement !== activeElement) {
                        // console.log('[UIManager] Re-focusing element after timeout');
                        activeElement.focus({ preventScroll: true });
                    }
                    
                    // For contenteditable, ensure the selection is still valid
                    if (isContentEditable && window.getSelection().rangeCount > 0) {
                        const range = window.getSelection().getRangeAt(0);
                        range.collapse(false);
                    }
                } catch (focusError) {
                    console.error('[UIManager] Error in delayed focus:', focusError);
                }
            }, 50);
            
        } catch (error) {
            console.error('[UIManager] Error replacing word:', error);
            
            // Revert to original value if available
            if (this.originalValue) {
                try {
                    if (isContentEditable) {
                        // Safely restore content without using innerHTML
                        activeElement.textContent = this.originalValue;
                    } else {
                        activeElement.value = this.originalValue;
                    }
                } catch (e) {
                    console.error('[UIManager] Error reverting to original value:', e);
                }
            }
            
            // Make the element editable again
            if (activeElement.hasAttribute('readonly')) {
                activeElement.removeAttribute('readonly');
            }
            
            // Clear the menu
            this.closeSuggestionMenu();
            
            // Clear the active element reference
            this.activeElement = null;
            
            // Try to restore focus
            setTimeout(() => {
                try {
                    activeElement.focus({ preventScroll: true });
                } catch (e) {
                    console.error('[UIManager] Error in error handler focus:', e);
                }
            }, 0);
        }
    }

    /**
     * Navigate through suggestions with keyboard
     * @param {KeyboardEvent} e - Keyboard event
     */
    async navigateSuggestions(e) {
        if (!this.menuVisible) return;
        
        // Prevent default for all navigation keys
        if (['j', 'k', 'Enter', 'Tab', ' ', 'Escape', 'q'].includes(e.key)) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
        
        if (e.key === 'j') { // Navigate Down
            if (this.suggestionsArray.length === 0) return;
            this.currentIndex = (this.currentIndex + 1) % this.suggestionsArray.length;
            this.updateSuggestionHighlight();
        } else if (e.key === 'k') { // Navigate Up
            if (this.suggestionsArray.length === 0) return;
            this.currentIndex = (this.currentIndex - 1 + this.suggestionsArray.length) % this.suggestionsArray.length;
            this.updateSuggestionHighlight();
        } else if ((e.key === 'Enter' || e.key === 'Tab' || e.key === ' ') && this.currentIndex >= 0) {
            // Handle word replacement for Enter, Tab, or Space
            const selectedWord = this.suggestionsArray[this.currentIndex];
            await this.replaceWordInInput(selectedWord);
        } else if (e.key === 'Escape' || e.key === 'q') {
            this.closeSuggestionMenu();
        }
    }

    /**
     * Update the highlight on the currently selected suggestion
     */
    updateSuggestionHighlight() {
        const menu = document.getElementById('suggestionMenu');
        if (!menu) return;
        
        Array.from(menu.children).forEach((child, index) => {
            if (child.hasAttribute('data-index')) {
                const itemDataIndex = parseInt(child.getAttribute('data-index'));
                if (itemDataIndex === this.currentIndex) {
                    child.style.backgroundColor = '#3088fb';
                    child.style.color = 'white';
                    
                    // Ensure the selected item is visible (auto-scroll)
                    child.scrollIntoView({ block: 'nearest' });
                } else {
                    child.style.backgroundColor = 'transparent';
                    child.style.color = 'white';
                }
            }
        });
    }

    /**
     * Close the suggestion menu
     */
    closeSuggestionMenu() {
        // console.log('[UIManager] Closing suggestion menu');
        
        // Remove the menu from the DOM if it exists
        const menu = document.getElementById('suggestionMenu');
        if (menu) {
            try {
                menu.remove();
            } catch (e) {
                console.error('[UIManager] Error removing menu:', e);
            }
        }
        
        // Update state
        this.menuVisible = false;
        
        // Remove event listeners
        try {
            document.removeEventListener('keydown', this.boundNavigateSuggestions);
            document.removeEventListener('keydown', this.boundPreventFocusChange, true);
            document.removeEventListener('blur', this.boundHandleBlur, true);
        } catch (e) {
            console.error('[UIManager] Error removing event listeners:', e);
        }
        
        // Don't clear activeElement here - let the replaceWordInInput method handle it
        // This ensures we can still restore focus after the menu is closed
    }
    
    // Alias for closeSuggestionMenu to maintain backward compatibility
    hideSuggestionsMenu() {
        // console.log('[UIManager] Hiding suggestions menu');
        this.closeSuggestionMenu();
    }

    /**
     * Prevent focus change and typing while menu is open
     * @param {KeyboardEvent} e - Keyboard event
     */
    preventFocusChange(e) {
        if (!this.menuVisible) return;
        
        // Allow only navigation keys and menu closing keys
        const allowedKeys = ['j', 'k', 'Enter', 'Tab', ' ', 'Escape', 'q'];
        
        if (!allowedKeys.includes(e.key)) {
            // Block all other keys
            // console.log('[UIManager] Blocking key:', e.key);
            e.preventDefault();
            e.stopPropagation();
        } else if (['Tab', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            // Prevent default behavior for navigation keys
            e.preventDefault();
        }
    }
    
    /**
     * Handle blur events to prevent losing focus while the menu is open
     * @param {FocusEvent} e - Focus event
     */
    handleBlur(e) {
        if (this.menuVisible && this.activeElement && e.target === this.activeElement) {
            // console.log('[UIManager] Preventing blur on active element');
            // Prevent the blur
            e.preventDefault();
            e.stopPropagation();
            
            // Force focus back to the element in the next tick
            setTimeout(() => {
                try {
                    this.activeElement.focus({ preventScroll: true });
                } catch (error) {
                    console.error('[UIManager] Error refocusing element:', error);
                }
            }, 0);
            
            return false;
        }
    }
    
    /**
     * Show a visual indicator when no suggestions are found
     * @param {string} word - The misspelled word with no suggestions
     */
    showNoSuggestionsIndicator(word) {
        // console.log(`[UIManager] Showing no suggestions indicator for: ${word}`);
        this._showIndicator('noSuggestionsIndicator', 'rgba(255,0,0,0.7)', 'rgba(255,0,0,0)', 200);
    }
    
    /**
     * Show a visual indicator when a word is correctly spelled
     * @param {string} word - The correctly spelled word
     */
    showCorrectSpellingIndicator(word) {
        // console.log(`[UIManager] Showing correct spelling indicator for: ${word}`);
        this._showIndicator('correctSpellingIndicator', 'rgba(0,200,0,0.7)', 'rgba(0,200,0,0)', 200);
    }
    
    /**
     * Helper method to show a visual indicator with the specified color
     * @param {string} id - The ID for the indicator element
     * @param {string} centerColor - The center color of the gradient
     * @param {string} edgeColor - The edge color of the gradient
     * @param {number} duration - The animation duration in milliseconds
     * @private
     */
    _showIndicator(id, centerColor, edgeColor, duration) {
        // Create the indicator element
        const indicator = document.createElement('div');
        indicator.setAttribute('id', id);
        
        // Style the indicator as a circle with gradient
        Object.assign(indicator.style, {
            position: 'fixed',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${centerColor} 10%, ${edgeColor} 60%)`,
            zIndex: '9999',
            animation: `pulse ${duration}ms ease-out forwards`,
            pointerEvents: 'none' // Make it non-interactive
        });
        
        // Add the animation style if it doesn't exist yet
        if (!document.getElementById('indicator-animation-style')) {
            const style = document.createElement('style');
            style.setAttribute('id', 'indicator-animation-style');
            style.textContent = `
                @keyframes pulse {
                    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
                    40% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    100% { opacity: 0; transform: translate(-50%, -50%) scale(1.2); }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Add the indicator to the DOM
        document.body.appendChild(indicator);
        
        // Remove the indicator after animation completes
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.remove();
            }
        }, duration);
    }
}

// ===== Main Application =====

// Global instances
const spellChecker = new SpellChecker();
const textProcessor = new TextProcessor();
const uiManager = new UIManager();

/**
 * Initialize the application
 */
async function initialize() {
    try {
        // SpellChecker constructor now calls _initializeWorker(), which starts Nspell worker initialization.
        // There's no separate main-thread Typo to initialize anymore.
        // We can await the worker initialization here if we want to ensure it's done before other things,
        // or rely on individual methods like .check() and .suggest() to await it.
        // For simplicity, let's assume methods will handle awaiting worker readiness.
        
        // Initialize other modules
        textProcessor.initialize(); // Assuming this doesn't depend on spellChecker being fully ready.
        
        // console.log("SpellCheck Fixer addon (Nspell) initialization process started.");
    } catch (error) {
        console.error("Failed to initialize SpellCheck Fixer (Nspell):", error);
    }
}

/**
 * Handle keyboard shortcut to check spelling
 * @param {KeyboardEvent} e - Keyboard event
 */
function handleSpellCheckShortcut(e) {
    // Check if the shortcut is pressed (Ctrl+Space)
    if (e.ctrlKey && e.key === " ") {
        e.preventDefault();
        checkSpellingAtCursor();
    }
}

/**
 * Check spelling at the current cursor position
 */
function checkSpellingAtCursor() {
    // Get the current word at cursor
    const { word, start, end, element } = textProcessor.getCurrentWordAtCursor();
    
    // If we have a word, check its spelling
    if (word && element) {
        checkSpellingAndShowSuggestions(word, start, end);
    }
}

/**
 * Check spelling and show suggestions if needed
 * @param {string} word - Word to check
 * @param {number} start - Start position of the word
 * @param {number} end - End position of the word
 */
async function checkSpellingAndShowSuggestions(word, start, end) {
    try {
        // console.log('Starting spell check for word:', word);
        
        // Check if the word is spelled correctly (now async)
        const isCorrect = await spellChecker.check(word);
        // console.log('Spell check result for', word, ':', isCorrect);
        
        if (!isCorrect) {
            // console.log(`Misspelled word found (Nspell): ${word}`);
            try {
                // console.log('Fetching suggestions for:', word);
                const suggestions = await spellChecker.suggest(word);
                // console.log('Received suggestions:', suggestions);
                
                if (suggestions && suggestions.length > 0) {
                    // console.log('Displaying suggestions menu with:', suggestions);
                    uiManager.displaySuggestionsMenu(suggestions, start, end);
                    // console.log('Menu should now be visible');
                } else {
                    // console.log(`No suggestions found for ${word} (Nspell)`);
                    uiManager.hideSuggestionsMenu();
                    // Show the no suggestions indicator
                    uiManager.showNoSuggestionsIndicator(word);
                }
            } catch (suggestError) {
                console.error('Error getting suggestions:', suggestError);
                uiManager.hideSuggestionsMenu();
            }
        } else {
            // console.log('Word is spelled correctly, hiding menu');
            uiManager.hideSuggestionsMenu();
            // Show the correct spelling indicator
            uiManager.showCorrectSpellingIndicator(word);
        }
    } catch (error) {
        console.error('Error in checkSpellingAndShowSuggestions:', error);
        uiManager.hideSuggestionsMenu();
    }
}

// Set up message listener for command from background script
browser.runtime.onMessage.addListener((message) => {
    if (message.action === "checkSpelling") {
        checkSpellingAtCursor();
    }
});

// Add event listener for keyboard shortcut
document.addEventListener('keydown', handleSpellCheckShortcut);

// Start initialization
initialize();
