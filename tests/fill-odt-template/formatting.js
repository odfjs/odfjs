import test from 'ava';
import {join} from 'node:path';

import {getOdtTemplate} from '../../scripts/odf/odtTemplate-forNode.js'

import {fillOdtTemplate, getOdtTextContent} from '../../exports.js'

test('template filling {#each ...}{/each} with formating in {#each ...} start marker', async t => {
    const templatePath = join(import.meta.dirname, '../fixtures/liste-nombres-avec-formattage.odt')
    const templateContent = `Liste de nombres

Les nombres : {#each nombres as n}{n} {/each} !!
`

    const data = {
        nombres : [1,2,3,5]
    }

    const odtTemplate = await getOdtTemplate(templatePath)

    const templateTextContent = await getOdtTextContent(odtTemplate)    
    t.deepEqual(templateTextContent, templateContent, 'reconnaissance du template')

    const odtResult = await fillOdtTemplate(odtTemplate, data)

    const odtResultTextContent = await getOdtTextContent(odtResult)
    t.deepEqual(odtResultTextContent, `Liste de nombres

Les nombres : 1 2 3 5  !!
`)

});