const DEFAULT_BREAK_PATTERN = /([+\s,，、;；/]+)/;

const splitTokenByLength = (token, maxCharsPerLine) => {
  const parts = []
  let remaining = String(token || '')

  while (remaining.length > maxCharsPerLine) {
    parts.push(remaining.slice(0, maxCharsPerLine))
    remaining = remaining.slice(maxCharsPerLine)
  }

  if (remaining) parts.push(remaining)
  return parts
}

export const formatExcelWrapText = (value, options = {}) => {
  const {
    maxCharsPerLine = 16,
    breakPattern = DEFAULT_BREAK_PATTERN,
  } = options

  const source = String(value ?? '').trim()
  if (!source) return '-'

  const lines = []
  const paragraphs = source.replace(/\r\n/g, '\n').split('\n')

  paragraphs.forEach((paragraph) => {
    const normalized = paragraph.trim()
    if (!normalized) {
      lines.push('-')
      return
    }

    const tokens = normalized.split(breakPattern).filter(Boolean)
    let currentLine = ''

    tokens.forEach((rawToken) => {
      const token = currentLine ? rawToken : rawToken.trimStart()
      if (!token) return

      const candidate = currentLine + token
      if (currentLine && candidate.length > maxCharsPerLine) {
        lines.push(currentLine.trimEnd())

        const wrappedTokenParts = splitTokenByLength(token.trimStart(), maxCharsPerLine)
        currentLine = wrappedTokenParts.pop() || ''
        wrappedTokenParts.forEach((part) => lines.push(part))
        return
      }

      if (!currentLine && token.length > maxCharsPerLine) {
        const wrappedTokenParts = splitTokenByLength(token, maxCharsPerLine)
        currentLine = wrappedTokenParts.pop() || ''
        wrappedTokenParts.forEach((part) => lines.push(part))
        return
      }

      currentLine = candidate
    })

    if (currentLine) lines.push(currentLine.trimEnd())
  })

  return lines.filter(Boolean).join('\n') || '-'
}

export const countExcelTextLines = (value) => {
  const normalized = String(value ?? '').replace(/\r\n/g, '\n')
  return Math.max(1, normalized.split('\n').length)
}

export const getExcelWrappedRowHeight = (lineCount, options = {}) => {
  const {
    minHeight = 24,
    lineHeight = 16,
    padding = 8,
  } = options

  return Math.max(minHeight, padding + lineCount * lineHeight)
}
