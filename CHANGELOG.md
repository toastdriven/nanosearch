# Changelog

## 2.0.0

This release is backward-incompatible with `1.0.0`!

### Upgrading

The easiest path to upgrading is simply to `engine.clear()`, then re-index all
of your documents. This is only needed if you're persisting your index.

> _Note:_ Alternatively, you can manually change the top-level
> `engine.index["version"]` key to `"2.0.0"`, though you need to be careful
> when messing with internals.

You'll also need to check your usages of `SearchEngine.search`, as its API has
changed. The `start` & `limit` parameters were dropped, but can be applied to
`Results.slice(start, end)` instead for an identical result.

### Changes

* Changed the `SearchEngine.search` method to return a `Results` object instead
  of a plain array. This object allows for getting the total result count,
  accessing a specific offset within the results, iterating over all results, &
  a slicing interface to the result set.
* Added an `EnglishPreprocessor`. This comes with an English-specific set of
  stop words (common words to filter out that would otherwise dilute the
  search results). We also export the `ENGLISH_STOP_WORDS` constant for your
  use.
* Added a `RegExpTokenizer`. This allows for stemming based on a regular
  expression, which can be useful for simple or non-English situations.


## 1.0.0

Initial release.
