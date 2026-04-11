// 日期工具函数
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import relativeTime from 'dayjs/plugin/relativeTime'
import isBetween from 'dayjs/plugin/isBetween'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import isoWeek from 'dayjs/plugin/isoWeek'

dayjs.locale('zh-cn')
dayjs.extend(relativeTime)
dayjs.extend(isBetween)
dayjs.extend(weekOfYear)
dayjs.extend(isoWeek)

/**
 * 日期格式常量
 */
export const DATE_FORMATS = {
  DATE: 'YYYY-MM-DD',
  DATE_SLASH: 'YYYY/MM/DD',
  DATE_CN: 'YYYY年MM月DD日',
  TIME: 'HH:mm:ss',
  TIME_SHORT: 'HH:mm',
  DATETIME: 'YYYY-MM-DD HH:mm:ss',
  DATETIME_SLASH: 'YYYY/MM/DD HH:mm:ss',
  DATETIME_CN: 'YYYY年MM月DD日 HH:mm:ss',
  MONTH: 'YYYY-MM',
  MONTH_CN: 'YYYY年MM月',
  YEAR: 'YYYY'
}

/**
 * 格式化日期
 * @param {string|Date|dayjs.Dayjs} date - 日期
 * @param {string} format - 格式字符串
 * @returns {string} 格式化后的日期字符串
 */
export function formatDate(date, format = DATE_FORMATS.DATE) {
  if (!date) return ''
  return dayjs(date).format(format)
}

/**
 * 获取今天的日期
 * @param {string} format - 格式字符串
 * @returns {string} 今天的日期字符串
 */
export function today(format = DATE_FORMATS.DATE) {
  return dayjs().format(format)
}

/**
 * 获取昨天的日期
 * @param {string} format - 格式字符串
 * @returns {string} 昨天的日期字符串
 */
export function yesterday(format = DATE_FORMATS.DATE) {
  return dayjs().subtract(1, 'day').format(format)
}

/**
 * 获取明天的日期
 * @param {string} format - 格式字符串
 * @returns {string} 明天的日期字符串
 */
export function tomorrow(format = DATE_FORMATS.DATE) {
  return dayjs().add(1, 'day').format(format)
}

/**
 * 获取日期范围
 */
export const DateRanges = {
  // 今天
  today() {
    return {
      start: dayjs().startOf('day').format(DATE_FORMATS.DATETIME),
      end: dayjs().endOf('day').format(DATE_FORMATS.DATETIME),
      label: '今天'
    }
  },

  // 昨天
  yesterday() {
    return {
      start: dayjs().subtract(1, 'day').startOf('day').format(DATE_FORMATS.DATETIME),
      end: dayjs().subtract(1, 'day').endOf('day').format(DATE_FORMATS.DATETIME),
      label: '昨天'
    }
  },

  // 本周
  thisWeek() {
    return {
      start: dayjs().startOf('week').format(DATE_FORMATS.DATETIME),
      end: dayjs().endOf('week').format(DATE_FORMATS.DATETIME),
      label: '本周'
    }
  },

  // 上周
  lastWeek() {
    return {
      start: dayjs().subtract(1, 'week').startOf('week').format(DATE_FORMATS.DATETIME),
      end: dayjs().subtract(1, 'week').endOf('week').format(DATE_FORMATS.DATETIME),
      label: '上周'
    }
  },

  // 本月
  thisMonth() {
    return {
      start: dayjs().startOf('month').format(DATE_FORMATS.DATETIME),
      end: dayjs().endOf('month').format(DATE_FORMATS.DATETIME),
      label: '本月'
    }
  },

  // 上月
  lastMonth() {
    return {
      start: dayjs().subtract(1, 'month').startOf('month').format(DATE_FORMATS.DATETIME),
      end: dayjs().subtract(1, 'month').endOf('month').format(DATE_FORMATS.DATETIME),
      label: '上月'
    }
  },

  // 今年
  thisYear() {
    return {
      start: dayjs().startOf('year').format(DATE_FORMATS.DATETIME),
      end: dayjs().endOf('year').format(DATE_FORMATS.DATETIME),
      label: '今年'
    }
  },

  // 最近7天
  last7Days() {
    return {
      start: dayjs().subtract(6, 'days').startOf('day').format(DATE_FORMATS.DATETIME),
      end: dayjs().endOf('day').format(DATE_FORMATS.DATETIME),
      label: '最近7天'
    }
  },

  // 最近30天
  last30Days() {
    return {
      start: dayjs().subtract(29, 'days').startOf('day').format(DATE_FORMATS.DATETIME),
      end: dayjs().endOf('day').format(DATE_FORMATS.DATETIME),
      label: '最近30天'
    }
  },

  // 最近90天
  last90Days() {
    return {
      start: dayjs().subtract(89, 'days').startOf('day').format(DATE_FORMATS.DATETIME),
      end: dayjs().endOf('day').format(DATE_FORMATS.DATETIME),
      label: '最近90天'
    }
  }
}

/**
 * 获取相对时间（如：3分钟前，2小时前）
 * @param {string|Date|dayjs.Dayjs} date - 日期
 * @returns {string} 相对时间字符串
 */
