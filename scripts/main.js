//@ts-check

import { unzip } from 'unzipit';

/**
 * @typedef SheetCellRawContent
 * @prop {string | null | undefined} value
 * @prop {'float' | 'percentage' | 'currency' | 'date' | 'time' | 'boolean' | 'string' | 'b' | 'd' | 'e' | 'inlineStr' | 'n' | 's' | 'str'} type
 */

/** @typedef {SheetCellRawContent[]} SheetRowRawContent */
/** @typedef {SheetRowRawContent[]} SheetRawContent */

/** @typedef {string} SheetName */


const ODS_TYPE = "application/vnd.oasis.opendocument.spreadsheet";
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


/**
 * Extracts raw table content from an ODS file.
 * @param {File} file - The ODS file.
 * @param {Function} unzip - Function to unzip the file.
 * @param {Function} parseXML - Function to parse XML content.
 * @returns {Promise<Map<SheetName, SheetRawContent>>}
 */
async function getTableRawContentFromODSFile(file, unzip, parseXML) {
    const zip = await unzip(file);
    const entries = zip.entries;

    // Extract the content.xml file which contains the spreadsheet data
    const contentXml = await entries['content.xml'].text();
    const contentDoc = parseXML(contentXml);

    const tableMap = new Map();

    const tables = contentDoc.getElementsByTagName('table:table');

    for (let table of tables) {
        const sheetName = table.getAttribute('table:name');
        const rows = table.getElementsByTagName('table:table-row');
        const sheetData = [];

        for (let row of rows) {
            const cells = row.getElementsByTagName('table:table-cell');
            const rowData = [];

            for (let cell of cells) {
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
 * @param {File} file - The XLSX file.
 * @param {Function} unzip - Function to unzip the file.
 * @param {Function} parseXML - Function to parse XML content.
 * @returns {Promise<Map<SheetName, SheetRawContent>>}
 */
async function getTableRawContentFromXSLXFile(file, unzip, parseXML) {
    const zip = await unzip(file);
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



const parser = new DOMParser();

/**
 * @param {string} str 
 * @returns {Document}
 */
function parseXML(str){
    return parser.parseFromString(str, 'application/xml');
}


/**
 * 
 * @param {File} file 
 * @returns {Promise<Map<SheetName, SheetRawContent>>}
 */
export function getTableRawContentFromFile(file){
    if(file.type === ODS_TYPE)
        return getTableRawContentFromODSFile(file, unzip, parseXML)

    if(file.type === XLSX_TYPE)
        return getTableRawContentFromXSLXFile(file, unzip, parseXML)

    throw new TypeError(`Unsupported file type: ${file.type} (${file.name})`)
}



/**
 * Converts a cell value to the appropriate JavaScript type based on its cell type.
 * @param {SheetCellRawContent} _ 
 * @returns {number | boolean | string | Date} The converted value.
 */
function convertCellValue({value, type}) {
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
 * @param {SheetCellRawContent} rawCellContent
 * @returns {boolean}
 */
function isCellNotEmpty({value}){
    return value !== '' && value !== null && value !== undefined
}

/**
 * @param {SheetRowRawContent} rawContentRow 
 * @returns {boolean}
 */
function isRowNotEmpty(rawContentRow){
    return rawContentRow.some(isCellNotEmpty)
}

/**
 * 
 * @param {SheetRawContent} rawContent 
 * @returns {any[]}
 */
function rawContentToObjects(rawContent){
    let [firstRow, ...dataRows] = rawContent

    /** @type {string[]} */
    //@ts-expect-error this type is correct after the filter
    const columns = firstRow.filter(({value}) => typeof value === 'string' && value.length >= 1).map(r => r.value)

    return dataRows
    .filter(isRowNotEmpty) // remove empty rows
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
            return [sheetName, rawContentToObjects(rawContent)]
        })
    )
}

