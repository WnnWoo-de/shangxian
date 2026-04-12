// 金钱工具函数

/**
 * 格式化金额
 * @param {number|string} amount - 金额（元）
 * @param {Object} options - 格式化选项
 * @param {number} options.decimals - 小数位数，默认2
 * @param {boolean} options.showSymbol - 是否显示货币符号，默认true
 * @param {string} options.symbol - 货币符号，默认¥
 * @param {boolean} options.grouping - 是否分组显示，默认true
 * @returns {string} 格式化后的金额
 */
export function formatMoney(amount, options = {}) {
  const {
    decimals = 2,
    showSymbol = true,
    symbol = '¥',
    grouping = true
  } = options

  // 处理 NaN 和 null/undefined
  if (amount == null || Number.isNaN(Number(amount))) {
    return showSymbol ? `${symbol}0.00` : '0.00'
  }

  // 转换为数字
  const numAmount = Number(amount)

  // 格式化 - 使用更简单可靠的方法
  try {
    // 先保留指定小数位
    const fixedAmount = numAmount.toFixed(decimals)

    // 如果需要分组显示
    let formatted = fixedAmount
    if (grouping) {
      const parts = fixedAmount.split('.')
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      formatted = parts.join('.')
    }

    return showSymbol ? `${symbol}${formatted}` : formatted
  } catch (error) {
    console.error('Money formatting error:', error)
    return showSymbol ? `${symbol}0.00` : '0.00'
  }
}

/**
 * 分转元
 * @param {number|string} cents - 金额（分）
 * @param {Object} options - 格式化选项
 * @returns {string} 格式化后的金额
 */
export function centsToYuan(cents, options = {}) {
  const yuanAmount = Number(cents) / 100
  return formatMoney(yuanAmount, options)
}

/**
 * 元转分
 * @param {number|string} yuan - 金额（元）
 * @returns {number} 金额（分）
 */
export function yuanToCents(yuan) {
  return Math.round(Number(yuan) * 100)
}

/**
 * 计算金额的和（支持两个参数或数组）
 * @param {number|string|Array} amount1 - 金额1或金额数组
 * @param {number|string} amount2 - 金额2（可选）
 * @returns {number} 总和（元）
 */
export function addMoney(amount1, amount2) {
  if (Array.isArray(amount1)) {
    return parseFloat(
      amount1.reduce((sum, amount) => {
        return sum + (Number(amount) || 0)
      }, 0).toFixed(2)
    )
  }
  const num1 = Number(amount1) || 0
  const num2 = Number(amount2) || 0
  return parseFloat((num1 + num2).toFixed(2))
}

/**
 * 计算两个金额的差
 * @param {number|string} amount1 - 金额1
 * @param {number|string} amount2 - 金额2
 * @returns {number} 差值（元）
 */
export function subtractMoney(amount1, amount2) {
  const num1 = Number(amount1) || 0
  const num2 = Number(amount2) || 0
  return parseFloat((num1 - num2).toFixed(2))
}

/**
 * 计算金额乘法
 * @param {number|string} amount - 金额
 * @param {number|string} multiplier - 乘数
 * @returns {number} 乘积（元）
 */
export function multiplyMoney(amount, multiplier) {
  const numAmount = Number(amount) || 0
  const numMultiplier = Number(multiplier) || 0
  return parseFloat((numAmount * numMultiplier).toFixed(2))
}

/**
 * 计算金额除法
 * @param {number|string} amount - 金额
 * @param {number|string} divisor - 除数
 * @param {number} decimals - 小数位数，默认2
 * @returns {number} 商（元）
 */
export function divideMoney(amount, divisor, decimals = 2) {
  const numAmount = Number(amount) || 0
  const numDivisor = Number(divisor) || 1
  return parseFloat((numAmount / numDivisor).toFixed(decimals))
}

/**
 * 计算数组中的金额总和
 * @param {Array} amounts - 金额数组
 * @returns {number} 总和（元）
 */
export function sumMoney(amounts) {
  if (!Array.isArray(amounts)) return 0
  return parseFloat(
    amounts.reduce((sum, amount) => {
      return sum + (Number(amount) || 0)
    }, 0).toFixed(2)
  )
}

/**
 * 计算平均值
 * @param {Array} amounts - 金额数组
 * @param {number} decimals - 小数位数，默认2
 * @returns {number} 平均值（元）
 */
export function averageMoney(amounts, decimals = 2) {
  if (!Array.isArray(amounts) || amounts.length === 0) return 0
  const sum = sumMoney(amounts)
  return parseFloat((sum / amounts.length).toFixed(decimals))
}

/**
 * 格式化金额显示（智能精度）
 * 如果有小数显示两位，没有小数显示整数
 * @param {number|string} amount - 金额
 * @param {Object} options - 格式化选项
 * @returns {string} 格式化后的金额
 */
export function smartFormatMoney(amount, options = {}) {
  const {
    showSymbol = true,
    symbol = '¥',
    grouping = true
  } = options

  // 先格式化保留2位小数
  const formatted2Decimals = formatMoney(amount, {
    decimals: 2,
    showSymbol,
    symbol,
    grouping
  })

  // 如果小数部分是00，则只显示整数
  if (/\.00$/.test(formatted2Decimals)) {
    return formatMoney(amount, {
      decimals: 0,
      showSymbol,
      symbol,
      grouping
    })
  }

  return formatted2Decimals
}

