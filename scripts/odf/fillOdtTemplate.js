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
 * Content between blockStartNode and blockEndNode is extracted to a documentFragment
 * The original document is modified because nodes are removed from it to be part of the returned documentFragment
 * 
 * startChild and endChild are ancestors of, respectively, blockStartNode and blockEndNode
 * and startChild.parentNode === endChild.parentNode
 * 
 * @precondition blockStartNode needs to be before blockEndNode in document order
 * 
 * @param {Node} blockStartNode 
 * @param {Node} blockEndNode 
 * @returns {{startChild: Node, endChild:Node, content: DocumentFragment}}
 */
function extractBlockContent(blockStartNode, blockEndNode){
    // find common ancestor of blockStartNode and blockEndNode
    let commonAncestor

    let startAncestor = blockStartNode
    let endAncestor = blockEndNode

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

    const startAncestryToCommonAncestor = [...startAncestry].slice(0, [...startAncestry].indexOf(commonAncestor))
    const endAncestryToCommonAncestor = [...endAncestry].slice(0, [...endAncestry].indexOf(commonAncestor))

    const startChild = startAncestryToCommonAncestor.at(-1)
    const endChild = endAncestryToCommonAncestor.at(-1)

    // Extract DOM content in a documentFragment
    const contentFragment = blockStartNode.ownerDocument.createDocumentFragment()

    /** @type {Element[]} */
    const repeatedPatternArray = []
    let sibling = startChild.nextSibling

    while(sibling !== endChild){
        repeatedPatternArray.push(sibling)
        sibling = sibling.nextSibling;
    }

    for(const sibling of repeatedPatternArray){
        sibling.parentNode?.removeChild(sibling)
        contentFragment.appendChild(sibling)
    }

    return {
        startChild,
        endChild,
        content: contentFragment
    }
}




/**
 * 
 * @param {Node} ifOpeningMarkerNode 
 * @param {Node | undefined} ifElseMarkerNode 
 * @param {Node} ifClosingMarkerNode 
 * @param {string} ifBlockConditionExpression 
 * @param {Compartment} compartment 
 */
