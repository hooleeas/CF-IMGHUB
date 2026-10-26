# cf-imghub

**cf-imghub** 是由 [hooleeas](https://github.com/hooleeas) 维护的文件与图像托管应用，支持 Docker 和 Cloudflare 部署，提供多种存储渠道及网页管理面板。

[English](./README.md)

## 功能特性

- 通过网页界面和 API 上传、浏览、管理及分享文件。
- 支持 Telegram、Discord、Cloudflare R2、S3、Hugging Face 和 WebDAV 等存储渠道。
- 使用 KV 或 D1 保存应用配置、图片路径和元数据，与图片文件存储相互独立。
- 可在管理面板中配置访问控制和站点设置。
- 支持 Docker、Cloudflare Pages 和 Cloudflare Workers 部署。

功能说明和详细部署指南请参阅[项目文档](https://cfbed.sanyue.de)。

## Docker 部署

### 直接运行 Docker 镜像

运行当前镜像：

```bash
docker run -d --name cf-imghub --restart=always \
  -p 7654:8080 \
  -v "$(pwd)/data:/app/data" \
  ghcr.io/hooleeas/cf-imghub:latest
```

检查服务：

```bash
curl http://localhost:7654/
```

### Docker Compose

Compose 配置使用 `7654` 端口，并将数据持久化到 `./data`：

```yaml
services:
  cf-imghub:
    image: ghcr.io/hooleeas/cf-imghub:latest
    container_name: cf-imghub
    ports:
      - "7654:8080"
    volumes:
      - ./data:/app/data
    restart: always
```

保存为 `docker-compose.yml` 后运行：

```bash
docker compose up -d
```

容器启动后访问 [http://localhost:7654](http://localhost:7654)。

这里的 `7654` 是宿主机端口，容器内部端口固定为 `8080`；如需更换访问端口，只需修改左侧端口。

Compose 配置使用镜像 `ghcr.io/hooleeas/cf-imghub:latest`。推送到 `main` 分支时，GitHub Actions 会构建并发布开发镜像。发布正式版本时，推送语义化版本标签（例如 `v2.7.5`），工作流会为该版本发布 `2.7.5`、`2.7`、`2` 和 `latest` 标签。如果软件包是私有的，请先在 GitHub Packages 中将其设为公开，方便匿名拉取。

查看日志或停止服务：

```bash
docker compose logs -f
docker compose down
```

## Cloudflare 部署

### Cloudflare Pages

将本仓库连接到 Cloudflare Pages。构建设置为：框架选择 `None`，构建命令填写 `npm ci --omit=dev --omit=optional`，构建输出目录填写 `frontend-dist`。前端静态文件已包含在仓库中；构建命令用于安装 Pages Functions 所需的运行时依赖。若构建命令留空，Functions 打包时会因找不到 npm 依赖而失败。在 Pages 项目的 Settings → Functions → Bindings 中至少配置一个元数据数据库绑定（`KV` 或 `D1`），并配置至少一个图片存储渠道所需的绑定和凭据。KV/D1 用于保存应用配置、图片路径和元数据；R2、Telegram、S3、Discord、Hugging Face、WebDAV 等图片渠道用于存放实际图片文件。只有选择 R2 作为图片渠道时才需要绑定 R2 存储桶。还需配置所选渠道要求的环境变量。每次推送到生产分支后，Pages 会自动重新部署。

D1 数据表会在首次使用时自动创建，无需手动执行 SQL。KV 和 D1 同时绑定时，首次默认使用 KV；可在“备份与迁移 → 更改存储”中自动复制并核对数据后切换。核对通过后，原数据库会自动清空。R2 或其他渠道中的图片文件不会移动。

### Cloudflare Workers

Worker 配置文件位于 [`deploy/worker/wrangler.toml`](./deploy/worker/wrangler.toml)。部署前至少配置一个元数据数据库绑定（`D1` 或 `KV`）和一个图片存储渠道。数据库用于保存应用配置、图片路径和元数据；R2、Telegram、S3、Discord、Hugging Face、WebDAV 等渠道用于存放图片文件。只有选择 R2 作为图片渠道时才需要绑定 R2 存储桶，并配置所选渠道要求的凭据。项目也提供 GitHub Actions 自动部署工作流，所需 Secrets 和工作方式请参阅 [`.github/workflows/deploy-worker.yml`](./.github/workflows/deploy-worker.yml)。

## 本地开发

需要 Node.js 22 或更新版本以及 npm。

```bash
npm ci
npm start
```

本地 Pages 开发服务器地址为 [http://localhost:8080](http://localhost:8080)。本地数据库和图片文件保存在 `./data` 目录。

运行测试：

```bash
npm test
```

## 许可证

请参阅 [`LICENSE`](./LICENSE)。
