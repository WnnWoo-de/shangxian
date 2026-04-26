export const entityConfigs = {
  customers: {
    table: 'customers',
    fields: [
      { column: 'name', value: (customer) => String(customer.name || '') },
      { column: 'status', value: (customer) => String(customer.status || 'active') },
    ],
  },
  fabrics: {
    table: 'fabrics',
    fields: [
      { column: 'code', value: (fabric) => String(fabric.code || '') },
      { column: 'name', value: (fabric) => String(fabric.name || '') },
      { column: 'status', value: (fabric) => String(fabric.status || 'active') },
    ],
  },
  bills: {
    table: 'bills',
    fields: [
      { column: 'bill_no', value: (bill) => String(bill.billNo || '') },
      { column: 'type', value: (bill) => String(bill.type || 'purchase') },
      { column: 'bill_date', value: (bill) => String(bill.billDate || '') },
      { column: 'customer_name', value: (bill) => String(bill.customerName || bill.partnerName || '') },
      { column: 'status', value: (bill) => String(bill.status || 'confirmed') },
      { column: 'total_amount', value: (bill) => Number(bill.totalAmount || 0) },
      { column: 'total_weight', value: (bill) => Number(bill.totalWeight || 0) },
    ],
  },
}

export const getEntityConfig = (entity) => entityConfigs[entity] || null
