import {readFile} from 'node:fs/promises'

import test from 'ava';

import {getODSTableRawContent} from '../scripts/node.js'

const nomAgeContent = (await readFile('./tests/data/nom-age.ods')).buffer

test('basic', async t => {
	const table = await getODSTableRawContent(nomAgeContent);
    t.assert(table.has('Feuille1'))

    const feuille1 = table.get('Feuille1')
    t.assert(Array.isArray(feuille1))
    //@ts-ignore
    t.assert(Array.isArray(feuille1[0]))
    //@ts-ignore
    t.deepEqual(feuille1[0][0], {value: 'Nom', type: 'string'})
});
