import test from 'ava';
import {join} from 'node:path';

import {getOdtTemplate} from '../../scripts/odf/odtTemplate-forNode.js'

import {fillOdtTemplate, getOdtTextContent} from '../../exports.js'
import { listZipEntries } from '../helpers/zip-analysis.js';


test('basic template filling with variable substitution', async t => {
    const templatePath = join(import.meta.dirname, '../fixtures/template-anniversaire.odt')
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

