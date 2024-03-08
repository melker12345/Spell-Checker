/*
##GOAL: 
This browser extension that checks spelling and provides suggestions for the word that is being checked.

- Register keypresses and take in the word before the cursor. [DONE]
- Check spelling of the word to the left of the cursor position. [DONE]
- On keypress a menu should open containing the 4 best suggestions. [DONE]
- On selection of a suggestion the word should be replaced with the selected suggestion. [DONE]

##FIX:
- If not in a text input field, it should not log anything to the console. [FIXED]
  - It currently logs the wole text within the page content to the console. 

- On Windows: uncaught exception: Dictionary not loaded. line 99.[ ]
  - This might be because firefow on windows already have crtl+1 as a shortcut (should not be).
  
  - What's the difference between firefox on windows and on linux?
    - Why does it work on linux but not on windows?
    - How does windows effect the addons?
      - Different versions of firefox?  

- The menu should be positioned in the center of the screen. [FIXED]
- Menu need to be cleared if no word is selected. [ ]
- Cycle through the suggestions using the h j k l keys and choose selection with space or enter. [ ]
  - Indecate the selected suggestion border 1px solid. [ ]
- Escape should close the menu and not replace the word. [ ]

##INFO:

- What i mean by check spelling is that on what ever word the user presses Ctrl+1, the word should be checked for spelling and the 4 best suggestions should be displayed in a menu in the center of the screen.
- the typo.js file is a library that is used to check spelling.
- the en_us.aff and en_us.dic files are used by the typo.js library to check spelling.
- the typo.js library is attached to the window object.

- I want to use the typo.js library to check spelling.
- If the user presses Ctrl+1, I want to open a menu with the 4 best suggestions e.i the 4 words closest to the word that is being checked.

*/

let typo;

async function loadDictionary() {
  const affData = await fetch(browser.runtime.getURL("en_us.aff")).then(
    (response) => response.text().catch((error) => console.log("error: ", error))
  );
  const dicData = await fetch(browser.runtime.getURL("en_US.dic")).then(
    (response) => response.text().catch((error) => console.log("error: ", error))
  );
  
  console.log("Typo: ", Typo);
  if (Typo !== undefined) {
    typo = new Typo("en_US", affData, dicData, { platform: "any" });
    console.log("Typo is attached to the window.");
  } else {
    console.log("Typo is not attached to the window.");
  }
}
console.log("Typo:");

// once i call this function, AbortError: The operation was aborted. 
// my guess is that the fetch request is being aborted
loadDictionary();

document.addEventListener("keydown", async (event) => {
  if (event.ctrlKey && event.key === "1") {
    console.log("Ctrl+1 was pressed");

    const activeElement = document.activeElement;
    let cursorPosition = activeElement.selectionStart;

    let text = activeElement.value;
    let wordDetails = findWordAtPosition(text, cursorPosition);
    console.log("word: ", wordDetails.word);

    if (wordDetails && wordDetails.word && typo) {
      let suggestions = typo.suggest(wordDetails.word, 4); // Get top 4 suggestions

      if (suggestions.length > 0) {
       

        // Create a suggestions menu
        const suggestionsMenu = createSuggestionsMenu(
          suggestions,
          (selectedSuggestion) => {
            replaceWordAtPosition(
              activeElement,
              wordDetails.start,
              wordDetails.end,
              selectedSuggestion
            );
          }
        );

        // Append the suggestions menu to the body
        document.body.appendChild(suggestionsMenu);
      }
    }
  }
}); // on Windows: uncaught exception: Dictionary not loaded.

function findWordAtPosition(text, position) {
  let start = text.lastIndexOf(" ", position - 1) + 1;
  let end = text.indexOf(" ", position);
  end = end === -1 ? text.length : end;
  return { word: text.substring(start, end), start, end };
}

function replaceWordAtPosition(element, start, end, newWord) {
  let text = element.value || element.textContent;
  let newText = text.substring(0, start) + newWord + text.substring(end);
  if ("value" in element) {
    element.value = newText;
  } else {
    element.textContent = newText;
  }
}

function createSuggestionsMenu(suggestions, callback) {
  const menu = document.createElement("div");
  // Set menu styles to position it appropriately on the page
  menu.style.position = "absolute";
  menu.style.left = "50%";
  menu.style.top = "50%";
  menu.style.transform = "translate(-50%, -50%)";
  menu.style.backgroundColor = "white";
  menu.style.border = "1px solid black";
  menu.style.fontSize = "22px";
  menu.style.padding = "5px 20px";

  suggestions.forEach((suggestion) => {
    const item = document.createElement("div");
    item.textContent = suggestion;
    item.style.cursor = "pointer";
    item.addEventListener("click", () => {
      callback(suggestion);
      document.body.removeChild(menu); // Remove the menu after selection
    });
    menu.appendChild(item);
  });

  document.body.appendChild(menu);
}
console.log(
  "this is an indecation of the contentScript.js file being loaded.",
  typo
);
