// spellcheck_worker.js

// Import the NSpell bundle
console.log("SpellCheck Worker: About to import nspell-bundle.js");
try {
    importScripts('nspell-bundle.js');
    console.log("SpellCheck Worker: Successfully imported nspell-bundle.js");
} catch (error) {
    console.error("SpellCheck Worker: Failed to import nspell-bundle.js", error);
    throw error; // Rethrow to prevent further execution
}

let nspellInstance;
let nspellInitialized = false;

self.onmessage = async function(event) {
    const { action, payload, requestId } = event.data;

    if (action === 'init') {
        if (nspellInitialized) {
            self.postMessage({ action: 'initComplete', success: true, requestId: 'worker_init' });
            return;
        }
        try {
            const affURL = payload.affURL;
            const dicURL = payload.dicURL;

            if (!affURL || !dicURL) {
                throw new Error('AFF and DIC URLs must be provided for Nspell initialization.');
            }

            console.log("SpellCheck Worker: Fetching dictionary files from", { affURL, dicURL });
            const [affData, dicData] = await Promise.all([
                fetch(affURL).then((res) => res.text()),
                fetch(dicURL).then((res) => res.text()),
            ]);
            
            console.log("SpellCheck Worker: Dictionary files fetched, aff length:", affData.length, "dic length:", dicData.length);
            
            // Nspell constructor expects an object with 'aff' and 'dic' properties containing the file content
            console.log("SpellCheck Worker: Creating nspell instance");
            nspellInstance = nspell({ aff: affData, dic: dicData });
            console.log("SpellCheck Worker: Nspell instance created successfully"); 
            nspellInitialized = true;
            console.log("SpellCheck Worker: Nspell initialized successfully");
            self.postMessage({ action: 'initComplete', success: true, requestId: 'worker_init' });
        } catch (error) {
            console.error("SpellCheck Worker: Failed to initialize Nspell", error);
            self.postMessage({ action: 'initComplete', success: false, error: error.message, requestId: 'worker_init' });
        }
    } else if (action === 'suggest') {
        if (!nspellInitialized || !nspellInstance) {
            self.postMessage({
                action: 'suggestionResult',
                requestId: requestId,
                suggestions: [],
                error: 'Nspell Worker not initialized'
            });
            return;
        }
        try {
            const { word, limit, requestId } = payload;
            if (!requestId) {
                console.error('SpellCheck Worker: Missing requestId in suggest action');
                return;
            }
            const startTime = performance.now();
            
            console.log(`SpellCheck Worker: Getting suggestions for "${word}"`);
            const startSuggestTime = performance.now();
            let suggestions = nspellInstance.suggest(word);
            const suggestTime = performance.now() - startSuggestTime;
            
            // Nspell suggestions are generally good, but apply limit if needed and filter numbers
            if (suggestions && suggestions.length > 0) {
                const filterStart = performance.now();
                suggestions = suggestions.filter(s => !/\d/.test(s)); // Filter numbers
                const filterTime = performance.now() - filterStart;
                
                const limitStart = performance.now();
                if (limit && suggestions.length > limit) {
                    suggestions = suggestions.slice(0, limit);
                }
                const limitTime = performance.now() - limitStart;
                
                const totalTime = performance.now() - startTime;
                
                console.group('SpellCheck Worker: Suggestion Performance');
                console.log(`Word: "${word}"`);
                console.log(`Suggestions (${suggestions.length}):`, suggestions);
                console.log(`--- Timing (ms) ---`);
                console.log(`Suggestions generation: ${suggestTime.toFixed(2)}`);
                console.log(`Number filtering: ${filterTime.toFixed(2)}`);
                console.log(`Limit application: ${limitTime.toFixed(2)}`);
                console.log(`Total time: ${totalTime.toFixed(2)}`);
                console.groupEnd();
            } else {
                const totalTime = performance.now() - startTime;
                console.log(`SpellCheck Worker: No suggestions found for "${word}" (took ${totalTime.toFixed(2)}ms)`);
            }

            console.log(`SpellCheck Worker: Sending back ${suggestions.length} suggestions for request ${requestId}`);
            self.postMessage({
                action: 'suggestionResult',
                requestId: requestId,  // Make sure this matches the request ID
                suggestions: suggestions || []
            });
        } catch (error) {
            console.error("SpellCheck Worker (Nspell): Error during suggestion for " + payload.word, error);
            self.postMessage({
                action: 'suggestionResult',
                requestId: requestId,
                suggestions: [],
                error: error.message
            });
        }
    } else if (action === 'check') {
        if (!nspellInitialized || !nspellInstance) {
            self.postMessage({
                action: 'checkResult',
                requestId: requestId,
                isCorrect: true, // Assume correct if not initialized, to avoid blocking
                error: 'Nspell Worker not initialized'
            });
            return;
        }
        try {
            const { word } = payload;
            const isCorrect = nspellInstance.correct(word);
            self.postMessage({
                action: 'checkResult',
                requestId: requestId,
                isCorrect: isCorrect
            });
        } catch (error) {
            console.error("SpellCheck Worker (Nspell): Error during check for " + payload.word, error);
            self.postMessage({
                action: 'checkResult',
                requestId: requestId,
                isCorrect: true, // Assume correct on error
                error: error.message
            });
        }
    }
};

console.log("SpellCheck Worker (Nspell): Loaded and awaiting messages.");
