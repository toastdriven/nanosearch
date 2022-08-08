/**
 * minisearch: A tiny search engine.
 *
 * Default implementation is based off of n-grams (default size: `3`).
 *
 * @module minisearch
 */

const VERSION = "1.0.0";

class TermPosition {
  constructor(term, position) {
    this.term = term;
    this.position = position;
  }
}

/**
 * A basic preprocessor.
 *
 * Takes a document of text & generates a list of words.
 *
 * Functionally, this essentially does the following:
 * - converts the document to lowercase
 * - strips out non-alphanumeric symbols
 * - splits on whitespace
 */
class BasicPreprocessor {
  constructor(splitOn, skipWords, punctuation) {
    this.splitOn = splitOn || /\s/;
    this.skipWords = skipWords || [];
    this.punctuation = punctuation || /[~`!@#$%^&*\(\)_+=\[\]\{\}\\\|;:'",\.\/<>?-]/g;
  }

  clean(word) {
    // Dupe it so that we don't modify the original.
    let cleaned = word.slice();
    cleaned = cleaned.replaceAll(this.punctuation, "");
    return cleaned;
  }

  appendTerm(terms, currentWord, wordOffset) {
    // We've encountered the end of the word. Finalize the term.
    const cleaned = this.clean(currentWord.toLowerCase());

    if (cleaned.length > 0) {
      // Check the skip word list.
      if (this.skipWords.indexOf(cleaned) < 0) {
        // It's not a skip word. Add it to terms.
        const term = new TermPosition(cleaned, wordOffset);
        terms.push(term);
      }
    }

    return terms;
  }

  /**
   * Processes a document into a list of terms (`TermPosition` objects).
   * @param {string} doc - The text to preprocess for the engine.
   * @return {array}
   */
  process(doc) {
    const docLength = doc.length;
    const terms = [];
    let char = null,
      wordOffset = null,
      currentWord = "",
      cleaned = "";

    // Iterate over the whole document, character by character.
    // `.split()` would be faster, but we would lose term positions, plus
    // needing to copy the document.
    for (let offset = 0; offset < docLength; offset++) {
      char = doc[offset];

      // Check if it's a non-whitespace character.
      if (!this.splitOn.test(char)) {
        // Check to see if we have an active word offset.
        if (wordOffset === null) {
          // We don't have an active word. Store the offset.
          wordOffset = offset;
        }

        // Then append the character & move on.
        currentWord += char;
        continue;
      }

      // It's a whitespace character.
      // We now need to figure out if we have an in-progress term...
      if (currentWord.length > 0) {
        this.appendTerm(terms, currentWord, wordOffset);

        // Reset our variables.
        currentWord = "";
        wordOffset = null;
        // All done, next character please!
        continue;
      }
    }

    // If we didn't hit trailing whitespace, we need to finalize the last term.
    if (currentWord.length > 0) {
      this.appendTerm(terms, currentWord, wordOffset);
    }

    return terms;
  }
}

/**
 * An n-gram tokenizer.
 *
 * Takes a word & generates a list of tokens to index.
 */
class NGramTokenizer {
  /**
   * Creates a new tokenizer.
   * @param {int} length - The minimum length of the n-grams.
   * @return {this}
   */
  constructor(length) {
    this._gram_length = parseInt(length || 3);
  }

  /**
   * Processes a word into a list of tokens.
   * @param {string} word - The word to process.
   * @return {array}
   */
  tokenize(word) {
    const tokens = [];

    if (word.length < this._gram_length) {
      tokens.push(word);
      return tokens;
    }

    // Pass a "window" over the word.
    for (let start = 0; start <= (word.length - this._gram_length); start++) {
      tokens.push(word.substr(start, this._gram_length));
    }

    return tokens;
  }
}

/**
 * A mini search engine.
 *
 * Usage:
 *
 *   const engine = new MiniSearch();
 *
 *   // Add some documents. Call for each document you need to index.
 *   engine.add(uniqueDocumentId, documentText);
 *
 *   // Later, you can let the user search & return the first 10 results.
 *   const results = engine.search(userQuery, 10);
 */
class MiniSearch {
  /**
   * Creates a new search engine.
   * @param {object} existingIndex - The existing index or `undefined` (fresh
   *   index).
   * @param {object} preprocessor - The preprocessor or `undefined`
   *   (`BasicPreprocessor`).
   * @param {object} tokenizer - The tokenizer or `undefined`
   *   (`NGramTokenizer`).
   * @return {this}
   */
  constructor(existingIndex, preprocessor, tokenizer) {
    this.index = existingIndex || {
      "version": VERSION,
      "documentIds": {},
      "terms": {},
    };
    this.preprocessor = preprocessor || new BasicPreprocessor();
    this.tokenizer = tokenizer || new NGramTokenizer();
  }

  /**
   * Clears out the entire index.
   * @return {undefined}
   */
  clear() {
    this.index = {
      "version": VERSION,
      "documentIds": {},
      "terms": {},
    };
  }

  /**
   * Adds a document to the index.
   * @param {string} docId - The unique identifier for the document.
   * @param {string} doc - The text of the document.
   * @return {undefined}
   */
  add(docId, doc) {
    const alreadyIndexed = this.index["documentIds"].hasOwnProperty(docId);
    const terms = this.preprocessor.process(doc);

    for (let termPos of terms) {
      let tokens = this.tokenizer.tokenize(termPos.term);

      for (let token of tokens) {
        // Check if the token is already present. If not, set to an empty object.
        if (!this.index["terms"].hasOwnProperty(token)) {
          this.index["terms"][token] = {};
        }

        // Check if the document Id is already present. If not, or if we're
        // reindexing it (already seen), set the count to zero.
        if (
          (!this.index["terms"][token].hasOwnProperty(docId))
          || (alreadyIndexed)
        ) {
          this.index["terms"][token][docId] = [];
        }

        // Store the term position of the token.
        this.index["terms"][token][docId].push(termPos.position);
      }
    }

    // Finally, add the document to the known list.
    if (!alreadyIndexed) {
      this.index["documentIds"][docId] = doc.length;
    }
  }

  /**
   * Removes a document from the index.
   *
   * Safe to call even if the document isn't indexed.
   *
   * WARNING: Depending on the size of your index, this may take a LONG time.
   * @param {string} docId - The unique identifier for the document.
   * @return {undefined}
   */
  remove(docId) {
    const docPresent = this.index["documentIds"].hasOwnProperty(docId);

    if (!docPresent) {
      // Not found. We're all done!
      return;
    }

    // Remove it from the known documents list.
    delete this.index["documentIds"][docId];

    // Then remove it from any/all tokens.
    for (let [term, termInfo] of Object.entries(this.index["terms"])) {
      if (termInfo.hasOwnProperty(docId)) {
        delete termInfo[docId];
      }

      if (Object.keys(termInfo).length <= 0) {
        delete this.index["terms"][term];
      }
    }
  }

  _search(query) {
    const initialResults = {};
    const rawResults = [];
    const queryTerms = this.preprocessor.process(query);

    for (let termPos of queryTerms) {
      const queryTokens = this.tokenizer.tokenize(termPos.term);

      for (let token of queryTokens) {
        if (this.index["terms"].hasOwnProperty(token)) {
          // We've got a hit!
          for (const [docId, positions] of Object.entries(this.index["terms"][token])) {
            // Check if we've already seen the document. Initialize a result
            // if not.
            if (!initialResults.hasOwnProperty(docId)) {
              initialResults[docId] = {
                "terms": {},
                "length": this.index["documentIds"][docId],
                "score": 0,
              };
            }

            if (!initialResults[docId]["terms"].hasOwnProperty(token)) {
              initialResults[docId]["terms"][token] = 0;
            }

            // FIXME: We're still using a count here, when we can do better.
            initialResults[docId]["terms"][token] += positions.length;
          }
        }
      }
    }

    // Score the results.
    for (let [docId, rawResult] of Object.entries(initialResults)) {
      // Generate a score for the result.
      let score = this.scoreResult(rawResult);
      rawResults.push({
        "docId": docId,
        "score": score,
      });
    }

    return rawResults;
  }

  /**
   * Scores a raw result.
   *
   * Mostly an internal method called by `_search`, but you can override if
   * needed/have a better way to score.
   * @param {object} rawResult - The raw result to score.
   * @return {float}
   */
  scoreResult(rawResult) {
    // For now, we'll simply calculate how much of the overall document length
    // is consumed by the total token length.
    let totalTokenLength = 0;

    for (let [token, count] of Object.entries(rawResult["terms"])) {
      totalTokenLength += token.length * count;
    }

    return totalTokenLength / rawResult["length"];
  }

  /**
   * Performs a search against the index & returns results.
   * @param {string} query - The user's query to search on.
   * @param {int} limit - The number of results to return.
   * @param {int} start - The starting offset of the results.
   * @return {array}
   */
  search(query, limit, start) {
    limit = parseInt(limit) || 10;
    start = parseInt(start) || 0;

    const allResults = this._search(query);

    // Reorder all the results by score.
    allResults.sort((a, b) => {
      if (a["score"] > b["score"]) {
        return -1;
      } else if (a["score"] < b["score"]) {
        return 1;
      }

      return 0;
    });

    return allResults.slice(start, start + limit);
  }

  /**
   * Dumps the index to a JSON string.
   *
   * Useful for persisting an already-built index.
   * @return {string}
   */
  toJson() {
    return JSON.stringify(this.index);
  }

  /**
   * Loads the index from a JSON string.
   *
   * This *clears* the index first!
   * @param {string} indexData - The JSON of a previously-built index.
   * @return {undefined}
   */
  fromJson(indexData) {
    const loadedData = JSON.parse(indexData);

    if (!loadedData.hasOwnProperty("version")) {
      throw new Error("Index data has no version information! Aborting load.");
    }

    // Do a basic version check.
    const ourVersion = VERSION.split(".", 1);
    const loadedVersion = loadedData["version"].split(".", 1);

    if (ourVersion !== loadedVersion) {
      throw new Error("Index major version doesn't match! Aborting load.");
    }

    this.clear();
    this.index = loadedData;
  }
}

export {
  VERSION,
  TermPosition,
  BasicPreprocessor,
  NGramTokenizer,
  MiniSearch,
};
