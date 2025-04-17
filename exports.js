//@ts-check

export {default as fillOdtTemplate} from './scripts/odf/fillOdtTemplate.js'
export {getOdtTextContent} from './scripts/odf/odt/getOdtTextContent.js'

export { createOdsFile } from './scripts/createOdsFile.js'

export {
    getODSTableRawContent,

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
} from './scripts/shared.js'

