/**
 * nanosearch: A tiny search engine.
 *
 * Default implementation is based off of n-grams (default size: `3`).
 *
 * @module nanosearch
 */

const VERSION = "2.0.0-dev";

const ENGLISH_STOP_WORDS = [
  "a",
  "all",
  "am",
  "an",
  "and",
  "any",
  "are",
  "at",
  "be",
  "been",
  "being",
  "both",
  "but",
  "by",
  "can",
  "can't",
  "did",
  "didn't",
  "does",
  "doesn't",
  "doing",
  "done",
  "down",
  "each",
  "few",
  "for",
  "had",
  "has",
  "have",
  "he",
  "her",
  "here",
  "herself",
  "him",
  "himself",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "isn't",
  "it",
  "its",
  "itself",
  "many",
  "me",
  "more",
  "most",
  "my",
  "no",
  "nor",
  "not",
  "now",
  "of",
  "off",
  "on",
  "once",
  "only",
  "or",
  "other",
  "our",
  "out",
  "own",
  "same",
  "should",
  "shouldn't",
  "so",
  "some",
  "than",
  "that",
  "the",
  "these",
  "their",
  "theirs",
  "them",
  "themselves",
  "then",
  "they",
  "this",
  "those",
  "to",
  "too",
  "up",
  "very",
  "we",
  "what",
  "when",
  "where",
  "which",
  "who",
  "whom",
  "why",
  "you",
];

/**
 * A term position.
 *
 * Essentially a struct, this takes a term (word) & a position within a document.
 */
class TermPosition {
  /**
   * Creates a new term position.
   * @param {string} term - The term/word to store.
   * @param {int} position - The position within the document.
   * @return {this}
   */
  constructor(term, position) {
    this.term = term;
    this.position = position;
  }
}

function* _resultsIterator(results, start = 0, end = Infinity, step = 1) {
  let iterationCount = 0;
  let actualEnd = Math.min(results.length, end);

  for (let i = start; i < actualEnd; i += step) {
    iterationCount++;
    yield results.at(i);
  }

  return iterationCount;
}

/**
 * A result set.
 *
 * An object that makes working with all the results from a query easier.
 */
class Results {
  /**
   * Creates a new result.
   * @param {string} query - The query searched on.
   * @param {array} results - The results found from searching.
   * @return {this}
   */
  constructor(query, results) {
    this.query = query;
    this._allResults = results || [];
  }

  /**
   * Creates an iterator that allows you to loop over results.
   * @param {int} start - The starting offset. Default is `0`.
   * @param {int} end - The ending offset. Default is `Infinity`.
   * @param {int} step - The step value. Default is `1`.
   * @return {generator}
   */
  iterator(start = 0, end = Infinity, step = 1) {
    return _resultsIterator(this._allResults, start, end, step);
  }

  /**
   * Returns a result at a specific offset.
   * @param {int} offset - The position within the results.
   * @return {this}
   */
  at(offset) {
    return this._allResults.at(offset);
  }

  /**
   * Returns the total count of matches.
   * @return {int}
   */
  count() {
    return this._allResults.length;
  }

