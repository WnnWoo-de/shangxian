ALTER TABLE customers ADD COLUMN deleted_at TEXT;
ALTER TABLE fabrics ADD COLUMN deleted_at TEXT;
ALTER TABLE bills ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_updated_at ON customers(updated_at);
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON customers(deleted_at);

CREATE INDEX IF NOT EXISTS idx_fabrics_updated_at ON fabrics(updated_at);
CREATE INDEX IF NOT EXISTS idx_fabrics_deleted_at ON fabrics(deleted_at);

CREATE INDEX IF NOT EXISTS idx_bills_updated_at ON bills(updated_at);
CREATE INDEX IF NOT EXISTS idx_bills_deleted_at ON bills(deleted_at);
