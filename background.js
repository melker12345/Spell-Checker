
// listen for our browserAction to be clicked and send the message to the content script to check spelling
browser.commands.onCommand.addListener((command) => {
  if (command === "fix-spelling") {
    browser.tabs.query({active: true, currentWindow: true}).then((tabs) => {
      browser.tabs.sendMessage(tabs[0].id, {
        action: "checkSpelling"
      });
    });
  }
});
