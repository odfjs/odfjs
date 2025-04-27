import { ZipReader, ZipWriter, BlobReader, BlobWriter, TextReader, Uint8ArrayReader, TextWriter, Uint8ArrayWriter } from '@zip.js/zip.js';

import {traverse, parseXML, serializeToString, Node} from '../DOMUtils.js'
import {makeManifestFile, getManifestFileData} from './manifest.js';

import 'ses'

lockdown();


/** @import {Reader, ZipWriterAddDataOptions} from '@zip.js/zip.js' */
/** @import {ODFManifest} from './manifest.js' */

/** @typedef {ArrayBuffer} ODTFile */

const ODTMimetype = 'application/vnd.oasis.opendocument.text'




// For a given string, split it into fixed parts and parts to replace

/**
 * @typedef TextPlaceToFill
 * @property { {expression: string, replacedString:string}[] } expressions
 * @property {() => void} fill
 */



/**
 * @param {string} str
 * @param {Compartment} compartment 
 * @returns {TextPlaceToFill | undefined}
 */
function findPlacesToFillInString(str, compartment) {
    const matches = str.matchAll(/\{([^{#\/]+?)\}/g)

    /** @type {TextPlaceToFill['expressions']} */
    const expressions = []

    /** @type {(string | ((data:any) => void))[]} */
    const parts = []
    let remaining = str;

    for (const match of matches) {
        //console.log('match', match)
        const [matched, group1] = match

        const replacedString = matched
        const expression = group1.trim()
        expressions.push({ expression, replacedString })

        const [fixedPart, newRemaining] = remaining.split(replacedString, 2)

        if (fixedPart.length >= 1)
            parts.push(fixedPart)

        parts.push(() => compartment.evaluate(expression))

        remaining = newRemaining
    }

    if (remaining.length >= 1)
        parts.push(remaining)

    //console.log('parts', parts)


    if (remaining === str) {
        // no match found
        return undefined
    }
    else {
        return {
            expressions,
            fill: (data) => {
                return parts.map(p => {
                    if (typeof p === 'string')
                        return p
                    else
                        return p(data)
                })
                    .join('')
            }
        }
    }


}



/**
 * 
 * @param {Node} startNode 
 * @param {string} iterableExpression 
 * @param {string} itemExpression 
 * @param {Node} endNode 
 * @param {Compartment} compartment 
 */
function fillEachBlock(startNode, iterableExpression, itemExpression, endNode, compartment){
    //console.log('fillEachBlock', iterableExpression, itemExpression)
    //console.log('startNode', startNode.nodeType, startNode.nodeName)
    //console.log('endNode', endNode.nodeType, endNode.nodeName)

    // find common ancestor
    let commonAncestor

    let startAncestor = startNode
    let endAncestor = endNode
    
    const startAncestry = new Set([startAncestor])
    const endAncestry = new Set([endAncestor]) 

    while(!startAncestry.has(endAncestor) && !endAncestry.has(startAncestor)){
        if(startAncestor.parentNode){
            startAncestor = startAncestor.parentNode
            startAncestry.add(startAncestor)
        }
        if(endAncestor.parentNode){
            endAncestor = endAncestor.parentNode
            endAncestry.add(endAncestor)
        }
    }

    if(startAncestry.has(endAncestor)){
        commonAncestor = endAncestor
    }
    else{
        commonAncestor = startAncestor
    }


    //console.log('commonAncestor', commonAncestor.tagName)
    //console.log('startAncestry', startAncestry.size, [...startAncestry].indexOf(commonAncestor))
    //console.log('endAncestry', endAncestry.size, [...endAncestry].indexOf(commonAncestor))

    const startAncestryToCommonAncestor = [...startAncestry].slice(0, [...startAncestry].indexOf(commonAncestor))
    const endAncestryToCommonAncestor = [...endAncestry].slice(0, [...endAncestry].indexOf(commonAncestor))

    const startChild = startAncestryToCommonAncestor.at(-1)
    const endChild = endAncestryToCommonAncestor.at(-1)

    //console.log('startChild', startChild.tagName)
    //console.log('endChild', endChild.tagName)

    // Find repeatable pattern and extract it in a documentFragment
    // @ts-ignore
    const repeatedFragment = startNode.ownerDocument.createDocumentFragment()

    /** @type {Element[]} */
    const repeatedPatternArray = []
    let sibling = startChild.nextSibling

    while(sibling !== endChild){
        repeatedPatternArray.push(sibling)
        sibling = sibling.nextSibling;
    }


    //console.log('repeatedPatternArray', repeatedPatternArray.length)

    for(const sibling of repeatedPatternArray){
        sibling.parentNode?.removeChild(sibling)
        repeatedFragment.appendChild(sibling)
    }

    // Find the iterable in the data
    // PPP eventually, evaluate the expression as a JS expression
    let iterable = compartment.evaluate(iterableExpression)
    if(!iterable || typeof iterable[Symbol.iterator] !== 'function'){
        // when there is no iterable, silently replace with empty array
        iterable = []
    }

    // create each loop result
    // using a for-of loop to accept all iterable values
    for(const item of iterable){
        /** @type {DocumentFragment} */
        // @ts-ignore
        const itemFragment = repeatedFragment.cloneNode(true)

        let insideCompartment = new Compartment({
            globals: Object.assign({}, compartment.globalThis, {[itemExpression]: item}),
            __options__: true
        })

        // recursive call to fillTemplatedOdtElement on itemFragment
        fillTemplatedOdtElement(
            itemFragment, 
            insideCompartment
        )
        // @ts-ignore
        commonAncestor.insertBefore(itemFragment, endChild)
    }

    startChild.parentNode.removeChild(startChild)
    endChild.parentNode.removeChild(endChild)
}


const IF = 'IF'
const EACH = 'EACH'


/**
 * 
 * @param {Element | DocumentFragment | Document} rootElement 
 * @param {Compartment} compartment 
 * @returns {void}
 */
function fillTemplatedOdtElement(rootElement, compartment){
    //console.log('fillTemplatedOdtElement', rootElement.nodeType, rootElement.nodeName)

    // Perform a first traverse to split textnodes when they contain several block markers
    traverse(rootElement, currentNode => {
        if(currentNode.nodeType === Node.TEXT_NODE){
            // trouver tous les débuts et fin de each et découper le textNode

            let remainingText = currentNode.textContent || ''

            while(remainingText.length >= 1){
                let match;

                // looking for opening {#each ...} block
                const eachBlockOpeningRegex = /{#each\s+([^}]+?)\s+as\s+([^}]+?)\s*}/;
                const eachBlockClosingRegex = /{\/each}/;

                for(const regexp of [eachBlockOpeningRegex, eachBlockClosingRegex]){
                    let thisMatch = remainingText.match(regexp)

                    // trying to find only the first match in remainingText string
                    // @ts-ignore
                    if(thisMatch && (!match || match.index > thisMatch.index)){
                        match = thisMatch
                    }
                }

                if(match){
                    // split 3-way : before-match, match and after-match

                    if(match[0].length < remainingText.length){
                        // @ts-ignore
                        let afterMatchTextNode = currentNode.splitText(match.index + match[0].length)
                        if(afterMatchTextNode.textContent && afterMatchTextNode.textContent.length >= 1){
                            remainingText = afterMatchTextNode.textContent
                        }
                        else{
                            remainingText = ''
                        }

                        // per spec, currentNode now contains before-match and match text
                    
                        // @ts-ignore
                        if(match.index > 0){
                            // @ts-ignore
                            currentNode.splitText(match.index)
                        }

                        if(afterMatchTextNode){
                            currentNode = afterMatchTextNode
                        }
                    }
                    else{
                        remainingText = ''
                    }
                }
                else{
                    remainingText = ''
                }
            }

        }
        else{
            // skip
        }
    })

    // now, each Node contains at most one block marker



    /** @type {Node | undefined} */
    let eachBlockOpeningNode
    /** @type {Node | undefined} */
    let eachBlockClosingNode

    let currentlyUnclosedBlocks = []

    let eachBlockIterableExpression, eachBlockItemExpression;

    // Traverse "in document order"

    // @ts-ignore
    traverse(rootElement, currentNode => {
        const insideAnEachBlock = !!eachBlockOpeningNode

        if(currentNode.nodeType === Node.TEXT_NODE){
            const text = currentNode.textContent || ''

            // looking for {#each x as y}
            const eachStartRegex = /{#each\s+([^}]+?)\s+as\s+([^}]+?)\s*}/;
            const startMatch = text.match(eachStartRegex);

            if(startMatch){
                if(insideAnEachBlock){
                    currentlyUnclosedBlocks.push(EACH)
                }
                else{
                    let [_, _iterableExpression, _itemExpression] = startMatch
                    
                    eachBlockIterableExpression = _iterableExpression
                    eachBlockItemExpression = _itemExpression
                    eachBlockOpeningNode = currentNode
                }
            }

            // trying to find an {/each}
            const eachClosingBlockString = '{/each}'
            const isEachClosingBlock = text.includes(eachClosingBlockString)

            if(isEachClosingBlock){                    
                if(!eachBlockOpeningNode)
                    throw new Error(`{/each} found without corresponding opening {#each x as y}`)
                
                if(currentlyUnclosedBlocks.at(-1) !== EACH)
                    throw new Error(`{/each} found while the last opened block was not an opening {#each x as y}`)

                if(currentlyUnclosedBlocks.length >= 1){
                    // ignore because it will be treated as part of the outer {#each}
                    currentlyUnclosedBlocks.pop()
                }
                else{
                    eachBlockClosingNode = currentNode
                    
                    // found an #each and its corresponding /each
                    // execute replacement loop
                    fillEachBlock(eachBlockOpeningNode, eachBlockIterableExpression, eachBlockItemExpression, eachBlockClosingNode, compartment)

                    eachBlockOpeningNode = undefined
                    eachBlockIterableExpression = undefined
                    eachBlockItemExpression = undefined 
                    eachBlockClosingNode = undefined
                }
            }


            // Looking for variables for substitutions
            if(!insideAnEachBlock){
                // @ts-ignore
                if (currentNode.data) {
                    // @ts-ignore
                    const placesToFill = findPlacesToFillInString(currentNode.data, compartment)

                    if(placesToFill){
                        const newText = placesToFill.fill()
                        // @ts-ignore
                        const newTextNode = currentNode.ownerDocument?.createTextNode(newText)
                        // @ts-ignore
                        currentNode.parentNode?.replaceChild(newTextNode, currentNode)
                    }
                }
            }
            else{
                // ignore because it will be treated as part of the {#each} block
            }
        }

        if(currentNode.nodeType === Node.ATTRIBUTE_NODE){
            // Looking for variables for substitutions
            if(!insideAnEachBlock){
                // @ts-ignore
                if (currentNode.value) {
                    // @ts-ignore
                    const placesToFill = findPlacesToFillInString(currentNode.value, compartment)
                    if(placesToFill){
                        // @ts-ignore
                        currentNode.value = placesToFill.fill()
                    }
                }
            }
            else{
                // ignore because it will be treated as part of the {#each} block
            }
        }
    })
}


const keptFiles = new Set(['content.xml', 'styles.xml', 'mimetype', 'META-INF/manifest.xml'])


/**
 * 
 * @param {string} filename 
 * @returns {boolean}
 */
function keepFile(filename){
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

    // Parcourir chaque entrée du fichier ODT
    for await (const entry of entries) {
        const filename = entry.filename

        //console.log('entry', filename, entry.directory)

        // remove other files
        if(!keepFile(filename)){
            // ignore, do not create a corresponding entry in the new zip
        }
        else{
            let content
            let options

            switch(filename){
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

                    fillTemplatedOdtElement(contentDocument, compartment) 
                    
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


    for(const {filename, content, options} of zipEntriesToAdd){
        await writer.add(filename, content, options);
    }

    const newZipFilenames = new Set(zipEntriesToAdd.map(ze => ze.filename))

    if(!manifestFileData){
        throw new Error(`'META-INF/manifest.xml' zip entry missing`)
    }

    // remove ignored files from manifest.xml
    for(const filename of manifestFileData.fileEntries.keys()){
        if(!newZipFilenames.has(filename)){
            manifestFileData.fileEntries.delete(filename)
        }
    }

    const manifestFileXml = makeManifestFile(manifestFileData)
    await writer.add('META-INF/manifest.xml', new TextReader(manifestFileXml));

    await reader.close();

    return writer.close();
}






