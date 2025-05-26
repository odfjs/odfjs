import {DOMParser, XMLSerializer} from '#DOM'

/*
    Since we're using xmldom in Node.js context, the entire DOM API is not implemented
    Functions here are helpers whild xmldom becomes more complete
*/


/**
 * 
 * @param {string} str 
 * @returns {Document}
 */
export function parseXML(str){
    return (new DOMParser()).parseFromString(str, 'application/xml');
}

const serializer = new XMLSerializer()

/** @type { typeof XMLSerializer.prototype.serializeToString } */
export function serializeToString(node){
    return serializer.serializeToString(node)
}


/**
 * Traverses a DOM tree starting from the given node and applies the visit function
 * to each Element node encountered in tree order (depth-first).
 * 
 * This should probably be replace by the TreeWalker API when implemented by xmldom
 * 
 * @param {Node} node
 * @param {(n : Node) => void} visit
 */
export function traverse(node, visit) {
    //console.log('traverse', node.nodeType, node.nodeName)
    
    for (const child of Array.from(node.childNodes)) {
        traverse(child, visit);
    }

    visit(node);
}


/**
 * 
 * @param {Node} node1 
 * @param {Node} node2 
 * @returns {Node}
 */
export function findCommonAncestor(node1, node2) {
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
 * returns ancestors youngest first, oldest last
 * 
 * @param {Node} node 
 * @param {Node} [until] 
 * @returns {Node[]} 
 */
export function getAncestors(node, until = undefined) {
    const ancestors = [];
    let current = node;

    while(current && current !== until) {
        ancestors.push(current);
        current = current.parentNode;
    }

    if(current === until){
        ancestors.push(until);
    }

    return ancestors;
}



export {
    DOMParser, 
    XMLSerializer,
    createDocument,
    Node
} from '#DOM'