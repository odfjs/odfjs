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
 * @returns {Node | undefined}
 */
function findCommonAncestor(node1, node2) {
    const ancestors1 = getAncestors(node1);
    const ancestors2 = getAncestors(node2);

    for(const ancestor of ancestors1) {
        if(ancestors2.includes(ancestor)) {
            return ancestor;
        }
    }

    return undefined;
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
 * but keep startNode and endNode
 * 
 * returns the common ancestor child in start branch 
 * for the purpose for inserting something between startNode and endNode
 * with insertionPoint.parentNode.insertBefore(newBetweenContent, insertionPoint)
 * 
 * @param {Node} startNode
 * @param {Node} endNode
 * @returns {Node}
 */
function removeNodesBetween(startNode, endNode) {
    let nodesToRemove = new Set();

    // find both ancestry branch
    const startNodeAncestors = new Set(getAncestors(startNode))
    const endNodeAncestors = new Set(getAncestors(endNode))

    // find common ancestor
    const commonAncestor = findCommonAncestor(startNode, endNode)

    // remove everything "on the right" of start branch
    let currentAncestor = startNode
    let commonAncestorChildInEndNodeBranch

    while(currentAncestor !== commonAncestor){
        let siblingToRemove = currentAncestor.nextSibling
        
        while(siblingToRemove && !endNodeAncestors.has(siblingToRemove)){
            nodesToRemove.add(siblingToRemove)
            siblingToRemove = siblingToRemove.nextSibling
        }
        if(endNodeAncestors.has(siblingToRemove)){
            commonAncestorChildInEndNodeBranch = siblingToRemove
        }

        currentAncestor = currentAncestor.parentNode;
    }

    // remove everything "on the left" of end branch
    currentAncestor = endNode

    while(currentAncestor !== commonAncestor){
        let siblingToRemove = currentAncestor.previousSibling
        
        while(siblingToRemove && !startNodeAncestors.has(siblingToRemove)){
            nodesToRemove.add(siblingToRemove)
            siblingToRemove = siblingToRemove.previousSibling
        }

        currentAncestor = currentAncestor.parentNode;
    }

    for(const node of nodesToRemove){
        node.parentNode.removeChild(node)
    }

    return commonAncestorChildInEndNodeBranch
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

        /*if(positionedMarkers.length >= 1)
            console.log('positionedMarkers', positionedMarkers)*/

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
                    // Calculate relative positions within the nodes
                    let startNodeTextContent = startNode.textContent || '';
                    let endNodeTextContent = endNode.textContent || '';

                    // Calculate the position within the start node
                    let posInStartNode = positionedMarker.index - getNodeTextPosition(startNode, containerTextNodesInTreeOrder);

                    // Calculate the position within the end node
                    let posInEndNode = (positionedMarker.index + positionedMarker.marker.length) - getNodeTextPosition(endNode, containerTextNodesInTreeOrder);

                    /** @type {Node} */
                    let beforeStartNode = startNode

                    // if there is before-text, split
                    if(posInStartNode > 0) {
                        // Text exists before the marker - preserve it

                        // set newStartNode to a Text node containing only the marker beginning
                        const newStartNode = startNode.splitText(posInStartNode)
                        // startNode/beforeStartNode now contains only non-marker text

                        // then, by definition of .splitText(posInStartNode):
                        posInStartNode = 0

                        // remove the marker beginning part from the tree (since the marker will be inserted in full later)
                        newStartNode.parentNode?.removeChild(newStartNode)
                    }

                    /** @type {Node} */
                    let afterEndNode

                    // if there is after-text, split
                    if(posInEndNode < endNodeTextContent.length) {
                        // Text exists after the marker - preserve it

                        // set afterEndNode to a Text node containing only non-marker text
                        afterEndNode = endNode.splitText(posInEndNode);
                        // endNode now contains only the end of marker text

                        // then, by definition of .splitText(posInEndNode):
                        posInEndNode = endNodeTextContent.length

                        // remove the marker ending part from the tree (since the marker will be inserted in full later)
                        endNode.parentNode?.removeChild(endNode)
                    }

                    // then, replace all nodes between (new)startNode and (new)endNode with a single textNode in commonAncestor
                    const insertionPoint = removeNodesBetween(beforeStartNode, afterEndNode)
                    const markerTextNode = insertionPoint.ownerDocument.createTextNode(positionedMarker.marker)

                    insertionPoint.parentNode.insertBefore(markerTextNode, insertionPoint)

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
 * isolate markers which are in Text nodes with other texts
 * 
 * @param {Document} document 
 */
function isolateMarkers(document){
    traverse(document, currentNode => {
        if(currentNode.nodeType === Node.TEXT_NODE) {
            // find all marker starts and ends and split textNode
            let remainingText = currentNode.textContent || ''

            while(remainingText.length >= 1) {
                let matchText;
                let matchIndex;

                // looking for a block marker
                for(const marker of [ifStartMarkerRegex, elseMarker, closingIfMarker, eachStartMarkerRegex, eachClosingMarker]) {
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
}

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
    isolateMarkers(document)
}