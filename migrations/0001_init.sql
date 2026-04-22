CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fabrics (
  id TEXT PRIMARY KEY,
  code TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bills (
  id TEXT PRIMARY KEY,
  bill_no TEXT,
  type TEXT NOT NULL,
  bill_date TEXT,
  customer_name TEXT,
  status TEXT,
  total_amount REAL DEFAULT 0,
  total_weight REAL DEFAULT 0,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO users (id, username, password, data, created_at, updated_at)
VALUES (
  'user-001',
  '皖盛布碎',
  '123456',
  '{"id":"user-001","username":"皖盛布碎","name":"系统管理员","phone":"","avatar":"","email":"admin@wsbs.com","department":"财务部","role":"admin","permissions":["all"],"status":"active","createdAt":"2024-01-01T00:00:00Z","updatedAt":"2024-01-01T00:00:00Z"}',
  datetime('now'),
  datetime('now')
);
