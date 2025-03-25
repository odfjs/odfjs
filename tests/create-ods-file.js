import test from 'ava';

import {getODSTableRawContent, createOdsFile} from '../scripts/node.js'

/** @import {SheetName, SheetRawContent} from '../scripts/types.js' */

test('basic file creation', async t => {
    /** @type {Map<SheetName, SheetRawContent>} */
	const content = new Map([
        [
            'La feuille', 
            [
                [
                    {value: 'azerty', type: 'string'},
                    {value: '37', type: 'float'}
                ]
            ]
        ]
    ])

    
    const odsFile = await createOdsFile(content)

    const parsedContent = await getODSTableRawContent(odsFile)

    t.assert(parsedContent.has('La feuille'))

    const feuille = parsedContent.get('La feuille')
    
    t.deepEqual(feuille, [ 
        [ 
            {value: 'azerty', type: 'string'},
            {value: '37', type: 'float'}
        ] 
    ])

});
