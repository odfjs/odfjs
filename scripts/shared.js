//@ts-check
import { Uint8ArrayReader, ZipReader, TextWriter } from '@zip.js/zip.js';

import {parseXML} from './DOMUtils.js'

/** @import {Entry} from '@zip.js/zip.js'*/
/** @import {SheetName, SheetRawContent, SheetRowRawContent, SheetCellRawContent, OdfjsImage} from './types.js' */


// https://dom.spec.whatwg.org/#interface-node
const TEXT_NODE = 3

/**
 * 
 * @param {Element} cell 
 * @returns {string}
 */
function extraxtODSCellText(cell) {
    let text = '';
    const childNodes = cell.childNodes;
    for (const child of Array.from(childNodes)) {
        if (child.nodeType === TEXT_NODE) {
            // Direct text node, append the text directly
            text += child.nodeValue;
        } else if (child.nodeName === 'text:p') {
            if (text.length > 0) {
                // Add a newline before appending new paragraph if text already exists
                text += '\n';
            }
            const pNodes = child.childNodes;
            for (const pChild of Array.from(pNodes)) {
                if (pChild.nodeType === TEXT_NODE) {
                    text += pChild.nodeValue;  // Append text inside <text:p>
                } else if (pChild.nodeName === 'text:line-break') {
                    text += '\n';  // Append newline for <text:line-break />
                } else if (pChild.nodeName === 'text:a') {
                    text += pChild.textContent
                }
            }
        } else if (child.nodeName === 'text:line-break') {
            text += '\n';  // Append newline for <text:line-break /> directly under <table:table-cell>
        }
    }
    
    return text.trim();
}


/**
 * Extracts raw table content from an ODS file.
 * @param {ArrayBuffer} arrayBuffer - The ODS file.
 * @returns {Promise<Map<SheetName, SheetRawContent>>}
 */
export async function getODSTableRawContent(arrayBuffer) {
    const zipDataReader = new Uint8ArrayReader(new Uint8Array(arrayBuffer));
    const zipReader = new ZipReader(zipDataReader);
    const zipEntries = await zipReader.getEntries()
    await zipReader.close();

    /** @type {Map<Entry['filename'], Entry>} */
    const entryByFilename = new Map()
    for(const entry of zipEntries){
        const filename = entry.filename
        entryByFilename.set(filename, entry)
    }

    const contentXmlEntry = entryByFilename.get('content.xml')

    if(!contentXmlEntry){
        throw new TypeError(`entry 'content.xml' manquante dans le zip`)
    }

    // Extract the content.xml file which contains the spreadsheet data

    //@ts-ignore
    const contentXml = await contentXmlEntry.getData(new TextWriter());
    //console.log('contentXml', contentXml);

    const contentDoc = parseXML(contentXml);

    const tableMap = new Map();

    const tables = contentDoc.getElementsByTagName('table:table');

    for (let table of Array.from(tables)) {
        const sheetName = table.getAttribute('table:name');
        const rows = table.getElementsByTagName('table:table-row');
        const sheetData = [];

        for (let row of Array.from(rows)) {
            const cells = row.getElementsByTagName('table:table-cell');
            const rowData = [];

            for (let cell of Array.from(cells)) {
                const cellType = cell.getAttribute('office:value-type');
                let cellValue;

                if (cellType === 'string') {
                    cellValue = extraxtODSCellText(cell)
                } else if (cellType === 'date') {
                    cellValue = cell.getAttribute('office:date-value');
                } else {
                    cellValue = cell.getAttribute('office:value');
                }

                const numberOfColumnsRepeated = cell.getAttribute('table:number-columns-repeated');
                const repeatCount = numberOfColumnsRepeated ? parseInt(numberOfColumnsRepeated, 10) : 1;
                if(repeatCount < 100){ // ignore excessive repetitions
                    for (let i = 0; i < repeatCount; i++) {
                        rowData.push({
                            value: cellValue,
                            type: cellType
                        });
                    }
                }
            }

            sheetData.push(rowData);
        }

        tableMap.set(sheetName, sheetData);
    }

    return tableMap;
}


/**
 * Converts a cell value to the appropriate JavaScript type based on its cell type.
 * @param {SheetCellRawContent} _ 
 * @returns {number | boolean | string | Date} The converted value.
 */
