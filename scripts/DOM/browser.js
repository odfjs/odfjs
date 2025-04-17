
console.info('DOM implementation in browser')

/** @type { typeof DOMImplementation.prototype.createDocument } */
export function createDocument(...args){
    // @ts-ignore
    return document.implementation.createDocument(...args)
}