//@ts-check

import { _getODSTableRawContent } from './shared.js'

import {_createOdsFile} from './createOdsFile.js'

import _fillOdtTemplate from './odf/fillOdtTemplate.js'


/** @import {SheetCellRawContent, SheetName, SheetRawContent} from './types.js' */
/** @import {ODTFile} from './odf/fillOdtTemplate.js' */


function parseXML(str){
    return (new DOMParser()).parseFromString(str, 'application/xml');
}

/**
 * @param {ArrayBuffer} odsArrBuff
 * @returns {ReturnType<_getODSTableRawContent>}
 */
export function getODSTableRawContent(odsArrBuff){
    return _getODSTableRawContent(odsArrBuff, parseXML)
}



/** @type { typeof DOMImplementation.prototype.createDocument } */
const createDocument = function createDocument(...args){
    // @ts-ignore
    return document.implementation.createDocument(...args)
}

const serializer = new XMLSerializer()

/** @type { typeof XMLSerializer.prototype.serializeToString } */
const serializeToString = function serializeToString(node){
    return serializer.serializeToString(node)
}

/**
 * @param {ODTFile} odtTemplate
 * @param {any} data 
 * @returns {Promise<ODTFile>}
 */
export function fillOdtTemplate(odtTemplate, data){
    return _fillOdtTemplate(odtTemplate, data, parseXML, serializeToString, Node)
}


/**
 * @param {Map<SheetName, SheetRawContent>} sheetsData
 */
export function createOdsFile(sheetsData){
    return _createOdsFile(sheetsData, createDocument, serializeToString)
}


export {
    // table-level exports
    tableWithoutEmptyRows,
    tableRawContentToValues,
    tableRawContentToStrings,
    tableRawContentToObjects, 

    // sheet-level exports
    sheetRawContentToObjects,
    sheetRawContentToStrings,

    // row-level exports
    rowRawContentToStrings,
    isRowNotEmpty,

    // cell-level exports
    cellRawContentToStrings,
    convertCellValue
} from './shared.js'

