import {join} from 'node:path';

import {getOdtTemplate} from '../scripts/odf/odtTemplate-forNode.js'
import {fillOdtTemplate} from '../scripts/node.js'

/*
const templatePath = join(import.meta.dirname, '../tests/data/template-anniversaire.odt')
const data = {
    nom: 'David Bruant',
    dateNaissance: '8 mars 1987'
}
*/


/*
const templatePath = join(import.meta.dirname, '../tests/data/liste-courses.odt')
const data = {
    listeCourses : [
        'Radis',
        `Jus d'orange`,
        'Pâtes à lasagne (fraîches !)'
    ]
}
*/

/*
const templatePath = join(import.meta.dirname, '../tests/data/liste-fruits-et-légumes.odt')
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
}*/

const templatePath = join(import.meta.dirname, '../tests/data/tableau-simple.odt')
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
const odtResult = await fillOdtTemplate(odtTemplate, data)

process.stdout.write(new Uint8Array(odtResult))