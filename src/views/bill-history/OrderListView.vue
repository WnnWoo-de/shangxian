<script setup>
import { computed, reactive, watch, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBillRecordStore } from '../../stores/billRecord'
import { formatMoney } from '../../utils/money'
import { showToast } from '../../utils/toast'
import { ElMessageBox } from 'element-plus'

const props = defineProps({ type: { type: String, default: 'purchase' } })
const router = useRouter()
const route = useRoute()
const billRecordStore = useBillRecordStore()
billRecordStore.init()

const isPurchase = computed(() => props.type !== 'sale')
const quickDate = computed(() => String(route.query.quickDate || '').trim())
const selectedDate = computed(() => quickDate.value || '')
const pageTitle = computed(() => isPurchase.value ? (selectedDate.value ? `${selectedDate.value} 进货列表` : '进货列表') : (selectedDate.value ? `${selectedDate.value} 出货列表` : '出货列表'))
const amountLabel = computed(() => isPurchase.value ? '进货金额' : '出货金额')
const settlementLabel = computed(() => isPurchase.value ? '已付款' : '已收款')
const eyebrow = computed(() => isPurchase.value ? 'Purchase Bills' : 'Sale Bills')

const filters = reactive({
  partnerName: '',
  dateStart: selectedDate.value,
  dateEnd: selectedDate.value,
  status: 'all' // all, settled, unsettled
})
watch(selectedDate, (value) => {
  filters.dateStart = value;
  filters.dateEnd = value
}, { immediate: true })

const list = computed(() => {
  let filtered = billRecordStore.getRecordsByType(isPurchase.value ? 'purchase' : 'sale')

  // 按往来对象筛选
  if (filters.partnerName) {
    filtered = filtered.filter((record) =>
      String(record.partnerName || '').includes(filters.partnerName.trim())
    )
  }

  // 按日期范围筛选
  if (filters.dateStart) {
    filtered = filtered.filter((record) => record.billDate >= filters.dateStart)
  }
  if (filters.dateEnd) {
    filtered = filtered.filter((record) => record.billDate <= filters.dateEnd)
  }

  // 按状态筛选
  if (filters.status === 'settled') {
    filtered = filtered.filter((record) => Number(record.unsettledAmount || 0) <= 0)
  } else if (filters.status === 'unsettled') {
    filtered = filtered.filter((record) => Number(record.unsettledAmount || 0) > 0)
  }

  return filtered
})

const totals = computed(() => list.value.reduce((acc, cur) => {
  acc.weight += Number(cur.totalWeight || 0)
  acc.amount += Number(cur.totalAmount || 0)
  acc.settlement += Number(isPurchase.value ? cur.paidAmount || 0 : cur.receivedAmount || 0)
  return acc
}, { weight: 0, amount: 0, settlement: 0 }))

const openCreate = () => router.push(isPurchase.value ? '/purchase/create' : '/sale/create')
const viewBill = (id) => router.push(`/${isPurchase.value ? 'purchase' : 'sale'}/view/${id}`)
const editBill = (id) => router.push(`/${isPurchase.value ? 'purchase' : 'sale'}/edit/${id}`)

const deleteBill = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除此单据吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await billRecordStore.deleteRecord(id)
    showToast('删除成功')
  } catch {
    // 用户取消或出错
  }
}

const clearQuickFilter = () => {
  router.replace({ path: route.path, query: { ...route.query, quickDate: undefined } })
}

const exportToExcel = () => {
  showToast('功能开发中...')
}

const getStatusText = (status, unsettled) => {
  if (unsettled > 0) return '未结算'
  return status === 'settled' ? '已结算' : '已确认'
}

const getStatusColor = (status, unsettled) => {
  if (unsettled > 0) return 'orange'
  return status === 'settled' ? 'green' : 'blue'
}

// 最近常用客户
const recentPartners = computed(() => {
  const partners = new Map()
  list.value.slice(0, 5).forEach(item => {
    if (item.partnerName) {
      partners.set(item.partnerName, item.partnerId)
    }
  })
  return Array.from(partners.entries()).map(([name, id]) => ({ id, name }))
})
</script>