function fillIfBlock(ifOpeningMarkerNode, ifElseMarkerNode, ifClosingMarkerNode, ifBlockConditionExpression, compartment){
    console.log('fillIfBlock pas encore codée')

    const conditionValue = compartment.evaluate(ifBlockConditionExpression)

    if(conditionValue){
        // récupérer le morceau entre ifOpeningMarkerNode et ifElseMarkerNode
        // l'executer
    }
    else{

    }

    // dans tous les cas, recupérer ce qu'il y a entre ifOpeningMarkerNode et ifClosingMarkerNode
    // et le supprimer de l'arbre



    /*throw `PPP
        - executer l'expression
        - selon la valeur, choisir le bon block à extraire/remplir
        - 
    `*/
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

    const {startChild, endChild, content: repeatedFragment} = extractBlockContent(startNode, endNode)
    
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
        
        endChild.parentNode.insertBefore(itemFragment, endChild)
    }

    // remove block elements
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


    let currentlyOpenBlocks = []


    /** @type {Node | undefined} */
    let eachOpeningMarkerNode
    /** @type {Node | undefined} */
    let eachClosingMarkerNode

    let eachBlockIterableExpression, eachBlockItemExpression;


    /** @type {Node | undefined} */
    let ifOpeningMarkerNode
    /** @type {Node | undefined} */
    let ifElseMarkerNode
    /** @type {Node | undefined} */
    let ifClosingMarkerNode

    let ifBlockConditionExpression
    // Traverse "in document order"

    // @ts-ignore
    traverse(rootElement, currentNode => {
        //console.log('currentlyUnclosedBlocks', currentlyUnclosedBlocks)
        const insideAnOpenBlock = currentlyOpenBlocks.length >= 1

        if(currentNode.nodeType === Node.TEXT_NODE){
            const text = currentNode.textContent || ''

            /**
             * looking for {#each x as y}
             */ 
            const eachStartRegex = /{#each\s+([^}]+?)\s+as\s+([^}]+?)\s*}/;
            const eachStartMatch = text.match(eachStartRegex);

            if(eachStartMatch){
                //console.log('startMatch', startMatch)

                currentlyOpenBlocks.push(EACH)
                
                if(insideAnOpenBlock){
                    // do nothing 
                }
                else{
                    let [_, _iterableExpression, _itemExpression] = eachStartMatch
                    
                    eachBlockIterableExpression = _iterableExpression
                    eachBlockItemExpression = _itemExpression
                    eachOpeningMarkerNode = currentNode
                }
            }


            /**
             * Looking for {/each}
             */
            const eachClosingBlockString = '{/each}'
            const isEachClosingBlock = text.includes(eachClosingBlockString)

            if(isEachClosingBlock){

                //console.log('isEachClosingBlock', isEachClosingBlock)

                if(!eachOpeningMarkerNode)
                    throw new Error(`{/each} found without corresponding opening {#each x as y}`)
                
                if(currentlyOpenBlocks.at(-1) !== EACH)
                    throw new Error(`{/each} found while the last opened block was not an opening {#each x as y}`)

                if(currentlyOpenBlocks.length === 1){
                    eachClosingMarkerNode = currentNode
                    
                    // found an {#each} and its corresponding {/each}
                    // execute replacement loop
                    fillEachBlock(eachOpeningMarkerNode, eachBlockIterableExpression, eachBlockItemExpression, eachClosingMarkerNode, compartment)

                    eachOpeningMarkerNode = undefined
                    eachBlockIterableExpression = undefined
                    eachBlockItemExpression = undefined 
                    eachClosingMarkerNode = undefined
                }
                else{
                    // ignore because it will be treated as part of the outer {#each}
                }

                currentlyOpenBlocks.pop()
            }


            /**
             * Looking for {#if ...}
             */
            const ifStartRegex = /{#if\s+([^}]+?)\s*}/;
            const ifStartMatch = text.match(ifStartRegex);

            if(ifStartMatch){
                currentlyOpenBlocks.push(IF)
                
                if(insideAnOpenBlock){
                    // do nothing because the marker is too deep
                }
                else{
                    let [_, _ifBlockConditionExpression] = ifStartMatch
                    
                    ifBlockConditionExpression = _ifBlockConditionExpression
                    ifOpeningMarkerNode = currentNode
                }
            }


            /**
             * Looking for {:else}
             */
            const elseMarker = '{:else}'
            const hasElseMarker = text.includes(elseMarker);

            if(hasElseMarker){      
                if(!insideAnOpenBlock)
                    throw new Error('{:else} without a corresponding {#if}')
                
                if(currentlyOpenBlocks.length === 1){
                    if(currentlyOpenBlocks[0] === IF){
                        ifElseMarkerNode = currentNode
                    }
                    else
                        throw new Error('{:else} inside an {#each} but without a corresponding {#if}')
                }
                else{
                    // do nothing because the marker is too deep
                }
            }


            /**
             * Looking for {/if}
             */
            const closingIfMarker = '{/if}'
            const hasClosingMarker = text.includes(closingIfMarker);

            if(hasClosingMarker){            
                if(!insideAnOpenBlock)
                    throw new Error('{/if} without a corresponding {#if}')

                if(currentlyOpenBlocks.length === 1){
                    if(currentlyOpenBlocks[0] === IF){
                        ifClosingMarkerNode = currentNode

                        // found an {#if} and its corresponding {/if}
                        // execute replacement loop
                        fillIfBlock(ifOpeningMarkerNode, ifElseMarkerNode, ifClosingMarkerNode, ifBlockConditionExpression, compartment)

                        ifOpeningMarkerNode = undefined
                        ifElseMarkerNode = undefined
                        ifClosingMarkerNode = undefined
                        ifBlockConditionExpression = undefined
                    }
                    else
                        throw new Error('{/if} inside an {#each} but without a corresponding {#if}')
                }
                else{
                    // do nothing because the marker is too deep
                }
            }


            /**
             * Looking for variables for substitutions
             */
            if(!insideAnOpenBlock){
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
                // ignore because it will be treated as part of the outer {#each} block
            }
        }

        if(currentNode.nodeType === Node.ATTRIBUTE_NODE){
            // Looking for variables for substitutions
            if(!insideAnOpenBlock){
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






