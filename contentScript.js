/*
goal: 
- check spelling of the word to the left of the cursor position
- on keypress a menu should open containing the 4 best suggestions
- on selection of a suggestion the word should be replaced with the selected suggestion 
*/

let typo;

async function loadDictionary() {
  const affData = await fetch(browser.runtime.getURL('/en_US.aff')).then(response => response.text());
  const dicData = await fetch(browser.runtime.getURL('/en_US.dic')).then(response => response.text());
  
  typo = new Typo("en_US", affData, dicData, { platform: 'any' });
}

loadDictionary();

document.addEventListener('keydown', async (event) => {
  if (event.ctrlKey && event.altKey && event.key === 'U') {
    const activeElement = document.activeElement;
    let cursorPosition = activeElement.selectionStart;
    let text = activeElement.value || activeElement.textContent;
    
    let wordDetails = findWordAtPosition(text, cursorPosition);
    
    if (wordDetails && wordDetails.word && typo) {
      let suggestions = typo.suggest(wordDetails.word, 4); // Get top 4 suggestions
      
      if (suggestions.length > 0) {
        // Here, implement opening a menu with suggestions
        // This could involve creating a custom HTML element and appending it to the body
        // Each suggestion would be a clickable element within this menu
        // On click, you would call replaceWordAtPosition with the clicked suggestion
      }
    }
  }
});


function findWordAtPosition(text, position) {
  let start = text.lastIndexOf(' ', position - 1) + 1;
  let end = text.indexOf(' ', position);
  end = end === -1 ? text.length : end;
  return { word: text.substring(start, end), start, end };
}

function replaceWordAtPosition(element, start, end, newWord) {
  let text = element.value || element.textContent;
  let newText = text.substring(0, start) + newWord + text.substring(end);
  if ('value' in element) {
    element.value = newText;
  } else {
    element.textContent = newText;
  }
}

function createSuggestionsMenu(suggestions, callback) {
  const menu = document.createElement('div');
  // Set menu styles to position it appropriately on the page
  menu.style.position = 'absolute';
  menu.style.left = '100px'; // Adjust as necessary
  menu.style.top = '100px'; // Adjust as necessary
  menu.style.backgroundColor = 'white';
  menu.style.border = '1px solid black';
  menu.style.padding = '5px';
  
  suggestions.forEach(suggestion => {
    const item = document.createElement('div');
    item.textContent = suggestion;
    item.style.cursor = 'pointer';
    item.addEventListener('click', () => {
      callback(suggestion);
      document.body.removeChild(menu); // Remove the menu after selection
    });
    menu.appendChild(item);
  });
  
  document.body.appendChild(menu);
}

