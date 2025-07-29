import {traverse, Node, getAncestors, findCommonAncestor} from "../../DOMUtils.js";
import {closingIfMarker, eachClosingMarker, eachStartMarkerRegex, elseMarker, ifStartMarkerRegex, imageMarkerRegex, variableRegex} from './markers.js'

/**
 * @typedef TextPlaceToFill
 * @property { {expression: string, replacedString:string}[] } expressions
 * @property {() => void} fill
 */

class TemplateDOMBranch{
    /** @type {Node} */
    #branchBaseNode
    
    /** @type {Node} */
    #leafNode

    // ancestors with this.#ancestors[0] === this.#branchBaseNode and this.#ancestors.at(-1) === this.#leafNode
    /** @type {Node[]} */
    #ancestors

    /**
     * 
     * @param {Node} branchBaseNode 
     * @param {Node} leafNode 
     */
    constructor(branchBaseNode, leafNode){
        this.#branchBaseNode = branchBaseNode
        this.#leafNode = leafNode

        this.#ancestors = getAncestors(this.#leafNode, this.#branchBaseNode).reverse()
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
        //this.logBranch('[removeLeafAndEmptyAncestors] branch at the start')

        // it may happen (else marker of if/else/endif) that the leaf was already removed as part of another block
        // so before removing anything, let's update #ancestors and #leaf

        this.#ancestors.every((ancestor, i) => {
            if(!ancestor.parentNode){
                // ancestor already removed from tree
                this.#ancestors = this.#ancestors.slice(0, i)
                return false;
            }

            return true // continue
        })

        this.#leafNode = this.#ancestors.at(-1)

        //this.logBranch('[removeLeafAndEmptyAncestors] after adjusting this.#ancestors')

        //console.log('removeLeafAndEmptyAncestors', this.#startNode.textContent)
        let nextLeaf
        if(this.#leafNode !== this.#branchBaseNode){
            nextLeaf = this.#leafNode.parentNode
            //console.log('nextLeaf', !!nextLeaf)
            nextLeaf.removeChild(this.#leafNode)
            this.#leafNode = nextLeaf
        }

        while(this.#leafNode !== this.#branchBaseNode && 
            (this.#leafNode.textContent === null || this.#leafNode.textContent.trim() === ''))
        {
            nextLeaf = this.#leafNode.parentNode
            this.#leafNode.parentNode.removeChild(this.#leafNode)
            this.#leafNode = nextLeaf
        }

        this.#ancestors = getAncestors(this.#leafNode, this.#branchBaseNode).reverse()
    }

    /**
     * 
     * @param {number} [startIndex]
     */
    removeRightContent(startIndex = 0){
        //console.log('[removeRightContent]', startIndex, this.#ancestors.slice(startIndex).length)

        for(const branchNode of this.#ancestors.slice(startIndex)){
            //console.log('[removeRightContent]', branchNode.nodeType, branchNode.nodeName)

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

    /**
     * 
     * @returns {number[]}
     */
    getBranchPath(){
        //console.log('[getBranchPath]', this.#branchBaseNode.nodeName, this.#branchBaseNode.textContent)
        //console.log('[getBranchPath] leaf', this.#leafNode.nodeName, this.#leafNode.textContent)

        /** @type {ReturnType<typeof TemplateDOMBranch.prototype.getBranchPath>} */
        const pathFromLeafToBase = [];

        let currentNode = this.#leafNode
        let currentNodeParent = currentNode.parentNode

        while(currentNodeParent){
            //console.log('[getBranchPath] currentNodeParent', currentNodeParent.nodeName)
            //console.log('[getBranchPath] looking for currentNode', currentNode.nodeName, currentNode.textContent)
            //console.log('[getBranchPath] currentNodeParent.childNodes.length', currentNodeParent.childNodes.length)
            /*console.log('[getBranchPath] currentNodeParent.childNodes', Array.from(currentNodeParent.childNodes)
                .map(n => `${n.nodeName} - ${n.textContent}`)
            )*/

            const index = Array.from(currentNodeParent.childNodes).indexOf(currentNode)
            //console.log('[getBranchPath] indexOf', index)
            if(index === -1){
                throw new Error(`Could not find currentNode in currentNodeParent's childNodes`)
            }
            pathFromLeafToBase.push(index)
            //console.log('[getBranchPath] currentNodeParent and index', currentNodeParent.nodeName, index)

            if(currentNodeParent === this.#ancestors[0]){
                break; // path is fnished
            }
            else{
                currentNode = currentNodeParent
                currentNodeParent = currentNode.parentNode
            }
        }

        //@ts-expect-error ES2023
        return pathFromLeafToBase.toReversed()
    }

    logBranch(message){
        console.group('[TemplateDOMBranch] Showing branch')
        console.log(message)
        for(const node of this.#ancestors){
            console.log('branch node', node.nodeType, node.nodeName, node.nodeType === node.TEXT_NODE ? node.textContent : '')
        }
        console.groupEnd()
    }


}


class TemplateBlock{
    /** @type {Element | Document | DocumentFragment} */
    #commonAncestor;
    /** @type {TemplateDOMBranch} */
    startBranch;
    /** @type {TemplateDOMBranch} */
    endBranch;

    /** @type {Node[]} */
    #middleContent;

    /**
     * 
     * @param {Node} startNode 
     * @param {Node} endNode 
     */
    constructor(startNode, endNode){
        // @ts-expect-error xmldom.Node
        this.#commonAncestor = findCommonAncestor(startNode, endNode)

        //console.log('create start branch')
        this.startBranch = new TemplateDOMBranch(this.#commonAncestor, startNode)
        //console.log('create end branch')
        this.endBranch = new TemplateDOMBranch(this.#commonAncestor, endNode)



        this.#middleContent = []

        let content = this.startBranch.at(1).nextSibling
        while(content && content !== this.endBranch.at(1)){
            this.#middleContent.push(content)
            content = content.nextSibling
        }

        //console.group('\n== TemplateBlock ==')
        //this.startBranch.logBranch('startBranch')
        //console.log('middleContent', this.#middleContent.map(n => n.textContent).join(''))
        //this.endBranch.logBranch('endBranch')
        //console.log('common ancestor', this.#commonAncestor.nodeName, '\n')
        //console.groupEnd()
    }

    removeMarkersAndEmptyAncestors(){
        //console.log('[removeMarkersAndEmptyAncestors]', this.#commonAncestor.textContent)
        this.startBranch.removeLeafAndEmptyAncestors()
        this.endBranch.removeLeafAndEmptyAncestors()
        //console.log('[removeMarkersAndEmptyAncestors] after', this.#commonAncestor.textContent)
    }

    /**
     * 
     * @param {Compartment} compartement 
     */
    fillBlockContentTemplate(compartement){
        //console.log('[fillBlockContentTemplate] start')

        const startChild = this.startBranch.at(1)
        if(startChild /*&& startChild !== */){
            //console.log('[fillBlockContentTemplate] startChild', startChild.nodeName, startChild.textContent)
            fillOdtElementTemplate(startChild, compartement)
        }
        //console.log('[fillBlockContentTemplate] after startChild')

        
        // if content consists of several parts of an {#each}{/each}
        // when arriving to the {/each}, it will be alone (and imbalanced)
        // and will trigger an error
        fillOdtElementTemplate(Array.from(this.#middleContent), compartement)

        //console.log('[fillBlockContentTemplate] after middleContent')

        const endChild = this.endBranch.at(1)
        //console.log('fillBlockContentTemplate] [endBranch]')
        //this.endBranch.logBranch('endBranch')

        if(endChild){
            //console.log('[fillBlockContentTemplate] endChild', endChild.nodeName, endChild.textContent)
            fillOdtElementTemplate(endChild, compartement)
        }
        //console.log('[fillBlockContentTemplate] after endChild')

        //console.log('[fillBlockContentTemplate] end')
    }

    removeContent(){
        this.startBranch.removeRightContent(2)

        for(const content of this.#middleContent){
            content.parentNode.removeChild(content)
        }

        this.endBranch.removeLeftContent(2)
    }

    

    /**
     * @returns {TemplateBlock}
     */
    cloneAndAppendAfter(){
        //console.log('[cloneAndAppendAfter]')
        const clonedPieces = []

        let startBranchClone;
        let endBranchClone;

        for(const sibling of [this.startBranch.at(1), ...this.#middleContent, this.endBranch.at(1)]){
            if(sibling){
                const siblingClone = sibling.cloneNode(true)
                clonedPieces.push(siblingClone)
                
                if(sibling === this.startBranch.at(1))
                    startBranchClone = siblingClone
                
                if(sibling === this.endBranch.at(1))
                    endBranchClone = siblingClone
                
            }
        }

        let startChildPreviousSiblingsCount = 0
        let previousSibling = this.startBranch.at(1).previousSibling
        while(previousSibling){
            startChildPreviousSiblingsCount = startChildPreviousSiblingsCount + 1
            previousSibling = previousSibling.previousSibling
        }

        const startBranchPathFromBaseToLeaf = this.startBranch.getBranchPath().slice(1)
        const endBranchPathFromBaseToLeaf = this.endBranch.getBranchPath().slice(1)

        
        //console.log('startBranchClone', !!startBranchClone)
        //console.log('startBranchPathFromBaseToLeaf', startBranchPathFromBaseToLeaf)

        let startLeafCloneNode
        {
            let node = startBranchClone
            for(let pathIndex of startBranchPathFromBaseToLeaf){
                //console.log('[startLeafCloneNode] node.childNodes.length', node.childNodes.length)
                //console.log('[startLeafCloneNode] pathIndex', pathIndex)

                node = node.childNodes[pathIndex]
            }
            startLeafCloneNode = node
        }

        //console.log('endBranchClone', !!endBranchClone)
        //console.log('endBranchPathFromBaseToLeaf', endBranchPathFromBaseToLeaf)

        let endLeafCloneNode
        {
            let node = endBranchClone
            for(let pathIndex of endBranchPathFromBaseToLeaf){

                //console.log('[endLeafCloneNode] node.childNodes.length', node.childNodes.length)
                //console.log('[endLeafCloneNode] pathIndex', pathIndex)

                node = node.childNodes[pathIndex]
            }
            endLeafCloneNode = node
        }

        let insertBeforePoint = this.endBranch.at(1) && this.endBranch.at(1).nextSibling

        if(insertBeforePoint){
            for(const node of clonedPieces){
                this.#commonAncestor.insertBefore(node, insertBeforePoint)
            }
        }
        else{
            for(const node of clonedPieces){
                this.#commonAncestor.appendChild(node)
            }
        }

        return new TemplateBlock(startLeafCloneNode, endLeafCloneNode)
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
 * 
 * @param {Node} ifOpeningMarkerNode 
 * @param {Node | undefined} ifElseMarkerNode 
 * @param {Node} ifClosingMarkerNode 
 * @param {string} ifBlockConditionExpression 
 * @param {Compartment} compartment 
 */
function fillIfBlock(ifOpeningMarkerNode, ifElseMarkerNode, ifClosingMarkerNode, ifBlockConditionExpression, compartment) {
    //const docEl = ifOpeningMarkerNode.ownerDocument.documentElement
    
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

    if(conditionValue) {
        if(elseTemplateBlock){
            elseTemplateBlock.removeContent()
        }

        thenTemplateBlock.removeMarkersAndEmptyAncestors()
        if(elseTemplateBlock){
            elseTemplateBlock.removeMarkersAndEmptyAncestors()
        }

        thenTemplateBlock.fillBlockContentTemplate(compartment)
    }
    else{
        // remove content before removing markers so that right and left content are fully removed
        thenTemplateBlock.removeContent()
        
        thenTemplateBlock.removeMarkersAndEmptyAncestors()
        if(elseTemplateBlock){
            elseTemplateBlock.removeMarkersAndEmptyAncestors()
        }

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
    //console.log('[fillEachBlock] docEl', docEl.textContent)

    const repeatedTemplateBlock = new TemplateBlock(startNode, endNode)

    // Find the iterable in the data
    let iterable = compartment.evaluate(iterableExpression)
    if(!iterable || typeof iterable[Symbol.iterator] !== 'function') {
        // when there is no iterable, silently replace with empty array
        iterable = []
    }

    // convert to array to know the size and know which element is last
    if(!Array.isArray(iterable))
        iterable = [...iterable]


    if(iterable.length === 0){
        repeatedTemplateBlock.removeMarkersAndEmptyAncestors()
        repeatedTemplateBlock.removeContent()
    }
    else{
        let nextTemplateBlock = repeatedTemplateBlock

        iterable.forEach((item, i) => {
            //console.log('[fillEachBlock] loop i', i, docEl.textContent)
            const firstItem = i === 0
            const lastItem = i === iterable.length - 1
            let currentTemplateBlock = nextTemplateBlock;

            //console.log('currentTemplateBlock', currentTemplateBlock.startBranch.at(0).textContent)

            if(!lastItem){
                nextTemplateBlock = currentTemplateBlock.cloneAndAppendAfter()
            }

            let insideCompartment = new Compartment({
                globals: Object.assign({}, compartment.globalThis, {[itemExpression]: item}),
                __options__: true
            })

            if(!firstItem){
                currentTemplateBlock.startBranch.removeLeftContent(2)
            }
            if(!lastItem){
                //console.log('[fillEachBlock] removeRightContent')
                currentTemplateBlock.endBranch.removeRightContent(2)
            }

            //console.log('[fillEachBlock] docEl i before removeMarkers', i, docEl.textContent)
            currentTemplateBlock.removeMarkersAndEmptyAncestors()
            //console.log('[fillEachBlock] docEl i after removeMarkers', i, docEl.textContent)

            //console.log('\nrecursive call to fillBlockContentTemplate')
            currentTemplateBlock.fillBlockContentTemplate(insideCompartment)

            //console.log('[fillEachBlock] docEl i after remove contents', i, docEl.textContent)

        })
    }

}


/**
 * @param {string} str
 * @param {Compartement} compartment
 * @returns {}
 */
function findImageMarker(str, compartment) {
    const imageRexExp = new RegExp(imageMarkerRegex.source, 'g');
    const match = imageRexExp.exec(str)

    if (match===null){
        return;
    }

    const expression = match[1]
    const value = compartment.evaluate(expression)
    
    if (value instanceof ArrayBuffer) {
        // TODO : 
        //  - Rajouter un fichier image dans le odt avec le ArrayBuffer comme contenu (ou autre type)
        //  - Rajouter un suffixe/titre (donc peut-être changer l'api pour que photo ça soit un objet qui contienne arraybuffer et d'autres choses)
        //  - puis remplacer le texte par peut-être <draw:image et peut-être <draw:frame et peut être pas ici
        return value
    } else {
        // TODO: throws an exception
    }
}

const IF = ifStartMarkerRegex.source
const EACH = eachStartMarkerRegex.source

/** @typedef {Element | DocumentFragment | Document} RootElementArgument */


/**
 * 
 * @param {RootElementArgument | RootElementArgument[]} rootElements
 * @param {Compartment} compartment 
 * @returns {void}
 */
export default function fillOdtElementTemplate(rootElements, compartment) {
    
    if(!Array.isArray(rootElements)){
        rootElements = [rootElements]
    }

    //console.log('[fillTemplatedOdtElement]', rootElements.length, rootElements[0].nodeType, rootElements[0].nodeName, rootElements[0].textContent)
    //console.log('[fillTemplatedOdtElement]', rootElement.documentElement && rootElement.documentElement.textContent)

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


    for(const rootElement of rootElements){

        // @ts-ignore
        traverse(rootElement, currentNode => {
            //console.log('currentlyOpenBlocks', currentlyOpenBlocks)
            //console.log('eachOpeningMarkerNode', eachOpeningMarkerNode)

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

                    //console.log('isEachClosingBlock', isEachClosingBlock, currentlyOpenBlocks)

                    if(!insideAnOpenBlock)
                        throw new Error('{/each} found without corresponding opening {#each x as y}')

                    if(currentlyOpenBlocks.at(-1) !== EACH)
                        throw new Error(`{/each} found while the last opened block was not an opening {#each x as y}`)

                    if(currentlyOpenBlocks.length === 1) {
                        eachClosingMarkerNode = currentNode

                        // found an {#each} and its corresponding {/each}
                        // execute replacement loop
                        //console.log('start of fillEachBlock')

                        fillEachBlock(eachOpeningMarkerNode, eachBlockIterableExpression, eachBlockItemExpression, eachClosingMarkerNode, compartment)

                        //console.log('end of fillEachBlock')

                        eachOpeningMarkerNode = undefined
                        eachBlockIterableExpression = undefined
                        eachBlockItemExpression = undefined
                        eachClosingMarkerNode = undefined
                    }
                    else {
                        // ignore because it will be treated as part of the outer {#each}
                    }

                    //console.log('popping currentlyOpenBlocks')
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
                        } else {
                            const imageMarker = findImageMarker(currentNode.data, compartment)
                            
                            if (imageMarker){
                                console.log({imageMarker}, "dans le if")
                            }
                            

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
}