<template>
  <section class="order-list-page">
    <!-- 页面头部 -->
    <header class="page-header">
      <div class="header-content">
        <div class="page-info">
          <p class="page-eyebrow">{{ eyebrow }}</p>
          <h1 class="page-title">{{ pageTitle }}</h1>
          <p class="page-desc">查看历史单据，支持按日期、客户和状态筛选</p>
        </div>
        <div class="page-actions">
          <button class="btn-primary" @click="openCreate">
            {{ isPurchase ? '📥 进货开单' : '📤 出货开单' }}
          </button>
        </div>
      </div>
    </header>

    <!-- 统计卡片 -->
    <section class="stats-section">
      <div class="stats-grid">
        <article class="stat-card">
          <span class="stat-label">单据数量</span>
          <strong class="stat-value">{{ list.length }}</strong>
          <small class="stat-note">当前结果</small>
        </article>
        <article class="stat-card">
          <span class="stat-label">{{ amountLabel }}</span>
          <strong class="stat-value">{{ formatMoney(totals.amount) }}</strong>
          <small class="stat-note">{{ settlementLabel }} {{ formatMoney(totals.settlement) }}</small>
        </article>
        <article class="stat-card">
          <span class="stat-label">总重量</span>
          <strong class="stat-value">{{ totals.weight.toFixed(2) }}</strong>
          <small class="stat-note">斤</small>
        </article>
        <article class="stat-card">
          <span class="stat-label">未结单据</span>
          <strong class="stat-value">{{ list.filter(item => Number(item.unsettledAmount || 0) > 0).length }}</strong>
          <small class="stat-note">待处理</small>
        </article>
      </div>
    </section>

    <!-- 筛选区域 -->
    <section class="filter-section">
      <div class="filter-grid">
        <div class="filter-group">
          <label class="filter-label">客户</label>
          <input
            v-model="filters.partnerName"
            type="text"
            placeholder="搜索客户名称"
            class="filter-input"
          />
          <!-- 最近客户快捷选择 -->
          <div class="recent-partners" v-if="recentPartners.length > 0 && !filters.partnerName">
            <span class="recent-label">最近：</span>
            <button
              v-for="partner in recentPartners"
              :key="partner.id"
              class="partner-tag"
              @click="filters.partnerName = partner.name"
            >
              {{ partner.name }}
            </button>
          </div>
        </div>

        <div class="filter-group">
          <label class="filter-label">日期</label>
          <div class="date-range">
            <input
              v-model="filters.dateStart"
              type="date"
              class="filter-input"
            />
            <span class="date-separator">至</span>
            <input
              v-model="filters.dateEnd"
              type="date"
              class="filter-input"
            />
          </div>
        </div>

        <div class="filter-group">
          <label class="filter-label">状态</label>
          <select v-model="filters.status" class="filter-select">
            <option value="all">全部状态</option>
            <option value="settled">已结算</option>
            <option value="unsettled">未结算</option>
          </select>
        </div>

        <div class="filter-actions">
          <button class="btn-secondary" @click="exportToExcel">
            导出Excel
          </button>
          <button v-if="selectedDate" class="btn-ghost" @click="clearQuickFilter">
            查看全部
          </button>
        </div>
      </div>
    </section>

    <!-- 单据列表 -->
    <section class="list-section">
      <div class="list-container">
        <div class="list-header">
          <h3>单据列表</h3>
          <span class="list-tip">支持查看、编辑、删除</span>
        </div>

        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>单号</th>
                <th>日期</th>
                <th>客户</th>
                <th>重量</th>
                <th>{{ amountLabel }}</th>
                <th>{{ settlementLabel }}</th>
                <th>未结金额</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in list" :key="item.id" class="table-row">
                <td class="bill-no">{{ item.billNo }}</td>
                <td class="bill-date">{{ item.billDate }}</td>
                <td class="partner-name">{{ item.partnerName }}</td>
                <td class="total-weight">{{ Number(item.totalWeight || 0).toFixed(2) }} 斤</td>
                <td class="total-amount">{{ formatMoney(item.totalAmount) }}</td>
                <td class="settlement-amount">{{ formatMoney(isPurchase ? item.paidAmount : item.receivedAmount) }}</td>
                <td class="unsettled-amount" :class="{ negative: item.unsettledAmount > 0 }">
                  {{ formatMoney(item.unsettledAmount) }}
                </td>
                <td class="status">
                  <span
                    class="status-tag"
                    :class="`status-${getStatusColor(item.status, item.unsettledAmount)}`"
                  >
                    {{ getStatusText(item.status, item.unsettledAmount) }}
                  </span>
                </td>
                <td class="actions">
                  <div class="action-buttons">
                    <button class="btn-text" @click="viewBill(item.id)">查看</button>
                    <button class="btn-text" @click="editBill(item.id)">编辑</button>
                    <button class="btn-text btn-danger" @click="deleteBill(item.id)">删除</button>
                  </div>
                </td>
              </tr>
              <tr v-if="list.length === 0" class="empty-row">
                <td colspan="9">
                  <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <p class="empty-text">暂无单据</p>
                    <p class="empty-desc">{{ isPurchase ? '点击上方按钮创建第一张进货单' : '点击上方按钮创建第一张出货单' }}</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped lang="scss">
