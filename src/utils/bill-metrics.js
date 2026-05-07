export const toFiniteNumber = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export const parseWeightExpression = (input) => {
  const raw = String(input || '').trim()
  if (!raw) return 0

  const tokens = raw
    .replace(/[×xX]/g, '*')
    .replace(/\s*\*\s*/g, '*')
    .replace(/[，,、；;＋+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)

  if (!tokens.length) return 0

  let value = 0
  tokens.forEach((token) => {
    if (!token.includes('*') && (token.match(/\./g) || []).length > 1) {
      const dotParts = token.split('.')
      const numbers = dotParts.map((part) => Number(part))
      if (numbers.length === dotParts.length && numbers.every(Number.isFinite)) {
        value += numbers.reduce((sum, number) => sum + number, 0)
      }
      return
    }

    const factors = token.split('*')
    const numbers = factors.map((part) => Number(part)).filter(Number.isFinite)
    if (numbers.length !== factors.length || numbers.length === 0) return

    value += numbers.reduce((product, number) => product * number, 1)
  })

  return Number.isFinite(value) ? value : 0
}

export const getBillItems = (record = {}) => {
  if (Array.isArray(record.items)) return record.items
  if (Array.isArray(record.details)) return record.details
  return []
}

export const getRecordItemWeight = (item = {}) => {
  const inputWeight = parseWeightExpression(item.quantityInput ?? item.weightInput ?? item.weight_input_text ?? item.weightInputText)
  if (inputWeight > 0) return inputWeight

  const direct = toFiniteNumber(item.totalWeight ?? item.quantity ?? item.weight, NaN)
  return Number.isFinite(direct) && direct > 0 ? direct : 0
}

export const getRecordTotalWeight = (record = {}) => {
  const itemTotal = getBillItems(record).reduce((sum, item) => sum + getRecordItemWeight(item), 0)
  if (itemTotal > 0) return itemTotal

  const direct = toFiniteNumber(record.totalWeight ?? record.netWeight, NaN)
  if (Number.isFinite(direct) && direct > 0) return direct
  return 0
}

export const getRecordTotalAmount = (record = {}) => {
  const itemTotal = getBillItems(record).reduce((sum, item) => {
    const unitPrice = toFiniteNumber(item.unitPrice ?? item.unit_price, 0)
    return sum + getRecordItemWeight(item) * unitPrice
  }, 0)
  const adjustment = Math.max(Math.round(toFiniteNumber(record.balanceAdjustmentAmount ?? record.balance_adjustment_amount, 0)), 0)
  if (itemTotal > 0) return Math.max(Math.round(itemTotal) - adjustment, 0)

  const direct = toFiniteNumber(record.totalAmount ?? record.totalPrice, NaN)
  if (Number.isFinite(direct) && direct > 0) return Math.max(Math.round(direct), 0)
  return 0
}
