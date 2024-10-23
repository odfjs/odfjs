//@ts-check

import XLSX from 'xlsx'

import {tableRawContentToValues} from './shared.js'

/** @import {SheetName, SheetRawContent, SheetRowRawContent, SheetCellRawContent} from './types.js' */

const officeVersion = '1.2'

/**
 * Crée un fichier .ods à partir d'un Map de feuilles de calcul
 * @param {Map<SheetName, SheetRawContent>} sheetsData
 * @returns {Promise<ArrayBuffer>}
 */
export async function createOdsFile(sheetsData) {
    const workbook = XLSX.utils.book_new();

    const sheetsDataValues = tableRawContentToValues(sheetsData)

    for(const [sheetName, table] of sheetsDataValues){
        const worksheet = XLSX.utils.aoa_to_sheet(table);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }

    return XLSX.write(workbook, {bookType: 'ods', type: 'array'});
}
