
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
 * @prop {Map<ODFManifestFileEntry['fullPath'], ODFManifestFileEntry>} fileEntries
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
export function makeManifestFile({fileEntries, mediaType, version}){
    return `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="${version}">
   <manifest:file-entry manifest:full-path="/" manifest:version="${version}" manifest:media-type="${mediaType}"/>
   ${[...fileEntries.values()].map(makeFileEntry).join('\n')}
</manifest:manifest>`
}

/**
 * @param {Document} manifestDoc 
 * @returns {ODFManifest}
 */
export function getManifestFileData(manifestDoc){
    /** @type {Partial<ReturnType<getManifestFileData>>} */
    const manifestData = {
        fileEntries: new Map()
    }

    const manifestEl = manifestDoc.getElementsByTagName('manifest:manifest')[0]
    /** @type {ODFVersion} */
    // @ts-ignore
    const version = manifestEl.getAttribute('manifest:version');
    if(!version){
        throw new Error(`Missing version attibute in manifest:manifest element of manifest.xml file`)
    }

    manifestData.version = version

    const manifestEntryEls = manifestEl.getElementsByTagName('manifest:file-entry')
    
    for(const manifestEntryEl of Array.from(manifestEntryEls)){
        /** @type {ODFManifestFileEntry} */
        const odfManifestFileEntry = {
            fullPath: '',
            mediaType: ''
        }

        const fullPath = manifestEntryEl.getAttribute('manifest:full-path')
        if(!fullPath){
            throw new Error(`Missing manifest:full-path attribute in manifest entry`)
        }
        odfManifestFileEntry.fullPath = fullPath

        const mediaType = manifestEntryEl.getAttribute('manifest:media-type')
        if(!mediaType){
            throw new Error(`Missing manifest:media-type attribute in manifest entry for '${fullPath}'`)
        }
        odfManifestFileEntry.mediaType = mediaType

        if(fullPath === '/'){
            // @ts-ignore
            manifestData.mediaType = mediaType
        }

        const version = manifestEntryEl.getAttribute('manifest:version')
        if(version){
            odfManifestFileEntry.version = version
        }

        // @ts-ignore
        manifestData.fileEntries.set(fullPath, odfManifestFileEntry)
    }

    //@ts-ignore
    return manifestData
}