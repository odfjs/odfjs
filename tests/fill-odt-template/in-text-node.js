import test from 'ava';
import {join} from 'node:path';

import {getOdtTemplate} from '../../scripts/odf/odtTemplate-forNode.js'

import {fillOdtTemplate, getOdtTextContent} from '../../exports.js'


test('template filling {#if ...}{/if} within a single text node', async t => {
    const templatePath = join(import.meta.dirname, '../fixtures/inline-if-nombres.odt')
    const templateContent = `Taille de nombre

Le nombre {n} est {#if n<5}petit{:else}grand{/if}.
`

    const odtTemplate = await getOdtTemplate(templatePath)

    const templateTextContent = await getOdtTextContent(odtTemplate)    
    t.deepEqual(templateTextContent, templateContent, 'reconnaissance du template')

    const odtResult3 = await fillOdtTemplate(odtTemplate, {n : 3})

    const odtResult3TextContent = await getOdtTextContent(odtResult3)
    t.deepEqual(odtResult3TextContent, `Taille de nombre

Le nombre 3 est petit.
`)

    const odtResult9 = await fillOdtTemplate(odtTemplate, {n : 9})

    const odtResult9TextContent = await getOdtTextContent(odtResult9)
    t.deepEqual(odtResult9TextContent, `Taille de nombre

Le nombre 9 est grand.
`)

});


test('template filling {#each ...}{/each} within a single text node', async t => {
    const templatePath = join(import.meta.dirname, '../fixtures/liste-nombres.odt')
    const templateContent = `Liste de nombres

Les nombres : {#each nombres as n}{n} {/each} !!
`

	const data = {
        nombres : [1,1,2,3,5,8,13,21]
    }

    const odtTemplate = await getOdtTemplate(templatePath)

    const templateTextContent = await getOdtTextContent(odtTemplate)    
    t.deepEqual(templateTextContent, templateContent, 'reconnaissance du template')

    const odtResult = await fillOdtTemplate(odtTemplate, data)

    const odtResultTextContent = await getOdtTextContent(odtResult)
    t.deepEqual(odtResultTextContent, `Liste de nombres

Les nombres : 1 1 2 3 5 8 13 21  !!
`)

});

