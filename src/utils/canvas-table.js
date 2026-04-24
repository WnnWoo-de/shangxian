export const createCanvasTableColumns = (tableLeft, definitions) => {
  let currentLeft = tableLeft

  return definitions.map((definition) => {
    const column = {
      align: 'left',
      paddingX: 12,
      ...definition,
      left: currentLeft,
    }

    currentLeft += column.width
    return column
  })
}

export const getCanvasTableWidth = (columns) => columns.reduce((sum, column) => sum + Number(column.width || 0), 0)

export const drawCanvasTableGrid = (ctx, options) => {
  const {
    columns,
    tableTop,
    headerHeight,
    rowHeights,
    borderColor = '#d7e1eb',
    lineWidth = 1,
  } = options

  if (!columns?.length) return

  const tableLeft = columns[0].left
  const tableWidth = getCanvasTableWidth(columns)
  const tableHeight = headerHeight + rowHeights.reduce((sum, height) => sum + height, 0)

  ctx.save()
  ctx.strokeStyle = borderColor
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  ctx.rect(tableLeft, tableTop, tableWidth, tableHeight)

  let currentX = tableLeft
  columns.slice(0, -1).forEach((column) => {
    currentX += column.width
    ctx.moveTo(currentX, tableTop)
    ctx.lineTo(currentX, tableTop + tableHeight)
  })

  let currentY = tableTop + headerHeight
  ctx.moveTo(tableLeft, currentY)
  ctx.lineTo(tableLeft + tableWidth, currentY)

  rowHeights.forEach((height, index) => {
    currentY += height
    if (index < rowHeights.length - 1) {
      ctx.moveTo(tableLeft, currentY)
      ctx.lineTo(tableLeft + tableWidth, currentY)
    }
  })

  ctx.stroke()
  ctx.restore()
}

export const getCanvasBlockStartY = (rowTop, rowHeight, lineCount, lineHeight) => {
  const contentHeight = Math.max(lineHeight, lineCount * lineHeight)
  return rowTop + Math.max(14, (rowHeight - contentHeight) / 2 + lineHeight - 4)
}

export const getCanvasCenterTextY = (rowTop, rowHeight) => rowTop + rowHeight / 2 + 6
