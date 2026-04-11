// 重量工具函数

/**
 * 分隔符列表
 */
const SEPARATORS = [
  ' ',    // 空格
  ',',    // 英文逗号
  '，',   // 中文逗号
  '+',    // 加号
  '、',   // 中文顿号
  ';',    // 英文分号
  '；',   // 中文分号
  '\n',   // 换行
  '\t',   // 制表符
]

/**
 * 支持的分隔符正则
 */
const SEPARATOR_REGEX = /[\s，,+、;\t\n]+/g

/**
 * 数字正则（支持整数和小数）
 */
const NUMBER_REGEX = /^\d+(\.\d+)?$/

/**
 * 解析重量输入字符串
 * 支持多种分隔符：空格、逗号、中文逗号、加号、顿号等
 * @param {string} input - 输入字符串
 * @returns {Object} 解析结果
 */
export function parseWeightInput(input) {
  if (!input || typeof input !== 'string') {
    return {
      weights: [],
      totalWeight: 0,
      isValid: true,
      error: null
    }
  }

  // 清理输入字符串，移除首尾空白
  const cleanedInput = input.trim()

  if (!cleanedInput) {
    return {
      weights: [],
      totalWeight: 0,
      isValid: true,
      error: null
    }
  }

  // 使用统一的分隔符处理
  const parts = cleanedInput
    .replace(SEPARATOR_REGEX, '|')
    .split('|')
    .filter(part => part.trim())

  const weights = []
  const errors = []

  parts.forEach((part, index) => {
    const trimmedPart = part.trim()

    // 检查是否是有效数字
    if (!NUMBER_REGEX.test(trimmedPart)) {
      errors.push({
        index,
        value: trimmedPart,
        message: `第${index + 1}项"${trimmedPart}"不是有效数字`
      })
      return
    }

    const num = parseFloat(trimmedPart)

    // 检查是否是正数
    if (num <= 0) {
      errors.push({
        index,
        value: trimmedPart,
        message: `第${index + 1}项"${trimmedPart}"必须大于0`
      })
      return
    }

    // 检查是否是合理的数值（最大限制99999）
    if (num > 99999) {
      errors.push({
        index,
        value: trimmedPart,
        message: `第${index + 1}项"${trimmedPart}"数值过大`
      })
      return
    }

    weights.push(num)
  })

  const totalWeight = weights.length > 0
    ? parseFloat(weights.reduce((sum, w) => sum + w, 0).toFixed(2))
    : 0

  return {
    weights,
    totalWeight,
    isValid: errors.length === 0,
    errors,
    input: cleanedInput
  }
}

/**
 * 格式化重量
 * @param {number|string} weight - 重量
 * @param {number} decimals - 小数位数，默认2
 * @returns {string} 格式化后的重量
 */
export function formatWeight(weight, decimals = 2) {
  if (weight == null || Number.isNaN(Number(weight))) {
    return '0.00'
  }

  const numWeight = Number(weight)
  return numWeight.toFixed(decimals)
}

/**
 * 格式化重量显示（智能精度）
 * 如果有小数显示两位，没有小数显示整数
 * @param {number|string} weight - 重量
 * @returns {string} 格式化后的重量
 */
export function smartFormatWeight(weight) {
  const formatted = formatWeight(weight, 2)
  if (/\.00$/.test(formatted)) {
    return formatWeight(weight, 0)
  }
  return formatted
}

/**
 * 格式化重量数组为显示字符串
 * @param {Array} weights - 重量数组
 * @param {string} separator - 分隔符，默认空格
 * @returns {string} 格式化后的字符串
 */
export function formatWeightArray(weights, separator = ' ') {
  if (!Array.isArray(weights) || weights.length === 0) {
    return ''
  }
  return weights.map(w => smartFormatWeight(w)).join(separator)
}

/**
 * 计算数组中重量的总和
 * @param {Array} weights - 重量数组
 * @returns {number} 总重量
 */
export function sumWeight(weights) {
  if (!Array.isArray(weights)) {
    return 0
  }
  return parseFloat(
    weights.reduce((sum, w) => sum + (Number(w) || 0), 0).toFixed(2)
  )
}

/**
 * 计算平均重量
 * @param {Array} weights - 重量数组
 * @param {number} decimals - 小数位数，默认2
 * @returns {number} 平均重量
 */
export function averageWeight(weights, decimals = 2) {
  if (!Array.isArray(weights) || weights.length === 0) {
    return 0
  }
  const sum = sumWeight(weights)
  return parseFloat((sum / weights.length).toFixed(decimals))
}

/**
 * 获取重量数组中的最大值
 * @param {Array} weights - 重量数组
 * @returns {number} 最大值
 */
export function maxWeight(weights) {
  if (!Array.isArray(weights) || weights.length === 0) {
    return 0
  }
  return Math.max(...weights.map(w => Number(w) || 0))
}

/**
 * 获取重量数组中的最小值
 * @param {Array} weights - 重量数组
 * @returns {number} 最小值
 */
export function minWeight(weights) {
  if (!Array.isArray(weights) || weights.length === 0) {
    return 0
  }
  return Math.min(...weights.map(w => Number(w) || 0))
}

/**
 * 单位转换：斤 -> 公斤
 * @param {number|string} jin - 斤
 * @param {number} decimals - 小数位数，默认2
 * @returns {number} 公斤
 */
export function jinToKg(jin, decimals = 2) {
  return parseFloat((Number(jin) / 2).toFixed(decimals))
}

/**
 * 单位转换：公斤 -> 斤
 * @param {number|string} kg - 公斤
 * @param {number} decimals - 小数位数，默认2
 * @returns {number} 斤
 */
