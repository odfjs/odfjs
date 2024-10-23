# ods-xlsx

Small lib to parse/understand .ods and .xsls files in the browser and node.js


## Usage

### Install

```sh
npm i https://github.com/DavidBruant/ods-xlsx.git#v0.9.0
```


### Usage

#### Basic - reading an ods/xlsx file

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


#### Basic - creating an ods file

```js
import {createOdsFile} from 'ods-xlsx'

const content = new Map([
    [
        'La feuille',
        [
            [
                {value: '37', type: 'float'},
                {value: '26', type: 'string'}
            ]
        ],
    ],
    [
        "L'autre feuille",
        [
            [
                {value: '1', type: 'string'},
                {value: '2', type: 'string'},
                {value: '3', type: 'string'},
                {value: '5', type: 'string'},
                {value: '8', type: 'string'}
            ]
        ],
    ]
])

const ods = await createOdsFile(content)
// ods is an ArrayBuffer representing an ods file with the content described by the Map
```


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
