import {traverse, Node, getAncestors, findCommonAncestor} from "../../DOMUtils.js";
import {closingIfMarker, eachClosingMarker, eachStartMarkerRegex, elseMarker, ifStartMarkerRegex, variableRegex} from './markers.js'

/**
 * @typedef TextPlaceToFill
 * @property { {expression: string, replacedString:string}[] } expressions
 * @property {() => void} fill
 */

class TemplateDOMBranch{
    /** @type {Node} */
    #startNode
    
    /** @type {Node} */
    #leafNode

    // ancestors with this.#ancestors[0] === this.#startNode and this.#ancestors.at(-1) === this.#leafNode
    /** @type {Node[]} */
    #ancestors

    /**
     * 
     * @param {Node} startNode 
     * @param {Node} leafNode 
     */
    constructor(startNode, leafNode){
        this.#startNode = startNode
        this.#leafNode = leafNode

        this.#ancestors = getAncestors(this.#leafNode, this.#startNode).reverse()
    }

    /**
     * 
     * @param {number} n 
     * @returns {Node | undefined}
     */
    at(n){
        return this.#ancestors.at(n)
    }

    removeLeafAndEmptyAncestors(){
        // it may happen (else marker of if/else/endif) that the leaf was already removed as part of another block
        // so before removing anything, let's update #ancestors and #leaf

        this.#ancestors.every((ancestor, i) => {
            if(!ancestor.parentNode){
                // ancestor already removed from tree
                this.#ancestors = this.#ancestors.slice(0, i)
                this.#leafNode = this.#ancestors.at(-1)
                return false;
            }

            return true // continue
        })

        //console.log('removeLeafAndEmptyAncestors', this.#startNode.textContent)
        let nextLeaf = this.#leafNode.parentNode
        //console.log('nextLeaf', !!nextLeaf)
        nextLeaf.removeChild(this.#leafNode)
        this.#leafNode = nextLeaf

        while(this.#leafNode !== this.#startNode && 
            this.#leafNode.textContent && this.#leafNode.textContent.trim() === '')
        {
            nextLeaf = this.#leafNode.parentNode
            this.#leafNode.parentNode.removeChild(this.#leafNode)
            this.#leafNode = nextLeaf
        }

        this.#ancestors = getAncestors(this.#startNode, this.#leafNode).reverse()
    }

    /**
     * 
     * @param {number} [startIndex]
     */
    removeRightContent(startIndex = 0){
        for(const branchNode of this.#ancestors.slice(startIndex)){
            let toRemove = branchNode.nextSibling

            while(toRemove){
                const toRemoveNext = toRemove.nextSibling
                toRemove.parentNode.removeChild(toRemove)
                toRemove = toRemoveNext
            }
        }
    }

    /**
     * 
     * @param {number} [startIndex]
     */
    removeLeftContent(startIndex = 0){
        for(const branchNode of this.#ancestors.slice(startIndex)){
            let toRemove = branchNode.previousSibling

            while(toRemove){
                const toRemoveNext = toRemove.previousSibling
                toRemove.parentNode.removeChild(toRemove)
                toRemove = toRemoveNext
            }
        }
    }

    
}


class TemplateBlock{
    /** @type {Element | Document | DocumentFragment} */
    #commonAncestor;
    /** @type {TemplateDOMBranch} */
    #startBranch;
    /** @type {TemplateDOMBranch} */
    #endBranch;

    /** @type {Node[]} */
    #middleContent;