/**
 * 格式化金额范围
 * @param {number|string} min - 最小金额
 * @param {number|string} max - 最大金额
 * @param {Object} options - 格式化选项
 * @returns {string} 格式化后的范围
 */
export function formatMoneyRange(min, max, options = {}) {
  const minStr = formatMoney(min, { ...options, showSymbol: false })
  const maxStr = formatMoney(max, { ...options, showSymbol: false })
  return `${options.showSymbol ? options.symbol || '¥' : ''}${minStr}-${maxStr}`
}

/**
 * 解析格式化后的金额字符串
 * @param {string} formattedStr - 格式化后的字符串
 * @param {string} symbol - 货币符号，默认¥
 * @returns {number} 金额（元）
 */
export function parseMoney(formattedStr, symbol = '¥') {
  if (!formattedStr || typeof formattedStr !== 'string') {
    return 0
  }

  // 移除符号和分组
  let parsed = formattedStr
    .replace(symbol, '')
    .replace(/,/g, '')
    .trim()

  return parseFloat(parsed) || 0
}

/**
 * 验证金额格式
 * @param {string} str - 要验证的字符串
 * @returns {boolean} 是否是有效金额
 */
export function isValidMoneyFormat(str) {
  if (typeof str !== 'string') return false

  // 正则表达式：允许可选的符号 + 可选的分组 + 可选的小数
  const moneyReg = /^¥?\d{1,3}(,\d{3})*(\.\d{1,2})?$/
  return moneyReg.test(str.trim())
}

/**
 * 获取金额的绝对值
 * @param {number|string} amount - 金额
 * @returns {number} 绝对值
 */
export function absMoney(amount) {
  return Math.abs(Number(amount) || 0)
}

/**
 * 格式化金额显示为万元
 * @param {number|string} amount - 金额（元）
 * @param {Object} options - 格式化选项
 * @param {number} options.decimals - 小数位数，默认1
 * @param {boolean} options.showSymbol - 是否显示货币符号，默认true
 * @param {string} options.symbol - 货币符号，默认¥
 * @param {string} options.unit - 单位，默认万
 * @returns {string} 格式化后的金额
 */
export function formatMoneyTenThousands(amount, options = {}) {
  const {
    decimals = 1,
    showSymbol = true,
    symbol = '¥',
    unit = '万'
  } = options

  const tenThousands = divideMoney(amount, 10000, decimals)
  const baseStr = formatMoney(tenThousands, {
    decimals,
    showSymbol: false
  })

  return showSymbol ? `${symbol}${baseStr}${unit}` : `${baseStr}${unit}`
}

/**
 * 价格区间格式化
 * @param {number|string} minPrice - 最低价格
 * @param {number|string} maxPrice - 最高价格
 * @param {string} unit - 单位，默认/斤
 * @returns {string} 格式化后的价格区间
 */
export function formatPriceRange(minPrice, maxPrice, unit = '/斤') {
  if (minPrice == null && maxPrice == null) return ''
  if (minPrice == null) return `${formatMoney(maxPrice)}以下${unit}`
  if (maxPrice == null) return `${formatMoney(minPrice)}以上${unit}`
  if (Number(minPrice) === Number(maxPrice)) {
    return `${formatMoney(minPrice)}${unit}`
  }
  return `${formatMoney(minPrice)}-${formatMoney(maxPrice)}${unit}`
}

/**
 * 格式化折扣
 * @param {number|string} discount - 折扣（如8表示8折，0.8表示8折）
 * @param {Object} options - 格式化选项
 * @param {boolean} options.showPercent - 是否显示百分比，默认true
 * @param {boolean} options.showWord - 是否显示"折"，默认false
 * @returns {string} 格式化后的折扣
 */
export function formatDiscount(discount, options = {}) {
  const {
    showPercent = true,
    showWord = false
  } = options

  const numDiscount = Number(discount)

  // 处理大于1的数（如8表示8折）
  let actualDiscount = numDiscount > 1 ? numDiscount / 10 : numDiscount

  if (Number.isNaN(actualDiscount) || actualDiscount < 0) {
    actualDiscount = 0
  }

  if (showWord) {
    return `${(actualDiscount * 10).toFixed(1)}折`
  }

  if (showPercent) {
    return `${(actualDiscount * 100).toFixed(1)}%`
  }

  return actualDiscount.toFixed(2)
}

/**
 * 计算折扣价格
 * @param {number|string} originalPrice - 原价
 * @param {number|string} discount - 折扣
 * @returns {number} 折后价
 */
export function calculateDiscountPrice(originalPrice, discount) {
  const original = Number(originalPrice) || 0
  const discountRate = Number(discount) || 1

  // 处理折扣格式
  const actualDiscount = discountRate > 1 ? discountRate / 10 : discountRate

  return parseFloat((original * actualDiscount).toFixed(2))
}

/**
 * 计算节省金额
 * @param {number|string} originalPrice - 原价
 * @param {number|string} discountedPrice - 折后价
 * @returns {number} 节省金额
 */
export function calculateSavings(originalPrice, discountedPrice) {
  return subtractMoney(originalPrice, discountedPrice)
}

// 默认导出
export default {
  formatMoney,
  centsToYuan,
  yuanToCents,
  addMoney,
  subtractMoney,
  multiplyMoney,
  divideMoney,
  sumMoney,
  averageMoney,
  smartFormatMoney,
  formatMoneyRange,
  parseMoney,
  isValidMoneyFormat,
  absMoney,
  formatMoneyTenThousands,
  formatPriceRange,
  formatDiscount,
  calculateDiscountPrice,
  calculateSavings
}
