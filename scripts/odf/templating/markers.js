// the regexps below are shared, so they shoudn't have state (no 'g' flag)
export const ifStartMarkerRegex = /{#if\s+([^}]+?)\s*}/;
export const elseMarker = '{:else}'
export const closingIfMarker = '{/if}'

export const eachStartMarkerRegex = /{#each\s+([^}]+?)\s+as\s+([^}]+?)\s*}/;
export const eachClosingMarker = '{/each}'