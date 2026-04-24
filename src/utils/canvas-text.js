const DEFAULT_BREAK_PATTERN = /([+\s,，、;；/]+)/u

const splitTextByWidth = (ctx, text, maxWidth) => {
  const lines = []
  let currentLine = ''

  for (const char of String(text || '')) {
    const candidate = currentLine + char
    if (currentLine && ctx.measureText(candidate).width > maxWidth) {
      lines.push(currentLine.trimEnd())
      currentLine = char.trimStart()
    } else {
      currentLine = candidate
    }
  }

  if (currentLine) lines.push(currentLine.trimEnd())
  return lines
}

export const wrapCanvasText = (ctx, value, maxWidth, options = {}) => {
  const {
    breakPattern = DEFAULT_BREAK_PATTERN,
  } = options

  const source = String(value ?? '').trim() || '-'
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

    const pushTokenWithFallback = (token) => {
      if (ctx.measureText(token).width <= maxWidth) {
        currentLine = token
        return
      }

      const wrappedLines = splitTextByWidth(ctx, token, maxWidth)
      currentLine = wrappedLines.pop() || ''
      wrappedLines.forEach((line) => lines.push(line))
    }

    tokens.forEach((token) => {
      const candidate = currentLine + token
      if (currentLine && ctx.measureText(candidate).width > maxWidth) {
        lines.push(currentLine.trimEnd())
        pushTokenWithFallback(token.trimStart())
        return
      }

      if (!currentLine && ctx.measureText(token).width > maxWidth) {
        pushTokenWithFallback(token)
        return
      }

      currentLine = candidate
    })

    if (currentLine) lines.push(currentLine.trimEnd())
  })

  return lines.length ? lines : ['-']
}

export const getCanvasWrappedRowHeight = (lineCount, options = {}) => {
  const {
    minHeight = 42,
    lineHeight = 22,
    padding = 16,
  } = options

  return Math.max(minHeight, padding + lineCount * lineHeight)
}
