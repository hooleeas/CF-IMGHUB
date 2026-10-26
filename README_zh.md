# cf-imghub

**cf-imghub** 是由 [hooleeas](https://github.com/hooleeas) 维护的文件与图像托管应用，支持 Docker 和 Cloudflare 部署，提供多种存储渠道及网页管理面板。

[English](./README.md)

## 功能特性

- 通过网页界面和 API 上传、浏览、管理及分享文件。
- 支持 Telegram、Discord、Cloudflare R2、S3、Hugging Face 和 WebDAV 等存储渠道。
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

将本仓库连接到 Cloudflare Pages。构建设置建议为：框架选择 `None`，构建命令留空，构建输出目录填写 `frontend-dist`。在 Pages 项目的 Settings → Functions → Bindings 中按代码名称配置 `KV` 和 `R2` 绑定，并在 Environment variables 中配置所需变量。每次推送到生产分支后，Pages 会自动重新部署。

### Cloudflare Workers

Worker 配置文件位于 [`deploy/worker/wrangler.toml`](./deploy/worker/wrangler.toml)。部署前请配置所需的存储绑定（D1 或 KV，可选 R2）。项目也提供 GitHub Actions 自动部署工作流，所需 Secrets 和工作方式请参阅 [`.github/workflows/deploy-worker.yml`](./.github/workflows/deploy-worker.yml)。

## 本地开发

需要 Node.js 22 或更新版本以及 npm。

```bash
npm ci
npm start
```

本地 Pages 开发服务器地址为 [http://localhost:8080](http://localhost:8080)。本地 KV 和 R2 数据保存在 `./data` 目录。

运行测试：

```bash
npm test
```

## 许可证

请参阅 [`LICENSE`](./LICENSE)。
