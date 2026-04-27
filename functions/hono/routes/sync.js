import { fail, ok, parseBody } from '../helpers/http.js'
import {
  getSyncEntityConfig,
  getSyncRecordSnapshot,
  listEntityChanges,
  softDeleteSyncRecord,
  upsertSyncRecord,
} from '../../_lib/sync-repository.js'

const EPOCH_ISO = '1970-01-01T00:00:00.000Z'

const toIsoString = (value, fallback = EPOCH_ISO) => {
  const date = new Date(value || fallback)
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString()
}

const toMillis = (value) => {
  const date = new Date(value || EPOCH_ISO)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

const toMoney = (value) => Math.max(Number(value || 0), 0)
const parseWeightExpression = (input) => {
  const raw = String(input || '').trim()
  if (!raw) return 0
  return raw
    .replace(/[，,、；;]/g, ' ')
    .replace(/[＋]/g, '+')
    .replace(/[×xX]/g, '*')
    .replace(/\s+/g, ' ')
    .split('+')
    .reduce((sum, part) => {
      const factors = part.split('*')
      if (factors.length === 2) {
        const left = Number(factors[0])
        const right = Number(factors[1])
        return sum + (Number.isFinite(left) && Number.isFinite(right) ? left * right : 0)
      }

      return sum + part.split(' ').reduce((partSum, token) => {
        const number = Number(token)
        return partSum + (Number.isFinite(number) ? number : 0)
      }, 0)
    }, 0)
}

const getItemWeight = (item = {}) => {
  const inputWeight = parseWeightExpression(item.quantityInput ?? item.weightInput ?? item.weight_input_text ?? item.weightInputText)
  if (inputWeight > 0) return inputWeight
  return toMoney(item.totalWeight ?? item.quantity ?? item.weight)
}

const getItems = (bill = {}) => Array.isArray(bill.items) ? bill.items : Array.isArray(bill.details) ? bill.details : []

const normalizeBillAmounts = (bill = {}) => {
  const type = bill.type === 'sale' ? 'sale' : 'purchase'
  const items = getItems(bill)
  const itemTotalWeight = items.reduce((sum, item) => sum + getItemWeight(item), 0)
  const itemTotalAmount = items.reduce((sum, item) => sum + getItemWeight(item) * toMoney(item.unitPrice ?? item.unit_price), 0)
  const totalAmount = Math.round((itemTotalAmount || toMoney(bill.totalAmount)) * 100) / 100
  const totalWeight = Math.round((itemTotalWeight || toMoney(bill.totalWeight)) * 100) / 100
  const paidAmount = type === 'purchase' ? Math.min(toMoney(bill.paidAmount), totalAmount) : 0
  const receivedAmount = type === 'sale' ? Math.min(toMoney(bill.receivedAmount), totalAmount) : 0
  const settlementAmount = type === 'sale' ? receivedAmount : paidAmount
  const unsettledAmount = Math.max(Math.round((totalAmount - settlementAmount) * 100) / 100, 0)

  return {
    ...bill,
    type,
    totalAmount,
    totalWeight,
    paidAmount,
    receivedAmount,
    unsettledAmount,
    status: unsettledAmount <= 0 ? 'settled' : 'confirmed',
  }
}

const normalizeOperation = (raw = {}, index = 0) => {
  const action = raw.action === 'delete' ? 'delete' : 'upsert'
  const entity = String(raw.entity || '').trim()
  const recordId = String(raw.recordId || raw.id || raw.record?.id || '').trim()
  const updatedAt = toIsoString(raw.updatedAt || raw.record?.updatedAt || new Date().toISOString())
  return {
    opId: String(raw.opId || `op-${Date.now()}-${index}`),
    entity,
    action,
    recordId,
    record: raw.record && typeof raw.record === 'object' ? raw.record : null,
    updatedAt,
  }
}

const normalizeOperations = (body = {}) => {
  if (Array.isArray(body?.operations)) {
    return body.operations.map((item, index) => normalizeOperation(item, index))
  }
  return []
}

const buildRecordByEntity = (entity, input, existingData, recordId, updatedAt) => {
  const now = new Date().toISOString()
  const merged = {
    ...(existingData || {}),
    ...(input || {}),
    id: recordId,
    createdAt: existingData?.createdAt || input?.createdAt || now,
    updatedAt,
  }

  if (entity === 'customers') {
    return {
      ...merged,
      name: String(merged.name || '').trim(),
      status: String(merged.status || 'active'),
      deletedAt: null,
    }
  }

  if (entity === 'fabrics') {
    return {
      ...merged,
      code: String(merged.code || `FAB${Date.now().toString().slice(-4)}`),
      name: String(merged.name || '').trim(),
      status: String(merged.status || 'active'),
      deletedAt: null,
    }
  }

  return normalizeBillAmounts({
    ...merged,
    billNo: String(merged.billNo || `B${Date.now()}`),
    type: merged.type === 'sale' ? 'sale' : 'purchase',
    billDate: String(merged.billDate || now.slice(0, 10)),
    customerName: String(merged.customerName || merged.partnerName || ''),
    status: String(merged.status || 'confirmed'),
    totalAmount: Number(merged.totalAmount || 0),
    totalWeight: Number(merged.totalWeight || 0),
    deletedAt: null,
  })
}

const softDeleteRow = async (db, entity, recordId, updatedAt) => {
  const existing = await getSyncRecordSnapshot(db, entity, recordId)
  if (!existing) return

  const status = entity === 'bills' ? 'deleted' : 'inactive'
  const deleted = {
    ...existing.data,
    id: recordId,
    status,
    updatedAt,
    deletedAt: updatedAt,
  }

  await softDeleteSyncRecord(db, entity, recordId, deleted)
}

const applyOperation = async (db, operation) => {
  const config = getSyncEntityConfig(operation.entity)
  if (!config) {
    return { status: 'invalid', reason: 'unsupported_entity' }
  }
  if (!operation.recordId) {
    return { status: 'invalid', reason: 'missing_record_id' }
  }

  const existing = await getSyncRecordSnapshot(db, operation.entity, operation.recordId)

  const serverUpdatedAt = toIsoString(existing?.updatedAt || EPOCH_ISO)
  if (existing && toMillis(operation.updatedAt) < toMillis(serverUpdatedAt)) {
    return {
      status: 'conflict',
      reason: 'stale_operation',
      serverUpdatedAt,
    }
  }

  if (operation.action === 'delete') {
    if (existing && toMillis(operation.updatedAt) === toMillis(serverUpdatedAt)) {
      return { status: 'applied' }
    }
    await softDeleteRow(db, operation.entity, operation.recordId, operation.updatedAt)
    return { status: 'applied' }
  }

  const existingData = existing?.data || null
  const nextRecord = buildRecordByEntity(
    operation.entity,
    operation.record,
    existingData,
    operation.recordId,
    operation.updatedAt
  )

  if (operation.entity !== 'bills' && !nextRecord.name) {
    return { status: 'invalid', reason: 'missing_name' }
  }

  if (existing && toMillis(operation.updatedAt) === toMillis(serverUpdatedAt)) {
    return { status: 'applied' }
  }

  await upsertSyncRecord(db, operation.entity, nextRecord)
  return { status: 'applied' }
}

export const registerSyncRoutes = (app) => {
  app.get('/api/sync/pull', async (c) => {
    const forceFull = c.req.query('full') === '1'
    const since = forceFull ? EPOCH_ISO : toIsoString(c.req.query('since') || EPOCH_ISO)

    const [customers, fabrics, bills] = await Promise.all([
      listEntityChanges(c.env.DB, 'customers', since, toIsoString),
      listEntityChanges(c.env.DB, 'fabrics', since, toIsoString),
      listEntityChanges(c.env.DB, 'bills', since, toIsoString),
    ])

    return ok(c, {
      data: {
        serverTime: new Date().toISOString(),
        since,
        changes: { customers, fabrics, bills },
      },
    })
  })

  app.post('/api/sync/push', async (c) => {
    const body = await parseBody(c)
    const operations = normalizeOperations(body)
    if (!operations.length) {
      return fail(c, '缺少待同步操作', 400)
    }

    const appliedOpIds = []
    const conflicts = []
    const invalid = []

    for (const operation of operations) {
      const result = await applyOperation(c.env.DB, operation)
      if (result.status === 'applied') {
        appliedOpIds.push(operation.opId)
      } else if (result.status === 'conflict') {
        conflicts.push({
          opId: operation.opId,
          entity: operation.entity,
          recordId: operation.recordId,
          reason: result.reason,
          serverUpdatedAt: result.serverUpdatedAt,
        })
      } else {
        invalid.push({
          opId: operation.opId,
          entity: operation.entity,
          recordId: operation.recordId,
          reason: result.reason,
        })
      }
    }

    return ok(c, {
      data: {
        serverTime: new Date().toISOString(),
        appliedCount: appliedOpIds.length,
        conflictCount: conflicts.length,
        invalidCount: invalid.length,
        appliedOpIds,
        conflicts,
        invalid,
      },
    })
  })
}
