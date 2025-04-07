# ods-xlsx

Small lib to parse/understand .ods and .xsls files in the browser and node.js


## Rough roadmap

- [ ] add odt templating
- [ ] remove support for xlsx
- [ ] add a .ods minifyer
- [ ] add a generic .ods visualizer
- [ ] move to a dedicated odf docs org
- [ ] add a quick .odt visualiser (maybe converting to markdown first?)


## Usage

### Install

```sh
npm i https://github.com/DavidBruant/ods-xlsx.git#v0.11.0
```


### Basic - reading an ods/xlsx file

```js
import {tableRawContentToObjects, tableWithoutEmptyRows, getODSTableRawContent} from 'ods-xlsx'

/**
 * @param {ArrayBuffer} odsFile - content of an .ods file
 * @return {Promise<any[]>}
 */ 
async function getFileData(odsFile){
    return getODSTableRawContent(odsFile)
        .then(tableWithoutEmptyRows)
        .then(tableRawContentToObjects)
}
```

The return value is an array of objects where 
the **keys** are the column names in the first row and 
the **values** are automatically converted from the .ods or .xlsx files (which type numbers, strings, booleans and dates) 
to the appropriate JavaScript value


### Basic - creating an ods file

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

(and there is a tool to test file creation:
`node tools/create-an-ods-file.js > yo.ods`)


### Filling an .odt template

odf.js proposes a template syntax

In an .odt file, write the following:

```txt
Hey {nom}! 

Your birthdate is {dateNaissance}
```

And then run the code:


```js
import {join} from 'node:path';

import {getOdtTemplate} from '../scripts/odf/odtTemplate-forNode.js'
import {fillOdtTemplate} from '../scripts/node.js'

// replace with your template path
const templatePath = join(import.meta.dirname, './tests/data/template-anniversaire.odt')
const data = {
    nom: 'David Bruant',
    dateNaissance: '8 mars 1987'
}

const odtTemplate = await getOdtTemplate(templatePath)
const odtResult = await fillOdtTemplate(odtTemplate, data)

process.stdout.write(new Uint8Array(odtResult))
```

There are also loops in the form:

```txt
- {#each listeCourses as élément}
- {élément}
- {/each}
```

They can be used to generate lists or tables in .odt files from data and a template using this syntax


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

