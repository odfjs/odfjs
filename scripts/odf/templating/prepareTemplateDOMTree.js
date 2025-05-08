import {traverse, Node} from "../../DOMUtils.js";
import {closingIfMarker, eachClosingMarker, eachStartMarkerRegex, elseMarker, ifStartMarkerRegex} from './markers.js'

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
 * get the path from ancestor to descendant
 * 
 * @param {Node} node 
 * @param {Node} ancestor 
 * @returns {DOMPath}
 */
function getPathToNode(node, ancestor) {
    /** @type {DOMPath} */
    const path = [];
    let current = node;

    while(current && current !== ancestor) {
        path.unshift(current);
        current = current.parentNode;
    }

    return path;
}

/**
 * find the point where two paths diverge
 * 
 * @param {DOMPath} path1 
 * @param {DOMPath} path2 
 * @returns {Node | undefined}
 */
function findDivergingPoint(path1, path2) {
    for(let i = 0; i < Math.min(path1.length, path2.length); i++) {
        if(path1[i] !== path2[i]) {
            return path1[i - 1] || undefined; // Return the last common node
        }
    }

    // One path is a prefix of the other
    return path1[Math.min(path1.length, path2.length) - 1];
}

/**
 * handle the case where start and end nodes have a direct relationship
 * @param {Text} startNode 
 * @param {Text} endNode 
 * @param {number} posInStartNode 
 * @param {number} posInEndNode 
 * @param {string} markerText 
 */
function consolidateDirectRelationship(startNode, endNode, posInStartNode, posInEndNode, markerText) {
    const startNodeParent = startNode.parentNode;
    const endNodeParent = endNode.parentNode;
    const document = startNode.ownerDocument;

    console.log('consolidateDirectRelationship - startNodeParent === endNodeParent', startNodeParent === endNodeParent)

    if(startNodeParent === endNodeParent) {
        // Siblings case
        let currentNode = startNode;
        let nextSibling;

        // Handle start node - split if needed to preserve text before marker
        if(posInStartNode > 0) {
            console.log('posInStartNode > 0', posInStartNode)
            console.log('startNode', startNode.textContent)
            // Split text node to preserve text before marker
            const remainingNode = startNode.splitText(posInStartNode);
            currentNode = remainingNode.previousSibling; // Now we'll work with the second part
            remainingNode.parentNode?.removeChild(remainingNode)
            console.log('remainingNode', remainingNode.textContent)
        }

        // Create marker node
        const markerNode = document.createTextNode(markerText);

        // Insert marker after current node
        if(currentNode.nextSibling) {
            startNodeParent.insertBefore(markerNode, currentNode.nextSibling);
        } else {
            startNodeParent.appendChild(markerNode);
        }

        // Remove nodes between start split and end node
        currentNode = markerNode.nextSibling;
        while(currentNode && currentNode !== endNode) {
            nextSibling = currentNode.nextSibling;
            startNodeParent.removeChild(currentNode);
            currentNode = nextSibling;
        }

        // Handle end node - split if needed to preserve text after marker
        if(posInEndNode < endNode.textContent.length) {
            // Split to keep text after marker
            endNode.splitText(posInEndNode);
            // First part (up to the split point) should be removed
            startNodeParent.removeChild(endNode);
        } else {
            // No text after marker, remove the entire end node
            startNodeParent.removeChild(endNode);
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

/**
 * check if one node is ancestor of another
 * 
 * @param {Node} potentialAncestor 
 * @param {Node} node 
 * @returns {boolean}
 */
function isAncestor(potentialAncestor, node) {
    let current = node.parentNode;
    while(current) {
        if(current === potentialAncestor) return true;
        current = current.parentNode;
    }
    return false;
}

/**
 * replace a node with marker text
 * @param {Node} node 
 * @param {string} markerText 
 */
function replaceWithMarker(node, markerText) {
    const document = node.ownerDocument;
    const markerNode = document.createTextNode(markerText);
    node.parentNode.replaceChild(markerNode, node);
}

/**
 * remove nodes between two sibling branches
 * 
 * @param {Node} startBranch 
 * @param {Node} endBranch 
 * @param {Node} commonAncestor 
 */
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
            ...findAllMatches(fullText, eachClosingMarker)
        ];

        console.log('positionedMarkers', positionedMarkers)

        // If no markers found, skip this container
        while(consolidatedMarkers.length < positionedMarkers.length) {
            refreshContainerTextNodes()

            // For each marker, check if it's contained within a single text node
            for(const positionedMarker of positionedMarkers.slice(consolidatedMarkers.length)) {
                console.log('positionedMarker', positionedMarker)

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

                /*if(!startNode){
                    throw new Error(`Could not find startNode for marker '${positionedMarker.marker}'`)
                }*/   
                    
                /*if(!endNode){
                    throw new Error(`Could not find endNode for marker '${positionedMarker.marker}'`)
                }*/

                // Check if marker spans multiple nodes
                if(startNode !== endNode) {
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

                            console.log('parentOfStartNode', parentOfStartNode)

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