export function relativeTimeText(date) {
  if (!date) return ''
  return dayjs(date).fromNow()
}

/**
 * 检查日期是否在两个日期之间
 * @param {string|Date|dayjs.Dayjs} target - 目标日期
 * @param {string|Date|dayjs.Dayjs} start - 开始日期
 * @param {string|Date|dayjs.Dayjs} end - 结束日期
 * @param {string} inclusivity - 包含性 ('()', '[)', '(]', '[]')
 * @returns {boolean} 是否在范围内
 */
export function isDateBetween(target, start, end, inclusivity = '[]') {
  if (!target || !start || !end) return false
  return dayjs(target).isBetween(start, end, 'day', inclusivity)
}

/**
 * 获取一个月的天数
 * @param {string|Date|dayjs.Dayjs} date - 日期
 * @returns {number} 天数
 */
export function daysInMonth(date) {
  return dayjs(date).daysInMonth()
}

/**
 * 获取日期是星期几
 * @param {string|Date|dayjs.Dayjs} date - 日期
 * @returns {string} 星期几
 */
export function getWeekDay(date) {
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return weekDays[dayjs(date).day()]
}

/**
 * 判断是否是今天
 * @param {string|Date|dayjs.Dayjs} date - 日期
 * @returns {boolean} 是否是今天
 */
export function isToday(date) {
  return dayjs(date).isSame(dayjs(), 'day')
}

/**
 * 判断是否是昨天
 * @param {string|Date|dayjs.Dayjs} date - 日期
 * @returns {boolean} 是否是昨天
 */
export function isYesterday(date) {
  return dayjs(date).isSame(dayjs().subtract(1, 'day'), 'day')
}

/**
 * 获取两个日期之间的天数
 * @param {string|Date|dayjs.Dayjs} start - 开始日期
 * @param {string|Date|dayjs.Dayjs} end - 结束日期
 * @returns {number} 天数
 */
export function daysBetween(start, end) {
  return Math.abs(dayjs(end).diff(dayjs(start), 'day'))
}

/**
 * 添加天数
 * @param {string|Date|dayjs.Dayjs} date - 日期
 * @param {number} days - 天数
 * @returns {string} 新日期
 */
export function addDays(date, days) {
  return dayjs(date).add(days, 'day').format(DATE_FORMATS.DATE)
}

/**
 * 添加月数
 * @param {string|Date|dayjs.Dayjs} date - 日期
 * @param {number} months - 月数
 * @returns {string} 新日期
 */
export function addMonths(date, months) {
  return dayjs(date).add(months, 'month').format(DATE_FORMATS.DATE)
}

/**
 * 智能日期显示
 * 今天显示：14:30
 * 昨天显示：昨天 14:30
 * 一周内显示：周三 14:30
 * 更早显示：2024-04-11 14:30
 * @param {string|Date|dayjs.Dayjs} date - 日期
 * @returns {string} 智能日期显示
 */
export function smartDateDisplay(date) {
  if (!date) return ''

  const target = dayjs(date)
  const now = dayjs()

  if (isToday(date)) {
    return target.format(DATE_FORMATS.TIME_SHORT)
  } else if (isYesterday(date)) {
    return `昨天 ${target.format(DATE_FORMATS.TIME_SHORT)}`
  } else if (daysBetween(date, now) < 7) {
    return `${getWeekDay(date)} ${target.format(DATE_FORMATS.TIME_SHORT)}`
  } else if (target.year() === now.year()) {
    return target.format('MM-DD HH:mm')
  } else {
    return target.format(DATE_FORMATS.DATETIME)
  }
}

/**
 * 生成时间戳
 * @returns {number} 时间戳
 */
export function timestamp() {
  return Date.now()
}

/**
 * 获取当天开始时间
 * @param {string|Date|dayjs.Dayjs} date - 日期
 * @returns {string} 开始时间
 */
export function startOfDay(date) {
  return dayjs(date).startOf('day').format(DATE_FORMATS.DATETIME)
}

/**
 * 获取当天结束时间
 * @param {string|Date|dayjs.Dayjs} date - 日期
 * @returns {string} 结束时间
 */
export function endOfDay(date) {
  return dayjs(date).endOf('day').format(DATE_FORMATS.DATETIME)
}

/**
 * 判断日期是否早于当前日期
 * @param {string|Date|dayjs.Dayjs} date - 日期
 * @returns {boolean} 是否过期
 */
export function isExpired(date) {
  return dayjs(date).isBefore(dayjs())
}

/**
 * 判断日期是否晚于当前日期
 * @param {string|Date|dayjs.Dayjs} date - 日期
 * @returns {boolean} 是否未来
 */
export function isFuture(date) {
  return dayjs(date).isAfter(dayjs())
}

// 导出 dayjs 实例供高级使用
export { dayjs }

export default {
  formatDate,
  today,
  yesterday,
  tomorrow,
  DateRanges,
  DATE_FORMATS,
  relativeTimeText,
  isDateBetween,
  daysInMonth,
  getWeekDay,
  isToday,
  isYesterday,
  daysBetween,
  addDays,
  addMonths,
  smartDateDisplay,
  timestamp,
  startOfDay,
  endOfDay,
  isExpired,
  isFuture,
  dayjs
}
