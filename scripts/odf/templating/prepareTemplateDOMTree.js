//@ts-check

import {traverse, Node} from "../../DOMUtils.js";
import {closingIfMarker, eachClosingMarker, eachStartMarkerRegex, elseMarker, ifStartMarkerRegex, variableRegex} from './markers.js'

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
    const ancestors2 = new Set(getAncestors(node2));

    for(const ancestor of ancestors1) {
        if(ancestors2.has(ancestor)) {
            return ancestor;
        }
    }

    throw new Error(`node1 and node2 do not have a common ancestor`)
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

/**
 * text position of a node relative to a text nodes within a container
 * 
 * @param {Text} node 
 * @param {Text[]} containerTextNodes
 * @returns {number}
 */
function getNodeTextPosition(node, containerTextNodes) {
    let position = 0;

    for(const currentTextNode of containerTextNodes) {
        if(currentTextNode === node) {
            return position
        }
        else {
            position += (currentTextNode.textContent || '').length;
        }
    }

    throw new Error(`[${getNodeTextPosition.name}] None of containerTextNodes elements is equal to node`)
}


/** @typedef {Node[]} DOMPath  */

/**
 * remove nodes between startNode and endNode
 * including startNode and endNode
 * 
 * @param {Node} startNode
 * @param {Node} endNode
 * @param {string} text 
 * @returns {void}
 */
function replaceBetweenNodesWithText(startNode, endNode, text) {
    // find both ancestry branch
    const startNodeAncestors = new Set(getAncestors(startNode))
    const endNodeAncestors = new Set(getAncestors(endNode))

    // find common ancestor
    const commonAncestor = findCommonAncestor(startNode, endNode)

    let remove = false
    let toRemove = []
    let commonAncestorChild = commonAncestor.firstChild
    let commonAncestorInsertionChild

    while(commonAncestorChild){
        if(startNodeAncestors.has(commonAncestorChild)){
            remove = true
        }

        if(remove){
            toRemove.push(commonAncestorChild)

            if(endNodeAncestors.has(commonAncestorChild)){
                commonAncestorInsertionChild = commonAncestorChild.nextSibling
                break;
            }
        }
        commonAncestorChild = commonAncestorChild.nextSibling
    }

    for(const node of toRemove){
        commonAncestor.removeChild(node)
    }

    //console.log('replaceBetweenNodesWithText startNode', startNode.textContent)

    const newTextNode = commonAncestor.ownerDocument.createTextNode(text)

    if(commonAncestorInsertionChild){
        commonAncestor.insertBefore(newTextNode, commonAncestorInsertionChild)
    }
    else{
        commonAncestor.appendChild(newTextNode)
    }

}

/**
 * Consolidate markers which are split among several Text nodes
 * 
 * @param {Document} document 
 */
