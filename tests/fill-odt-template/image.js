import test from 'ava';
import {join} from 'node:path';

import {getOdtTemplate} from '../../scripts/odf/odtTemplate-forNode.js'

import {fillOdtTemplate} from '../../exports.js'
import { listZipEntries } from '../helpers/zip-analysis.js';


test('template filling preserves images', async t => {
    const templatePath = join(import.meta.dirname, '../fixtures/template-avec-image.odt')

	const data = {
        commentaire : `J'adooooooore 🤩 West covinaaaaaaaaaaa 🎶`
    }

    const odtTemplate = await getOdtTemplate(templatePath)
    const templateEntries = await listZipEntries(odtTemplate)

    //console.log('templateEntries', templateEntries.map(({filename, directory}) => ({filename, directory})))

    t.assert(
        templateEntries.find(entry => entry.filename.startsWith('Pictures/')), 
        `One zip entry of the template is expected to have a name that starts with 'Pictures/'`
    )

    const odtResult = await fillOdtTemplate(odtTemplate, data)
    const resultEntries = await listZipEntries(odtResult)

    //console.log('resultEntries', resultEntries.map(({filename, directory}) => ({filename, directory})))

    
    t.assert(
        resultEntries.find(entry => entry.filename.startsWith('Pictures/')), 
        `One zip entry of the result is expected to have a name that starts with 'Pictures/'`
    )

})