.order-list-page {
  background: linear-gradient(180deg, #fffaf3 0%, #f5ebde 100%);
  min-height: 100vh;
  padding: 20px;
}

/* 页面头部 */
.page-header {
  margin-bottom: 24px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  background: rgba(255, 250, 241, 0.9);
  border-radius: 24px;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 12px 30px rgba(187, 161, 130, 0.08);

  .page-info {
    flex: 1;

    .page-eyebrow {
      margin: 0 0 8px;
      font-size: 12px;
      letter-spacing: 0.08em;
      color: rgba(139, 125, 112, 0.7);
      text-transform: uppercase;
    }

    .page-title {
      margin: 0 0 8px;
      font-size: 28px;
      font-weight: 700;
      color: #231f1c;
      line-height: 1.1;
    }

    .page-desc {
      margin: 0;
      font-size: 14px;
      color: #6a5d52;
      line-height: 1.5;
    }
  }

  .page-actions {
    .btn-primary {
      padding: 12px 20px;
      background: linear-gradient(135deg, #1a915c, #23ac6f);
      color: #fff;
      border: none;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(26, 145, 92, 0.3);
      }
    }
  }
}

/* 统计卡片 */
.stats-section {
  margin-bottom: 24px;

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;

    @media (max-width: 768px) {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .stat-card {
    padding: 20px;
    background: rgba(255, 250, 241, 0.9);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.6);
    box-shadow: 0 12px 30px rgba(187, 161, 130, 0.08);
    text-align: center;

    .stat-label {
      display: block;
      font-size: 12px;
      color: #8b7d70;
      margin-bottom: 8px;
    }

    .stat-value {
      display: block;
      font-size: 24px;
      font-weight: 700;
      color: #231f1c;
      margin-bottom: 4px;
    }

    .stat-note {
      font-size: 11px;
      color: #9b8d80;
    }
  }
}

/* 筛选区域 */
.filter-section {
  margin-bottom: 24px;

  .filter-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    background: rgba(255, 250, 241, 0.9);
    border-radius: 20px;
    padding: 20px;
    border: 1px solid rgba(255, 255, 255, 0.6);
    box-shadow: 0 12px 30px rgba(187, 161, 130, 0.08);

    @media (max-width: 1024px) {
      grid-template-columns: repeat(2, 1fr);
    }

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  }

  .filter-group {
    .filter-label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #6a5d52;
      margin-bottom: 8px;
    }

    .filter-input {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid rgba(139, 125, 112, 0.2);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.8);
      font-size: 14px;
      color: #231f1c;
      transition: border-color 0.2s ease;

      &:focus {
        outline: none;
        border-color: #e3bb7a;
        box-shadow: 0 0 0 3px rgba(227, 187, 122, 0.1);
      }
    }

    .filter-select {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid rgba(139, 125, 112, 0.2);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.8);
      font-size: 14px;
      color: #231f1c;
      cursor: pointer;
    }

    .date-range {
      display: flex;
      align-items: center;
      gap: 8px;

      .date-separator {
        color: #8b7d70;
        font-size: 14px;
      }
    }

    .recent-partners {
      margin-top: 8px;
      display: flex;
      align-items: center;
      gap: 8px;

      .recent-label {
        font-size: 12px;
        color: #8b7d70;
      }

      .partner-tag {
        padding: 4px 12px;
        background: rgba(227, 187, 122, 0.15);
        border: 1px solid rgba(227, 187, 122, 0.3);
        border-radius: 999px;
        font-size: 12px;
        color: #9b7e5c;
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
          background: rgba(227, 187, 122, 0.25);
          border-color: rgba(227, 187, 122, 0.4);
        }
      }
    }
  }

  .filter-actions {
    display: flex;
    gap: 8px;

    .btn-secondary {
      padding: 10px 16px;
      background: linear-gradient(135deg, #d4a76a, #e3bb7a);
      color: #fff;
      border: none;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s ease;

      &:hover {
        transform: translateY(-1px);
      }
    }

    .btn-ghost {
      padding: 10px 16px;
      background: transparent;
      border: 1px solid rgba(139, 125, 112, 0.2);
      border-radius: 12px;
      color: #6a5d52;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(227, 187, 122, 0.1);
        border-color: rgba(227, 187, 122, 0.3);
      }
    }
  }
}

