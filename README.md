# Browser Extension for Spell Checking

This browser extension integrates Typo.js for spell checking within text inputs on web pages using a keyboard shortcut. `Ctrl`+`<Space>` by default. The shortcut will open a menu with the suggested words if the word is misspelled.

## Features

- **Spell Checking**: Automatically check the spelling of the word to the left of the cursor in a text input field.
- **Suggestions Menu**: Display a menu with up to 4 spelling suggestions for the identified word.
- **Easy Navigation**: Navigate through the suggestions and select a word for replacement.
- The extension checks spelling only within text input fields or text areas.

## How to Use

1. **Trigger Spell Check**: Place the cursor to the right of a word in a text input field. Press `Ctrl`+` ` to check the spelling of that word. (You might need to change the keybinding).
2. **Navigate Suggestions**: If there are spelling suggestions, they will be displayed in a menu at the center of the screen. Use the following keys to navigate:
    - `j`: Move down through the list of suggestions.
    - `k`: Move up through the list of suggestions.
3. **Select a Suggestion**: To replace the word with a selected suggestion, navigate to the desired suggestion using `j` and `k`, then press `Space`, `Enter` or `Tab` to select it. `Esc` will close the menu. 

## Troubleshooting
- **Extension Not Working**: Check if the extension has the necessary permissions and is activated for the website you're using.
- **Not working in certain input fealds** There are a cuple reasons as to why it dont work in certain input feilds
    1. Content Security Policy (CSP)
    2. ShadowDOM currently 
---
