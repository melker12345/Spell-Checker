/**
 * SpellCheck Fixer - Background Script
 * 
 * Handles keyboard shortcuts and sends messages to the content script
 */

// Listen for keyboard shortcut command
browser.commands.onCommand.addListener((command) => {
  if (command === "fix-spelling") {
    // Get the active tab
    browser.tabs.query({active: true, currentWindow: true}).then((tabs) => {
      // Send message to the content script
      browser.tabs.sendMessage(tabs[0].id, {
        action: "checkSpelling"
      }).catch(error => {
        console.error("Error sending message to content script:", error);
      });
    }).catch(error => {
      console.error("Error querying tabs:", error);
    });
  }
});

// Log when the addon is loaded
console.log("SpellCheck Fixer background script loaded");
