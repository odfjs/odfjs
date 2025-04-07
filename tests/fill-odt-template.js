import test from 'ava';
import {join} from 'node:path';

import {getOdtTemplate, getOdtTextContent} from '../scripts/odf/odtTemplate-forNode.js'

import {fillOdtTemplate} from '../scripts/node.js'


test('basic template filling with variable substitution', async t => {
    const templatePath = join(import.meta.dirname, './data/template-anniversaire.odt')
    const templateContent = `Yo {nom} ! 
Tu es né.e le {dateNaissance}

Bonjoir ☀️
`

	const data = {
        nom: 'David Bruant',
        dateNaissance: '8 mars 1987'
    }

    const odtTemplate = await getOdtTemplate(templatePath)
    const templateTextContent = await getOdtTextContent(odtTemplate)
    t.deepEqual(templateTextContent, templateContent, 'reconnaissance du template')

    const odtResult = await fillOdtTemplate(odtTemplate, data)

    const odtResultTextContent = await getOdtTextContent(odtResult)
    t.deepEqual(odtResultTextContent, `Yo David Bruant ! 
Tu es né.e le 8 mars 1987

Bonjoir ☀️
`)

});



test('basic template filling with {#each}', async t => {
    const templatePath = join(import.meta.dirname, './data/enum-courses.odt')
    const templateContent = `🧺 La liste de courses incroyable 🧺

{#each listeCourses as élément}
{élément}
{/each}
`

	const data = {
        listeCourses : [
            'Radis',
            `Jus d'orange`,
            'Pâtes à lasagne (fraîches !)'
        ]
    }

    const odtTemplate = await getOdtTemplate(templatePath)

    const templateTextContent = await getOdtTextContent(odtTemplate)

    t.deepEqual(templateTextContent, templateContent, 'reconnaissance du template')

    const odtResult = await fillOdtTemplate(odtTemplate, data)

    const odtResultTextContent = await getOdtTextContent(odtResult)
    t.deepEqual(odtResultTextContent, `🧺 La liste de courses incroyable 🧺

Radis
Jus d'orange
Pâtes à lasagne (fraîches !)
`)


});



test('template filling with {#each} generating a list', async t => {
    const templatePath = join(import.meta.dirname, './data/liste-courses.odt')
    const templateContent = `🧺 La liste de courses incroyable 🧺

- {#each listeCourses as élément}
- {élément}
- {/each}
`

	const data = {
        listeCourses : [
            'Radis',
            `Jus d'orange`,
            'Pâtes à lasagne (fraîches !)'
        ]
    }

    const odtTemplate = await getOdtTemplate(templatePath)

    const templateTextContent = await getOdtTextContent(odtTemplate)

    t.deepEqual(templateTextContent, templateContent, 'reconnaissance du template')

    const odtResult = await fillOdtTemplate(odtTemplate, data)

    const odtResultTextContent = await getOdtTextContent(odtResult)
    t.deepEqual(odtResultTextContent, `🧺 La liste de courses incroyable 🧺

- Radis
- Jus d'orange
- Pâtes à lasagne (fraîches !)
`)


});


test('template filling with 2 sequential {#each}', async t => {
    const templatePath = join(import.meta.dirname, './data/liste-fruits-et-légumes.odt')
    const templateContent = `Liste de fruits et légumes

Fruits
{#each fruits as fruit}
{fruit}
{/each}

Légumes
{#each légumes as légume}
{légume}
{/each}
`

	const data = {
        fruits : [
            'Pastèque 🍉',
            `Kiwi 🥝`,
            'Banane 🍌'
        ],
        légumes: [
            'Champignon 🍄‍🟫',
            'Avocat 🥑',
            'Poivron 🫑'
        ]
    }

    const odtTemplate = await getOdtTemplate(templatePath)

    const templateTextContent = await getOdtTextContent(odtTemplate)    
    t.deepEqual(templateTextContent, templateContent, 'reconnaissance du template')

    const odtResult = await fillOdtTemplate(odtTemplate, data)

    const odtResultTextContent = await getOdtTextContent(odtResult)
    t.deepEqual(odtResultTextContent, `Liste de fruits et légumes

Fruits
Pastèque 🍉
Kiwi 🥝
Banane 🍌

Légumes
Champignon 🍄‍🟫
Avocat 🥑
Poivron 🫑
`)

});



test('template filling with nested {#each}s', async t => {
    const templatePath = join(import.meta.dirname, './data/légumes-de-saison.odt')
    const templateContent = `Légumes de saison

{#each légumesSaison as saisonLégumes}
{saisonLégumes.saison}
- {#each saisonLégumes.légumes as légume}
- {légume}
- {/each}

{/each}
`

	const data = {
        légumesSaison : [
            {
                saison: 'Printemps',
                légumes: [
                    'Asperge',
                    'Betterave',
                    'Blette'
                ]
            },
            {
                saison: 'Été',
                légumes: [
                    'Courgette',
                    'Poivron',
                    'Laitue'
                ]
            },
            {
                saison: 'Automne',
                légumes: [
                    'Poireau',
                    'Potiron',
                    'Brocoli'
                ]
            },
            {
                saison: 'Hiver',
                légumes: [
                    'Radis',
                    'Chou de Bruxelles',
                    'Frisée'
                ]
            }
        ]
    }

    const odtTemplate = await getOdtTemplate(templatePath)

    const templateTextContent = await getOdtTextContent(odtTemplate)    
    t.deepEqual(templateTextContent, templateContent, 'reconnaissance du template')

    const odtResult = await fillOdtTemplate(odtTemplate, data)

    const odtResultTextContent = await getOdtTextContent(odtResult)
    t.deepEqual(odtResultTextContent, `Légumes de saison

Printemps
- Asperge
- Betterave
- Blette

Été
- Courgette
- Poivron
- Laitue

Automne
- Poireau
- Potiron
- Brocoli

Hiver
- Radis
- Chou de Bruxelles
- Frisée

`)

});



test('template filling of a table', async t => {
    const templatePath = join(import.meta.dirname, './data/tableau-simple.odt')
    const templateContent = `Évolution énergie en kWh par personne en France

Année
Énergie par personne
{#each annéeConsos as annéeConso}

{annéeConso.année}
{annéeConso.conso}
{/each}
`

    /*
    Data sources:

    U.S. Energy Information Administration (2023)Energy Institute - 
    Statistical Review of World Energy (2024)Population based on various sources (2023)

    – with major processing by Our World in Data
    */
	const data = {
        annéeConsos : [
            { année: 1970, conso: 36252.637},
            { année: 1980, conso: 43328.78},
            { année: 1990, conso: 46971.94},
            { année: 2000, conso: 53147.277},
            { année: 2010, conso: 48062.32},
            { année: 2020, conso: 37859.246},
        ]
    }

    const odtTemplate = await getOdtTemplate(templatePath)

    const templateTextContent = await getOdtTextContent(odtTemplate)    
    t.deepEqual(templateTextContent.trim(), templateContent.trim(), 'reconnaissance du template')

    const odtResult = await fillOdtTemplate(odtTemplate, data)

    const odtResultTextContent = await getOdtTextContent(odtResult)
    t.deepEqual(odtResultTextContent.trim(), `Évolution énergie en kWh par personne en France

Année
Énergie par personne
1970
36252.637
1980
43328.78
1990
46971.94
2000
53147.277
2010
48062.32
2020
37859.246
`.trim())

});



