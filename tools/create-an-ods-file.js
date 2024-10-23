//@ts-check

import {createOdsFile} from '../scripts/node.js'

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

// @ts-ignore
const ods = await createOdsFile(content)

//console.log('writableHighWaterMark', process.stdout.writableHighWaterMark) // 16384

process.stdout.write(new Uint8Array(ods))

