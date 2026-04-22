PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(1,'001_init.sql','2026-04-10 13:20:32');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(2,'002_auth.sql','2026-04-10 13:20:33');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(3,'003_sync_fields.sql','2026-04-10 13:20:33');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(4,'004_indexes.sql','2026-04-10 13:20:34');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(5,'005_bill_settlement_fields.sql','2026-04-10 13:20:34');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(6,'006_bill_item_fabric_fields.sql','2026-04-10 13:54:25');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(7,'007_bill_weight_fields.sql','2026-04-10 14:11:20');
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO "users" ("id","username","password_hash","display_name","status","created_at","updated_at") VALUES('user_admin','admin','pbkdf2','管理员','active','2026-04-10 13:20:33','2026-04-10 13:20:33');
INSERT INTO "users" ("id","username","password_hash","display_name","status","created_at","updated_at") VALUES('user_wansheng','皖盛布碎','dev_password_placeholder','皖盛布碎','active','2026-04-10T16:25:12.421Z','2026-04-10T16:25:12.421Z');
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  contact TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT,
  default_purchase_price REAL,
  default_sale_price REAL,
  status TEXT NOT NULL DEFAULT 'active',
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);
INSERT INTO "categories" ("id","owner_id","name","unit","default_purchase_price","default_sale_price","status","note","created_at","updated_at","deleted_at","version") VALUES('cat-001','user_wansheng','布条类','斤',NULL,NULL,'active','各种布条类布料','2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "categories" ("id","owner_id","name","unit","default_purchase_price","default_sale_price","status","note","created_at","updated_at","deleted_at","version") VALUES('cat-002','user_wansheng','擦机布类','斤',NULL,NULL,'active','各种擦机布类布料','2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
CREATE TABLE fabrics (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  width INTEGER,
  gram_weight INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  category_id TEXT,
  default_purchase_price REAL,
  default_sale_price REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-001','user_wansheng','布条类-90×115','FAB-001',NULL,NULL,'active','cat-001',0.85,0.85,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-002','user_wansheng','布条类-双条','FAB-002',NULL,NULL,'active','cat-001',0.8,0.8,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-003','user_wansheng','布条类-粗杂条','FAB-003',NULL,NULL,'active','cat-001',0.55,0.55,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-004','user_wansheng','布条类-彩无弹','FAB-004',NULL,NULL,'active','cat-001',1.3,1.3,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-005','user_wansheng','布条类-彩定条','FAB-005',NULL,NULL,'active','cat-001',1.25,1.25,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-006','user_wansheng','布条类-牛边','FAB-006',NULL,NULL,'active','cat-001',0.9,0.9,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-007','user_wansheng','布条类-牛条','FAB-007',NULL,NULL,'active','cat-001',0.8,0.8,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-008','user_wansheng','布条类-X灰条','FAB-008',NULL,NULL,'active','cat-001',0.7,0.7,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-009','user_wansheng','布条类-色条','FAB-009',NULL,NULL,'active','cat-001',0.8,0.8,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-010','user_wansheng','布条类-粉条','FAB-010',NULL,NULL,'active','cat-001',0.9,0.9,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-011','user_wansheng','布条类-单花条','FAB-011',NULL,NULL,'active','cat-001',0.9,0.9,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-012','user_wansheng','布条类-灰条','FAB-012',NULL,NULL,'active','cat-001',1.2,1.2,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-013','user_wansheng','布条类-B条','FAB-013',NULL,NULL,'active','cat-001',0.5,0.5,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-014','user_wansheng','布条类-杂条','FAB-014',NULL,NULL,'active','cat-001',0.25,0.25,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-015','user_wansheng','擦机布类-花刀','FAB-015',NULL,NULL,'active','cat-002',0.9,0.9,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-016','user_wansheng','擦机布类-杂床','FAB-016',NULL,NULL,'active','cat-002',0.3,0.3,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-017','user_wansheng','擦机布类-白床','FAB-017',NULL,NULL,'active','cat-002',2,2,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-018','user_wansheng','擦机布类-白中','FAB-018',NULL,NULL,'active','cat-002',1.4,1.4,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-019','user_wansheng','擦机布类-花床','FAB-019',NULL,NULL,'active','cat-002',0.8,0.8,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-020','user_wansheng','擦机布类-白大刀','FAB-020',NULL,NULL,'active','cat-002',2.7,2.7,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-021','user_wansheng','擦机布类-白中角','FAB-021',NULL,NULL,'active','cat-002',1.4,1.4,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-022','user_wansheng','擦机布类-牛白床','FAB-022',NULL,NULL,'active','cat-002',2.4,2.4,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-023','user_wansheng','擦机布类-棉白床','FAB-023',NULL,NULL,'active','cat-002',2,2,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-024','user_wansheng','擦机布类-灰床','FAB-024',NULL,NULL,'active','cat-002',1.1,1.1,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-025','user_wansheng','擦机布类-F灰床','FAB-025',NULL,NULL,'active','cat-002',0.7,0.7,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-026','user_wansheng','擦机布类-杂尾','FAB-026',NULL,NULL,'active','cat-002',0.4,0.4,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-027','user_wansheng','擦机布类-粉床','FAB-027',NULL,NULL,'active','cat-002',1,1,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-028','user_wansheng','擦机布类-毛杂尾','FAB-028',NULL,NULL,'active','cat-002',0.2,0.2,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-029','user_wansheng','擦机布类-男尾','FAB-029',NULL,NULL,'active','cat-002',0.7,0.7,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-030','user_wansheng','擦机布类-粉尾','FAB-030',NULL,NULL,'active','cat-002',1,1,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-031','user_wansheng','擦机布类-F粉床','FAB-031',NULL,NULL,'active','cat-002',0.5,0.5,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-032','user_wansheng','擦机布类-花尾','FAB-032',NULL,NULL,'active','cat-002',0.9,0.9,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-033','user_wansheng','擦机布类-黑大布','FAB-033',NULL,NULL,'active','cat-002',1,1,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-034','user_wansheng','擦机布类-灰尾','FAB-034',NULL,NULL,'active','cat-002',1.1,1.1,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-035','user_wansheng','擦机布类-白切','FAB-035',NULL,NULL,'active','cat-002',2,2,'2026-04-11 03:04:50','2026-04-11 03:04:50',NULL,1);
INSERT INTO "fabrics" ("id","owner_id","name","code","width","gram_weight","status","category_id","default_purchase_price","default_sale_price","created_at","updated_at","deleted_at","version") VALUES('fab-036','user_wansheng','擦机布类-牛白尾','FAB-036',1,1,'active','cat-002',2.3,2.4,'2026-04-11 03:04:50','2026-04-11T08:36:16.337Z',NULL,2);
CREATE TABLE bills (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  bill_no TEXT NOT NULL,
  bill_type TEXT NOT NULL,
  bill_date TEXT NOT NULL,
  customer_id TEXT,
  customer_name_snapshot TEXT,
  total_weight REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',
  creator_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1, paid_amount REAL NOT NULL DEFAULT 0, received_amount REAL NOT NULL DEFAULT 0, unsettled_amount REAL NOT NULL DEFAULT 0, first_weight REAL NOT NULL DEFAULT 0, last_weight REAL NOT NULL DEFAULT 0, net_weight REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (creator_id) REFERENCES users(id)
);
CREATE TABLE bill_items (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  bill_id TEXT NOT NULL,
  category_id TEXT,
  category_name_snapshot TEXT,
  weight_input_text TEXT,
  total_weight REAL NOT NULL DEFAULT 0,
  unit_price REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0,
  note TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1, fabric_id TEXT, fabric_name TEXT,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (bill_id) REFERENCES bills(id),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);
CREATE TABLE price_memory (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  last_price REAL NOT NULL,
  last_bill_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (last_bill_id) REFERENCES bills(id)
);
CREATE TABLE sync_changes (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_version INTEGER NOT NULL,
  changed_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('d1_migrations',7);
CREATE INDEX idx_customers_owner_updated
ON customers(owner_id, updated_at);
CREATE INDEX idx_categories_owner_updated
ON categories(owner_id, updated_at);
CREATE INDEX idx_fabrics_owner_updated
ON fabrics(owner_id, updated_at);
CREATE INDEX idx_bills_owner_bill_date
ON bills(owner_id, bill_date);
CREATE INDEX idx_bills_owner_updated
ON bills(owner_id, updated_at);
CREATE INDEX idx_bill_items_bill_id
ON bill_items(bill_id);
CREATE INDEX idx_bill_items_owner_updated
ON bill_items(owner_id, updated_at);
CREATE UNIQUE INDEX idx_price_memory_unique
ON price_memory(owner_id, customer_id, category_id);