    /**
     * 
     * @param {Node} startMarkerNode 
     * @param {Node} endMarkerNode 
     */
    constructor(startMarkerNode, endMarkerNode){
        // @ts-expect-error xmldom.Node
        this.#commonAncestor = findCommonAncestor(startMarkerNode, endMarkerNode)

        this.#startBranch = new TemplateDOMBranch(this.#commonAncestor, startMarkerNode)
        this.#endBranch = new TemplateDOMBranch(this.#commonAncestor, endMarkerNode)

        this.#middleContent = []

        let content = this.#startBranch.at(1).nextSibling
        while(content && content !== this.#endBranch.at(1)){
            this.#middleContent.push(content)
            content = content.nextSibling
        }

        //console.log('TemplateBlock')
        //console.log('startBranch', this.#startBranch.at(1).textContent)
        //console.log('middleContent', this.#middleContent.map(n => n.textContent).join(''))
        //console.log('endBranch', this.#endBranch.at(1).textContent)
    }

    removeMarkersAndEmptyAncestors(){
        //console.log('removeMarkersAndEmptyAncestors startBranch')
        this.#startBranch.removeLeafAndEmptyAncestors()
        //console.log('removeMarkersAndEmptyAncestors endBranch')
        this.#endBranch.removeLeafAndEmptyAncestors()
    }

    /**
     * 
     * @param {Compartment} compartement 
     */
    fillBlockContentTemplate(compartement){
        const startChild = this.#startBranch.at(1)
        if(startChild){
            fillOdtElementTemplate(startChild, compartement)
        }

        for(const content of this.#middleContent){
            fillOdtElementTemplate(content, compartement)
        }

        const endChild = this.#endBranch.at(1)
        if(endChild){
            fillOdtElementTemplate(endChild, compartement)
        }
    }

    removeContent(){
        this.#startBranch.removeRightContent(2)

        for(const content of this.#middleContent){
            content.parentNode.removeChild(content)
        }

        this.#endBranch.removeLeftContent(2)
    }
}


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
 * @returns {{removeMarkers: () => void, insertContent: (n : Node) => void, content: DocumentFragment}}
 */
