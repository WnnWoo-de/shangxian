# 阿里云 Node.js + Hono + MySQL 迁移部署说明

本文档用于说明后续将当前 `Cloudflare Pages Functions + Hono + D1` 后端迁移到阿里云服务器上的 `Node.js + Hono + MySQL` 架构时的部署流程、数据迁移流程和注意事项。

本项目后续 **保留 Hono**，不再要求改写为 Express。现有 `functions/hono/routes/*` 路由可以继续复用，只需要新增 Node.js 启动入口和 MySQL 连接池。

当前项目已经具备部分 MySQL 兼容基础：

- 已有 MySQL 建表脚本：`migrations/mysql_schema.sql`
- 已有 D1 导出 SQL 转 MySQL SQL 脚本：`scripts/convert-d1-sql-to-mysql.js`
- 已有数据库访问兼容层：`server/db/db.js`
- 已有业务数据仓库封装：`server/db/entity-repository.js`、`server/db/sync-repository.js`

但项目目前仍主要运行在 Cloudflare D1 环境。迁移到阿里云服务器后，需要新增 Hono 的 Node.js 启动入口、MySQL 连接池、环境变量配置和部署进程管理。Nginx 反向代理是推荐项，如果你当前不会使用，可以先使用 Node.js 直接监听 `3000` 端口。

本文以 **阿里云 ECS** 为主要云服务器场景说明。若使用阿里云轻量应用服务器，整体步骤类似，但控制台入口、安全组/防火墙名称可能略有不同。

---

## 1. 目标架构

本项目当前正式访问地址为：

```text
https://wsbs.wnnw.fun/
```

迁移到阿里云 ECS + MySQL 后，目标是继续使用这个项目地址访问系统。根据是否使用 Nginx，有两种部署方式。

### 方案一：不用 Nginx，Hono 直接对外提供网站和 API

如果你暂时不会使用 Nginx，可以采用这个方案作为迁移测试方案。此方案不会直接占用当前正式地址 `https://wsbs.wnnw.fun/` 的 `443` 端口，而是通过 `3000` 端口访问：

```text
用户浏览器
  ↓
Node.js + Hono
  ├─ /              -> Vue 静态资源 dist/
  └─ /api/*         -> Hono API 服务
                         ↓
                     MySQL 数据库
```

访问方式示例：

```text
http://服务器公网IP:3000/
http://服务器公网IP:3000/api/health
```

如果项目域名 `wsbs.wnnw.fun` 已经解析到阿里云 ECS，但不使用 Nginx，也可以先使用临时测试地址：

```text
http://wsbs.wnnw.fun:3000/
http://wsbs.wnnw.fun:3000/api/health
```

注意：`https://wsbs.wnnw.fun/` 是本项目正式地址，默认走 `443` 端口。若不使用 Nginx 或其他 HTTPS 代理，Node.js 服务只监听 `3000` 时，不能直接通过正式地址 `https://wsbs.wnnw.fun/` 访问新服务。

这种方式部署最简单，但正式生产环境会有几个限制：

- 访问地址需要带 `:3000` 端口。
- HTTPS 配置不如 Nginx 方便。
- 静态资源缓存、压缩、反向代理能力较弱。
- 需要在阿里云安全组开放 `3000` 端口。

### 方案二：使用 Nginx 反向代理，Hono 只监听内部端口

这是更推荐的正式上线方案，可以让本项目继续使用正式地址 `https://wsbs.wnnw.fun/`：

```text
用户浏览器
  ↓
https://wsbs.wnnw.fun/
  ↓
Nginx
  ├─ /              -> Vue 静态资源 dist/
  └─ /api/*         -> Node.js + Hono API 服务
                         ↓
                     MySQL 数据库
```

访问方式示例：

```text
https://wsbs.wnnw.fun/
https://wsbs.wnnw.fun/api/health
```

如果当前不会使用 Nginx，可以先采用方案一。等系统稳定后，再升级为方案二。

推荐组件：

| 模块 | 推荐方案 |
|---|---|
| 前端 | Vue 构建后的 `dist/` 静态文件 |
| 后端 | Node.js + Hono，保留现有 Hono 路由 |
| 数据库 | MySQL 8.x |
| Node 版本 | Node.js 20 LTS 或 22 LTS |
| 进程管理 | PM2，正式运行建议使用 |
| 反向代理 | Nginx，可选；不会使用时可以先不用 |
| 数据库驱动 | `mysql2/promise` |
| 环境变量 | `.env` + `dotenv` |

---

