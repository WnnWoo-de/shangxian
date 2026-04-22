# vue-jizhang

一个基于 `Vue 3 + Vite + Pinia + Vue Router` 的记账/结算系统。

## 本地开发

```sh
npm install
npm run dev
```

## 生产构建

```sh
npm run build
```

## Cloudflare Pages + Functions + D1 落地说明

项目已内置：
- `functions/api/*`：Pages Functions API
- `migrations/0001_init.sql`：D1 初始化脚本
- `wrangler.toml`：D1 绑定配置模板

### 1. 创建 D1 数据库

```sh
npx wrangler d1 create ws-wnnw-db
```

将命令输出里的 `database_id` 填入 `wrangler.toml` 的 `database_id`。

### 2. 执行数据库迁移

```sh
npx wrangler d1 migrations apply ws-wnnw-db --remote
```

### 3. 在 Cloudflare Pages 绑定 D1

进入 Pages 项目 `ws-wnnw`：
- Settings -> Functions -> D1 database bindings
- Binding 名称填写：`DB`
- 绑定数据库：`ws-wnnw-db`

### 4. GitHub Actions 自动部署

仓库已添加工作流文件：`.github/workflows/deploy-cloudflare-pages.yml`。

当代码推送到 `main` 分支时，会自动：
1. 安装依赖
2. 执行 `npm run build`
3. 将 `dist` 部署到 Cloudflare Pages

### 5. 需要在 GitHub 仓库配置

进入 `Settings -> Secrets and variables -> Actions`。

Secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Variables:
- 当前 workflow 固定项目名 `ws-wnnw`，无需额外变量。

## 测试

```sh
npm run test:unit
```
