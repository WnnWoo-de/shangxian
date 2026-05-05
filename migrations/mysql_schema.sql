CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(191) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  data JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  status VARCHAR(32) NOT NULL,
  data JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  deleted_at DATETIME(3) NULL,
  INDEX idx_customers_updated_at (updated_at),
  INDEX idx_customers_deleted_at (deleted_at),
  INDEX idx_customers_name (name),
  INDEX idx_customers_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fabrics (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(64) NULL,
  name VARCHAR(191) NOT NULL,
  status VARCHAR(32) NOT NULL,
  data JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  deleted_at DATETIME(3) NULL,
  INDEX idx_fabrics_updated_at (updated_at),
  INDEX idx_fabrics_deleted_at (deleted_at),
  INDEX idx_fabrics_code (code),
  INDEX idx_fabrics_name (name),
  INDEX idx_fabrics_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bills (
  id VARCHAR(64) PRIMARY KEY,
  bill_no VARCHAR(64) NULL,
  type VARCHAR(32) NOT NULL,
  bill_date DATE NULL,
  customer_name VARCHAR(191) NULL,
  status VARCHAR(32) NULL,
  total_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  total_weight DECIMAL(14, 2) NOT NULL DEFAULT 0,
  data JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  deleted_at DATETIME(3) NULL,
  INDEX idx_bills_updated_at (updated_at),
  INDEX idx_bills_deleted_at (deleted_at),
  INDEX idx_bills_bill_date (bill_date),
  INDEX idx_bills_bill_no (bill_no),
  INDEX idx_bills_type (type),
  INDEX idx_bills_customer_name (customer_name),
  INDEX idx_bills_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO users (id, username, password, data, created_at, updated_at)
VALUES (
  'user-001',
  '皖盛布碎',
  '123456',
  JSON_OBJECT(
    'id', 'user-001',
    'username', '皖盛布碎',
    'name', '系统管理员',
    'phone', '',
    'avatar', '',
    'email', 'admin@wsbs.com',
    'department', '财务部',
    'role', 'admin',
    'permissions', JSON_ARRAY('all'),
    'status', 'active',
    'createdAt', '2024-01-01T00:00:00Z',
    'updatedAt', '2024-01-01T00:00:00Z'
  ),
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
);
