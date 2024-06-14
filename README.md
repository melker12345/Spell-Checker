
# Browser Extension for Spell Checking

This browser extension integrates Typo.js for spell checking within text inputs on web pages using a keyboard shortcut, `Ctrl`+`Space` by default. The shortcut will open a menu with the suggested words if the word is misspelled.

## Features

- **Spell Checking**: Automatically check the spelling of the word to the left of the cursor in a text input field.
- **Suggestions Menu**: Display a menu with up to 4 spelling suggestions for the identified word.
- **Easy Navigation**: Navigate through the suggestions and select a word for replacement.
- The extension checks spelling only within text input fields or text areas.

## How to Use

1. **Trigger Spell Check**: Place the cursor to the right of a word in a text input field. Press `Ctrl`+`Space` to check the spelling of that word.
2. **Navigate Suggestions**: If there are spelling suggestions, they will be displayed in a menu at the center of the screen. Use the following keys to navigate:
    - `j`: Move down through the list of suggestions.
    - `k`: Move up through the list of suggestions.
3. **Select a Suggestion**: To replace the word with a selected suggestion, navigate to the desired suggestion using `j` and `k`, then press `Space`, `Enter`, or `Tab` to select it. Press `Esc` to close the menu.

## Troubleshooting

- **Extension Not Working**: Check if the extension has the necessary permissions and is activated for the website you're using.
- **Not Working in Certain Input Fields**: There are a couple of cases where the add-on may not work:
    1. If the website's input field Content Security Policy (CSP) doesn't allow it.
    2. Modern frameworks might cause it to not work due to the Shadow DOM.