## 2. 阿里云 ECS 服务器准备

以下以阿里云 ECS + Ubuntu / Debian 系统为例。

### 2.0 阿里云控制台准备

在安装服务器软件前，先在阿里云控制台确认以下配置。

#### ECS 实例建议

| 项目 | 建议 |
|---|---|
| 地域 | 选择离主要用户近的地域，例如华东、华南 |
| 系统 | Ubuntu 22.04 LTS / Debian 12 |
| CPU/内存 | 小规模使用可先选 2 核 2G 或 2 核 4G |
| 磁盘 | 建议 40G 起步，数据库增长较快时单独扩容 |
| 公网 IP | 需要公网访问时必须分配公网 IP 或绑定 EIP |

#### 阿里云安全组端口

在 ECS 实例的安全组中至少放行：

| 端口 | 协议 | 来源 | 用途 | 是否必须 |
|---|---|---|---|---|
| 22 | TCP | 你的办公 IP | SSH 登录服务器 | 必须 |
| 80 | TCP | 0.0.0.0/0 | HTTP 访问网站，使用 Nginx 时开放 | 使用 Nginx 时需要 |
| 443 | TCP | 0.0.0.0/0 | HTTPS 访问网站，使用 Nginx 时开放 | 使用 Nginx 时需要 |
| 3000 | TCP | 0.0.0.0/0 或你的固定 IP | 不使用 Nginx 时，Hono 直接对外访问 | 不用 Nginx 时需要 |
| 3306 | TCP | 不建议公网开放 | MySQL 端口 | 不建议开放 |

推荐做法分两种：

不使用 Nginx 时：

- 阿里云安全组需要开放 `3000`。
- Node.js + Hono 需要监听 `0.0.0.0:3000`。
- 浏览器通过 `http://服务器公网IP:3000/` 访问。
- `3306` 不要对公网开放，MySQL 仍然只允许本机访问。

使用 Nginx 时：

- `80`、`443` 对公网开放，由 Nginx 接收访问。
- `3000` 不对公网开放，只监听 `127.0.0.1`。
- Nginx 将 `/api/*` 转发到 Node.js。
- `3306` 只允许本机访问，即 MySQL 用户使用 `'localhost'`。
- `22` 尽量只允许自己的固定 IP 访问，不建议对所有 IP 开放。

#### 域名和备案

如果使用阿里云中国大陆服务器并绑定域名，需要注意：

- 域名需要完成 ICP 备案后，才能正常通过域名提供 Web 服务。
- 未备案域名访问大陆 ECS 网站可能被拦截。
- 如果只是测试，可以先用公网 IP 访问。
- HTTPS 证书可使用阿里云免费证书，也可以使用 Certbot 自动签发 Let's Encrypt 证书。

#### 服务器系统防火墙