/* 列表区域 */
.list-section {
  .list-container {
    background: rgba(255, 250, 241, 0.9);
    border-radius: 20px;
    padding: 20px;
    border: 1px solid rgba(255, 255, 255, 0.6);
    box-shadow: 0 12px 30px rgba(187, 161, 130, 0.08);

    .list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;

      h3 {
        margin: 0;
        font-size: 18px;
        color: #231f1c;
        font-weight: 700;
      }

      .list-tip {
        font-size: 12px;
        color: #8b7d70;
      }
    }

    .table-wrap {
      overflow-x: auto;

      .data-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;

        thead {
          tr {
            th {
              padding: 14px;
              text-align: left;
              background: rgba(255, 250, 241, 0.9);
              font-size: 12px;
              font-weight: 600;
              color: #8b7d70;
              letter-spacing: 0.06em;
              text-transform: uppercase;
              border-bottom: 1px solid rgba(139, 125, 112, 0.1);
            }
          }
        }

        tbody {
          .table-row {
            transition: background 0.2s ease;

            &:hover {
              background: rgba(255, 248, 235, 0.8);
            }

            td {
              padding: 14px;
              border-bottom: 1px solid rgba(139, 125, 112, 0.08);
              font-size: 14px;
              color: #231f1c;

              &.bill-no {
                font-weight: 600;
              }

              &.bill-date {
                color: #6a5d52;
              }

              &.partner-name {
                font-weight: 500;
              }

              &.total-weight {
                color: #8b7d70;
              }

              &.total-amount {
                color: #1a915c;
                font-weight: 600;
              }

              &.settlement-amount {
                color: #2c3e50;
                font-weight: 600;
              }

              &.unsettled-amount {
                font-weight: 600;

                &.negative {
                  color: #e74c3c;
                }
              }

              &.status {
                .status-tag {
                  padding: 4px 10px;
                  border-radius: 999px;
                  font-size: 12px;
                  font-weight: 600;
                  display: inline-block;

                  &.status-green {
                    background: rgba(26, 145, 92, 0.1);
                    color: #1a915c;
                  }

                  &.status-blue {
                    background: rgba(44, 62, 80, 0.1);
                    color: #2c3e50;
                  }

                  &.status-orange {
                    background: rgba(231, 118, 34, 0.1);
                    color: #e67e22;
                  }
                }
              }

              &.actions {
                .action-buttons {
                  display: flex;
                  gap: 8px;

                  .btn-text {
                    padding: 4px 8px;
                    background: transparent;
                    border: none;
                    color: #9b7e5c;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: color 0.2s ease;

                    &:hover {
                      color: #d4a76a;
                    }

                    &.btn-danger {
                      color: #e74c3c;

                      &:hover {
                        color: #c0392b;
                      }
                    }
                  }
                }
              }
            }
          }

          .empty-row {
            td {
              padding: 60px 20px;
              text-align: center;
              border-bottom: none;

              .empty-state {
                .empty-icon {
                  font-size: 48px;
                  margin-bottom: 16px;
                }

                .empty-text {
                  font-size: 18px;
                  color: #231f1c;
                  font-weight: 600;
                  margin-bottom: 8px;
                }

                .empty-desc {
                  font-size: 14px;
                  color: #8b7d70;
                }
              }
            }
          }
        }
      }
    }
  }
}
</style>
