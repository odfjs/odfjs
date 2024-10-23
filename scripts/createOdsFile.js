//@ts-check

import {write, utils} from 'xlsx'
import {tableRawContentToValues} from './shared.js'

/** @import {SheetName, SheetRawContent} from './types.js' */

/**
 * Crée un fichier .ods à partir d'un Map de feuilles de calcul
 * @param {Map<SheetName, SheetRawContent>} sheetsData
 * @returns {Promise<ArrayBuffer>}
 */
export async function createOdsFile(sheetsData) {
    const workbook = utils.book_new();

    const sheetsDataValues = tableRawContentToValues(sheetsData)

    for(const [sheetName, table] of sheetsDataValues){
        const worksheet = utils.aoa_to_sheet(table);
        utils.book_append_sheet(workbook, worksheet, sheetName);
    }

    return write(workbook, {bookType: 'ods', type: 'array'});
}
