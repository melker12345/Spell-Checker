/*
FEATURES TO ADD:
- User should be able to press ``Esc`` to close the suggestion menu.
- User should be able to press ``Enter`` to select a suggestion.
- If no suggestions are available, the suggestion menu should not be displayed. 

- When menu is open 
 - The user should not be able to type in the input field.
 - The user should not be able to switch "focusable area" using the keyboard. 


LOW PRIORITY FEATURES DON'T ADD NOW:
- Load time for longer words are a bit slow.
- Allow the user to set the keybinding for opening the suggestion menu and navigating the menu.
 - This could be set in the settings for the add-on.

*/

let typo;

async function initializeTypo() {
    const affURL = browser.runtime.getURL("en_US.aff");
    const dicURL = browser.runtime.getURL("en_US.dic");
    try {
        const [affData, dicData] = await Promise.all([
            fetch(affURL).then((res) => res.text()),
            fetch(dicURL).then((res) => res.text()),
        ]);

        typo = new Typo("en_US", affData, dicData);
        console.log("Typo initialized successfully");
    } catch (error) {
        console.error("Failed to load and initialize Typo.js:", error);
    }
}

initializeTypo();

async function loadDictionaryFiles() {
    try {
        const [affData, dicData] = await Promise.all([
            fetch(chrome.runtime.getURL("en_US.aff")).then(response => response.text()),
            fetch(chrome.runtime.getURL("en_US.dic")).then(response => response.text()),
        ]);

        window.typo = new Typo("en_US", affData, dicData);
    } catch (error) {
        console.error("Failed to load and initialize Typo.js:", error);
    }
}

document.addEventListener("DOMContentLoaded", loadDictionaryFiles);

document.addEventListener("keydown", function (e) {
    if (!isTextInputField(document.activeElement)) return;

    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        const cursorPosition = document.activeElement.selectionStart;
        const textValue = document.activeElement.value;
        const wordToLeft = getWordToLeftOfCursor(textValue, cursorPosition);

        if (wordToLeft.word) {
            checkSpellingAndGetSuggestions(wordToLeft.word, wordToLeft.start, wordToLeft.end);
        }
    }
});

function isTextInputField(element) {
    return ['input', 'textarea'].includes(element.tagName.toLowerCase());
}

function getWordToLeftOfCursor(text, position) {
    const leftText = text.substring(0, position);
    const start = leftText.search(/\S+$/); // Find the start of the last word to the left of the cursor
    const end = position;
    const word = leftText.substring(start, position);
    return { word, start, end };
}

function checkSpellingAndGetSuggestions(word, start, end) {
    if (typeof typo !== "undefined" && typo.check) {
        if (!typo.check(word)) {
            const suggestions = typo.suggest(word, 4);
            if (suggestions.length > 0) {
                displaySuggestionsMenu(suggestions, start, end);
            }
        }
    } else {
        console.error('Typo.js is not fully initialized.');
    }
}

// Global variables for suggestion menu
let currentIndex = -1;
let suggestionsArray = [];
let wordStartPosition;
let wordEndPosition;

function displaySuggestionsMenu(suggestions, start, end) {
    // Prevent typing and focus change
    const inputElem = document.activeElement;
    inputElem.setAttribute('readonly', true);
    document.addEventListener('keydown', preventFocusChange);

    // Menu setup
    wordStartPosition = start;
    wordEndPosition = end;
    const suggestionMenu = document.createElement('div');
    suggestionMenu.setAttribute('id', 'suggestionMenu');
    suggestionMenu.style.position = 'absolute';
    suggestionMenu.style.top = '50%';
    suggestionMenu.style.left = '50%';
    suggestionMenu.style.transform = 'translate(-50%, -50%)';
    suggestionMenu.style.zIndex = '10000';
    suggestionMenu.style.textAlign = 'center';
    suggestionMenu.style.display = 'border-box';
    suggestionMenu.style.border = '#3088fb solid 1px';
    suggestionMenu.style.backgroundColor = 'black';
    suggestionMenu.style.width = '200px';
    suggestionMenu.style.color = '#FFF';
    suggestionMenu.style.padding = '0px 25px';
    suggestionMenu.style.fontSize = '24px';

    suggestions.forEach((suggestion, index) => {
        const suggestionItem = document.createElement('div');
        suggestionItem.textContent = suggestion;
        suggestionItem.setAttribute('data-index', index);
        suggestionItem.style.margin = '10px';

        suggestionItem.addEventListener('click', () => {
            replaceWordInInput(suggestion, wordStartPosition, wordEndPosition);
            closeSuggestionMenu();
        });

        suggestionMenu.appendChild(suggestionItem);
    });

    currentIndex = -1;
    suggestionsArray = suggestions;
    document.body.appendChild(suggestionMenu);

    document.addEventListener('keydown', navigateSuggestions);
}

function replaceWordInInput(word, start, end) {
    const inputElem = document.activeElement;
    const originalValue = inputElem.value;
    const newValue = originalValue.substring(0, start) + word + originalValue.substring(end);
    inputElem.value = newValue;
    const newPosition = start + word.length;
    inputElem.setSelectionRange(newPosition, newPosition);
}

function navigateSuggestions(e) {
    if (e.key === 'j') {
        e.preventDefault();
        currentIndex = (currentIndex + 1) % suggestionsArray.length;
        updateSuggestionHighlight();
    } else if (e.key === 'k') {
        e.preventDefault();
        currentIndex = (currentIndex - 1 + suggestionsArray.length) % suggestionsArray.length;
        updateSuggestionHighlight();
    } else if (e.key === 'Enter' && currentIndex >= 0) {
        e.preventDefault();
        replaceWordInInput(suggestionsArray[currentIndex], wordStartPosition, wordEndPosition);
        closeSuggestionMenu();
    }else if (e.key === 'Tab' && currentIndex >= 0) {
        e.preventDefault();
        replaceWordInInput(suggestionsArray[currentIndex], wordStartPosition, wordEndPosition);
        closeSuggestionMenu();
    }else if (e.key === ' ' && currentIndex >= 0) {
        e.preventDefault();
        replaceWordInInput(suggestionsArray[currentIndex], wordStartPosition, wordEndPosition);
        closeSuggestionMenu();
    }
}

function updateSuggestionHighlight() {
    const menu = document.getElementById('suggestionMenu');
    Array.from(menu.children).forEach((child, index) => {
        child.style.border = index === currentIndex ? '1px solid blue' : 'none';
    });
}

function closeSuggestionMenu() {
    const inputElem = document.activeElement;
    inputElem.removeAttribute('readonly');

    const menu = document.getElementById('suggestionMenu');
    if (menu) menu.remove();
    document.removeEventListener('keydown', navigateSuggestions);
    document.removeEventListener('keydown', preventFocusChange);
}

function preventFocusChange(e) {
    if (['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
    }
}

document.addEventListener('keydown', function(event) {
    if (event.key === "Escape") {
      closeSuggestionMenu();
    } else if (event.key === "q"){
        event.preventDefault();
        closeSuggestionMenu();
    }
});