# Browser Extension for Spell Checking

This browser extension integrates Typo.js for spell checking within text inputs on web pages using a keyboard shortcut. `Ctrl`+`Alt`+`D` by default; you might have to change it. The shortcut will open a menu with the suggested words if the word is misspelled.

Currently, you have to clone the repo and load it as a temporary add-on. To load the add-on, go to `about:debugging#/runtime/this-firefox` and click on `Load Temporary Add-on…`, select the `manifest.json`. Make sure to allow the add-on to run on sites with restrictions.

## Features

- **Spell Checking**: Automatically check the spelling of the word to the left of the cursor in a text input field.
- **Suggestions Menu**: Display a menu with up to 4 spelling suggestions for the identified word.
- **Easy Navigation**: Navigate through the suggestions and select a word for replacement.
- The extension checks spelling only within text input fields or text areas.

## How to Use

1. **Trigger Spell Check**: Place the cursor to the right of a word in a text input field. Press `Ctrl`+`Alt`+`D` to check the spelling of that word. (You might need to change the keybinding).
2. **Navigate Suggestions**: If there are spelling suggestions, they will be displayed in a menu at the center of the screen. Use the following keys to navigate:
    - `j`: Move down through the list of suggestions.
    - `k`: Move up through the list of suggestions.
3. **Select a Suggestion**: To replace the word with a selected suggestion, navigate to the desired suggestion using `j` and `k`, then press `Space` to select it.

## Troubleshooting

- **Nothing happening**: "Typo initialized successfully" is the only thing being logged, If the initialization was successful (fresh install works half the time), you might need to remap what keys are being used.
    - **Remapping Keys**: Change `if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "d")` line 58 in contentScript.js and in manifest.json.  
- **Typo.js Not Initialized**: Ensure that all necessary files (`typo.js`, `en_us.aff`, `en_us.dic`) are correctly placed within the extension directory and properly referenced in manifest.json.
- **Extension Not Working**: Check if the extension has the necessary permissions and is activated for the website you're using.

---
