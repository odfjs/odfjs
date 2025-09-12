import {writeFile} from 'node:fs/promises'
import {join} from 'node:path';

import {getOdtTemplate} from '../scripts/odf/odtTemplate-forNode.js'
import {fillOdtTemplate} from '../exports.js'

/*
const templatePath = join(import.meta.dirname, '../tests/fixtures/template-anniversaire.odt')
const data = {
    nom: 'David Bruant',
    dateNaissance: '8 mars 1987'
}
*/

/*const templatePath = join(import.meta.dirname, '../tests/fixtures/enum-courses.odt')
const data = {
    listeCourses : [
        'Radis',
        `Jus d'orange`,
        'Pâtes à lasagne (fraîches !)'
    ]
}*/

/*
const templatePath = join(import.meta.dirname, '../tests/fixtures/liste-fruits-et-légumes.odt')
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

/*
const templatePath = join(import.meta.dirname, '../tests/fixtures/légumes-de-saison.odt')
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
*/

/*
const templatePath = join(import.meta.dirname, '../tests/fixtures/tableau-simple.odt')
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
    */


/*
const templatePath = join(import.meta.dirname, '../tests/fixtures/template-avec-image.odt')

const data = {
    commentaire : `J'adooooooore 🤩 West covinaaaaaaaaaaa 🎶`
}
*/
/*
const templatePath = join(import.meta.dirname, '../tests/fixtures/partially-formatted-variable.odt')
const data = {nombre : 37}
*/  

/*
const templatePath = join(import.meta.dirname, '../tests/fixtures/text-after-closing-each.odt')
const data = {
    saison: 'Printemps',
    légumes: [
        'Asperge',
        'Betterave',
        'Blette'
    ]
}
*/

const templatePath = join(import.meta.dirname, '../tests/fixtures/AP_scientifiques.odt')
const data = {nombre : 37}


const odtTemplate = await getOdtTemplate(templatePath)
const odtResult = await fillOdtTemplate(odtTemplate, data)

writeFile('yo.odt', new Uint8Array(odtResult))
