# ods-xlsx

Small lib to parse/understand .ods and .xsls files in the browser and node.js


## Usage

### Install

```sh
npm i https://github.com/DavidBruant/ods-xlsx.git#v0.8.0
```


### Usage

#### Basic

```js
import {tableRawContentToObjects, tableWithoutEmptyRows, getODSTableRawContent} from 'ods-xlsx'

/**
 * @param {File} file - an .ods file like the ones you get from an <input type=file>
 * @return {Promise<any[]>}
 */ 
async function getFileData(file){
    return tableRawContent
        .then(tableWithoutEmptyRows)
        .then(tableRawContentToObjects)
}
```

The return value is an array of objects where 
the **keys** are the column names in the first row and 
the **values** are automatically converted from the .ods or .xlsx files (which type numbers, strings, booleans and dates) 
to the appropriate JavaScript value


#### Low-level

See exports

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
