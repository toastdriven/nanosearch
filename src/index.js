/**
 * minisearch: A tiny search engine.
 *
 * Default implementation is based off of n-grams (default size: `3`).
 *
 * @module minisearch
 */

/**
 * A basic, English-based preprocessor.
 *
 * Takes a document of text & generates a list of words.
 *
 * Functionally, this essentially does the following:
 * - converts the document to lowercase
 * - strips out non-alphanumeric symbols
 * - splits on whitespace
 */
class BasicEnglishPreprocessor {
  /**
   * Processes a document into a list of words.
   * @param {string} doc - The text to preprocess for the engine.
   * @return {array}
   */
  process(doc) {
    // This is really naive, but for the purposes of being simple/fast, it'll
    // have to do for now.
    const splitOn = /\s+/;
    const toStrip = /[^A-Za-z0-9\s]/g;

    // TODO: Eventually, Unicode support would be cool.
    // const toStrip = /([\u0000-\u0019\u0021-\uFFFF])+/gu;

    // Copy it, so that we don't risk modifying the original on someone.
    let cleaned = doc.toString().slice();

    cleaned = cleaned.toLowerCase();
    cleaned = cleaned.replaceAll(toStrip, '');
    return cleaned.split(splitOn);
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
   *   (`BasicEnglishPreprocessor`).
   * @param {object} tokenizer - The tokenizer or `undefined`
   *   (`NGramTokenizer`).
   * @return {this}
   */
  constructor(existingIndex, preprocessor, tokenizer) {
    this.index = existingIndex || {
      "documentIds": {},
      "terms": {},
    };
    this.preprocessor = preprocessor || new BasicEnglishPreprocessor();
    this.tokenizer = tokenizer || new NGramTokenizer();
  }

  /**
   * Clears out the entire index.
   * @return {undefined}
   */
  clear() {
    this.index = {
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
    const words = this.preprocessor.process(doc);

    for (let word of words) {
      let tokens = this.tokenizer.tokenize(word);

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
          this.index["terms"][token][docId] = 0;
        }

        // Increment the token count for the document.
        this.index["terms"][token][docId]++;
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
    const queryWords = this.preprocessor.process(query);

    for (let word of queryWords) {
      const queryTokens = this.tokenizer.tokenize(word);

      for (let token of queryTokens) {
        if (this.index["terms"].hasOwnProperty(token)) {
          // We've got a hit!
          for (const [docId, count] of Object.entries(this.index["terms"][token])) {
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

            initialResults[docId]["terms"][token] += count;
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
    this.clear();
    this.index = JSON.parse(indexData);
  }
}

export {
  BasicEnglishPreprocessor,
  NGramTokenizer,
  MiniSearch,
};