export function kgToJin(kg, decimals = 2) {
  return parseFloat((Number(kg) * 2).toFixed(decimals))
}

/**
 * 单位转换：斤 -> 吨
 * @param {number|string} jin - 斤
 * @param {number} decimals - 小数位数，默认4
 * @returns {number} 吨
 */
export function jinToTon(jin, decimals = 4) {
  return parseFloat((Number(jin) / 2000).toFixed(decimals))
}

/**
 * 单位转换：吨 -> 斤
 * @param {number|string} ton - 吨
 * @param {number} decimals - 小数位数，默认2
 * @returns {number} 斤
 */
export function tonToJin(ton, decimals = 2) {
  return parseFloat((Number(ton) * 2000).toFixed(decimals))
}

/**
 * 验证单个重量值
 * @param {string|number} value - 要验证的值
 * @param {Object} options - 验证选项
 * @param {number} options.min - 最小值，默认0.01
 * @param {number} options.max - 最大值，默认99999
 * @returns {Object} 验证结果
 */
export function validateWeightValue(value, options = {}) {
  const {
    min = 0.01,
    max = 99999
  } = options

  const numValue = Number(value)

  if (Number.isNaN(numValue)) {
    return {
      isValid: false,
      message: '请输入有效数字'
    }
  }

  if (numValue <= 0) {
    return {
      isValid: false,
      message: '重量必须大于0'
    }
  }

  if (numValue < min) {
    return {
      isValid: false,
      message: `重量不能小于${min}`
    }
  }

  if (numValue > max) {
    return {
      isValid: false,
      message: `重量不能大于${max}`
    }
  }

  return {
    isValid: true,
    value: numValue
  }
}

/**
 * 格式化重量显示，带单位
 * @param {number|string} weight - 重量
 * @param {string} unit - 单位，默认'斤'
 * @returns {string} 格式化后的重量
 */
export function formatWeightWithUnit(weight, unit = '斤') {
  return `${smartFormatWeight(weight)}${unit}`
}

/**
 * 格式化重量范围
 * @param {number|string} min - 最小重量
 * @param {number|string} max - 最大重量
 * @param {string} unit - 单位，默认'斤'
 * @returns {string} 格式化后的范围
 */
export function formatWeightRange(min, max, unit = '斤') {
  if (min == null && max == null) return ''
  if (min == null) return `${formatWeight(max)}${unit}以下`
  if (max == null) return `${formatWeight(min)}${unit}以上`
  if (Number(min) === Number(max)) {
    return `${formatWeight(min)}${unit}`
  }
  return `${formatWeight(min)}-${formatWeight(max)}${unit}`
}

/**
 * 智能重量输入格式化器
 * 自动清理输入，转换分隔符
 * @param {string} input - 输入字符串
 * @param {string} targetSeparator - 目标分隔符，默认空格
 * @returns {string} 格式化后的输入
 */
export function formatWeightInput(input, targetSeparator = ' ') {
  if (!input || typeof input !== 'string') {
    return ''
  }

  return input
    .trim()
    .replace(SEPARATOR_REGEX, targetSeparator)
}

/**
 * 获取重量输入统计信息
 * @param {Array} weights - 重量数组
 * @returns {Object} 统计信息
 */
export function getWeightStats(weights) {
  if (!Array.isArray(weights) || weights.length === 0) {
    return {
      count: 0,
      sum: 0,
      average: 0,
      min: 0,
      max: 0
    }
  }

  const validWeights = weights.map(w => Number(w)).filter(w => !Number.isNaN(w) && w > 0)

  if (validWeights.length === 0) {
    return {
      count: 0,
      sum: 0,
      average: 0,
      min: 0,
      max: 0
    }
  }

  return {
    count: validWeights.length,
    sum: sumWeight(validWeights),
    average: averageWeight(validWeights),
    min: minWeight(validWeights),
    max: maxWeight(validWeights)
  }
}

/**
 * 解析重量字符串为数组（宽松模式）
 * 尽可能解析有效的数字，忽略无效项
 * @param {string} input - 输入字符串
 * @returns {Array} 重量数组
 */
export function parseWeightLenient(input) {
  if (!input || typeof input !== 'string') {
    return []
  }

  const parts = input
    .replace(SEPARATOR_REGEX, '|')
    .split('|')
    .filter(part => part.trim())

  return parts
    .map(part => {
      const num = parseFloat(part.trim())
      return Number.isNaN(num) || num <= 0 ? null : num
    })
    .filter(num => num !== null)
}

/**
 * 重量分组
 * 按重量范围分组
 * @param {Array} weights - 重量数组
 * @param {Array} ranges - 范围数组 [[min, max, label], ...]
 * @returns {Object} 分组结果
 */
export function groupWeights(weights, ranges) {
  if (!Array.isArray(weights) || !Array.isArray(ranges)) {
    return {}
  }

  const result = {}
  ranges.forEach(([min, max, label]) => {
    result[label] = weights.filter(w => {
      const numW = Number(w)
      return numW >= min && numW <= max
    })
  })

  return result
}

// 默认导出
export default {
  parseWeightInput,
  formatWeight,
  smartFormatWeight,
  formatWeightArray,
  sumWeight,
  averageWeight,
  maxWeight,
  minWeight,
  jinToKg,
  kgToJin,
  jinToTon,
  tonToJin,
  validateWeightValue,
  formatWeightWithUnit,
  formatWeightRange,
  formatWeightInput,
  getWeightStats,
  parseWeightLenient,
  groupWeights
}
