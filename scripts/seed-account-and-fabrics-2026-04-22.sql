INSERT OR REPLACE INTO users (id, username, password, data, created_at, updated_at)
VALUES (
  'user-001',
  '皖盛布碎',
  '123456',
  json_object(
    'id', 'user-001',
    'username', '皖盛布碎',
    'name', '系统管理员',
    'phone', '',
    'avatar', '',
    'email', 'admin@wsbs.com',
    'department', '财务部',
    'role', 'admin',
    'permissions', json_array('all'),
    'status', 'active',
    'createdAt', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    'updatedAt', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  ),
  strftime('%Y-%m-%d %H:%M:%S', 'now'),
  strftime('%Y-%m-%d %H:%M:%S', 'now')
);

DELETE FROM fabrics;

INSERT INTO fabrics (id, code, name, status, data, created_at, updated_at) VALUES
(
  'fab-seed-001', 'MAT001', '布条类-90×115', 'active',
  json_object('id','fab-seed-001','code','MAT001','name','布条类-90×115','status','active','unit','斤','defaultPurchasePrice',0.85,'defaultSalePrice',0.85,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-002', 'MAT002', '布条类-双条', 'active',
  json_object('id','fab-seed-002','code','MAT002','name','布条类-双条','status','active','unit','斤','defaultPurchasePrice',0.8,'defaultSalePrice',0.8,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-003', 'MAT003', '擦机布类-花刀', 'active',
  json_object('id','fab-seed-003','code','MAT003','name','擦机布类-花刀','status','active','unit','斤','defaultPurchasePrice',0.9,'defaultSalePrice',0.9,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-004', 'MAT004', '擦机布类-杂床', 'active',
  json_object('id','fab-seed-004','code','MAT004','name','擦机布类-杂床','status','active','unit','斤','defaultPurchasePrice',0.3,'defaultSalePrice',0.3,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-005', 'MAT005', '擦机布类-白床', 'active',
  json_object('id','fab-seed-005','code','MAT005','name','擦机布类-白床','status','active','unit','斤','defaultPurchasePrice',2.0,'defaultSalePrice',2.0,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-006', 'MAT006', '擦机布类-白中', 'active',
  json_object('id','fab-seed-006','code','MAT006','name','擦机布类-白中','status','active','unit','斤','defaultPurchasePrice',1.4,'defaultSalePrice',1.4,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-007', 'MAT007', '擦机布类-花床', 'active',
  json_object('id','fab-seed-007','code','MAT007','name','擦机布类-花床','status','active','unit','斤','defaultPurchasePrice',0.8,'defaultSalePrice',0.8,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-008', 'MAT008', '擦机布类-白大刀', 'active',
  json_object('id','fab-seed-008','code','MAT008','name','擦机布类-白大刀','status','active','unit','斤','defaultPurchasePrice',2.7,'defaultSalePrice',2.7,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-009', 'MAT009', '布条类-粗杂条', 'active',
  json_object('id','fab-seed-009','code','MAT009','name','布条类-粗杂条','status','active','unit','斤','defaultPurchasePrice',0.55,'defaultSalePrice',0.55,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-010', 'MAT010', '布条类-彩无弹', 'active',
  json_object('id','fab-seed-010','code','MAT010','name','布条类-彩无弹','status','active','unit','斤','defaultPurchasePrice',1.3,'defaultSalePrice',1.3,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-011', 'MAT011', '布条类-彩定条', 'active',
  json_object('id','fab-seed-011','code','MAT011','name','布条类-彩定条','status','active','unit','斤','defaultPurchasePrice',1.25,'defaultSalePrice',1.25,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-012', 'MAT012', '布条类-牛边', 'active',
  json_object('id','fab-seed-012','code','MAT012','name','布条类-牛边','status','active','unit','斤','defaultPurchasePrice',0.9,'defaultSalePrice',0.9,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-013', 'MAT013', '布条类-牛条', 'active',
  json_object('id','fab-seed-013','code','MAT013','name','布条类-牛条','status','active','unit','斤','defaultPurchasePrice',0.8,'defaultSalePrice',0.8,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-014', 'MAT014', '擦机布类-白中角', 'active',
  json_object('id','fab-seed-014','code','MAT014','name','擦机布类-白中角','status','active','unit','斤','defaultPurchasePrice',1.4,'defaultSalePrice',1.4,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-015', 'MAT015', '擦机布类-牛白床', 'active',
  json_object('id','fab-seed-015','code','MAT015','name','擦机布类-牛白床','status','active','unit','斤','defaultPurchasePrice',2.4,'defaultSalePrice',2.4,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-016', 'MAT016', '布条类-X灰条', 'active',
  json_object('id','fab-seed-016','code','MAT016','name','布条类-X灰条','status','active','unit','斤','defaultPurchasePrice',0.7,'defaultSalePrice',0.7,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-017', 'MAT017', '擦机布类-棉白床', 'active',
  json_object('id','fab-seed-017','code','MAT017','name','擦机布类-棉白床','status','active','unit','斤','defaultPurchasePrice',2.0,'defaultSalePrice',2.0,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-018', 'MAT018', '布条类-色条', 'active',
  json_object('id','fab-seed-018','code','MAT018','name','布条类-色条','status','active','unit','斤','defaultPurchasePrice',0.8,'defaultSalePrice',0.8,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-019', 'MAT019', '布条类-粉条', 'active',
  json_object('id','fab-seed-019','code','MAT019','name','布条类-粉条','status','active','unit','斤','defaultPurchasePrice',0.9,'defaultSalePrice',0.9,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-020', 'MAT020', '布条类-单花条', 'active',
  json_object('id','fab-seed-020','code','MAT020','name','布条类-单花条','status','active','unit','斤','defaultPurchasePrice',0.9,'defaultSalePrice',0.9,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-021', 'MAT021', '擦机布类-灰床', 'active',
  json_object('id','fab-seed-021','code','MAT021','name','擦机布类-灰床','status','active','unit','斤','defaultPurchasePrice',1.1,'defaultSalePrice',1.1,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-022', 'MAT022', '擦机布类-F灰床', 'active',
  json_object('id','fab-seed-022','code','MAT022','name','擦机布类-F灰床','status','active','unit','斤','defaultPurchasePrice',0.7,'defaultSalePrice',0.7,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-023', 'MAT023', '擦机布类-杂尾', 'active',
  json_object('id','fab-seed-023','code','MAT023','name','擦机布类-杂尾','status','active','unit','斤','defaultPurchasePrice',0.4,'defaultSalePrice',0.4,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-024', 'MAT024', '擦机布类-粉床', 'active',
  json_object('id','fab-seed-024','code','MAT024','name','擦机布类-粉床','status','active','unit','斤','defaultPurchasePrice',1.0,'defaultSalePrice',1.0,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-025', 'MAT025', '擦机布类-毛杂尾', 'active',
  json_object('id','fab-seed-025','code','MAT025','name','擦机布类-毛杂尾','status','active','unit','斤','defaultPurchasePrice',0.2,'defaultSalePrice',0.2,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-026', 'MAT026', '擦机布类-男尾', 'active',
  json_object('id','fab-seed-026','code','MAT026','name','擦机布类-男尾','status','active','unit','斤','defaultPurchasePrice',0.7,'defaultSalePrice',0.7,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-027', 'MAT027', '擦机布类-粉尾', 'active',
  json_object('id','fab-seed-027','code','MAT027','name','擦机布类-粉尾','status','active','unit','斤','defaultPurchasePrice',1.0,'defaultSalePrice',1.0,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-028', 'MAT028', '擦机布类-F粉床', 'active',
  json_object('id','fab-seed-028','code','MAT028','name','擦机布类-F粉床','status','active','unit','斤','defaultPurchasePrice',0.5,'defaultSalePrice',0.5,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-029', 'MAT029', '布条类-灰条', 'active',
  json_object('id','fab-seed-029','code','MAT029','name','布条类-灰条','status','active','unit','斤','defaultPurchasePrice',1.2,'defaultSalePrice',1.2,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-030', 'MAT030', '擦机布类-花尾', 'active',
  json_object('id','fab-seed-030','code','MAT030','name','擦机布类-花尾','status','active','unit','斤','defaultPurchasePrice',0.9,'defaultSalePrice',0.9,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-031', 'MAT031', '布条类-B条', 'active',
  json_object('id','fab-seed-031','code','MAT031','name','布条类-B条','status','active','unit','斤','defaultPurchasePrice',0.5,'defaultSalePrice',0.5,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-032', 'MAT032', '擦机布类-黑大布', 'active',
  json_object('id','fab-seed-032','code','MAT032','name','擦机布类-黑大布','status','active','unit','斤','defaultPurchasePrice',1.0,'defaultSalePrice',1.0,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-033', 'MAT033', '擦机布类-灰尾', 'active',
  json_object('id','fab-seed-033','code','MAT033','name','擦机布类-灰尾','status','active','unit','斤','defaultPurchasePrice',1.1,'defaultSalePrice',1.1,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-034', 'MAT034', '擦机布类-白切', 'active',
  json_object('id','fab-seed-034','code','MAT034','name','擦机布类-白切','status','active','unit','斤','defaultPurchasePrice',2.0,'defaultSalePrice',2.0,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-035', 'MAT035', '布条类-杂条', 'active',
  json_object('id','fab-seed-035','code','MAT035','name','布条类-杂条','status','active','unit','斤','defaultPurchasePrice',0.25,'defaultSalePrice',0.25,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
),
(
  'fab-seed-036', 'MAT036', '擦机布类-牛白尾', 'active',
  json_object('id','fab-seed-036','code','MAT036','name','擦机布类-牛白尾','status','active','unit','斤','defaultPurchasePrice',2.4,'defaultSalePrice',2.4,'note','','createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  strftime('%Y-%m-%d %H:%M:%S', 'now'), strftime('%Y-%m-%d %H:%M:%S', 'now')
);
