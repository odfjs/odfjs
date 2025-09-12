import test from 'ava';
import {join} from 'node:path';

import {getOdtTemplate} from '../../scripts/odf/odtTemplate-forNode.js'

import {fillOdtTemplate, getOdtTextContent} from '../../exports.js'


test('template with {#each} inside an {#if}', async t => {
    const templatePath = join(import.meta.dirname, '../fixtures/if-then-each.odt')
    const templateContent = `{#if liste_départements.length >= 2}{#each liste_départements as département}{département}, {/each} {/if}`

    const data = {liste_départements : ['95', '33']}

    const odtTemplate = await getOdtTemplate(templatePath)
    const templateTextContent = await getOdtTextContent(odtTemplate)
    t.deepEqual(templateTextContent.trim(), templateContent.trim(), 'reconnaissance du template')

    const odtResult = await fillOdtTemplate(odtTemplate, data)

    const odtResultTextContent = await getOdtTextContent(odtResult)
    t.deepEqual(odtResultTextContent.trim(), `95, 33,`)

});

