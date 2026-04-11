# vue-jizhang

一个基于 `Vue 3 + Vite + Pinia + Vue Router` 的记账/结算前端项目。

## 本地开发

```sh
npm install
npm run dev
```

## 生产构建

```sh
npm run build
```

## GitHub Actions 自动部署到 Cloudflare Pages

仓库已添加工作流文件：`.github/workflows/deploy-cloudflare-pages.yml`。

当代码推送到 `main` 分支时，会自动：

1. 安装依赖
2. 执行 `npm run build`
3. 将 `dist` 目录部署到 Cloudflare Pages

### 需要在 GitHub 仓库中配置

进入 GitHub 仓库 `Settings -> Secrets and variables -> Actions`，添加以下内容：

#### Secrets

- `CLOUDFLARE_API_TOKEN`
  - Cloudflare API Token
  - 需要至少具备 Cloudflare Pages 部署相关权限
- `CLOUDFLARE_ACCOUNT_ID`
  - 你的 Cloudflare Account ID

#### Variables

当前工作流已写死 Cloudflare Pages 项目名为 `ws-wnnw`，因此**不需要**再额外配置 `CLOUDFLARE_PAGES_PROJECT`。

### Cloudflare Pages 项目建议

在 Cloudflare Pages 先创建一个项目，后续由 GitHub Actions 负责部署。

建议构建配置：

- Framework preset：`Vue`
- Build command：`npm run build`
- Build output directory：`dist`

## 测试

```sh
npm run test:unit
```
