import { DOMImplementation } from "@xmldom/xmldom"

//console.info('DOM implementation in Node.js based on xmldom')

const implementation = new DOMImplementation()

/** @type { typeof DOMImplementation.prototype.createDocument } */
export function createDocument(...args){
    // @ts-ignore
    return implementation.createDocument(...args)
}

export {
    DOMParser,
    XMLSerializer,
    Node
} from "@xmldom/xmldom"