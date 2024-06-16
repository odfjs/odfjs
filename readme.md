# ods-xlsx

Small lib to parse/understand .ods and .xsls files in the browser


## Usage

### Install

```sh
npm i github:DavidBruant/ods-xlsx#v0.2.0
```


### Usage

#### Basic

```js
import {getTableRawContentFromFile, tableRawContentToObjects} from './main.js'

/**
 * @param {File} file - a file like the ones you get from an <input type=file>
 * @return {Promise<any[]>}
 */ 
async function getFileData(file){
    return getTableRawContentFromFile(file)then(tableRawContentToObjects)
}
```

The return value is an array of objects where 
the **keys** are the column names in the first row and 
the **values** are automatically converted from the .ods or .xlsx files (which type numbers, strings, booleans and dates) 
to the appropriate JavaScript value


#### Low-level

`getTableRawContentFromFile` returns a `Promise` for an array of array of `{value, type}` objects where:
- `value` is a string or `undefined` or `null` and 
- `type` is a type defined in the .ods or .xlsx standards

See the `convertCellValue` function in the source code for an example of how to handle the `type` value


`tableRawContentToObjects` performs a conversion on values and also removes empty rows

### Demo

https://davidbruant.github.io/ods-xlsx/


## Local dev

```sh
npm install
npm run dev
```


## Expectations and licence

I hope to be credited for the work on this repo

Everything written by me and contributors to this repo is licenced under **CC0 1.0 (Public Domain)**


## Dependencies

Svelte and rollup are **MIT**-licence
