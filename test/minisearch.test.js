import assert from "assert";

import {
  BasicEnglishPreprocessor,
  NGramTokenizer,
  MiniSearch,
} from "../src/index.js";

describe("MiniSearch", function () {
  describe("constructor", function () {
    it("sets internal state", function () {
      const engine = new MiniSearch();

      assert.deepEqual(engine.index, {
        "documentIds": {},
        "terms": {},
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
