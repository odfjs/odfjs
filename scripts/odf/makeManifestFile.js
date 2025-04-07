
/*
    As specified by https://docs.oasis-open.org/office/OpenDocument/v1.3/os/part2-packages/OpenDocument-v1.3-os-part2-packages.html#__RefHeading__752825_826425813
*/

/** @typedef {'application/vnd.oasis.opendocument.text' | 'application/vnd.oasis.opendocument.spreadsheet'} ODFMediaType */

/** @typedef {'1.2' | '1.3' | '1.4'} ODFVersion */

/**
 * @typedef ODFManifestFileEntry
 * @prop {string} fullPath
 * @prop {string} mediaType
 * @prop {string} [version]
 */

/**
 * @typedef ODFManifest
 * @prop {ODFMediaType} mediaType
 * @prop {ODFVersion} version
 * @prop {ODFManifestFileEntry[]} fileEntries
 */

/**
 * 
 * @param {ODFManifestFileEntry} fileEntry 
 * @returns {string}
 */
function makeFileEntry({fullPath, mediaType}){
    return `<manifest:file-entry manifest:full-path="${fullPath}" manifest:media-type="${mediaType}"/>`
}

/**
 * 
 * @param {ODFManifest} odfManifest 
 * @returns {string}
 */
export default function makeManifestFile({fileEntries, mediaType, version}){
    return `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="${version}">
   <manifest:file-entry manifest:full-path="/" manifest:version="${version}" manifest:media-type="${mediaType}"/>
   ${fileEntries.map(makeFileEntry).join('\n')}
</manifest:manifest>`
}