除了阿里云安全组，服务器系统内部也可能启用了 `ufw`。如果启用，需要放行：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 3000/tcp
sudo ufw status
```

如果没有启用 `ufw`，可暂时不处理。

### 2.1 安装基础软件

```bash
sudo apt update
sudo apt install -y nginx mysql-server git curl unzip
```

### 2.2 安装 Node.js

推荐使用 NodeSource 安装 Node.js 20：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

### 2.3 安装 PM2

```bash
sudo npm install -g pm2
pm2 -v
```

---

## 3. MySQL 初始化

### 3.1 创建数据库和用户

登录 MySQL：

```bash
sudo mysql
```

执行：

```sql
CREATE DATABASE vue_jizhang CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'vue_jizhang'@'localhost' IDENTIFIED BY '请替换为强密码';
GRANT ALL PRIVILEGES ON vue_jizhang.* TO 'vue_jizhang'@'localhost';
FLUSH PRIVILEGES;
```

如果 Node.js API 服务和 MySQL 不在同一台机器，需要把 `localhost` 改成后端服务器 IP 或 `%`，并同时配置阿里云安全组、服务器防火墙和 MySQL 监听地址。

对于本项目的常见单机部署，推荐 **Node.js、Nginx、MySQL 都安装在同一台 ECS**。这种情况下：

- MySQL 用户保持 `'vue_jizhang'@'localhost'` 即可。
- 不需要在阿里云安全组开放 `3306`。
- `.env` 中 `MYSQL_HOST` 使用 `127.0.0.1`。
- 安全性比公网暴露 MySQL 更高。

### 3.2 导入 MySQL 表结构

在项目根目录执行：

```bash
mysql -u vue_jizhang -p vue_jizhang < migrations/mysql_schema.sql
```

导入后检查：

```bash
mysql -u vue_jizhang -p vue_jizhang -e "SHOW TABLES;"
```

应看到：

```text
users
customers
fabrics
bills
```

---

## 4. 从 D1 导出并迁移数据

### 4.1 从 Cloudflare D1 导出数据

可以使用 Wrangler 导出 D1 数据。示例：

```bash
npx wrangler d1 export my-cloudflare-backend-v2-db --remote --output backups/d1-export.sql
```

如果实际数据库名不同，请以 `wrangler.toml` 或 Cloudflare 控制台中的 D1 数据库名称为准。

### 4.2 转换 D1 SQL 为 MySQL SQL

项目已有脚本：

```bash
npm run db:convert-d1-to-mysql -- backups/d1-export.sql backups/mysql-import.sql
```

等价于：

```bash
node scripts/convert-d1-sql-to-mysql.js backups/d1-export.sql backups/mysql-import.sql
```

该脚本会处理：

- 删除 D1 / SQLite dump 中的 `PRAGMA`
- 删除 D1 表结构片段
- 删除 D1 索引片段
- 将 `INSERT OR IGNORE` 转成 `INSERT IGNORE`
- 将 `INSERT OR REPLACE` 转成 `REPLACE`
- 引入 `migrations/mysql_schema.sql`
- 包装 MySQL 事务

### 4.3 导入转换后的数据

```bash
mysql -u vue_jizhang -p vue_jizhang < backups/mysql-import.sql
```

### 4.4 校验数据数量

```bash
mysql -u vue_jizhang -p vue_jizhang
```

执行：

```sql
SELECT COUNT(*) AS users_count FROM users;
SELECT COUNT(*) AS customers_count FROM customers;
SELECT COUNT(*) AS fabrics_count FROM fabrics;
SELECT COUNT(*) AS bills_count FROM bills;

SELECT COUNT(*) AS active_customers FROM customers WHERE deleted_at IS NULL;
SELECT COUNT(*) AS active_fabrics FROM fabrics WHERE deleted_at IS NULL;
SELECT COUNT(*) AS active_bills FROM bills WHERE deleted_at IS NULL;

