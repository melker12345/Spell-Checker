// nspell.js - Simple browser-compatible version of Nspell
// Based on https://github.com/wooorm/nspell
// MIT License

(function(root) {
  'use strict';

  // Main nspell constructor
  function nspell(options) {
    if (!(this instanceof nspell)) {
      return new nspell(options);
    }

    var dic = options.dic;
    var aff = options.aff;

    if (!dic) throw new Error('Missing `dic` in options');
    if (!aff) throw new Error('Missing `aff` in options');

    console.log('Nspell: Parsing dictionary and affix files');
    this.dictionary = parseDictionary(dic);
    this.affixRules = parseAffixFile(aff);
    console.log('Nspell: Parsing complete, dictionary size:', Object.keys(this.dictionary).length);
  }

  // Add to global scope
  root.nspell = nspell;

  // Prototype methods
  nspell.prototype.correct = function(word) {
    if (!word) return true;
    if (word.length <= 1) return true;
    
    word = word.toLowerCase();
    
    // Skip non-word characters or words with numbers
    if (!/^[a-z'\-]+$/i.test(word) || /\d/.test(word)) return true;
    
    // Check if word is in dictionary
    if (this.dictionary[word]) return true;
    
    // Check compound words
    if (word.includes('-')) {
      var parts = word.split('-');
      var allPartsCorrect = true;
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].length > 0 && !this.correct(parts[i])) {
          allPartsCorrect = false;
          break;
        }
      }
      if (allPartsCorrect) return true;
    }
    
    // Check common word forms
    var forms = getWordForms(word);
    for (var i = 0; i < forms.length; i++) {
      if (this.dictionary[forms[i]]) return true;
    }
    
    return false;
  };

  nspell.prototype.suggest = function(word) {
    if (!word) return [];
    if (this.correct(word)) return [word];
    
    word = word.toLowerCase();
    var suggestions = [];
    
    // Add basic suggestions - edit distance 1
    var edits1 = getEditDistance1(word);
    for (var i = 0; i < edits1.length; i++) {
      if (this.correct(edits1[i])) {
        suggestions.push(edits1[i]);
      }
    }
    
    // If we don't have enough suggestions, try edit distance 2
    if (suggestions.length < 5) {
      for (var i = 0; i < Math.min(edits1.length, 50); i++) { // Limit to 50 to avoid excessive processing
        var moreEdits = getEditDistance1(edits1[i]);
        for (var j = 0; j < moreEdits.length; j++) {
          if (this.correct(moreEdits[j])) {
            suggestions.push(moreEdits[j]);
            if (suggestions.length >= 10) break; // Stop once we have enough
          }
        }
        if (suggestions.length >= 10) break;
      }
    }
    
    // Deduplicate
    var uniqueSuggestions = [];
    for (var i = 0; i < suggestions.length; i++) {
      if (uniqueSuggestions.indexOf(suggestions[i]) === -1) {
        uniqueSuggestions.push(suggestions[i]);
      }
    }
    
    return uniqueSuggestions.slice(0, 10); // Limit to 10 suggestions
  };

  // Helper functions
  function parseDictionary(dic) {
    var dictionary = {};
    
    try {
      console.log('Parsing dictionary, length:', dic.length);
      var lines = dic.split(/\r?\n/);
      console.log('Dictionary lines:', lines.length);
      
      // Skip header line (word count)
      for (var i = 1; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        
        // Handle forbidden words (marked with *)
        if (line.charAt(0) === '*') {
          dictionary[line.slice(1).toLowerCase()] = false;
        } else {
          // Split on first slash to separate word from flags
          var parts = line.split('/', 2);
          dictionary[parts[0].toLowerCase()] = true;
        }
      }
      
      console.log('Dictionary parsed, words:', Object.keys(dictionary).length);
    } catch (error) {
      console.error('Error parsing dictionary:', error);
      // Add some basic words to ensure functionality even if parsing fails
      var basicWords = ['the', 'and', 'that', 'have', 'for', 'not', 'with', 'you', 'this', 'but'];
      for (var i = 0; i < basicWords.length; i++) {
        dictionary[basicWords[i]] = true;
      }
    }
    
    return dictionary;
  }

  function parseAffixFile(aff) {
    var rules = {
      prefixes: [],
      suffixes: ['s', 'es', 'ed', 'ing', 'er', 'est', 'ly'] // Common English suffixes
    };
    
    try {
      console.log('Parsing affix file, length:', aff.length);
      var lines = aff.split(/\r?\n/);
      console.log('Affix lines:', lines.length);
      
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        
        if (!line || line.startsWith('#')) {
          continue;
        }
        
        // Extract common prefixes and suffixes from affix file
        if (line.startsWith('PFX')) {
          var parts = line.split(/\s+/);
          if (parts.length >= 5) {
            rules.prefixes.push(parts[4]);
          }
        } else if (line.startsWith('SFX')) {
          var parts = line.split(/\s+/);
          if (parts.length >= 5) {
            rules.suffixes.push(parts[4]);
          }
        }
      }
      
      console.log('Affix parsing complete, prefixes:', rules.prefixes.length, 'suffixes:', rules.suffixes.length);
    } catch (error) {
      console.error('Error parsing affix file:', error);
      // Keep the default suffixes if parsing fails
    }
    
    return rules;
  }

  function getWordForms(word) {
    var forms = [];
    
    // Plural forms
    if (word.endsWith('s')) {
      forms.push(word.slice(0, -1)); // singular
      
      if (word.endsWith('ies')) {
        forms.push(word.slice(0, -3) + 'y'); // flies -> fly
      }
      
      if (word.endsWith('es')) {
        forms.push(word.slice(0, -2)); // boxes -> box
      }
    }
    
    // Past tense and participles
    if (word.endsWith('ed')) {
      forms.push(word.slice(0, -2)); // walked -> walk
      forms.push(word.slice(0, -2) + 'e'); // liked -> like
      
      // Handle doubled consonant
      if (word.length > 3) {
        forms.push(word.slice(0, -3)); // stopped -> stop
      }
    }
    
    // Present participle
    if (word.endsWith('ing')) {
      forms.push(word.slice(0, -3)); // walking -> walk
      forms.push(word.slice(0, -3) + 'e'); // making -> make
      
      // Handle doubled consonant
      if (word.length > 4) {
        forms.push(word.slice(0, -4)); // running -> run
      }
    }
    
    return forms;
  }

  function getEditDistance1(word) {
    var results = [];
    var alphabet = 'abcdefghijklmnopqrstuvwxyz';
    
    // Deletions
    for (var i = 0; i < word.length; i++) {
      results.push(word.slice(0, i) + word.slice(i + 1));
    }
    
    // Transpositions
    for (var i = 0; i < word.length - 1; i++) {
      results.push(
        word.slice(0, i) + 
        word.charAt(i + 1) + 
        word.charAt(i) + 
        word.slice(i + 2)
      );
    }
    
    // Replacements
    for (var i = 0; i < word.length; i++) {
      for (var j = 0; j < alphabet.length; j++) {
        results.push(
          word.slice(0, i) + 
          alphabet[j] + 
          word.slice(i + 1)
        );
      }
    }
    
    // Insertions
    for (var i = 0; i <= word.length; i++) {
      for (var j = 0; j < alphabet.length; j++) {
        results.push(
          word.slice(0, i) + 
          alphabet[j] + 
          word.slice(i)
        );
      }
    }
    
    return results;
  }

})(typeof window !== 'undefined' ? window : self);
