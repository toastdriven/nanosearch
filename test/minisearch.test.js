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
    it("properly cleans a phrase of symbols", function () {
      const pp = new BasicPreprocessor();
      const doc = "The \"dog\" is -a 'hot dog'.";

      let cleaned = pp.clean(doc);
      assert.equal(cleaned, "The dog is a hot dog");
    });

    it("properly handles Unicode", function () {
      const pp = new BasicPreprocessor();
      const ukrainian = "Собака коричнева.";
      const serbian = "Пас је браон.";
      const japanese = "犬は茶色です。";
      let terms;

      terms = pp.process(ukrainian);
      assert.equal(terms.length, 2);
      assert.equal(terms[0].term, "собака");
      assert.equal(terms[1].term, "коричнева");

      terms = pp.process(serbian);
      assert.equal(terms.length, 3);
      assert.equal(terms[0].term, "пас");
      assert.equal(terms[1].term, "је");
      assert.equal(terms[2].term, "браон");

      // I'm sure this is incorrect, but would work with a better n-gram size.
      // For now, it's enough that it's configurable & preserves the characters.
      terms = pp.process(japanese);
      assert.equal(terms.length, 1);
      assert.equal(terms[0].term, "犬は茶色です。");
    });

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

    it("reduced punctuation replacement", function () {
      // This keeps the various quotes (normally stripped), but removes the
      // dash & period.
      const pp = new BasicPreprocessor(null, null, /[\.\-]/g);
      const doc = "The \"dog\" is -a 'hot dog'.";

      const terms = pp.process(doc);
      assert.equal(terms.length, 6);
      assert.equal(terms[0].term, "the");
      assert.equal(terms[0].position, 0);
      assert.equal(terms[1].term, '"dog"');
      assert.equal(terms[1].position, 4);
      assert.equal(terms[2].term, "is");
      assert.equal(terms[2].position, 10);
      assert.equal(terms[3].term, "a");
      assert.equal(terms[3].position, 13);
      assert.equal(terms[4].term, "'hot");
      assert.equal(terms[4].position, 16);
      assert.equal(terms[5].term, "dog'");
      assert.equal(terms[5].position, 21);
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

  describe("clear", function () {
    it("correctly empties the index", function () {
      const engine = new MiniSearch();

      engine.add("abc", "The dogs are loose");
      engine.add("def", "No cats aren't");

      // Sanity check.
      assert.equal(Object.keys(engine.index["documentIds"]).length, 2);
      assert.equal(Object.keys(engine.index["terms"]).length, 12);

      engine.clear();
      assert.equal(Object.keys(engine.index["documentIds"]).length, 0);
      assert.equal(Object.keys(engine.index["terms"]).length, 0);
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

  describe("toJson", function () {
    it("stores to JSON", function () {
      const engine = new MiniSearch();

      engine.add("abc", "The dog is a 'hot dog'.");
      engine.add("def", "Dogs > Cats");

      const index = engine.toJson();

      // Due to object instability, we need to load it.
      const rawData = JSON.parse(index);
      assert.equal(Object.keys(rawData["documentIds"]).length, 2);
      assert.equal(Object.keys(rawData["terms"]).length, 8);
      assert.equal(rawData["version"], VERSION);
    });
  });

  describe("fromJson", function () {
    it("loads from JSON", function () {
      const engine = new MiniSearch();

      // Sanity check.
      assert.equal(Object.keys(engine.index["documentIds"]).length, 0);
      assert.equal(Object.keys(engine.index["terms"]).length, 0);

      const rawData = {
        "version": "1.0.0",
        "documentIds": ["abc"],
        "terms": {
          "dog": {
            "abc": [1, 2, 3],
          },
        },
      };

      const index = JSON.stringify(rawData);
      engine.fromJson(index);
      assert.equal(Object.keys(engine.index["documentIds"]).length, 1);
      assert.equal(Object.keys(engine.index["terms"]).length, 1);
      assert.equal(engine.index["version"], VERSION);

      // Sanity check.
      const results = engine.search("dog");
      assert.equal(results.length, 1);
    });
  });
});