function consolidateMarkers(document){
    // Perform a first pass to detect templating markers with formatting to remove it
    const potentialMarkersContainers = [
        ...Array.from(document.getElementsByTagName('text:p')),
        ...Array.from(document.getElementsByTagName('text:h'))
    ]

    for(const potentialMarkersContainer of potentialMarkersContainers) {
        const consolidatedMarkers = []

        /** @type {Text[]} */
        let containerTextNodesInTreeOrder = [];

        function refreshContainerTextNodes(){
            containerTextNodesInTreeOrder = []

            traverse(potentialMarkersContainer, node => {
                if(node.nodeType === Node.TEXT_NODE) {
                    containerTextNodesInTreeOrder.push(/** @type {Text} */(node))
                }
            })
        }

        refreshContainerTextNodes()
        
        let fullText = ''
        for(const node of containerTextNodesInTreeOrder){
            fullText = fullText + node.textContent
        }

        // Check for each template marker
        const positionedMarkers = [
            ...findAllMatches(fullText, ifStartMarkerRegex),
            ...findAllMatches(fullText, elseMarker),
            ...findAllMatches(fullText, closingIfMarker),
            ...findAllMatches(fullText, eachStartMarkerRegex),
            ...findAllMatches(fullText, eachClosingMarker),
            ...findAllMatches(fullText, variableRegex)
        ];

        
        //if(positionedMarkers.length >= 1)
        //    console.log('positionedMarkers', positionedMarkers)
        

        while(consolidatedMarkers.length < positionedMarkers.length) {
            refreshContainerTextNodes()

            // For each marker, check if it's contained within a single text node
            for(const positionedMarker of positionedMarkers.slice(consolidatedMarkers.length)) {
                //console.log('positionedMarker', positionedMarker)

                let currentPos = 0;
                let startNode;
                let endNode;

                // Find which text node(s) contain this marker
                for(const textNode of containerTextNodesInTreeOrder) {
                    const nodeStart = currentPos;
                    const nodeEnd = nodeStart + textNode.textContent.length;

                    // If start of marker is in this node
                    if(!startNode && positionedMarker.index >= nodeStart && positionedMarker.index < nodeEnd) {
                        startNode = textNode;
                    }

                    // If end of marker is in this node
                    if(startNode && positionedMarker.index + positionedMarker.marker.length > nodeStart &&
                        positionedMarker.index + positionedMarker.marker.length <= nodeEnd) {
                        endNode = textNode;
                        break;
                    }

                    currentPos = nodeEnd;
                }

                if(!startNode){
                    throw new Error(`Could not find startNode for marker '${positionedMarker.marker}'`)
                }   
                    
                if(!endNode){
                    throw new Error(`Could not find endNode for marker '${positionedMarker.marker}'`)
                }

                // Check if marker spans multiple nodes
                if(startNode !== endNode) {
                    const commonAncestor = findCommonAncestor(startNode, endNode)

                    let commonAncestorStartChild = startNode
                    while(commonAncestorStartChild.parentNode !== commonAncestor){
                        commonAncestorStartChild = commonAncestorStartChild.parentNode
                    }

                    let commonAncestorEndChild = endNode
                    while(commonAncestorEndChild.parentNode !== commonAncestor){
                        commonAncestorEndChild = commonAncestorEndChild.parentNode
                    }

                    // Calculate relative positions within the nodes
                    let startNodeTextContent = startNode.textContent || '';
                    let endNodeTextContent = endNode.textContent || '';

                    // Calculate the position within the start node
                    let posInStartNode = positionedMarker.index - getNodeTextPosition(startNode, containerTextNodesInTreeOrder);

                    // Calculate the position within the end node
                    let posInEndNode = (positionedMarker.index + positionedMarker.marker.length) - getNodeTextPosition(endNode, containerTextNodesInTreeOrder);

                    let newStartNode = startNode

                    // if there is before-text, split
                    if(posInStartNode > 0) {
                        // Text exists before the marker - preserve it

                        // set newStartNode to a Text node containing only the marker beginning
                        newStartNode = startNode.splitText(posInStartNode)
                        // startNode/beforeStartNode now contains only non-marker text

                        // then, by definition of .splitText(posInStartNode):
                        posInStartNode = 0

                        // move the marker beginning part to become a child of commonAncestor
                        newStartNode.parentNode?.removeChild(newStartNode)

                        commonAncestor.insertBefore(newStartNode, commonAncestorStartChild.nextSibling)

                        //console.log('commonAncestor after before-text split', commonAncestor.textContent )
                    }


                    // if there is after-text, split
                    if(posInEndNode < endNodeTextContent.length) {
                        // Text exists after the marker - preserve it

                        endNode.splitText(posInEndNode);
                        // endNode now contains only the end of marker text

                        // then, by definition of .splitText(posInEndNode):
                        posInEndNode = endNodeTextContent.length

                        // move the marker ending part to become a child of commonAncestor
                        if(endNode !== commonAncestorEndChild){
                            endNode.parentNode?.removeChild(endNode)
                            commonAncestor.insertBefore(endNode, commonAncestorEndChild)
                        }

                        //console.log('commonAncestor after after-text split', commonAncestor.textContent )
                    }

                    // then, replace all nodes between (new)startNode and (new)endNode with a single textNode in commonAncestor
                    replaceBetweenNodesWithText(newStartNode, endNode, positionedMarker.marker)

                    //console.log('commonAncestor after replaceBetweenNodesWithText', commonAncestor.textContent )

                    // After consolidation, break as the DOM structure has changed 
                    // and containerTextNodesInTreeOrder needs to be refreshed
                    consolidatedMarkers.push(positionedMarker)
                    break;
                }

                consolidatedMarkers.push(positionedMarker)
            }
        }
    }
}

/**
 * @typedef {typeof closingIfMarker | typeof eachClosingMarker | typeof eachStartMarkerRegex.source | typeof elseMarker | typeof ifStartMarkerRegex.source | typeof variableRegex.source} MarkerType
 */

/**
 * @typedef {Object} MarkerNode
 * @prop {Node} node
 * @prop {MarkerType} markerType
 */

/**
 * isolate markers which are in Text nodes with other texts
 * 
 * @param {Document} document 
 * @returns {Map<Node, MarkerType>}
 */
