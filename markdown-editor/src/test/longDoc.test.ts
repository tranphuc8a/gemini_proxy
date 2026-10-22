import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { LONG_DOC_SHA256, longDoc, type LongDocName } from './longDoc'

describe('longDoc', () => {
  // The browser benchmark (scripts/kiem-hieu-nang.py) generates the same documents in Python; equal hashes
  // mean a number measured in vitest and one measured in Edge are about the very same text.
  it.each(Object.keys(LONG_DOC_SHA256) as LongDocName[])('%s is byte-identical to the benchmark generator', (name) => {
    const hash = createHash('sha256').update(longDoc(name), 'utf8').digest('hex')
    expect(hash).toBe(LONG_DOC_SHA256[name])
  })

  it('has the advertised length', () => {
    expect(longDoc('doc-2k').split('\n')).toHaveLength(2001)
    expect(longDoc('doc-10k').split('\n')).toHaveLength(10001)
  })
})
