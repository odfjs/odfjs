//@ts-check
import { unzip } from 'unzipit';

import './types.js'

/**
 * Extracts raw table content from an ODS file.
 * @param {ArrayBuffer} arrayBuffer - The ODS file.
 * @param {(str: String) => Document} parseXML - Function to parse XML content.
 * @returns {Promise<Map<SheetName, SheetRawContent>>}
 */
export async function _getODSTableRawContent(arrayBuffer, parseXML) {
    const zip = await unzip(arrayBuffer);
    const entries = zip.entries;

    // Extract the content.xml file which contains the spreadsheet data
    const contentXml = await entries['content.xml'].text();
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
                const cellValue = cellType === 'string' ? cell.textContent : cell.getAttribute('office:value');
                rowData.push({
                    value: cellValue,
                    type: cellType
                });
            }

            sheetData.push(rowData);
        }

        tableMap.set(sheetName, sheetData);
    }

    return tableMap;
}

/**
 * Extracts raw table content from an XLSX file.
 * @param {ArrayBuffer} arrayBuffer - The XLSX file.
 * @param {(str: String) => Document} parseXML - Function to parse XML content.
 * @returns {Promise<Map<SheetName, SheetRawContent>>}
 */
export async function _getXLSXTableRawContent(arrayBuffer, parseXML) {
    const zip = await unzip(arrayBuffer);
    const entries = zip.entries;

    const sharedStringsXml = await entries['xl/sharedStrings.xml'].text();
    const sharedStringsDoc = parseXML(sharedStringsXml);
    const sharedStrings = Array.from(sharedStringsDoc.getElementsByTagName('sst')[0].getElementsByTagName('si')).map(si => si.textContent);

    // Get sheet names and their corresponding XML files
    const workbookXml = await entries['xl/workbook.xml'].text();
    const workbookDoc = parseXML(workbookXml);
    const sheets = Array.from(workbookDoc.getElementsByTagName('sheets')[0].getElementsByTagName('sheet'));
    const sheetNames = sheets.map(sheet => sheet.getAttribute('name'));
    const sheetIds = sheets.map(sheet => sheet.getAttribute('r:id'));

    // Read the relations to get the actual filenames for each sheet
    const workbookRelsXml = await entries['xl/_rels/workbook.xml.rels'].text();
    const workbookRelsDoc = parseXML(workbookRelsXml);
    const sheetRels = Array.from(workbookRelsDoc.getElementsByTagName('Relationship'));
    const sheetFiles = sheetIds.map(id => sheetRels.find(rel => rel.getAttribute('Id') === id).getAttribute('Target').replace('worksheets/', ''));

    // Read each sheet's XML and extract data in parallel
    const sheetDataPs = sheetFiles.map((sheetFile, index) => (
        entries[`xl/worksheets/${sheetFile}`].text().then(sheetXml => {
            const sheetDoc = parseXML(sheetXml);

            const rows = sheetDoc.getElementsByTagName('sheetData')[0].getElementsByTagName('row');
            const sheetData = [];

            for (let row of rows) {
                const cells = row.getElementsByTagName('c');
                const rowData = [];

                for (let cell of cells) {
                    const cellType = cell.getAttribute('t') || 'n';
                    let cellValue = cell.getElementsByTagName('v')[0]?.textContent || '';

                    if (cellType === 's') {
                        cellValue = sharedStrings[parseInt(cellValue, 10)];
                    }

                    rowData.push({
                        value: cellValue,
                        type: cellType
                    });
                }

                sheetData.push(rowData);
            }

            return [sheetNames[index], sheetData];
        })
    ));

    return new Map(await Promise.all(sheetDataPs));
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
    //@ts-expect-error this type is correct after the filter
    const columns = firstRow.filter(({value}) => typeof value === 'string' && value.length >= 1).map(r => r.value)

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