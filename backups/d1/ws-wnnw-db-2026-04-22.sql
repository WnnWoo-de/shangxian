PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(1,'0001_init.sql','2026-04-22 08:57:00');
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO "users" ("id","username","password","data","created_at","updated_at") VALUES('user-001','皖盛布碎','123456','{"id":"user-001","username":"皖盛布碎","name":"系统管理员","phone":"","avatar":"","email":"admin@wsbs.com","department":"财务部","role":"admin","permissions":["all"],"status":"active","createdAt":"2024-01-01T00:00:00Z","updatedAt":"2024-01-01T00:00:00Z"}','2026-04-22 08:57:00','2026-04-22 08:57:00');
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE fabrics (
  id TEXT PRIMARY KEY,
  code TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE bills (
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
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('d1_migrations',1);
