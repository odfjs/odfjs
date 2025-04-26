import { ZipReader, Uint8ArrayReader } from '@zip.js/zip.js';

/**
 * 
 * @param {ArrayBuffer} odtTemplate 
 * @returns {ReturnType<typeof ZipReader.prototype.getEntries>}
 */
export async function listZipEntries(odtTemplate){
    const reader = new ZipReader(new Uint8ArrayReader(new Uint8Array(odtTemplate)));
    return reader.getEntries();
}