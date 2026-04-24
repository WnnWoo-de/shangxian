const DEFAULT_VIEW_BOX = '0 0 24 24'

const iconRegistry = Object.freeze({
  dashboard: {
    nodes: [
      { tag: 'rect', attrs: { x: '3', y: '3', width: '7', height: '7' } },
      { tag: 'rect', attrs: { x: '14', y: '3', width: '7', height: '7' } },
      { tag: 'rect', attrs: { x: '14', y: '14', width: '7', height: '7' } },
      { tag: 'rect', attrs: { x: '3', y: '14', width: '7', height: '7' } },
    ],
  },
  purchase: {
    nodes: [
      { tag: 'path', attrs: { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' } },
      { tag: 'polyline', attrs: { points: '17 8 12 3 7 8' } },
      { tag: 'line', attrs: { x1: '12', y1: '3', x2: '12', y2: '15' } },
    ],
  },
  sale: {
    nodes: [
      { tag: 'path', attrs: { d: 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' } },
      { tag: 'polyline', attrs: { points: '16 5 21 10 16 15' } },
      { tag: 'line', attrs: { x1: '21', y1: '10', x2: '9', y2: '10' } },
    ],
  },
  list: {
    nodes: [
      { tag: 'line', attrs: { x1: '8', y1: '6', x2: '21', y2: '6' } },
      { tag: 'line', attrs: { x1: '8', y1: '12', x2: '21', y2: '12' } },
      { tag: 'line', attrs: { x1: '8', y1: '18', x2: '21', y2: '18' } },
      { tag: 'line', attrs: { x1: '3', y1: '6', x2: '3.01', y2: '6' } },
      { tag: 'line', attrs: { x1: '3', y1: '12', x2: '3.01', y2: '12' } },
      { tag: 'line', attrs: { x1: '3', y1: '18', x2: '3.01', y2: '18' } },
    ],
  },
  customer: {
    nodes: [
      { tag: 'path', attrs: { d: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' } },
      { tag: 'circle', attrs: { cx: '9', cy: '7', r: '4' } },
      { tag: 'path', attrs: { d: 'M23 21v-2a4 4 0 0 0-3-3.87' } },
      { tag: 'path', attrs: { d: 'M16 3.13a4 4 0 0 1 0 7.75' } },
    ],
  },
  fabric: {
    nodes: [
      { tag: 'circle', attrs: { cx: '12', cy: '3', r: '1' } },
      { tag: 'circle', attrs: { cx: '12', cy: '21', r: '1' } },
      { tag: 'path', attrs: { d: 'M19 12a7 7 0 1 1-14 0' } },
    ],
  },
  report: {
    nodes: [
      { tag: 'line', attrs: { x1: '3', y1: '3', x2: '21', y2: '3' } },
      { tag: 'line', attrs: { x1: '3', y1: '12', x2: '21', y2: '12' } },
      { tag: 'line', attrs: { x1: '3', y1: '21', x2: '21', y2: '21' } },
      { tag: 'line', attrs: { x1: '18', y1: '3', x2: '18', y2: '21' } },
    ],
  },
  statistics: {
    nodes: [
      { tag: 'polyline', attrs: { points: '22 12 18 12 15 21 9 3 6 12 2 12' } },
    ],
  },
  settings: {
    nodes: [
      { tag: 'circle', attrs: { cx: '12', cy: '12', r: '3' } },
      { tag: 'path', attrs: { d: 'M12 1v6m0 6v6m4.22-13.22l4.24 4.24m-13.46 0l4.24 4.24m4.24 4.24l4.24 4.24m-13.46 0l4.24 4.24' } },
    ],
  },
  logout: {
    nodes: [
      { tag: 'path', attrs: { d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' } },
      { tag: 'polyline', attrs: { points: '16 17 21 12 16 7' } },
      { tag: 'line', attrs: { x1: '21', y1: '12', x2: '9', y2: '12' } },
    ],
  },
  search: {
    nodes: [
      { tag: 'circle', attrs: { cx: '11', cy: '11', r: '8' } },
      { tag: 'line', attrs: { x1: '21', y1: '21', x2: '16.65', y2: '16.65' } },
    ],
  },
  'chevron-down': {
    nodes: [
      { tag: 'polyline', attrs: { points: '6 9 12 15 18 9' } },
    ],
  },
  'chevron-left': {
    nodes: [
      { tag: 'path', attrs: { d: 'M15 18l-6-6 6-6' } },
    ],
  },
  'chevron-right': {
    nodes: [
      { tag: 'path', attrs: { d: 'M9 18l6-6-6-6' } },
    ],
  },
  'arrow-up': {
    nodes: [
      { tag: 'path', attrs: { d: 'M12 19V5' } },
      { tag: 'path', attrs: { d: 'M5 12l7-7 7 7' } },
    ],
  },
  'arrow-down': {
    nodes: [
      { tag: 'path', attrs: { d: 'M12 5v14' } },
      { tag: 'path', attrs: { d: 'M5 12l7 7 7-7' } },
    ],
  },
  'swap-vertical': {
    nodes: [
      { tag: 'circle', attrs: { cx: '12', cy: '12', r: '10' } },
      { tag: 'path', attrs: { d: 'M12 6v12M8 10l4-4 4 4M8 14l4 4 4-4' } },
    ],
  },
  box: {
    nodes: [
      { tag: 'path', attrs: { d: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' } },
    ],
  },
  calendar: {
    nodes: [
      { tag: 'rect', attrs: { x: '3', y: '4', width: '18', height: '18', rx: '2' } },
      { tag: 'path', attrs: { d: 'M16 2v4M8 2v4M3 10h18' } },
    ],
  },
  return: {
    nodes: [
      { tag: 'path', attrs: { d: 'M9 14l-4-4 4-4' } },
      { tag: 'path', attrs: { d: 'M5 10h11a4 4 0 1 1 0 8h-1' } },
    ],
  },
  trend: {
    nodes: [
      { tag: 'path', attrs: { d: 'M3 3v18h18' } },
      { tag: 'path', attrs: { d: 'M18 9l-5 5-4-4-3 3' } },
    ],
  },
  clock: {
    nodes: [
      { tag: 'circle', attrs: { cx: '12', cy: '12', r: '10' } },
      { tag: 'path', attrs: { d: 'M12 6v6l4 2' } },
    ],
  },
  plus: {
    nodes: [
      { tag: 'path', attrs: { d: 'M12 5v14' } },
      { tag: 'path', attrs: { d: 'M5 12h14' } },
    ],
  },
  trash: {
    nodes: [
      { tag: 'polyline', attrs: { points: '3 6 5 6 21 6' } },
      { tag: 'path', attrs: { d: 'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6' } },
      { tag: 'path', attrs: { d: 'M10 11v6' } },
      { tag: 'path', attrs: { d: 'M14 11v6' } },
      { tag: 'path', attrs: { d: 'M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2' } },
    ],
  },
  save: {
    nodes: [
      { tag: 'path', attrs: { d: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z' } },
      { tag: 'path', attrs: { d: 'M17 21v-8H7v8' } },
      { tag: 'path', attrs: { d: 'M7 3v5h8' } },
    ],
  },
  table: {
    nodes: [
      { tag: 'rect', attrs: { x: '3', y: '4', width: '18', height: '16', rx: '2' } },
      { tag: 'path', attrs: { d: 'M3 10h18M9 4v16M15 4v16' } },
    ],
  },
  image: {
    nodes: [
      { tag: 'rect', attrs: { x: '3', y: '5', width: '18', height: '14', rx: '2' } },
      { tag: 'circle', attrs: { cx: '8.5', cy: '10', r: '1.5' } },
      { tag: 'path', attrs: { d: 'M21 16l-5.5-5.5a1 1 0 0 0-1.4 0L7 18' } },
    ],
  },
  check: {
    nodes: [
      { tag: 'path', attrs: { d: 'M20 6 9 17l-5-5' } },
    ],
  },
  receipt: {
    nodes: [
      { tag: 'path', attrs: { d: 'M6 3h12a1 1 0 0 1 1 1v17l-3-2-2 2-2-2-2 2-3-2V4a1 1 0 0 1 1-1Z' } },
      { tag: 'path', attrs: { d: 'M9 7h6' } },
      { tag: 'path', attrs: { d: 'M9 11h6' } },
      { tag: 'path', attrs: { d: 'M9 15h4' } },
    ],
  },
  layers: {
    nodes: [
      { tag: 'path', attrs: { d: 'M12 3 3 8l9 5 9-5-9-5Z' } },
      { tag: 'path', attrs: { d: 'M3 12l9 5 9-5' } },
      { tag: 'path', attrs: { d: 'M3 16l9 5 9-5' } },
    ],
  },
  inbox: {
    nodes: [
      { tag: 'path', attrs: { d: 'M22 12h-6l-2 3h-4l-2-3H2' } },
      { tag: 'path', attrs: { d: 'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z' } },
    ],
  },
  x: {
    nodes: [
      { tag: 'path', attrs: { d: 'M18 6 6 18' } },
      { tag: 'path', attrs: { d: 'm6 6 12 12' } },
    ],
  },
  warning: {
    nodes: [
      { tag: 'path', attrs: { d: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z' } },
      { tag: 'path', attrs: { d: 'M12 9v4' } },
      { tag: 'path', attrs: { d: 'M12 17h.01' } },
    ],
  },
  info: {
    nodes: [
      { tag: 'circle', attrs: { cx: '12', cy: '12', r: '10' } },
      { tag: 'path', attrs: { d: 'M12 10v6' } },
      { tag: 'path', attrs: { d: 'M12 7h.01' } },
    ],
  },
})

const escapeMarkup = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')

const buildAttrs = (attrs = {}) => Object.entries(attrs)
  .map(([key, value]) => `${key}="${escapeMarkup(value)}"`)
  .join(' ')

const getIconDefinition = (name) => iconRegistry[name] || iconRegistry.info

const buildIconMarkup = (name, options = {}) => {
  const icon = getIconDefinition(name)
  const size = options.size ?? 18
  const strokeWidth = options.strokeWidth ?? 2
  const nodes = icon.nodes
    .map(({ tag, attrs }) => `<${tag} ${buildAttrs(attrs)}></${tag}>`)
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${escapeMarkup(size)}" height="${escapeMarkup(size)}" viewBox="${icon.viewBox || DEFAULT_VIEW_BOX}" fill="none" stroke="currentColor" stroke-width="${escapeMarkup(strokeWidth)}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${nodes}</svg>`
}

export {
  DEFAULT_VIEW_BOX,
  iconRegistry,
  getIconDefinition,
  buildIconMarkup,
}
