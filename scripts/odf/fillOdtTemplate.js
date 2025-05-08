import {ZipReader, ZipWriter, BlobReader, BlobWriter, TextReader, Uint8ArrayReader, TextWriter, Uint8ArrayWriter} from '@zip.js/zip.js';

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

    for(const match of matches) {
        //console.log('match', match)
        const [matched, group1] = match

        const replacedString = matched
        const expression = group1.trim()
        expressions.push({expression, replacedString})

        const [fixedPart, newRemaining] = remaining.split(replacedString, 2)

        if(fixedPart.length >= 1)
            parts.push(fixedPart)

        parts.push(() => compartment.evaluate(expression))

        remaining = newRemaining
    }

    if(remaining.length >= 1)
        parts.push(remaining)

    //console.log('parts', parts)


    if(remaining === str) {
        // no match found
        return undefined
    }
    else {
        return {
            expressions,
            fill: (data) => {
                return parts.map(p => {
                    if(typeof p === 'string')
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
function extractBlockContent(blockStartNode, blockEndNode) {
    // find common ancestor of blockStartNode and blockEndNode
    let commonAncestor

    let startAncestor = blockStartNode
    let endAncestor = blockEndNode

    const startAncestry = new Set([startAncestor])
    const endAncestry = new Set([endAncestor])

    while(!startAncestry.has(endAncestor) && !endAncestry.has(startAncestor)) {
        if(startAncestor.parentNode) {
            startAncestor = startAncestor.parentNode
            startAncestry.add(startAncestor)
        }
        if(endAncestor.parentNode) {
            endAncestor = endAncestor.parentNode
            endAncestry.add(endAncestor)
        }
    }

    if(startAncestry.has(endAncestor)) {
        commonAncestor = endAncestor
    }
    else {
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

    while(sibling !== endChild) {
        repeatedPatternArray.push(sibling)
        sibling = sibling.nextSibling;
    }

    for(const sibling of repeatedPatternArray) {
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
function fillIfBlock(ifOpeningMarkerNode, ifElseMarkerNode, ifClosingMarkerNode, ifBlockConditionExpression, compartment) {
    const conditionValue = compartment.evaluate(ifBlockConditionExpression)

    let startChild
    let endChild

    let markerNodes = new Set()

    let chosenFragment

    if(ifElseMarkerNode) {
        const {
            startChild: startIfThenChild,
            endChild: endIfThenChild,
            content: thenFragment
        } = extractBlockContent(ifOpeningMarkerNode, ifElseMarkerNode)

        const {
            startChild: startIfElseChild,
            endChild: endIfElseChild,
            content: elseFragment
        } = extractBlockContent(ifElseMarkerNode, ifClosingMarkerNode)

        chosenFragment = conditionValue ? thenFragment : elseFragment
        startChild = startIfThenChild
        endChild = endIfElseChild

        markerNodes
            .add(startIfThenChild).add(endIfThenChild)
            .add(startIfElseChild).add(endIfElseChild)
    }
    else {
        const {
            startChild: startIfThenChild,
            endChild: endIfThenChild,
            content: thenFragment
        } = extractBlockContent(ifOpeningMarkerNode, ifClosingMarkerNode)

        chosenFragment = conditionValue ? thenFragment : undefined
        startChild = startIfThenChild
        endChild = endIfThenChild

        markerNodes
            .add(startIfThenChild).add(endIfThenChild)
    }


    if(chosenFragment) {
        fillTemplatedOdtElement(
            chosenFragment,
            compartment
        )

        endChild.parentNode.insertBefore(chosenFragment, endChild)
    }

    for(const markerNode of markerNodes) {
        try {
            // may throw if node already out of tree
            // might happen if 
            markerNode.parentNode.removeChild(markerNode)
        }
        catch(e) {}
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
function fillEachBlock(startNode, iterableExpression, itemExpression, endNode, compartment) {
    //console.log('fillEachBlock', iterableExpression, itemExpression)
    //console.log('startNode', startNode.nodeType, startNode.nodeName)
    //console.log('endNode', endNode.nodeType, endNode.nodeName)

    const {startChild, endChild, content: repeatedFragment} = extractBlockContent(startNode, endNode)

    // Find the iterable in the data
    // PPP eventually, evaluate the expression as a JS expression
    let iterable = compartment.evaluate(iterableExpression)
    if(!iterable || typeof iterable[Symbol.iterator] !== 'function') {
        // when there is no iterable, silently replace with empty array
        iterable = []
    }

    // create each loop result
    // using a for-of loop to accept all iterable values
    for(const item of iterable) {
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

    // remove block marker elements
    startChild.parentNode.removeChild(startChild)
    endChild.parentNode.removeChild(endChild)
}


const IF = 'IF'
const EACH = 'EACH'

// the regexps below are shared, so they shoudn't have state (no 'g' flag)
const ifStartMarkerRegex = /{#if\s+([^}]+?)\s*}/;
const elseMarker = '{:else}'
const closingIfMarker = '{/if}'

const eachStartMarkerRegex = /{#each\s+([^}]+?)\s+as\s+([^}]+?)\s*}/;
const eachClosingBlockMarker = '{/each}'



/**
 * 
 * @param {Element | DocumentFragment | Document} rootElement 
 * @param {Compartment} compartment 
 * @returns {void}
 */
function fillTemplatedOdtElement(rootElement, compartment) {
    //console.log('fillTemplatedOdtElement', rootElement.nodeType, rootElement.nodeName)

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

        if(currentNode.nodeType === Node.TEXT_NODE) {
            const text = currentNode.textContent || ''

            /**
             * looking for {#each x as y}
             */
            const eachStartMatch = text.match(eachStartMarkerRegex);

            if(eachStartMatch) {
                //console.log('startMatch', startMatch)

                currentlyOpenBlocks.push(EACH)

                if(insideAnOpenBlock) {
                    // do nothing 
                }
                else {
                    let [_, _iterableExpression, _itemExpression] = eachStartMatch

                    eachBlockIterableExpression = _iterableExpression
                    eachBlockItemExpression = _itemExpression
                    eachOpeningMarkerNode = currentNode
                }
            }


            /**
             * Looking for {/each}
             */
            const isEachClosingBlock = text.includes(eachClosingBlockMarker)

            if(isEachClosingBlock) {

                //console.log('isEachClosingBlock', isEachClosingBlock)

                if(!eachOpeningMarkerNode)
                    throw new Error(`{/each} found without corresponding opening {#each x as y}`)

                if(currentlyOpenBlocks.at(-1) !== EACH)
                    throw new Error(`{/each} found while the last opened block was not an opening {#each x as y}`)

                if(currentlyOpenBlocks.length === 1) {
                    eachClosingMarkerNode = currentNode

                    // found an {#each} and its corresponding {/each}
                    // execute replacement loop
                    fillEachBlock(eachOpeningMarkerNode, eachBlockIterableExpression, eachBlockItemExpression, eachClosingMarkerNode, compartment)

                    eachOpeningMarkerNode = undefined
                    eachBlockIterableExpression = undefined
                    eachBlockItemExpression = undefined
                    eachClosingMarkerNode = undefined
                }
                else {
                    // ignore because it will be treated as part of the outer {#each}
                }

                currentlyOpenBlocks.pop()
            }


            /**
             * Looking for {#if ...}
             */
            const ifStartMatch = text.match(ifStartMarkerRegex);

            if(ifStartMatch) {
                currentlyOpenBlocks.push(IF)

                if(insideAnOpenBlock) {
                    // do nothing because the marker is too deep
                }
                else {
                    let [_, _ifBlockConditionExpression] = ifStartMatch

                    ifBlockConditionExpression = _ifBlockConditionExpression
                    ifOpeningMarkerNode = currentNode
                }
            }


            /**
             * Looking for {:else}
             */
            const hasElseMarker = text.includes(elseMarker);

            if(hasElseMarker) {
                if(!insideAnOpenBlock)
                    throw new Error('{:else} without a corresponding {#if}')

                if(currentlyOpenBlocks.length === 1) {
                    if(currentlyOpenBlocks[0] === IF) {
                        ifElseMarkerNode = currentNode
                    }
                    else
                        throw new Error('{:else} inside an {#each} but without a corresponding {#if}')
                }
                else {
                    // do nothing because the marker is too deep
                }
            }


            /**
             * Looking for {/if}
             */
            const hasClosingMarker = text.includes(closingIfMarker);

            if(hasClosingMarker) {
                if(!insideAnOpenBlock)
                    throw new Error('{/if} without a corresponding {#if}')

                if(currentlyOpenBlocks.length === 1) {
                    if(currentlyOpenBlocks[0] === IF) {
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
                else {
                    // do nothing because the marker is too deep
                }
            }


            /**
             * Looking for variables for substitutions
             */
            if(!insideAnOpenBlock) {
                // @ts-ignore
                if(currentNode.data) {
                    // @ts-ignore
                    const placesToFill = findPlacesToFillInString(currentNode.data, compartment)

                    if(placesToFill) {
                        const newText = placesToFill.fill()
                        // @ts-ignore
                        const newTextNode = currentNode.ownerDocument?.createTextNode(newText)
                        // @ts-ignore
                        currentNode.parentNode?.replaceChild(newTextNode, currentNode)
                    }
                }
            }
            else {
                // ignore because it will be treated as part of the outer {#each} block
            }
        }

        if(currentNode.nodeType === Node.ATTRIBUTE_NODE) {
            // Looking for variables for substitutions
            if(!insideAnOpenBlock) {
                // @ts-ignore
                if(currentNode.value) {
                    // @ts-ignore
                    const placesToFill = findPlacesToFillInString(currentNode.value, compartment)
                    if(placesToFill) {
                        // @ts-ignore
                        currentNode.value = placesToFill.fill()
                    }
                }
            }
            else {
                // ignore because it will be treated as part of the {#each} block
            }
        }
    })
}


// Helper function to find all regex matches with positions
/**
 * 
 * @param {string} text 
 * @param {string | RegExp} pattern 
 * @returns {{marker: string, index: number}[]}
 */
function findAllMatches(text, pattern) {
    const results = [];
    let match;

    if(typeof pattern === 'string') {
        // For string markers like elseMarker and closingIfMarker
        let index = 0;
        while((index = text.indexOf(pattern, index)) !== -1) {
            results.push({
                marker: pattern,
                index: index
            });
            index += pattern.length;
        }
    } else {
        // For regex patterns
        pattern = new RegExp(pattern.source, 'g');
        while((match = pattern.exec(text)) !== null) {
            results.push({
                marker: match[0],
                index: match.index
            });
        }
    }

    return results;
}


/**
 * 
 * @param {Node} node1 
 * @param {Node} node2 
 * @returns {Node}
 */
function findCommonAncestor(node1, node2) {
    const ancestors1 = getAncestors(node1);
    const ancestors2 = getAncestors(node2);

    for(const ancestor of ancestors1) {
        if(ancestors2.includes(ancestor)) {
            return ancestor;
        }
    }

    return null;
}

/**
 * 
 * @param {Node} node 
 * @returns {Node[]}
 */
function getAncestors(node) {
    const ancestors = [];
    let current = node;

    while(current) {
        ancestors.push(current);
        current = current.parentNode;
    }

    return ancestors;
}

// Helper function to find nodes between start and end (inclusive)
function findNodesBetween(startNode, endNode) {
    const commonAncestor = findCommonAncestor(startNode, endNode);
    if(!commonAncestor) return [];

    const result = [];
    let capturing = false;

    function traverse(node) {
        if(node === startNode) {
            capturing = true;
        }

        if(capturing) {
            result.push(node);
        }

        if(node === endNode) {
            capturing = false;
            return true;
        }

        for(let child = node.firstChild; child; child = child.nextSibling) {
            if(traverse(child)) return true;
        }

        return false;
    }

    traverse(commonAncestor);

    return result;
}


/**
 * text position of a node relative to a text nodes within a container
 * 
 * @param {Text} node 
 * @param {Text[]} containerTextNodes
 * @returns {number}
 */
function getNodeTextPosition(node, containerTextNodes) {
    let position = 0;

    for(const currentTextNode of containerTextNodes){
        if(currentTextNode === node){
            return position
        }
        else{
            position += (currentTextNode.textContent || '').length;
        }
    }

    throw new Error(`[${getNodeTextPosition.name}] None of containerTextNodes elements is equal to node`)
}

// Helper function to get the path from ancestor to descendant
function getPathToNode(node, ancestor) {
    const path = [];
    let current = node;

    while(current && current !== ancestor) {
        path.unshift(current);
        current = current.parentNode;
    }

    return path;
}

// Helper function to find the point where two paths diverge
function findDivergingPoint(path1, path2) {
    for(let i = 0; i < Math.min(path1.length, path2.length); i++) {
        if(path1[i] !== path2[i]) {
            return path1[i - 1] || null; // Return the last common node
        }
    }

    // One path is a prefix of the other
    return path1[Math.min(path1.length, path2.length) - 1];
}

// Helper function to handle the case where start and end nodes have a direct relationship
function consolidateDirectRelationship(startNode, endNode, posInStartNode, posInEndNode, markerText) {
    const startNodeParent = startNode.parentNode;
    const endNodeParent = endNode.parentNode;
    const document = startNode.ownerDocument;

    if(startNodeParent === endNodeParent) {
        // Siblings case
        // Preserve text before marker in start node
        if(posInStartNode > 0) {
            startNode.textContent = startNode.textContent.substring(0, posInStartNode);
        } else {
            startNodeParent.removeChild(startNode);
        }

        // Create marker node
        const markerNode = document.createTextNode(markerText);
        startNodeParent.insertBefore(markerNode, endNode);

        // Preserve text after marker in end node
        if(posInEndNode < endNode.textContent.length) {
            endNode.textContent = endNode.textContent.substring(posInEndNode);
        } else {
            endNodeParent.removeChild(endNode);
        }
    } else {
        // Handle nested case (one is ancestor of other)
        // This is more complex and needs customized handling
        // Simplified approach: replace everything with marker
        // A more sophisticated approach would be needed for production

        const isStartAncestorOfEnd = isAncestor(startNode, endNode);
        if(isStartAncestorOfEnd) {
            replaceWithMarker(startNode, markerText);
        } else {
            replaceWithMarker(endNode, markerText);
        }
    }
}

// Helper function to check if one node is ancestor of another
function isAncestor(potentialAncestor, node) {
    let current = node.parentNode;
    while(current) {
        if(current === potentialAncestor) return true;
        current = current.parentNode;
    }
    return false;
}

// Helper function to replace a node with marker text
function replaceWithMarker(node, markerText) {
    const document = node.ownerDocument;
    const markerNode = document.createTextNode(markerText);
    node.parentNode.replaceChild(markerNode, node);
}

// Helper function to remove nodes between two sibling branches
function removeNodesBetween(startBranch, endBranch, commonAncestor) {
    let removing = false;
    let nodesToRemove = [];

    for(let child = commonAncestor.firstChild; child; child = child.nextSibling) {
        if(child === startBranch) {
            removing = true;
            continue; // Don't remove the start branch
        }

        if(removing) {
            if(child === endBranch) {
                break; // Stop when we reach end branch
            }
            nodesToRemove.push(child);
        }
    }

    // Remove all nodes marked for removal
    for(const nodeToRemove of nodesToRemove) {
        commonAncestor.removeChild(nodeToRemove);
    }
}


/**
 * 
 * @param {Document} document 
 * @param {Compartment} compartment 
 * @returns {void}
 */
function fillTemplatedOdtDocument(document, compartment) {

    // Prepare tree to be used as template
    // Perform a first pass to detect templating markers with formatting to remove it
    const potentialMarkerContainers = [
        ...Array.from(document.getElementsByTagName('text:p')),
        ...Array.from(document.getElementsByTagName('text:h'))
    ]

    for(const potentialMarkerContainer of potentialMarkerContainers) {
        // Check if any template marker is split across multiple text nodes
        // Get all text nodes within this container
        /** @type {Text[]} */
        const containerTextNodesInTreeOrder = [];
        let fullText = ''
        traverse(potentialMarkerContainer, node => {
            if(node.nodeType === Node.TEXT_NODE) {
                containerTextNodesInTreeOrder.push(/** @type {Text} */ (node))
                fullText = fullText + node.textContent
            }
        })

        // Check for each template marker
        const positionedMarkers = [
            ...findAllMatches(fullText, ifStartMarkerRegex),
            ...findAllMatches(fullText, elseMarker),
            ...findAllMatches(fullText, closingIfMarker),
            ...findAllMatches(fullText, eachStartMarkerRegex),
            ...findAllMatches(fullText, eachClosingBlockMarker)
        ];

        // If no markers found, skip this container
        if(positionedMarkers.length >= 1) {

            // For each marker, check if it's contained within a single text node
            for(const positionedMarker of positionedMarkers) {
                let markerStart = -1;
                let markerEnd = -1;
                let currentPos = 0;
                let markerSpansNodes = false;
                let startNode = null;
                let endNode = null;

                // Find which text node(s) contain this marker
                for(const textNode of containerTextNodesInTreeOrder) {
                    const nodeStart = currentPos;
                    const nodeEnd = nodeStart + textNode.textContent.length;

                    // If start of marker is in this node
                    if(markerStart === -1 && positionedMarker.index >= nodeStart && positionedMarker.index < nodeEnd) {
                        markerStart = positionedMarker.index;
                        startNode = textNode;
                    }

                    // If end of marker is in this node
                    if(markerStart !== -1 && positionedMarker.index + positionedMarker.marker.length > nodeStart &&
                        positionedMarker.index + positionedMarker.marker.length <= nodeEnd) {
                        markerEnd = positionedMarker.index + positionedMarker.marker.length;
                        endNode = textNode;
                        break;
                    }

                    currentPos = nodeEnd;
                }

                // Check if marker spans multiple nodes
                if(startNode !== endNode) {
                    console.log('startNode !== endNode')
                    const commonAncestor = findCommonAncestor(startNode, endNode);

                    // Calculate relative positions within the nodes
                    let startNodeTextContent = startNode.textContent || '';
                    let endNodeTextContent = endNode.textContent || '';

                    // Calculate the position within the start node
                    let posInStartNode = positionedMarker.index - getNodeTextPosition(startNode, containerTextNodesInTreeOrder);

                    // Calculate the position within the end node
                    let posInEndNode = (positionedMarker.index + positionedMarker.marker.length) - getNodeTextPosition(endNode, containerTextNodesInTreeOrder);

                    // Get the path from common ancestor to start and end nodes
                    const pathToStart = getPathToNode(startNode, commonAncestor);
                    const pathToEnd = getPathToNode(endNode, commonAncestor);

                    // Find the diverging point in the paths
                    const lowestCommonAncestorChild = findDivergingPoint(pathToStart, pathToEnd);

                    if(!lowestCommonAncestorChild) {
                        // Direct parent-child relationship or other simple case
                        // Handle separately
                        consolidateDirectRelationship(startNode, endNode, posInStartNode, posInEndNode, positionedMarker.marker);
                    } else {
                        // Complex case: we need to:
                        // 1. Preserve text before marker in startNode
                        // 2. Preserve text after marker in endNode
                        // 3. Replace everything in-between with marker text

                        // Get all nodes between the diverging branches (including the branches)
                        const startBranch = pathToStart[pathToStart.indexOf(lowestCommonAncestorChild)];
                        const endBranch = pathToEnd[pathToEnd.indexOf(lowestCommonAncestorChild)];

                        // First, handle the start node - split if necessary
                        if(posInStartNode > 0) {
                            // Text exists before the marker - preserve it
                            const textBeforeMarker = startNodeTextContent.substring(0, posInStartNode);
                            const parentOfStartNode = startNode.parentNode;

                            // Replace the start node with the text before marker
                            startNode.textContent = textBeforeMarker;

                            // Create a new node for the start of the marker
                            const startOfMarkerNode = document.createTextNode(positionedMarker.marker);

                            // Insert after the modified start node
                            if(startNode.nextSibling) {
                                parentOfStartNode.insertBefore(startOfMarkerNode, startNode.nextSibling);
                            } else {
                                parentOfStartNode.appendChild(startOfMarkerNode);
                            }
                        } else {
                            // No text before marker, just replace the content
                            startNode.textContent = positionedMarker.marker;
                        }

                        // Handle the end node - split if necessary
                        if(posInEndNode < endNodeTextContent.length) {
                            // Text exists after the marker - preserve it
                            const textAfterMarker = endNodeTextContent.substring(posInEndNode);
                            const parentOfEndNode = endNode.parentNode;

                            // Replace the end node with just the text after marker
                            endNode.textContent = textAfterMarker;

                            // Create a new node for the end of the marker if needed
                            // Only needed if we haven't already added the full marker to the start node
                            if(posInStartNode > 0) {
                                const endOfMarkerNode = document.createTextNode("");  // Empty as marker is in start node

                                // Insert before the modified end node
                                parentOfEndNode.insertBefore(endOfMarkerNode, endNode);
                            }
                        } else {
                            // No text after marker
                            if(posInStartNode > 0) {
                                // If we preserved text before the marker, remove the end node
                                // as the marker is now fully in the start branch
                                endNode.parentNode.removeChild(endNode);
                            } else {
                                // Otherwise just replace the content
                                endNode.textContent = "";
                            }
                        }

                        // Now remove all nodes between start branch and end branch
                        // but not the branches themselves
                        removeNodesBetween(startBranch, endBranch, commonAncestor);
                    }

                    // After consolidation, we can break as the DOM structure has changed
                    break;
                }
            }
        }



    }





    // Perform a second pass to split textnodes when they contain several block markers
    traverse(document, currentNode => {
        if(currentNode.nodeType === Node.TEXT_NODE) {
            // find all marker starts and ends and split textNode
            let remainingText = currentNode.textContent || ''

            while(remainingText.length >= 1) {
                let matchText;
                let matchIndex;

                // looking for a block marker
                for(const marker of [ifStartMarkerRegex, elseMarker, closingIfMarker, eachStartMarkerRegex, eachClosingBlockMarker]) {
                    if(typeof marker === 'string') {
                        const index = remainingText.indexOf(marker)

                        if(index !== -1) {
                            matchText = marker
                            matchIndex = index

                            // found the first match
                            break; // get out of loop
                        }
                    }
                    else {
                        // marker is a RegExp
                        const match = remainingText.match(marker)

                        if(match) {
                            matchText = match[0]
                            matchIndex = match.index

                            // found the first match
                            break; // get out of loop
                        }
                    }
                }

                if(matchText) {
                    // split 3-way : before-match, match and after-match

                    if(matchText.length < remainingText.length) {
                        // @ts-ignore
                        let afterMatchTextNode = currentNode.splitText(matchIndex + matchText.length)
                        if(afterMatchTextNode.textContent && afterMatchTextNode.textContent.length >= 1) {
                            remainingText = afterMatchTextNode.textContent
                        }
                        else {
                            remainingText = ''
                        }

                        // per spec, currentNode now contains before-match and match text

                        // @ts-ignore
                        if(matchIndex > 0) {
                            // @ts-ignore
                            currentNode.splitText(matchIndex)
                        }

                        if(afterMatchTextNode) {
                            currentNode = afterMatchTextNode
                        }
                    }
                    else {
                        remainingText = ''
                    }
                }
                else {
                    remainingText = ''
                }
            }

        }
        else {
            // skip
        }
    })

    // now, each Node contains at most one block marker

    fillTemplatedOdtElement(document, compartment)
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

                    fillTemplatedOdtDocument(contentDocument, compartment)

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






