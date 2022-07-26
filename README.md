# `minisearch`

A tiny search engine.

Suitable for in-browser use, this provides n-gram based, English search results.


## Quickstart

```js
import { MiniSearch } from '@toastdriven/minisearch';

// Create a search engine.
const engine = new MiniSearch();

// Index some documents.
// First parameter is the unique document ID, second is the document text.
engine.add("abc", "The dog is a 'hot dog'.");
engine.add("def", "Dogs > Cats");
engine.add("ghi", "the quick brown fox jumps over the lazy dog");
engine.add("jkl", "Am I lazy, or just work smart?");

// Then, you can let the user search on the engine...
engine.search("my dog");
// ...including limiting results (to just one)...
engine.search("lazy", 1);
// ...or a second page of ten results!
engine.search("dogs", 10, 2);
```


## Installation

`$ npm install @toastdriven/minisearch`


## Requirements

* ES6 (or similar translation/polyfill)


## Tests

```shell
$ git clone git@github.com:toastdriven/minisearch.git
$ cd minisearch
$ npm install
$ npm test
```


## Docs

```shell
$ git clone git@github.com:toastdriven/minisearch.git
$ cd minisearch
$ npm install
$ ./node_modules/.bin/jsdoc -r -d ~/Desktop/out --package package.json --readme README.md src
```


## License

New BSD
