
//console.info('DOM implementation in browser')

/** @type { typeof DOMImplementation.prototype.createDocument } */
export function createDocument(...args){
    // @ts-ignore
    return document.implementation.createDocument(...args)
}

export const DOMParser = window.DOMParser
export const XMLSerializer = window.XMLSerializer
export const Node = window.Node