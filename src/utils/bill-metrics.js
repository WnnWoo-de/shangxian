export const toFiniteNumber = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export const parseWeightExpression = (input) => {
  const raw = String(input || '').trim()
  if (!raw) return 0

  const normalized = raw
    .replace(/[，,、；;]/g, ' ')
    .replace(/[＋]/g, '+')
    .replace(/[×xX]/g, '*')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return 0

  let value = 0
  normalized.split('+').forEach((part) => {
    const multiplyParts = part.split('*')
    if (multiplyParts.length === 2) {
      const left = Number(multiplyParts[0])
      const right = Number(multiplyParts[1])
      if (Number.isFinite(left) && Number.isFinite(right)) value += left * right
      return
    }

    part.split(' ').forEach((numStr) => {
      const number = Number(numStr)
      if (Number.isFinite(number)) value += number
    })
  })

  return Number.isFinite(value) ? value : 0
}

export const getBillItems = (record = {}) => {
  if (Array.isArray(record.items)) return record.items
  if (Array.isArray(record.details)) return record.details
  return []
}

export const getRecordItemWeight = (item = {}) => {
  const direct = toFiniteNumber(item.totalWeight ?? item.quantity ?? item.weight, NaN)
  if (Number.isFinite(direct) && direct > 0) return direct
  return parseWeightExpression(item.quantityInput ?? item.weightInput ?? item.weight_input_text ?? item.weightInputText)
}

export const getRecordTotalWeight = (record = {}) => {
  const direct = toFiniteNumber(record.totalWeight ?? record.netWeight, NaN)
  if (Number.isFinite(direct) && direct > 0) return direct

  return getBillItems(record).reduce((sum, item) => sum + getRecordItemWeight(item), 0)
}

export const getRecordTotalAmount = (record = {}) => {
  const direct = toFiniteNumber(record.totalAmount ?? record.totalPrice, NaN)
  if (Number.isFinite(direct) && direct > 0) return direct

  return getBillItems(record).reduce((sum, item) => {
    const unitPrice = toFiniteNumber(item.unitPrice ?? item.unit_price, 0)
    const amount = toFiniteNumber(item.amount, NaN)
    return sum + (Number.isFinite(amount) && amount > 0 ? amount : getRecordItemWeight(item) * unitPrice)
  }, 0)
}
