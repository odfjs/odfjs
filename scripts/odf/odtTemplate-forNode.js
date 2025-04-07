import { readFile } from 'node:fs/promises'

import { ZipReader, Uint8ArrayReader, TextWriter } from '@zip.js/zip.js';
import {DOMParser, Node} from '@xmldom/xmldom'


/** @import {ODTFile} from './fillOdtTemplate.js' */


/**
 * 
 * @param {Document} odtDocument 
 * @returns {Element}
 */
function getODTTextElement(odtDocument) {
    return odtDocument.getElementsByTagName('office:body')[0]
        .getElementsByTagName('office:text')[0]
}


/**
 * 
 * @param {string} path 
 * @returns {Promise<ODTFile>}
 */
export async function getOdtTemplate(path) {
    const fileBuffer = await readFile(path)
    return fileBuffer.buffer
}

/**
 * Extracts plain text content from an ODT file, preserving line breaks
 * @param {ArrayBuffer} odtFile - The ODT file as an ArrayBuffer
 * @returns {Promise<string>} Extracted text content
 */
export async function getOdtTextContent(odtFile) {
    const contentDocument = await getContentDocument(odtFile)
    const odtTextElement = getODTTextElement(contentDocument)

    /**
     * 
     * @param {Element} element 
     * @returns {string}
     */
    function getElementTextContent(element){
        //console.log('tagName', element.tagName)
        if(element.tagName === 'text:h' || element.tagName === 'text:p')
            return element.textContent + '\n'
        else{
            const descendantTexts = Array.from(element.childNodes)
                .filter(n => n.nodeType === Node.ELEMENT_NODE)
                .map(getElementTextContent)

            if(element.tagName === 'text:list-item')
                return `- ${descendantTexts.join('')}`

            return descendantTexts.join('')
        }
    }

    return getElementTextContent(odtTextElement)
}


/**
 * @param {ODTFile} odtFile 
 * @returns {Promise<Document>}
 */
async function getContentDocument(odtFile) {
    const reader = new ZipReader(new Uint8ArrayReader(new Uint8Array(odtFile)));

    const entries = await reader.getEntries();

    const contentEntry = entries.find(entry => entry.filename === 'content.xml');

    if (!contentEntry) {
        throw new Error('No content.xml found in the ODT file');
    }

    // @ts-ignore
    const contentText = await contentEntry.getData(new TextWriter());
    await reader.close();

    const parser = new DOMParser();

    return parser.parseFromString(contentText, 'text/xml');
}