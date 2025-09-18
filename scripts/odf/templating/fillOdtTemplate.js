import {ZipReader, ZipWriter, BlobReader, BlobWriter, TextReader, Uint8ArrayReader, TextWriter, Uint8ArrayWriter} from '@zip.js/zip.js';

import {parseXML, serializeToString} from '../../DOMUtils.js'
import {makeManifestFile, getManifestFileData} from '../manifest.js';
import prepareTemplateDOMTree from './prepareTemplateDOMTree.js';

import 'ses'
import fillOdtElementTemplate from './fillOdtElementTemplate.js';


/** @import {Reader, ZipWriterAddDataOptions} from '@zip.js/zip.js' */
/** @import {ODFManifest, ODFManifestFileEntry} from '../manifest.js' */
/** @import {OdfjsImage} from '../../types.js' */

/** @typedef {ArrayBuffer} ODTFile */

const ODTMimetype = 'application/vnd.oasis.opendocument.text'



/**
 * 
 * @param {Document} document 
 * @param {Compartment} compartment 
 * @param {(OdfjsImage) => string} addImageToOdtFile
 * @returns {void}
 */
function fillOdtDocumentTemplate(document, compartment, addImageToOdtFile) {
    prepareTemplateDOMTree(document)
    fillOdtElementTemplate(document, compartment, addImageToOdtFile)
}



const keptFiles = new Set(['content.xml', 'styles.xml', 'mimetype', 'META-INF/manifest.xml'])

/**
 * 
 * @param {string} filename 
 * @returns {boolean}
 */
function keepFile(filename) {
    return keptFiles.has(filename) || filename.startsWith('Pictures/')
}


/**
 * @param {ODTFile} odtTemplate
 * @param {any} data 
 * @returns {Promise<ODTFile>}
 */
export default async function fillOdtTemplate(odtTemplate, data) {

    const reader = new ZipReader(new Uint8ArrayReader(new Uint8Array(odtTemplate)));

    // Lire toutes les entrées du fichier ODT
    const entries = reader.getEntriesGenerator();

    // Créer un ZipWriter pour le nouveau fichier ODT
    const writer = new ZipWriter(new Uint8ArrayWriter());

    /** @type {ODFManifest} */
    let manifestFileData;

    /** @type {{filename: string, content: Reader, options?: ZipWriterAddDataOptions}[]} */
    const zipEntriesToAdd = []
    /** @type {ODFManifestFileEntry[]} */
    const newManifestEntries = []

    /** 
     * Return href
     * @param {OdfjsImage} odfjsImage
     * @returns {string}
    */
    function addImageToOdtFile(odfjsImage) {
        // console.log({odfjsImage})
        const filename = `Pictures/${odfjsImage.fileName}`
        zipEntriesToAdd.push({content: new Uint8ArrayReader(new Uint8Array(odfjsImage.content)), filename})
        newManifestEntries.push({fullPath: filename, mediaType: odfjsImage.mediaType})
        return filename
    }

    // Parcourir chaque entrée du fichier ODT
    for await(const entry of entries) {
        const filename = entry.filename

        //console.log('entry', filename, entry.directory)

        // remove other files
        if(!keepFile(filename)) {
            // ignore, do not create a corresponding entry in the new zip
        }
        else {
            let content
            let options

            switch(filename) {
                case 'mimetype':
                    content = new TextReader(ODTMimetype)
                    options = {
                        level: 0,
                        compressionMethod: 0,
                        dataDescriptor: false,
                        extendedTimestamp: false,
                    }

                    zipEntriesToAdd.push({filename, content, options})

                    break;
                case 'content.xml':
                    // @ts-ignore
                    const contentXml = await entry.getData(new TextWriter());
                    const contentDocument = parseXML(contentXml);
                    


                    const compartment = new Compartment({
                        globals: data,
                        __options__: true
                    })

                    fillOdtDocumentTemplate(contentDocument, compartment, addImageToOdtFile)

                    const updatedContentXml = serializeToString(contentDocument)

                    content = new TextReader(updatedContentXml)
                    options = {
                        lastModDate: entry.lastModDate,
                        level: 9
                    };

                    zipEntriesToAdd.push({filename, content, options})

                    break;

                case 'META-INF/manifest.xml':
                    // @ts-ignore
                    const manifestXml = await entry.getData(new TextWriter());
                    const manifestDocument = parseXML(manifestXml);
                    manifestFileData = getManifestFileData(manifestDocument)

                    break;

                case 'styles.xml':
                default:
                    const blobWriter = new BlobWriter();
                    // @ts-ignore
                    await entry.getData(blobWriter);
                    const blob = await blobWriter.getData();

                    content = new BlobReader(blob)
                    zipEntriesToAdd.push({filename, content})
                    break;
            }
        }
    }

    for(const {fullPath, mediaType} of newManifestEntries){
        manifestFileData.fileEntries.set(fullPath, {fullPath, mediaType})
    }

    for(const {filename, content, options} of zipEntriesToAdd) {
        await writer.add(filename, content, options);
    }

    const newZipFilenames = new Set(zipEntriesToAdd.map(ze => ze.filename))

    if(!manifestFileData) {
        throw new Error(`'META-INF/manifest.xml' zip entry missing`)
    }

    // remove ignored files from manifest.xml
    for(const filename of manifestFileData.fileEntries.keys()) {
        if(!newZipFilenames.has(filename)) {
            manifestFileData.fileEntries.delete(filename)
        }
    }

    const manifestFileXml = makeManifestFile(manifestFileData)
    await writer.add('META-INF/manifest.xml', new TextReader(manifestFileXml));

    await reader.close();

    return writer.close();
}

