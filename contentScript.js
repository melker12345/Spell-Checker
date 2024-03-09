
let typo;

async function initializeTypo() {
    const affURL = browser.runtime.getURL("en_US.aff");
    const dicURL = browser.runtime.getURL("en_US.dic");
    try {
        const [affData, dicData] = await Promise.all([
            fetch(affURL).then((res) => res.text()),
            fetch(dicURL).then((res) => res.text()),
        ]);

        // Initialize Typo.js with loaded dictionary data and assign it to the global variable
        typo = new Typo("en_US", affData, dicData);
        console.log("Typo initialized successfully");
    } catch (error) {
        console.error("Failed to load and initialize Typo.js:", error);
    }
}

// Ensure Typo.js initialization is triggered as soon as possible.
initializeTypo();



async function loadDictionaryFiles() {
    try {
        const [affData, dicData] = await Promise.all([
            fetch(chrome.runtime.getURL("en_US.aff")).then((response) =>
                response.text()
            ),
            fetch(chrome.runtime.getURL("en_US.dic")).then((response) =>
                response.text()
            ),
        ]);

        // Initialize Typo.js with loaded dictionary data
        window.typo = new Typo("en_US", affData, dicData);
    } catch (error) {
        console.error("Failed to load and initialize Typo.js:", error);
    }
}

document.addEventListener("DOMContentLoaded", function () {
    // Loading dictionary files
    loadDictionaryFiles();
});


document.addEventListener("keydown", function (e) {
    // Check if the focus is on a text input field or textarea.
    if (!isTextInputField(document.activeElement)) {
        return; // Do nothing if it's not a text input field.
    }

    // Detect Ctrl+Alt+D keystroke.
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "d") {
        e.preventDefault(); // Prevent the default action for this combination.
        const cursorPosition = document.activeElement.selectionStart;
        const textValue = document.activeElement.value;
        const wordToLeft = getWordToLeftOfCursor(textValue, cursorPosition);

        if (wordToLeft.word) {
          checkSpellingAndGetSuggestions(wordToLeft.word, wordToLeft.start, wordToLeft.end);
        }
    }
});
function isTextInputField(element) {
    return (
        element.tagName.toLowerCase() === "input" ||
        element.tagName.toLowerCase() === "textarea"
    );
}

function getWordToLeftOfCursor(text, position) {
    const leftText = text.substring(0, position);
    const start = leftText.search(/\S+$/); // Find the start of the last word to the left of the cursor
    const end = position;
    const word = leftText.substring(start, position);
    return { word, start, end };
}

function checkSpellingAndGetSuggestions(word, start, end) {
  // Ensure `typo` is defined before attempting to use it.
  if (typeof typo !== "undefined" && typo.check) {
      if (!typo.check(word)) {
          const suggestions = typo.suggest(word, 4); // Get up to 4 suggestions.
          displaySuggestionsMenu(suggestions, start, end);
      }
  } else {
      console.error('Typo.js is not fully initialized.');
  }
}
let currentIndex = -1; // Global index to keep track of the current selected suggestion
let suggestionsArray = []; // Global array to keep the suggestions
let wordStartPosition;
let wordEndPosition;

function displaySuggestionsMenu(suggestions, start, end) {
    // Keeping reference for replacing the word
    wordStartPosition = start;
    wordEndPosition = end;

    // Create suggestion menu container
    const suggestionMenu = document.createElement("div");
    suggestionMenu.setAttribute("id", "suggestionMenu");
    suggestionMenu.style.position = "absolute";
    suggestionMenu.style.top = "50%";
    suggestionMenu.style.left = "50%";
    suggestionMenu.style.transform = "translate(-50%, -50%)";
    suggestionMenu.style.zIndex = "10000";
    
    suggestionMenu.style.textAlign = "center";
    suggestionMenu.style.display = "border-box";
    suggestionMenu.style.border = "#3088fb solid 1px";
    suggestionMenu.style.backgroundColor = "black";
    suggestionMenu.style.width = "325px";
    
    suggestionMenu.style.color = "#FFF";
    suggestionMenu.style.padding = "25px";
    suggestionMenu.style.fontSize = "28px";
    


    // Add suggestions to the menu
    suggestions.forEach((suggestion, index) => {
        const suggestionItem = document.createElement("div");
        suggestionItem.textContent = suggestion;
        suggestionItem.setAttribute("data-index", index);
        suggestionItem.style.margin = "10px";

        suggestionItem.addEventListener("click", () => {
            replaceWordInInput(suggestion, wordStartPosition, wordEndPosition);
            closeSuggestionMenu();
        });

        suggestionMenu.appendChild(suggestionItem);
    });

    currentIndex = -1; // Reset for new suggestions
    suggestionsArray = suggestions; // Store suggestions globally
    document.body.appendChild(suggestionMenu);

    // Registering keydown event listener for navigation in suggestions
    document.addEventListener("keydown", navigateSuggestions);
}

function replaceWordInInput(word, start, end) {
    const inputElem = document.activeElement;
    const originalValue = inputElem.value;
    const newValue =
        originalValue.substring(0, start) + word + originalValue.substring(end);
    inputElem.value = newValue;
    const newPosition = start + word.length;
    inputElem.setSelectionRange(newPosition, newPosition);
}

function navigateSuggestions(e) {
    if (e.key === "j") {
        // Move down
        e.preventDefault();
        currentIndex = (currentIndex + 1) % suggestionsArray.length;
        updateSuggestionHighlight();
    } else if (e.key === "k") {
        // Move up
        e.preventDefault();
        currentIndex =
            (currentIndex - 1 + suggestionsArray.length) %
            suggestionsArray.length;
        updateSuggestionHighlight();
    } else if (e.key === " " && currentIndex >= 0) {
        // Space to select
        e.preventDefault();
        replaceWordInInput(
            suggestionsArray[currentIndex],
            wordStartPosition,
            wordEndPosition
        );
        closeSuggestionMenu();
    }
}

function updateSuggestionHighlight() {
    const menu = document.getElementById("suggestionMenu");
    if (!menu) return;

    Array.from(menu.children).forEach((child, index) => {
        if (index === currentIndex) {
            child.style.border = "1px solid blue";
        } else {
            child.style.border = "none";
        }
    });
}

function closeSuggestionMenu() {
    const menu = document.getElementById("suggestionMenu");
    if (menu) {
        menu.remove();
    }
    document.removeEventListener("keydown", navigateSuggestions); // Important to remove the listener
}
