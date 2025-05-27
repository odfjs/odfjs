import test from 'ava';
import {join} from 'node:path';

import {getOdtTemplate} from '../../scripts/odf/odtTemplate-forNode.js'

import {fillOdtTemplate, getOdtTextContent} from '../../exports.js'


test('template filling with several layers of formatting in {#each ...} start marker', async t => {
    const templatePath = join(import.meta.dirname, '../fixtures/formatting-liste-nombres-plusieurs-couches.odt')
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


test('template filling - both {#each ...} and {/each} within the same Text node are formatted', async t => {
    const templatePath = join(import.meta.dirname, '../fixtures/formatting-liste-nombres-2-markeurs-formatted.odt')
    const templateContent = `Liste de nombres

Les nombres : {#each nombres as n}{n} {/each} !!
`

    const data = {
        nombres : [2,3,5,8]
    }

    const odtTemplate = await getOdtTemplate(templatePath)

    const templateTextContent = await getOdtTextContent(odtTemplate)    
    t.deepEqual(templateTextContent, templateContent, 'reconnaissance du template')

    const odtResult = await fillOdtTemplate(odtTemplate, data)

    const odtResultTextContent = await getOdtTextContent(odtResult)
    t.deepEqual(odtResultTextContent, `Liste de nombres

Les nombres : 2 3 5 8  !!
`)

});


test('template filling - {#each ...} and text before partially formatted', async t => {
    const templatePath = join(import.meta.dirname, '../fixtures/formatting-liste-nombres-each-start-and-before-formatted.odt')
    const templateContent = `Liste de nombres

Les nombres : {#each nombres as n}{n} {/each} !!
`

    const data = {
        nombres : [3,5,8, 13]
    }

    const odtTemplate = await getOdtTemplate(templatePath)

    const templateTextContent = await getOdtTextContent(odtTemplate)    
    t.deepEqual(templateTextContent, templateContent, 'reconnaissance du template')

    const odtResult = await fillOdtTemplate(odtTemplate, data)

    const odtResultTextContent = await getOdtTextContent(odtResult)
    t.deepEqual(odtResultTextContent, `Liste de nombres

Les nombres : 3 5 8 13  !!
`)

});


test('template filling - {/each} and text after partially formatted', async t => {
    const templatePath = join(import.meta.dirname, '../fixtures/formatting-liste-nombres-each-end-and-after-formatted.odt')
    const templateContent = `Liste de nombres

Les nombres : {#each nombres as n}{n} {/each} !!
`

    const data = {
        nombres : [5,8, 13, 21]
    }

    const odtTemplate = await getOdtTemplate(templatePath)

    const templateTextContent = await getOdtTextContent(odtTemplate)    
    t.deepEqual(templateTextContent, templateContent, 'reconnaissance du template')

    const odtResult = await fillOdtTemplate(odtTemplate, data)

    const odtResultTextContent = await getOdtTextContent(odtResult)
    t.deepEqual(odtResultTextContent, `Liste de nombres

Les nombres : 5 8 13 21  !!
`)

});


test('template filling - partially formatted variable', async t => {
    const templatePath = join(import.meta.dirname, '../fixtures/partially-formatted-variable.odt')
    const templateContent = `Nombre

Voici le nombre : {nombre} !!!
`

    const data = {nombre : 37}

    const odtTemplate = await getOdtTemplate(templatePath)

    const templateTextContent = await getOdtTextContent(odtTemplate)    
    t.deepEqual(templateTextContent, templateContent, 'reconnaissance du template')
//try{
    const odtResult = await fillOdtTemplate(odtTemplate, data)
//}catch(e){console.error(e)}
    const odtResultTextContent = await getOdtTextContent(odtResult)
    t.deepEqual(odtResultTextContent, `Nombre

Voici le nombre : 37 !!!
`)

});


test('template filling - formatted-start-each-single-paragraph', async t => {
    const templatePath = join(import.meta.dirname, '../fixtures/formatted-start-each-single-paragraph.odt')
    const templateContent = `
{#each nombres as n}
{n}
{/each}
`

    const data = {nombres : [37, 38, 39]}

    const odtTemplate = await getOdtTemplate(templatePath)

    const templateTextContent = await getOdtTextContent(odtTemplate)    
    t.deepEqual(templateTextContent.trim(), templateContent.trim(), 'reconnaissance du template')
    
    const odtResult = await fillOdtTemplate(odtTemplate, data)

    const odtResultTextContent = await getOdtTextContent(odtResult)
    t.deepEqual(odtResultTextContent, `

37
38
39
`)

});


test('template filling - formatted ghost if then', async t => {
    const templatePath = join(import.meta.dirname, '../fixtures/ghost-if.odt')
    const templateContent = `
    Utilisation de sources lumineuses : {#if scientifique.source_lumineuses}Oui{:else}Non{/if}
`

    const data = {scientifique: {source_lumineuses: true}}

    const odtTemplate = await getOdtTemplate(templatePath)

    const templateTextContent = await getOdtTextContent(odtTemplate)    
    t.deepEqual(templateTextContent.trim(), templateContent.trim(), 'reconnaissance du template')
    let odtResult = await fillOdtTemplate(odtTemplate, data)

    const odtResultTextContent = await getOdtTextContent(odtResult)
    t.deepEqual(odtResultTextContent.trim(), `
 Utilisation de sources lumineuses : Oui
`.trim())

});


test('template filling - formatted ghost if else', async t => {
    const templatePath = join(import.meta.dirname, '../fixtures/ghost-if.odt')
    const templateContent = `
    Utilisation de sources lumineuses : {#if scientifique.source_lumineuses}Oui{:else}Non{/if}
`

    const data = {scientifique: {source_lumineuses: false}}

    const odtTemplate = await getOdtTemplate(templatePath)

    const templateTextContent = await getOdtTextContent(odtTemplate)    
    t.deepEqual(templateTextContent.trim(), templateContent.trim(), 'reconnaissance du template')
    let odtResult = await fillOdtTemplate(odtTemplate, data)

    const odtResultTextContent = await getOdtTextContent(odtResult)
    t.deepEqual(odtResultTextContent.trim(), `
 Utilisation de sources lumineuses : Non
`.trim())

});