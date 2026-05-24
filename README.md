# site-nav

网站收录导航与投稿审核站 - Next.js + MySQL + VPS 部署

## 开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## 数据库初始化

```bash
npm run db:init
```

首次全量导入会自动：

```text
schema push -> 生成 SQL 分块 -> 应用 SQL 分块 -> 初始化管理员（如配置）
```

## 数据更新

```bash
npm run db:build-sql
npm run db:seed
```

`npm run data:import` 为兼容入口，当前等同于 `db:seed` 的 SQL chunk 应用流程。

## 部署

部署到 VPS 上的 Node.js 进程，由 Nginx 反代到 `next start`。