  /**
   * Slices the result set.
   * @param {int} start - The starting offset.
   * @param {int} end - The ending offset (exclusive).
   * @return {array}
   */
  slice(start, end) {
    return this._allResults.slice(start, end);
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
  /**
   * Creates a new basic preprocessor.
   * @param {RegExp} splitOn - What to split terms on. Default is any
   *   whitespace.
   * @param {array} stopWords - A list of common words to be skipped. Default is
   *   `[]`.
   * @param {RegExp} punctuation - Any punctuation to be removed. Default is all
   *   common symbols on an English QWERTY keyboard.
   * @return {this}
   */
  constructor(splitOn, stopWords, punctuation) {
    this.splitOn = splitOn || /\s/;
    this.stopWords = stopWords || [];
    this.punctuation = punctuation || /[~`!@#$%^&*\(\)_+=\[\]\{\}\\\|;:'",\.\/<>?-]/g;

    this.setup();
  }

  setup() {
    this.stopWords = this.stopWords.map((word) => this.clean(word));
  }

  /**
   * Cleans a word.
   *
   * Currently, this is just stripping out basic punctuation characters.
   * @param {string} word - The word to be cleaned.
   * @return {string}
   */
  clean(word) {
    // Dupe it so that we don't modify the original.
    let cleaned = word.slice();
    cleaned = cleaned.replaceAll(this.punctuation, "");
    return cleaned;
  }

  /**
   * Potentially appends a new term to the terms list.
   *
   * This is largely an _internal_ method.
   *
   * This lowercases, then cleans the word. If there are any characters left
   * post-cleaning, it will create a new `TermPosition`, and append it to
   * the `terms` list **IN-PLACE**.
   * @param {array} terms - The existing term list.
   * @param {string} currentWord - The word to added.
   * @param {int} wordOffset - The offset of the word within the document.
   * @return {array}
   */
  appendTerm(terms, currentWord, wordOffset) {
    // We've encountered the end of the word. Finalize the term.
    const cleaned = this.clean(currentWord.toLowerCase());

    if (cleaned.length > 0) {
      // Check the stop word list.
      if (this.stopWords.indexOf(cleaned) < 0) {
        // It's not a stop word. Add it to terms.
        const term = new TermPosition(cleaned, wordOffset);
        // I don't love that we're modifying the passed array in-place, but
        // we also don't want O(N) copies of the `terms` per-document.
        // That's a lot of RAM & allocations on big documents.
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
 * A English-specific preprocessor.
 *
 * In addition to everything the `BasicPreprocessor` does, this has a default
 * set of stop words suitable for the English language, which filters out
 * common terms.
 */
class EnglishPreprocessor extends BasicPreprocessor {
  /**
   * Creates a new English preprocessor.
   * @param {RegExp} splitOn - What to split terms on. Default is any
   *   whitespace.
   * @param {array} stopWords - A list of common words to be skipped. Default is
   *   `ENGLISH_STOP_WORDS`.
   * @param {RegExp} punctuation - Any punctuation to be removed. Default is all
   *   common symbols on an English QWERTY keyboard.
   * @return {this}
   */
  constructor(splitOn, stopWords, punctuation) {
    stopWords = stopWords || ENGLISH_STOP_WORDS;
    super(splitOn, stopWords, punctuation);
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
 * An regular expression tokenizer.
 *
 * Takes a word & generates a list of tokens to index.
 */
class RegExpTokenizer {
  /**
   * Creates a new tokenizer.
   * @param {RegExp} regexp - The regular expression to replace on. Default is
   *   `/(es|ed|ing|s|able)$/g`.
   * @param {int} minLength - The minimum resultant word length. Default is `4`.
   * @return {this}
   */
  constructor(regexp, minLength) {
    this.regexp = regexp || /(es|ed|ing|s|able)$/g;
    this.minLength = minLength || 4;
  }

  /**
   * Processes a word into a list of tokens.
   * @param {string} word - The word to process.
   * @return {array}
   */
  tokenize(word) {
    const tokens = [];
    const stemmed = word.replace(this.regexp, '');

    if (stemmed.length >= this.minLength) {
      tokens.push(stemmed);
    } else {
      // It's too short to be a useful stem. Use the original word instead.
      tokens.push(word);
    }

    return tokens;
  }
}

/**
 * A tiny search engine.
 *
 * Usage:
 *
 *   const engine = new SearchEngine();
 *
 *   // Add some documents. Call for each document you need to index.
 *   engine.add(uniqueDocumentId, documentText);
 *
 *   // Later, you can let the user search & return the first 10 results.
 *   const results = engine.search(userQuery, 10);
 */
class SearchEngine {
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
   * @return {Results}
   */
  search(query) {
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

    return new Results(query, allResults);
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
    const ourVersion = VERSION.split(".", 1).toString();
    const loadedVersion = loadedData["version"].split(".", 1).toString();

    if (ourVersion !== loadedVersion) {
      throw new Error("Index major version doesn't match! Aborting load.");
    }

    this.clear();
    this.index = loadedData;
  }
}

export {
  VERSION,
  ENGLISH_STOP_WORDS,
  TermPosition,
  BasicPreprocessor,
  EnglishPreprocessor,
  NGramTokenizer,
  RegExpTokenizer,
  SearchEngine,
};