function extractBlockContent(blockStartNode, blockEndNode) {
    //console.log('[extractBlockContent] blockStartNode', blockStartNode.textContent)
    //console.log('[extractBlockContent] blockEndNode', blockEndNode.textContent)

    // find common ancestor of blockStartNode and blockEndNode
    let commonAncestor

    let startAncestor = blockStartNode
    let endAncestor = blockEndNode

    // ancestries in order of deepest first, closest to root last
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

    //console.log('extractBlockContent', commonAncestor.textContent)

    const startAncestryToCommonAncestor = [...startAncestry].slice(0, [...startAncestry].indexOf(commonAncestor))
    const endAncestryToCommonAncestor = [...endAncestry].slice(0, [...endAncestry].indexOf(commonAncestor))

    // direct children of commonAncestor in the branch or blockStartNode and blockEndNode respectively
    const startChild = startAncestryToCommonAncestor.at(-1)
    const endChild = endAncestryToCommonAncestor.at(-1)

    //console.log('[extractBlockContent] startChild', startChild.childNodes.length, startChild.textContent)
    //console.log('[extractBlockContent] endChild', endChild.childNodes.length,endChild.textContent)

    // Extract DOM content in a documentFragment
    /** @type {DocumentFragment} */
    const contentFragment = blockStartNode.ownerDocument.createDocumentFragment()

    /** @type {Element[]} */
    const blockContent = []

    // get start branch "right" content
    for(const startAncestor of startAncestryToCommonAncestor){
        if(startAncestor === startChild)
            break;
        
        let sibling = startAncestor.nextSibling

        while(sibling) {
            blockContent.push(sibling)
            sibling = sibling.nextSibling;
        }
    }


    let sibling = startChild.nextSibling

    while(sibling !== endChild) {
        blockContent.push(sibling)
        sibling = sibling.nextSibling;
    }


    // get end branch "left" content
    for(const endAncestor of [...endAncestryToCommonAncestor].reverse()){
        if(endAncestor === endChild)
            continue; // already taken care of
        
        let sibling = endAncestor.previousSibling

        const reversedBlockContentContribution = []

        while(sibling) {
            reversedBlockContentContribution.push(sibling)
            sibling = sibling.previousSibling;
        }

        const blockContentContribution = reversedBlockContentContribution.reverse()

        blockContent.push(...blockContentContribution)

        if(endAncestor === blockEndNode)
            break;
    }
    

    //console.log('blockContent', blockContent.map(n => n.textContent))


    for(const sibling of blockContent) {
        sibling.parentNode?.removeChild(sibling)
        contentFragment.appendChild(sibling)
    }

    //console.log('extractBlockContent contentFragment', contentFragment.textContent)

    let insertionParent;

    if(startAncestryToCommonAncestor.length >= endAncestryToCommonAncestor.length){
        insertionParent = blockStartNode.parentNode
    }
    else{
        insertionParent = blockEndNode.parentNode
    }

    let insertionBeforeNodeCandidates
    if(blockEndNode.nextSibling){
        insertionBeforeNodeCandidates = [blockEndNode.nextSibling]
        while(insertionBeforeNodeCandidates.at(-1).nextSibling){
            insertionBeforeNodeCandidates.push(insertionBeforeNodeCandidates.at(-1).nextSibling)
        }
    }

    /** 
     * @param {Node} content
     */
    function insertContent(content){
        //console.log('insertContent', node.textContent, insertionBeforeNodeCandidates.map(n => `${n.nodeName} - ${n.textContent}`))
        let insertionBeforeNode

        if(insertionBeforeNodeCandidates){
            insertionBeforeNode = insertionBeforeNodeCandidates.find(node => node.parentNode === insertionParent)
        }

        console.log('insertContent insertionBeforeNode', insertionBeforeNode && insertionBeforeNode.textContent)


        if(insertionBeforeNode){
            insertionParent.insertBefore(content, insertionBeforeNode)
        }
        else{
            console.log('insertionParent', insertionParent.nodeName)
            console.log('insertionParent content before append', insertionParent.textContent)
            //console.log('insertionParent owner doc', insertionParent.ownerDocument)
            
            insertionParent.appendChild(content)
            console.log('insertionParent content after append', insertionParent.textContent)
        }
    }

    console.log('contentFragment', 
        contentFragment.childNodes.length, 
        contentFragment.childNodes[0].nodeName,
        contentFragment.textContent
    )

    return {
        removeMarkers(){
            for(const marker of [blockStartNode, blockEndNode]){
                console.log('removing marker', marker.nodeName, marker.textContent)

                try{
                    marker.parentNode.removeChild(marker)
                }
                catch(e){}
            }  
        },
        insertContent,
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

    /** @type {TemplateBlock | undefined} */
    let thenTemplateBlock
    /** @type {TemplateBlock | undefined} */
    let elseTemplateBlock

    if(ifElseMarkerNode) {
        /*console.log('before first extract', 
            ifOpeningMarkerNode.childNodes.length, ifOpeningMarkerNode.textContent, 
            ifElseMarkerNode.childNodes.length, ifElseMarkerNode.textContent
        )*/

        thenTemplateBlock = new TemplateBlock(ifOpeningMarkerNode, ifElseMarkerNode)
        elseTemplateBlock = new TemplateBlock(ifElseMarkerNode, ifClosingMarkerNode)
    }
    else {
        thenTemplateBlock = new TemplateBlock(ifOpeningMarkerNode, ifClosingMarkerNode)
    }

    thenTemplateBlock.removeMarkersAndEmptyAncestors()
    if(elseTemplateBlock){
        elseTemplateBlock.removeMarkersAndEmptyAncestors()
    }


    if(conditionValue) {
        thenTemplateBlock.fillBlockContentTemplate(compartment)

        if(elseTemplateBlock){
            elseTemplateBlock.removeContent()
        }
    }
    else{
        thenTemplateBlock.removeContent()

        if(elseTemplateBlock){
            elseTemplateBlock.fillBlockContentTemplate(compartment)
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
function fillEachBlock(startNode, iterableExpression, itemExpression, endNode, compartment) {
    //console.log('fillEachBlock', iterableExpression, itemExpression)

    const docEl = startNode.ownerDocument.documentElement

    const {removeMarkers, insertContent, content: repeatedFragment} = extractBlockContent(startNode, endNode)

    // Find the iterable in the data
    // PPP eventually, evaluate the expression as a JS expression
    let iterable = compartment.evaluate(iterableExpression)
    if(!iterable || typeof iterable[Symbol.iterator] !== 'function') {
        // when there is no iterable, silently replace with empty array
        iterable = []
    }

    let firstItemFirstChild
    let lastItemLastChild

    // store before-text in startNodePreviousSiblings
    const startNodePreviousSiblings = []
    let startNodePreviousSibling = startNode.previousSibling
    while(startNodePreviousSibling){
        startNodePreviousSiblings.push(startNodePreviousSibling)
        startNodePreviousSibling = startNodePreviousSibling.previousSibling
    }

    // set the array back to tree order
    startNodePreviousSiblings.reverse()


    // store after-text in endNodeNextSiblings
    const endNodeNextSiblings = []
    let endNodeNextSibling = endNode.nextSibling
    while(endNodeNextSibling){
        endNodeNextSiblings.push(endNodeNextSibling)
        endNodeNextSibling = endNodeNextSibling.nextSibling
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
        fillOdtElementTemplate(
            itemFragment,
            insideCompartment
        )

        console.log('itemFragment', itemFragment.textContent)


        if(!firstItemFirstChild){
            firstItemFirstChild = itemFragment.firstChild
        }

        // eventually, will be set to the last item's last child
        lastItemLastChild = itemFragment.lastChild

        insertContent(itemFragment)

        console.log('doc', docEl.textContent)
    }

    if(startNodePreviousSiblings.length >= 1){
        let firstItemFirstestDescendant = firstItemFirstChild
        while(firstItemFirstestDescendant?.firstChild){
            firstItemFirstestDescendant = firstItemFirstestDescendant.firstChild
        }

        for(const beforeFirstNodeElement of startNodePreviousSiblings){
            firstItemFirstestDescendant?.parentNode?.insertBefore(beforeFirstNodeElement, firstItemFirstestDescendant)
        }
    }

    console.log('doc after add before-text if any', docEl.textContent)


    if(endNodeNextSiblings.length >= 1){
        let lastItemLatestDescendant = lastItemLastChild
        while(lastItemLatestDescendant?.lastChild){
            lastItemLatestDescendant = lastItemLatestDescendant.lastChild
        }

        for(const afterEndNodeElement of endNodeNextSiblings){
            console.log('doc in for-of', docEl.textContent)
            console.log('afterEndNodeElement', afterEndNodeElement.textContent)
            lastItemLatestDescendant?.parentNode?.appendChild(afterEndNodeElement)
        }
    }

    console.log('doc before removeMarkers', docEl.textContent)
    // remove block marker elements
    removeMarkers()
    console.log('doc after removeMarkers', docEl.textContent)
}


const IF = ifStartMarkerRegex.source
const EACH = eachStartMarkerRegex.source

/**
 * 
 * @param {Element | DocumentFragment | Document} rootElement 
 * @param {Compartment} compartment 
 * @returns {void}
 */
export default function fillOdtElementTemplate(rootElement, compartment) {
    //console.log('fillTemplatedOdtElement', rootElement.nodeType, rootElement.nodeName, rootElement.textContent)
    //console.log('fillTemplatedOdtElement', rootElement.childNodes[0].childNodes.length)

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
        //console.log('currentlyOpenBlocks', currentlyOpenBlocks)
        
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
            const ifClosingMarker = text.includes(closingIfMarker);

            if(ifClosingMarker) {
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

                currentlyOpenBlocks.pop()
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
