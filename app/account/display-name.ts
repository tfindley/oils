// Display-name formatting helpers. Not a server action (no 'use server'),
// so this can be imported by both the server-action file and the client form.

export type DisplayFormat = 'first-last' | 'last-first' | 'first-l' | 'f-last' | 'custom'

export function formatDisplayName(format: DisplayFormat, first: string, last: string, custom?: string): string {
  switch (format) {
    case 'first-last': return `${first} ${last}`
    case 'last-first': return `${last}, ${first}`
    case 'first-l':    return `${first} ${last.charAt(0).toUpperCase()}.`
    case 'f-last':     return `${first.charAt(0).toUpperCase()}. ${last}`
    case 'custom':     return (custom ?? '').trim()
  }
}