export function convertCellValue({value, type}) {
    if(value === ''){
        return ''
    }
    if(value === null || value === undefined){
        return ''
    }

    switch (type) {
        case 'float':
        case 'percentage':
        case 'currency':
        case 'n': // number
            return parseFloat(value);
        case 'date':
        case 'd': // date
            return new Date(value);
        case 'boolean':
        case 'b': // boolean
            return value === '1' || value === 'true';
        case 's': // shared string
        case 'inlineStr': // inline string
        case 'string':
        case 'e': // error
        case 'time':
        default:
            return value;
    }
}


/**
 * @param {unknown} value
 * @returns {value is OdfjsImage} 
 */
export function isOdfjsImage(value) {
    if (typeof value === 'object' && value!==null 
        && "content" in value && value.content instanceof ArrayBuffer
        && "fileName" in value && typeof value.fileName === 'string'
        && "mediaType" in value && typeof value.mediaType === 'string'
    ) {
        return true
    } else {
        return false
    }
}






/**
 * 
 * @param {Map<SheetName, SheetRawContent>} rawContentSheets 
 * @returns {Map<SheetName, ReturnType<convertCellValue>[][]>}
 */
export function tableRawContentToValues(rawContentSheets){
    return new Map(
        [...rawContentSheets].map(([sheetName, rawContent]) => {
            return [
                sheetName, 
                rawContent
                    .map(row => row.map(c => convertCellValue(c)))
            ]
        })
    )
}

/**
 * Convert values to strings
 */

/**
 * 
 * @param {SheetCellRawContent} rawContentCell
 * @returns {string}
 */
export function cellRawContentToStrings(rawContentCell){
    return rawContentCell.value || ''
}

/**
 * 
 * @param {SheetRowRawContent} rawContentRow 
 * @returns {string[]}
 */
export function rowRawContentToStrings(rawContentRow){
    return rawContentRow.map(cellRawContentToStrings)
}

/**
 * 
 * @param {SheetRawContent} rawContentSheet 
 * @returns {string[][]}
 */
export function sheetRawContentToStrings(rawContentSheet){
    return rawContentSheet.map(rowRawContentToStrings)
}

/**
 * 
 * @param {Map<SheetName, SheetRawContent>} rawContentSheets 
 * @returns {Map<SheetName, string[][]>}
 */
export function tableRawContentToStrings(rawContentSheets){
    return new Map(
        [...rawContentSheets].map(([sheetName, rawContent]) => {
            return [ sheetName, sheetRawContentToStrings(rawContent) ]
        })
    )
}





/**
 * Convert rows to objects
 */

/**
 * This function expects the first row to contain string values which are used as column names
 * It outputs an array of objects which keys are 
 *
 * @param {SheetRawContent} rawContent 
 * @returns {any[]}
 */
export function sheetRawContentToObjects(rawContent){
    let [firstRow, ...dataRows] = rawContent

    /** @type {string[]} */
    
    const columns = firstRow.map((r, i) => {
        if (r.value === undefined || r.value === null || r.value === "") {
            return `Column ${i+1}`
        }

        return r.value
    })

    return dataRows
    .map(row => {
        const obj = Object.create(null)
        columns.forEach((column, i) => {
            const rawValue = row[i]
            obj[column] = rawValue ? convertCellValue(rawValue) : ''
        })
        return obj
    })

}

/**
 * 
 * @param {Map<SheetName, SheetRawContent>} rawContentSheets 
 * @returns {Map<SheetName, any[]>}
 */
export function tableRawContentToObjects(rawContentSheets){
    return new Map(
        [...rawContentSheets].map(([sheetName, rawContent]) => {
            return [sheetName, sheetRawContentToObjects(rawContent)]
        })
    )
}




/**
 * Emptiness
 */

/**
 * @param {SheetCellRawContent} rawCellContent
 * @returns {boolean}
 */
export function isCellFilled({value}){
    return value !== '' && value !== null && value !== undefined
}

/**
 * @param {SheetRowRawContent} rawContentRow 
 * @returns {boolean}
 */
export function isRowNotEmpty(rawContentRow){
    return rawContentRow.some(isCellFilled)
}

/**
 * @param {SheetRawContent} sheet 
 * @returns {SheetRawContent}
 */
export function removeEmptyRowsFromSheet(sheet){
    return sheet.filter(isRowNotEmpty)
}


/**
 * 
 * @param {Map<SheetName, SheetRawContent>} rawContentTable 
 * @returns {Map<SheetName, SheetRawContent>}
 */
export function tableWithoutEmptyRows(rawContentTable){
    return new Map(
        [...rawContentTable].map(([sheetName, rawContent]) => {
            return [sheetName, removeEmptyRowsFromSheet(rawContent)]
        })
    )
}