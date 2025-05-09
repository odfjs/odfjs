import {traverse, Node} from '../../DOMUtils.js'
import {closingIfMarker, eachClosingMarker, eachStartMarkerRegex, elseMarker, ifStartMarkerRegex, variableRegex} from './markers.js'
import prepareTemplateDOMTree from './prepareTemplateDOMTree.js';

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
    const varRexExp = new RegExp(variableRegex.source, 'g');
    const matches = str.matchAll(varRexExp)

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
    console.log('[extractBlockContent] blockEndNode', blockEndNode.textContent)

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

    console.log('[extractBlockContent] endChild', endChild.textContent)

    // Extract DOM content in a documentFragment
    /** @type {DocumentFragment} */
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

    console.log('extractBlockContent contentFragment', contentFragment.textContent)

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
        fillOdtElementTemplate(
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
    console.log('startNode', startNode.nodeName, startNode.textContent)
    console.log('endNode', endNode.nodeName, endNode.textContent)
    console.log('endNode parent', endNode.parentNode.childNodes.length, endNode.parentNode.textContent)

    const doc = startNode.ownerDocument.documentElement

    console.log('doc text', doc.textContent)

    const {startChild, endChild, content: repeatedFragment} = extractBlockContent(startNode, endNode)

    console.log('endChild after extractBlockContent', endChild.textContent)
    console.log('doc text', doc.textContent)

    // Find the iterable in the data
    // PPP eventually, evaluate the expression as a JS expression
    let iterable = compartment.evaluate(iterableExpression)
    if(!iterable || typeof iterable[Symbol.iterator] !== 'function') {
        // when there is no iterable, silently replace with empty array
        iterable = []
    }

    let firstItemFirstChild
    let lastItemLastChild

    // create each loop result
    // using a for-of loop to accept all iterable values
    for(const item of iterable) {
        console.log('{#each}', itemExpression, item)
        console.log('doc text', doc.textContent)

        /** @type {DocumentFragment} */
        // @ts-ignore
        const itemFragment = repeatedFragment.cloneNode(true)
        console.log('itemFragment', itemFragment.textContent)

        let insideCompartment = new Compartment({
            globals: Object.assign({}, compartment.globalThis, {[itemExpression]: item}),
            __options__: true
        })

        // recursive call to fillTemplatedOdtElement on itemFragment
        fillOdtElementTemplate(
            itemFragment,
            insideCompartment
        )

        if(!firstItemFirstChild){
            firstItemFirstChild = itemFragment.firstChild
        }

        // eventually, will be set to the last item's last child
        lastItemLastChild = itemFragment.lastChild

        console.log('{#each} fragment', itemFragment.textContent)

        endChild.parentNode.insertBefore(itemFragment, endChild)
    }

    // add before-text if any
    const startNodePreviousSiblings = []
    let startNodePreviousSibling = startNode.previousSibling
    while(startNodePreviousSibling){
        startNodePreviousSiblings.push(startNodePreviousSibling)
        startNodePreviousSibling = startNodePreviousSibling.previousSibling
    }

    // set the array back to tree order
    startNodePreviousSiblings.reverse()

    if(startNodePreviousSiblings.length >= 1){
        let firstItemFirstestDescendant = firstItemFirstChild
        while(firstItemFirstestDescendant?.firstChild){
            firstItemFirstestDescendant = firstItemFirstestDescendant.firstChild
        }

        for(const beforeFirstNodeElement of startNodePreviousSiblings){
            firstItemFirstestDescendant?.parentNode?.insertBefore(beforeFirstNodeElement, firstItemFirstestDescendant)
        }
    }



    // add after-text if any
    const endNodeNextSiblings = []
    let endNodeNextSibling = endNode.nextSibling
    while(endNodeNextSibling){
        endNodeNextSiblings.push(endNodeNextSibling)
        endNodeNextSibling = endNodeNextSibling.nextSibling
    }

    if(endNodeNextSiblings.length >= 1){
        let lastItemLatestDescendant = lastItemLastChild
        while(lastItemLatestDescendant?.lastChild){
            lastItemLatestDescendant = lastItemLatestDescendant.lastChild
        }

        for(const afterEndNodeElement of endNodeNextSiblings){
            lastItemLatestDescendant?.parentNode?.appendChild(afterEndNodeElement)
        }
    }


    console.log('doc text after each', doc.textContent)

    // remove block marker elements
    startChild.parentNode.removeChild(startChild)
    endChild.parentNode.removeChild(endChild)

    console.log('doc text after removes', doc.textContent)

}


const IF = 'IF'
const EACH = 'EACH'

/**
 * 
 * @param {Element | DocumentFragment | Document} rootElement 
 * @param {Compartment} compartment 
 * @returns {void}
 */
export default function fillOdtElementTemplate(rootElement, compartment) {
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
            const isEachClosingBlock = text.includes(eachClosingMarker)

            if(isEachClosingBlock) {

                //console.log('isEachClosingBlock', isEachClosingBlock)

                if(!eachOpeningMarkerNode)
                    throw new Error(`{/each} found without corresponding opening {#each x as y}`)

                if(currentlyOpenBlocks.at(-1) !== EACH)
                    throw new Error(`{/each} found while the last opened block was not an opening {#each x as y}`)

                if(currentlyOpenBlocks.length === 1) {
                    eachClosingMarkerNode = currentNode

                    console.log('before fillEachBlock', eachClosingMarkerNode.parentNode.textContent)

                    // found an {#each} and its corresponding {/each}
                    // execute replacement loop
                    fillEachBlock(eachOpeningMarkerNode, eachBlockIterableExpression, eachBlockItemExpression, eachClosingMarkerNode, compartment)

                    console.log('after fillEachBlock', rootElement.documentElement.textContent)

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
