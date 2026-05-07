import { describe, expect, it } from 'vitest'

import { parseWeightExpression } from './bill-metrics'

describe('parseWeightExpression', () => {
  it('adds weights split by spaces, plus signs, punctuation, and repeated dots', () => {
    expect(parseWeightExpression('10+10+10')).toBe(30)
    expect(parseWeightExpression('10 10 10')).toBe(30)
    expect(parseWeightExpression('10,10；10')).toBe(30)
    expect(parseWeightExpression('10.10.10')).toBe(30)
  })

  it('multiplies each token before adding the next token', () => {
    expect(parseWeightExpression('10×8 60')).toBe(140)
    expect(parseWeightExpression('10x8 60')).toBe(140)
    expect(parseWeightExpression('10 * 8 + 60')).toBe(140)
    expect(parseWeightExpression('10×8 60 5×2')).toBe(150)
  })

  it('keeps normal decimals as decimal numbers', () => {
    expect(parseWeightExpression('10.5 2×3')).toBe(16.5)
  })
})