function isolateMarkerText(document){
    /** @type {ReturnType<isolateMarkerText>} */
    const markerNodes = new Map()

    traverse(document, currentNode => {
        //console.log('isolateMarkers', currentNode.nodeName, currentNode.textContent)

        if(currentNode.nodeType === Node.TEXT_NODE) {
            // find all marker starts and ends and split textNode
            let remainingText = currentNode.textContent || ''

            while(remainingText.length >= 1) {
                let matchText;
                let matchIndex;
                /** @type {MarkerType} */
                let markerType;

                // looking for a block marker
                for(const marker of [ifStartMarkerRegex, elseMarker, closingIfMarker, eachStartMarkerRegex, eachClosingMarker]) {
                    if(typeof marker === 'string') {
                        const index = remainingText.indexOf(marker)

                        if(index !== -1) {
                            matchText = marker
                            matchIndex = index
                            markerType = marker

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
                            markerType = marker.source

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

                        /** @type {Node} */
                        let matchTextNode

                        // @ts-ignore
                        if(matchIndex > 0) {
                            // @ts-ignore
                            matchTextNode = currentNode.splitText(matchIndex)
                        }
                        else{
                            matchTextNode = currentNode
                        }

                        markerNodes.set(matchTextNode, markerType)

                        // per spec, currentNode now contains only before-match text

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

    return markerNodes
}



/**
 * after isolateMatchingMarkersStructure, matching markers (opening/closing each, if/then/closing if)
 * are put in isolated branches within their common ancestors
 * 
 * UNFINISHED - maybe another day if relevant
 * 
 * @param {Document} document 
 * @param {Map<Node, MarkerType>} markerNodes 
 */
//function isolateMatchingMarkersStructure(document, markerNodes){
    /** @type {MarkerNode[]} */
/*    let currentlyOpenBlocks = []

    traverse(document, currentNode => {

        const markerType = markerNodes.get(currentNode)

        if(markerType){
            switch(markerType){
                case eachStartMarkerRegex.source:
                case ifStartMarkerRegex.source: {
                    currentlyOpenBlocks.push({
                        node: currentNode,
                        markerType
                    })
                    break;
                }
                case eachClosingMarker: {
                    const lastOpenedBlockMarkerNode = currentlyOpenBlocks.pop()

                    if(!lastOpenedBlockMarkerNode)
                        throw new Error(`{/each} found without corresponding opening {#each x as y}`)
    
                    if(lastOpenedBlockMarkerNode.markerType !== eachStartMarkerRegex.source)
                        throw new Error(`{/each} found while the last opened block was not an opening {#each x as y} (it was a ${lastOpenedBlockMarkerNode.markerType})`)
    
                    const openingEachNode = lastOpenedBlockMarkerNode.node
                    const closingEachNode = currentNode

                    const commonAncestor = findCommonAncestor(openingEachNode, closingEachNode)

                    if(openingEachNode.parentNode !== commonAncestor && openingEachNode.parentNode.childNodes.length >= 2){
                        if(openingEachNode.previousSibling){
                            // create branch for previousSiblings
                            let previousSibling = openingEachNode.previousSibling
                            const previousSiblings = []
                            while(previousSibling){
                                previousSiblings.push(previousSibling.previousSibling)
                                previousSibling = previousSibling.previousSibling
                            }

                            // put previous siblings in tree order
                            previousSiblings.reverse()

                            const parent = openingEachNode.parentNode
                            const parentClone = parent.cloneNode(false)
                            for(const previousSibling of previousSiblings){
                                previousSibling.parentNode.removeChild(previousSibling)
                                parentClone.appendChild(previousSibling)
                            }

                            let openingEachNodeBranch = openingEachNode.parentNode
                            let branchForPreviousSiblings = parentClone

                            while(openingEachNodeBranch.parentNode !== commonAncestor){
                                const newParentClone = openingEachNodeBranch.parentNode.cloneNode(false)
                                branchForPreviousSiblings.parentNode.removeChild(branchForPreviousSiblings)
                                newParentClone.appendChild(branchForPreviousSiblings)
                            }
                        }
                    }




                    break;
                }

                default:
                    throw new TypeError(`MarkerType not recognized: '${markerType}`)
            }
        }

    })

}*/


/**
 * This function prepares the template DOM tree in a way that makes it easily processed by the template execution
 * Specifically, after the call to this function, the document is altered to respect the following property:
 * 
 * each template marker ({#each ... as ...}, {/if}, etc.) placed within a single Text node
 * 
 * If the template marker was partially formatted in the original document, the formatting is removed so the
 * marker can be within a single Text node
 * 
 * If the template marker was in a Text node with other text, the Text node is split in a way to isolate the marker
 * from the rest of the text
 * 
 * @param {Document} document 
 */
export default function prepareTemplateDOMTree(document){
    consolidateMarkers(document)
    // after consolidateMarkers, each marker is in at most one text node
    // (formatting with markers is removed)

    isolateMarkerText(document)
    // after isolateMarkerText, each marker is in exactly one text node
    // (markers are separated from text that was before or after in the same text node)

}