SELECT MAX(updated_at) AS latest_customer_update FROM customers;
SELECT MAX(updated_at) AS latest_fabric_update FROM fabrics;
SELECT MAX(updated_at) AS latest_bill_update FROM bills;
```

建议同时和 D1 原库的数量做对比，确认导入完整。

---

## 5. 后端 Hono 服务改造建议

当前项目的 Hono 路由已经放在 `functions/hono/` 下。迁移到阿里云 Node.js 环境时，推荐 **保留 Hono**，不要改写成 Express。

优点：

- 现有 `functions/hono/routes/*` 基本不用重写。
- 当前 `server/db/*` repository 可以继续复用。
- 只需要新增 Node.js 启动入口和 MySQL 连接池。
- 迁移风险比改写 Express 更低。

需要安装：

```bash
npm install @hono/node-server mysql2 dotenv
```

如果要让 Hono 直接托管前端 `dist/` 静态资源，也使用 `@hono/node-server/serve-static`。

保留 Hono 后需要重点验证这些接口：

- `POST /api/auth/login`
- `GET /api/health`
- `GET /api/customers`
- `POST /api/customers`
- `PUT /api/customers/:id`
- `DELETE /api/customers/:id`
- `GET /api/fabrics`
- `GET /api/bills`
- `GET /api/stats/overview`
- `GET /api/stats/monthly`
- `GET /api/sync/pull`
- `POST /api/sync/push`

---

## 6. 推荐新增环境变量

项目根目录新增 `.env`，生产环境不要提交到 Git。

```env
NODE_ENV=production
PORT=3000

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=vue_jizhang
MYSQL_PASSWORD=请替换为强密码
MYSQL_DATABASE=vue_jizhang
MYSQL_CONNECTION_LIMIT=10

DB_DIALECT=mysql
```

建议同时新增 `.env.example`，只放示例值，不放真实密码。

---

## 7. Hono + MySQL 接入代码结构建议

建议新增以下目录结构：

```text
server/
  node/
    index.js
    mysql.js
```

继续复用现有 Hono 文件：

```text
functions/hono/app.js
functions/hono/routes/*.js
functions/hono/helpers/http.js
```

### 7.1 MySQL 连接池示例

建议使用 `mysql2/promise`：

```js
import mysql from 'mysql2/promise'

export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
  charset: 'utf8mb4',
  timezone: 'Z',
})

export const dbContext = {
  DB_DIALECT: 'mysql',
  DB: pool,
}
```

现有 `server/db/db.js` 期望的 MySQL client 是带 `execute(sql, params)` 或 `query(sql, params)` 方法的对象，`mysql2/promise` 的 pool 正好满足这个要求。

### 7.2 Node.js 启动 Hono 示例

建议新增 `server/node/index.js`，在 Node.js 环境中启动现有 Hono app，并把 MySQL 连接池作为 `env` 注入。

```js
import 'dotenv/config'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import app from '../../functions/hono/app.js'
import { dbContext } from './mysql.js'

const port = Number(process.env.PORT || 3000)

app.use('/assets/*', serveStatic({ root: './dist' }))
app.use('/favicon.ico', serveStatic({ path: './dist/favicon.ico' }))

app.get('*', async (c, next) => {
  if (c.req.path.startsWith('/api/')) return next()
  return serveStatic({ path: './dist/index.html' })(c, next)
})

serve({
  fetch: (request) => app.fetch(request, dbContext),
  hostname: '0.0.0.0',
  port,
})

console.log(`Hono server running on http://0.0.0.0:${port}`)
```

这样 Hono 路由里的 `c.env` 就会变成：

```js
{
  DB_DIALECT: 'mysql',
  DB: pool,
}
```

现有代码中类似下面的调用可以继续工作：

```js
await listActiveEntities(c.env, 'customers')
```

如果静态资源托管行为和预期不一致，可以后续再调整 Hono 的静态文件配置；API 迁移本身不需要改成 Express。

---

## 8. 前端 API 地址配置

当前前端大概率默认请求同源 `/api`。

如果不使用 Nginx，推荐让 Hono 同时托管前端 `dist/` 和后端 `/api`，这样前端仍然请求同源 `/api`，可以不改前端请求地址。

访问方式：

```text
http://服务器公网IP:3000/              -> Vue dist
http://服务器公网IP:3000/api/health     -> Hono API
http://wsbs.wnnw.fun:3000/             -> Vue dist，域名已解析时
http://wsbs.wnnw.fun:3000/api/health    -> Hono API，域名已解析时
```

Hono 可以在 Node.js 入口里托管静态资源和 Vue history fallback，示例见上面的 `server/node/index.js`。

如果使用 Nginx，则可以由 Nginx 托管 `dist/`，并将 `/api/*` 转发到 Node.js，此时访问方式为：

```text
https://wsbs.wnnw.fun/           -> Vue dist
https://wsbs.wnnw.fun/api/*      -> Node.js + Hono API
```

如果前端和 API 分开域名，需要在前端加入环境变量，例如：

```env
VITE_API_BASE_URL=https://api.example.com
```

然后确保请求封装读取该变量。

---

## 9. 构建与部署流程

### 9.1 拉取代码

```bash
cd /var/www
git clone <你的仓库地址> vue-jizhang
cd vue-jizhang
npm install
```

### 9.2 构建前端

```bash
npm run build
```

构建产物位于：

```text
dist/
```

### 9.3 启动后端

假设后续 Hono Node 入口为：

```text
server/node/index.js
```

则启动：

```bash
pm2 start server/node/index.js --name vue-jizhang-api
pm2 save
pm2 startup
```

查看日志：

```bash
pm2 logs vue-jizhang-api
```

重启：

```bash
pm2 restart vue-jizhang-api
```

---

## 10. 可选：Nginx 配置示例

如果你当前不会使用 Nginx，可以先跳过本节，直接使用：

```text
http://服务器公网IP:3000/
http://wsbs.wnnw.fun:3000/
```

后续如果想使用 `https://wsbs.wnnw.fun/`、去掉 `:3000` 端口、使用 `80/443`，再回头配置 Nginx。

新建配置：

```bash
sudo nano /etc/nginx/sites-available/vue-jizhang
```

示例内容：

```nginx
server {
    listen 80;
    server_name wsbs.wnnw.fun;

    root /var/www/vue-jizhang/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/vue-jizhang /etc/nginx/sites-enabled/vue-jizhang
sudo nginx -t
sudo systemctl reload nginx
```

如果使用 HTTPS，建议后续接入 Certbot：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d wsbs.wnnw.fun
```

---

## 11. 上线前验证清单

### 11.1 API 健康检查

```bash
curl http://服务器公网IP:3000/api/health
curl http://wsbs.wnnw.fun:3000/api/health
```

如果后续使用 Nginx 和 HTTPS 域名，则改为：

```bash
curl https://wsbs.wnnw.fun/api/health
```

期望返回：

```json
{
  "success": true,
  "data": {
    "database": "connected"
  }
}
```

### 11.2 登录验证

```bash
curl -X POST http://wsbs.wnnw.fun:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"皖盛布碎","password":"123456"}'
```

### 11.3 业务接口验证

依次检查：

- 客户列表是否正常
- 布料列表是否正常
- 单据列表是否正常
- 新增、编辑、删除是否正常
- 月度统计是否正常
- 多端同步 push / pull 是否正常

### 11.4 数据库连接验证

```bash
mysql -u vue_jizhang -p vue_jizhang -e "SELECT COUNT(*) FROM bills;"
```

---

## 12. 迁移上线建议流程

推荐采用短暂停机迁移：

1. 通知用户维护窗口
2. 暂停旧 D1 环境写入
3. 从 D1 导出最新数据
4. 转换为 MySQL SQL
5. 导入 MySQL
6. 校验表数量和核心业务数据
7. 启动 Node.js + Hono API
8. 根据实际方案切换访问入口：
   - 不用 Nginx：访问 `http://wsbs.wnnw.fun:3000/`
   - 使用 Nginx：访问 `https://wsbs.wnnw.fun/`
9. 验证登录、列表、同步、统计
10. 保留 D1 只读备份一段时间
11. 确认稳定后再下线旧 Cloudflare D1 写入路径

---

## 13. 重要风险与注意事项

### 13.1 时间字段格式

当前 D1 中时间多为 ISO 字符串，例如：

```text
2024-01-01T00:00:00.000Z
```

MySQL schema 中时间字段是：

```sql
DATETIME(3)
```

迁移时需要重点验证 `created_at`、`updated_at`、`deleted_at` 是否能正确导入和比较。尤其是同步接口依赖 `updated_at > since` 判断增量数据。

### 13.2 JSON 字段合法性

MySQL 的 `JSON` 类型要求内容必须是合法 JSON。导入前建议确认 `users.data`、`customers.data`、`fabrics.data`、`bills.data` 均为合法 JSON。

### 13.3 `REPLACE INTO` 语义

当前转换脚本和 repository 的 MySQL upsert 使用 `REPLACE INTO`。MySQL 的 `REPLACE` 是先删除再插入。当前表没有外键时通常可用，但长期建议改为：

```sql
INSERT INTO ... ON DUPLICATE KEY UPDATE ...
```

### 13.4 密码安全

当前初始化用户密码仍是明文演示密码。生产环境建议：

- 改强密码
- 后端存储密码 hash
- 登录接口增加限流
- 使用 HTTPS

### 13.5 备份

上线后建议每天备份 MySQL：

```bash
mysqldump -u vue_jizhang -p vue_jizhang > backup-$(date +%F).sql
```

可配合 crontab 定时执行，并将备份同步到对象存储。

---

## 14. 推荐后续实施顺序

1. 新增 Hono 的 Node.js 启动入口 `server/node/index.js`
2. 新增 MySQL 连接池 `server/node/mysql.js`
3. 安装 `@hono/node-server`、`mysql2`、`dotenv`
4. 保留并复用现有 `functions/hono/routes/*` 路由
5. 本地连接 MySQL 跑通 `/api/health`
6. 跑通登录和基础 CRUD
7. 跑通同步接口
8. 导入 D1 测试数据
9. 阿里云服务器部署 Node.js + Hono + MySQL
10. 不使用 Nginx 时，先通过 `http://wsbs.wnnw.fun:3000/` 验证
11. 后续需要 HTTPS 和不带端口访问时，再配置 Nginx 到 `https://wsbs.wnnw.fun/`
12. 执行正式 D1 到 MySQL 数据迁移
13. 切换线上流量

---

## 15. 当前项目可复用文件

迁移时优先复用这些文件：

```text
server/db/db.js
server/db/entity-configs.js
server/db/entity-repository.js
server/db/sync-repository.js
migrations/mysql_schema.sql
scripts/convert-d1-sql-to-mysql.js
```

需要新增或改造这些文件：

```text
server/node/index.js
server/node/mysql.js
functions/_middleware.js
wrangler.toml
```

`functions/hono/app.js`、`functions/hono/routes/*.js`、`functions/hono/helpers/http.js` 建议继续保留并复用。

其中 `wrangler.toml` 是 Cloudflare D1 部署配置，迁移到云服务器后不再作为生产部署核心配置，只保留为旧环境参考。
