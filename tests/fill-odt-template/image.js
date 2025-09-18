import test from 'ava';
import {join} from 'node:path';
import { readFile } from 'node:fs/promises'

import {getOdtTemplate} from '../../scripts/odf/odtTemplate-forNode.js'

import {fillOdtTemplate, getOdtTextContent} from '../../exports.js'
import { listZipEntries } from '../helpers/zip-analysis.js';
import { getContentDocument } from '../../scripts/odf/odt/getOdtTextContent.js';


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

test('insert 2 images', async t => {
    const templatePath = join(import.meta.dirname, '../fixtures/basic-image-insertion.odt')

    
    const odtTemplate = await getOdtTemplate(templatePath)
    const templateContent = `{title}

{#each photos as photo}
{#image photo}
{/each}
`
    const templateTextContent = await getOdtTextContent(odtTemplate)

    t.is(templateTextContent, templateContent, 'reconnaissance du template')

    const photo1Path = join(import.meta.dirname, '../fixtures/pitchou-1.png')
    const photo2Path = join(import.meta.dirname, '../fixtures/pitchou-2.png')

    const photo1Buffer = (await readFile(photo1Path)).buffer
    const photo2Buffer = (await readFile(photo2Path)).buffer

    const photos = [{content: photo1Buffer, fileName: 'pitchou-1.png', mediaType: 'image/png'}, {content: photo2Buffer, fileName: 'pitchou-2.png', mediaType: 'image/png'}]

    const data = {
        title: 'Titre de mon projet',
        photos,
    }

    const odtResult = await fillOdtTemplate(odtTemplate, data)
    const resultEntries = await listZipEntries(odtResult)
    
    
    t.is(
        resultEntries.filter(entry => entry.filename.startsWith('Pictures/')).length, 2, 
        `Two pictures in 'Pictures/' folder are expected`
    )

    const odtContentDocument = await getContentDocument(odtResult)

    const drawImageElements = odtContentDocument.getElementsByTagName('draw:image')
    t.is(drawImageElements.length, 2, 'Two draw:image elements should be in the generated document.')
   
})