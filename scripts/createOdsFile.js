import { ZipWriter, BlobWriter, TextReader } from '@zip.js/zip.js';

/** @import {SheetCellRawContent, SheetName, SheetRawContent} from './types.js' */

const stylesXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles 
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  office:version="1.2">
  <office:styles/>
  <office:automatic-styles/>
  <office:master-styles/>
</office:document-styles>`;

const manifestXml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest manifest:version="1.2" xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <manifest:file-entry manifest:media-type="application/vnd.oasis.opendocument.spreadsheet" manifest:full-path="/"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="content.xml"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="styles.xml"/>
</manifest:manifest>`;

/**
 * Crée un fichier .ods à partir d'un Map de feuilles de calcul
 * @param {Map<SheetName, SheetRawContent>} sheetsData
 * @param {typeof DOMImplementation.prototype.createDocument} createDocument 
 * @param {typeof XMLSerializer.prototype.serializeToString} serializeToString 
 * @returns {Promise<ArrayBuffer>}
 */
export async function _createOdsFile(sheetsData, createDocument, serializeToString) {
    // Create a new zip writer
    const zipWriter = new ZipWriter(new BlobWriter('application/vnd.oasis.opendocument.spreadsheet'));

    // The “mimetype” file shall be the first file of the zip file. 
    // It shall not be compressed, and it shall not use an 'extra field' in its header.
    // https://docs.oasis-open.org/office/OpenDocument/v1.3/os/part2-packages/OpenDocument-v1.3-os-part2-packages.html#__RefHeading__752809_826425813
    zipWriter.add(
        "mimetype",
        new TextReader("application/vnd.oasis.opendocument.spreadsheet"),
        {
            compressionMethod: 0,
            level: 0,
            dataDescriptor: false,
            extendedTimestamp: false,
        }
    );

    const contentXml = generateContentFileXMLString(sheetsData, createDocument, serializeToString);
    zipWriter.add("content.xml", new TextReader(contentXml), {level: 9});

    zipWriter.add("styles.xml", new TextReader(stylesXml));

    zipWriter.add('META-INF/manifest.xml', new TextReader(manifestXml));

    // Close the zip writer and get the ArrayBuffer
    const zipFile = await zipWriter.close();
    return zipFile.arrayBuffer();
}


/**
 * Generate the content.xml file with spreadsheet data
 * @param {Map<SheetName, SheetRawContent>} sheetsData 
 * @param {typeof DOMImplementation.prototype.createDocument} createDocument 
 * @param {typeof XMLSerializer.prototype.serializeToString} serializeToString 
 * @returns {string}
 */
function generateContentFileXMLString(sheetsData, createDocument, serializeToString) {
    const doc = createDocument('urn:oasis:names:tc:opendocument:xmlns:office:1.0', 'office:document-content');
    const root = doc.documentElement;

    // Set up namespaces
    root.setAttribute('xmlns:table', 'urn:oasis:names:tc:opendocument:xmlns:table:1.0');
    root.setAttribute('xmlns:text', 'urn:oasis:names:tc:opendocument:xmlns:text:1.0');
    root.setAttribute('xmlns:style', 'urn:oasis:names:tc:opendocument:xmlns:style:1.0');
    root.setAttribute('xmlns:number', 'urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0');
    root.setAttribute('xmlns:fo', 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0');
    root.setAttribute('office:version', '1.2');

    const bodyNode = doc.createElement('office:body');
    root.appendChild(bodyNode);

    const spreadsheetNode = doc.createElement('office:spreadsheet');
    bodyNode.appendChild(spreadsheetNode);

    // Iterate through sheets
    sheetsData.forEach((sheetData, sheetName) => {
        const tableNode = doc.createElement('table:table');
        tableNode.setAttribute('table:name', sheetName);
        spreadsheetNode.appendChild(tableNode);

        const columnNode = doc.createElement('table:table-column');
        tableNode.appendChild(columnNode);

        // Iterate through rows
        sheetData.forEach((row) => {
            const rowNode = doc.createElement('table:table-row');
            tableNode.appendChild(rowNode);

            // Iterate through cells in row
            row.forEach((cell) => {
                const cellNode = doc.createElement('table:table-cell');
                const cellType = convertCellType(cell.type);
                cellNode.setAttribute('office:value-type', cellType);

                // Add value attribute based on type
                if (cell.value !== null && cell.value !== undefined) {
                    switch (cellType) {
                        case 'float':
                            cellNode.setAttribute('office:value', cell.value.toString());
                            break;
                        case 'percentage':
                            cellNode.setAttribute('office:value', cell.value.toString());
                            cellNode.setAttribute('office:value-type', 'percentage');
                            break;
                        case 'date':
                            cellNode.setAttribute('office:date-value', cell.value.toString());
                            break;
                        case 'boolean':
                            cellNode.setAttribute('office:boolean-value', cell.value ? 'true' : 'false');
                            break;
                        default:
                            const textNode = doc.createElement('text:p');
                            textNode.textContent = cell.value.toString();
                            cellNode.appendChild(textNode);
                            break;
                    }

                    if (cellType !== 'string') {
                        const textNode = doc.createElement('text:p');
                        textNode.textContent = cell.value.toString();
                        cellNode.appendChild(textNode);
                    }
                }

                rowNode.appendChild(cellNode);
            });
        });
    });

    return serializeToString(doc);
}

/**
 * Convert cell type to OpenDocument format type
 * @param {SheetCellRawContent['type']} type 
 * @returns {SheetCellRawContent['type']}
 */
function convertCellType(type) {
    const typeMap = {
        'float': 'float',
        'percentage': 'percentage',
        'currency': 'currency',
        'date': 'date',
        'time': 'time',
        'boolean': 'boolean',
        'string': 'string',
        'n': 'float',
        's': 'string',
        'd': 'date',
        'b': 'boolean'
    };
    return typeMap[type] || 'string';
}

