import assert from "assert";

import {
  VERSION,
  TermPosition,
  BasicPreprocessor,
  NGramTokenizer,
  MiniSearch,
} from "../src/index.js";

describe("BasicEnglishPreprocessor", function () {
  describe("default processing", function () {
    it("returns the correct terms", function () {
      const pp = new BasicPreprocessor();
      const doc = "The dog is hot.";

      const terms = pp.process(doc);
      assert.equal(terms.length, 4);
      assert.equal(terms[0].term, "the");
      assert.equal(terms[0].position, 0);
      assert.equal(terms[1].term, "dog");
      assert.equal(terms[1].position, 4);
      assert.equal(terms[2].term, "is");
      assert.equal(terms[2].position, 8);
      assert.equal(terms[3].term, "hot");
      assert.equal(terms[3].position, 11);
    });

    it("returns the correct terms with surrounding whitespace", function () {
      const pp = new BasicPreprocessor();
      const doc = " The dog is hot.\n ";

      const terms = pp.process(doc);
      assert.equal(terms.length, 4);
      assert.equal(terms[0].term, "the");
      assert.equal(terms[0].position, 1);
      assert.equal(terms[1].term, "dog");
      assert.equal(terms[1].position, 5);
      assert.equal(terms[2].term, "is");
      assert.equal(terms[2].position, 9);
      assert.equal(terms[3].term, "hot");
      assert.equal(terms[3].position, 12);
    });
  });

  describe("overridden processing", function () {
    it("correctly handles different splits", function () {
      const pp = new BasicPreprocessor(/[\n]/);
      const doc = "The dog\nis hot.\n\n";

      const terms = pp.process(doc);
      assert.equal(terms.length, 2);
      assert.equal(terms[0].term, "the dog");
      assert.equal(terms[0].position, 0);
      assert.equal(terms[1].term, "is hot");
      assert.equal(terms[1].position, 8);
    });

    it("avoids stop words", function () {
      const pp = new BasicPreprocessor(null, ["the", "a", "an", "is"]);
      const doc = "The dog is a 'hot dog'.";

      const terms = pp.process(doc);
      assert.equal(terms.length, 3);
      assert.equal(terms[0].term, "dog");
      assert.equal(terms[0].position, 4);
      assert.equal(terms[1].term, "hot");
      assert.equal(terms[1].position, 13);
      assert.equal(terms[2].term, "dog");
      assert.equal(terms[2].position, 18);
    });
  });
});

describe("NGramTokenizer", function () {
  describe("default processing", function () {
    it("returns the correct n-grams", function () {
      const ng = new NGramTokenizer();
      const word = "doggone";

      const tokens = ng.tokenize(word);
      assert.equal(tokens.length, 5);
      assert.deepEqual(tokens, [
        "dog",
        "ogg",
        "ggo",
        "gon",
        "one",
      ]);
    });
  });

  describe("overridden processing", function () {
    it("returns shorter n-grams", function () {
      const ng = new NGramTokenizer(2);
      const word = "doggone";

      const tokens = ng.tokenize(word);
      assert.equal(tokens.length, 6);
      assert.deepEqual(tokens, [
        "do",
        "og",
        "gg",
        "go",
        "on",
        "ne",
      ]);
    });
  });
});

describe("MiniSearch", function () {
  describe("constructor", function () {
    it("sets internal state", function () {
      const engine = new MiniSearch();

      assert.deepEqual(engine.index, {
        "documentIds": {},
        "terms": {},
        "version": VERSION,
      });
    });
  });

  describe("add", function () {
    it("correctly adds a document", function () {
      const engine = new MiniSearch();

      engine.add("abc", "The dogs are loose");

      assert.equal(Object.keys(engine.index["documentIds"]).length, 1);
      assert.equal(Object.keys(engine.index["terms"]).length, 7);
    });
  });

  describe("remove", function () {
    it("correctly removes a document", function () {
      const engine = new MiniSearch();

      engine.add("abc", "The dogs are loose");
      engine.add("def", "No cats aren't");

      assert.equal(Object.keys(engine.index["documentIds"]).length, 2);
      assert.equal(Object.keys(engine.index["terms"]).length, 12);

      engine.remove("def");

      assert.equal(Object.keys(engine.index["documentIds"]).length, 1);
      assert.equal(Object.keys(engine.index["terms"]).length, 7);
    });
  });

  describe("search", function () {
    it("searches against the index", function () {
      const engine = new MiniSearch();

      engine.add("abc", "The dog is a 'hot dog'.");
      engine.add("def", "Dogs > Cats");
      engine.add("ghi", "the quick brown fox jumps over the lazy dog");
      engine.add("jkl", "Am I lazy, or just work smart?");

      const results = engine.search("my dog");

      assert.equal(results.length, 3);
      assert.equal(results[0]["docId"], "def");
      assert.equal(results[1]["docId"], "abc");
      assert.equal(results[2]["docId"], "ghi");
    });
  });
});
