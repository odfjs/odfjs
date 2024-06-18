//@ts-check

let _DOMParser

if(typeof DOMParser !== 'undefined' && Object(DOMParser) === DOMParser && DOMParser.prototype && typeof DOMParser.prototype.parseFromString === 'function'){
    console.info('[ods-xlsx] Already existing DOMParser. Certainly in the browser')
    _DOMParser = DOMParser
}
else{
    console.info('[ods-xlsx] No native DOMParser. Certainly in Node.js')

    const xmldom = await import('@xmldom/xmldom')
    _DOMParser = xmldom.DOMParser
}

function parseXML(str){
    return (new _DOMParser()).parseFromString(str, 'application/xml');
}

import {
    _getODSTableRawContent, 
    _getXLSXTableRawContent
} from './shared.js'

/**
 * @param {ArrayBuffer} odsArrBuff
 * @returns {ReturnType<_getODSTableRawContent>}
 */
export function getODSTableRawContent(odsArrBuff){
    return _getODSTableRawContent(odsArrBuff, parseXML)
}

/**
 * @param {ArrayBuffer} xlsxArrBuff
 * @returns {ReturnType<_getXLSXTableRawContent>}
 */
export function getXLSXTableRawContent(xlsxArrBuff){
    return _getXLSXTableRawContent(xlsxArrBuff, parseXML)
}


export {
    isRowNotEmpty,
    // table-level exports
    tableWithoutEmptyRows,
    tableRawContentToValues,
    tableRawContentToStrings,
    tableRawContentToObjects, 
} from './shared.js'

