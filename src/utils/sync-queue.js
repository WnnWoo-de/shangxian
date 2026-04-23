import storage from './storage'

const SYNC_QUEUE_KEY = 'sync_queue_ops'
const VALID_ENTITIES = new Set(['customers', 'fabrics', 'bills'])

const toList = (value) => (Array.isArray(value) ? value : [])

const nowIso = () => new Date().toISOString()

const normalizeEntity = (entity) => {
  const value = String(entity || '').trim()
  return VALID_ENTITIES.has(value) ? value : ''
}

const normalizeAction = (action) => (action === 'delete' ? 'delete' : 'upsert')

const normalizeQueueItem = (raw = {}) => {
  const entity = normalizeEntity(raw.entity)
  const recordId = String(raw.recordId || raw.record?.id || raw.id || '').trim()
  if (!entity || !recordId) return null

  const action = normalizeAction(raw.action)
  return {
    opId: String(raw.opId || `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    entity,
    action,
    recordId,
    record: action === 'upsert' && raw.record && typeof raw.record === 'object' ? raw.record : null,
    updatedAt: String(raw.updatedAt || raw.record?.updatedAt || nowIso()),
    queuedAt: String(raw.queuedAt || nowIso()),
  }
}

const readQueue = () => toList(storage.get(SYNC_QUEUE_KEY, [])).map(normalizeQueueItem).filter(Boolean)

const writeQueue = (items) => storage.set(SYNC_QUEUE_KEY, toList(items).map(normalizeQueueItem).filter(Boolean))

const mergeOperation = (items, nextOp) => {
  const next = toList(items)
  const index = next.findIndex((item) => item.entity === nextOp.entity && item.recordId === nextOp.recordId)
  if (index === -1) {
    next.push(nextOp)
    return next
  }

  const existing = next[index]
  if (nextOp.action === 'delete') {
    next[index] = { ...nextOp, record: null }
    return next
  }

  if (existing.action === 'delete') {
    next[index] = nextOp
    return next
  }

  next[index] = nextOp
  return next
}

export const enqueueSyncOperation = (entity, action, recordId, record = null, updatedAt = nowIso()) => {
  const normalized = normalizeQueueItem({
    entity,
    action,
    recordId,
    record,
    updatedAt,
  })
  if (!normalized) return false

  const queue = readQueue()
  const merged = mergeOperation(queue, normalized)
  writeQueue(merged)
  return true
}

export const getSyncQueue = () => readQueue()

export const removeSyncQueueByOpIds = (opIds = []) => {
  const removeSet = new Set(toList(opIds).map((id) => String(id)))
  if (!removeSet.size) return 0

  const queue = readQueue()
  const nextQueue = queue.filter((item) => !removeSet.has(item.opId))
  writeQueue(nextQueue)
  return queue.length - nextQueue.length
}

export const clearSyncQueue = () => {
  storage.remove(SYNC_QUEUE_KEY)
}

export const getSyncQueueStats = () => {
  const queue = readQueue()
  return {
    total: queue.length,
    byEntity: {
      customers: queue.filter((item) => item.entity === 'customers').length,
      fabrics: queue.filter((item) => item.entity === 'fabrics').length,
      bills: queue.filter((item) => item.entity === 'bills').length,
    },
  }
}

export default {
  enqueueSyncOperation,
  getSyncQueue,
  removeSyncQueueByOpIds,
  clearSyncQueue,
  getSyncQueueStats,
}
