import test from 'ava';
import {join} from 'node:path';

import {getOdtTemplate} from '../../scripts/odf/odtTemplate-forNode.js'

import {fillOdtTemplate, getOdtTextContent} from '../../exports.js'


test('basic template filling with {#if}', async t => {
    const templatePath = join(import.meta.dirname, '../fixtures/description-nombre.odt')
    const templateContent = `Description du nombre {n}

{#if n<5}
n est un petit nombre
{:else}
n est un grand nombre
{/if}
`

    const odtTemplate = await getOdtTemplate(templatePath)
    const templateTextContent = await getOdtTextContent(odtTemplate)
    t.deepEqual(templateTextContent, templateContent, 'reconnaissance du template')

    // then branch
    const odtResult3 = await fillOdtTemplate(odtTemplate, {n: 3})
    const odtResult3TextContent = await getOdtTextContent(odtResult3)
    t.deepEqual(odtResult3TextContent, `Description du nombre 3

n est un petit nombre
`)
    
    // else branch
    const odtResult8 = await fillOdtTemplate(odtTemplate, {n: 8})
    const odtResult8TextContent = await getOdtTextContent(odtResult8)
    t.deepEqual(odtResult8TextContent, `Description du nombre 8

n est un grand nombre
`)


});


test('weird bug', async t => {
    const templatePath = join(import.meta.dirname, '../fixtures/left-branch-content-and-two-consecutive-ifs.odt')
    const templateContent = `Utilisation de sources lumineuses : {#if scientifique.source_lumineuses}Oui{:else}Non{/if}
{#if scientifique.source_lumineuses && scientifique.modalités_source_lumineuses }
Modalités d’utilisation de sources lumineuses : {scientifique.modalités_source_lumineuses}
{/if}
`

    const data = {
        scientifique: {
            source_lumineuses: false,
            //modalités_source_lumineuses: 'lampes torches'
        }
    }


    const odtTemplate = await getOdtTemplate(templatePath)
    const templateTextContent = await getOdtTextContent(odtTemplate)
    t.deepEqual(templateTextContent.trim(), templateContent.trim(), 'reconnaissance du template')

    const odtResult = await fillOdtTemplate(odtTemplate, data)
    const odtResultTextContent = await getOdtTextContent(odtResult)
    t.deepEqual(odtResultTextContent.trim(), `Utilisation de sources lumineuses : Non`)

});

