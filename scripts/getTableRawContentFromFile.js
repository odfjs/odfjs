//@ts-check

import { unzip } from 'unzipit';

const parser = new DOMParser();

/**
 * 
 * @param {string} str 
 * @returns {Document}
 */
function parseXML(str){
    return parser.parseFromString(str, 'application/xml');
}

/**
 * @typedef TableCellRawContent
 * @prop {string} value
 * @prop {'float' | 'percentage' | 'currency' | 'date' | 'time' | 'boolean' | 'string' | 'b' | 'd' | 'e' | 'inlineStr' | 'n' | 's' | 'str'} type
 * 
 */

const ODS_TYPE = "application/vnd.oasis.opendocument.spreadsheet";
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


/**
 * Converts a cell value to the appropriate JavaScript type based on its cell type.
 * @param {string} value - The value of the cell.
 * @param {TableCellRawContent['type']} cellType - The type of the cell.
 * @returns {any} The converted value.
 */
function convertCellValue(value, cellType) {
    if(value === ''){
        return ''
    }

    switch (cellType) {
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
 * Extracts raw table content from an ODS file.
 * @param {File} file - The ODS file.
 * @param {Function} unzip - Function to unzip the file.
 * @param {Function} parseXML - Function to parse XML content.
 * @returns {Promise<Map<SheetName, TableCellRawContent[][]>>}
 */
async function getTableRawContentFromODSFile(file, unzip, parseXML) {
    const zip = await unzip(file);
    console.log('zip', zip)
    const entries = zip.entries;

    // Extract the content.xml file which contains the spreadsheet data
    const contentXml = await entries['content.xml'].text();
    const contentDoc = parseXML(contentXml);

    const tableMap = new Map();

    // Navigate the XML structure to extract table data
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
 * @returns {Promise<Map<SheetName, TableCellRawContent[][]>>}
 */
async function getTableRawContentFromXSLXFile(file, unzip, parseXML) {
    const zip = await unzip(file);
    const entries = zip.entries;

    // Read shared strings
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



/** @typedef {string} SheetName */

/**
 * 
 * @param {File} file 
 * @returns {Promise<Map<SheetName, TableCellRawContent[][]>>}
 */
export default function getTableRawContentFromFile(file){
    if(file.type === ODS_TYPE)
        return getTableRawContentFromODSFile(file, unzip, parseXML)

    if(file.type === XLSX_TYPE)
        return getTableRawContentFromXSLXFile(file, unzip, parseXML)

    throw new TypeError(`Unsupported file type: ${file.type} (${file.name})`)
}


