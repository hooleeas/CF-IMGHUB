# cf-imghub

**cf-imghub** 是由 [hooleeas](https://github.com/hooleeas) 维护的文件与图像托管应用，支持 Docker 和 Cloudflare 部署，提供多种存储渠道及网页管理面板。

[English](./README.md)

## 功能特性

- 通过网页界面和 API 上传、浏览、管理及分享文件。
- 支持 Telegram、Discord、Cloudflare R2、S3、Hugging Face 和 WebDAV 等存储渠道。
- 使用 KV 或 D1 保存应用配置、图片路径和元数据，与图片文件存储相互独立。
- 可在管理面板中配置访问控制和站点设置。
- 支持 Docker 和 Cloudflare Pages 部署。

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

1. Fork 本仓库，在 Cloudflare Pages 中连接你的 Fork。
2. 填写构建设置：
   - **框架预设：**

     ```text
     None
     ```
   - **构建命令：**

     ```sh
     npm ci --omit=dev --omit=optional
     ```
   - **构建输出目录：**

     ```text
     frontend-dist
     ```

3. 绑定一个元数据数据库：选择 KV 或 D1，绑定名称必须分别为 `KV` 或 `D1`。
4. 在管理面板添加图片存储渠道。若选择 R2，还需绑定 R2 存储桶，绑定名称必须为 `R2`；其他渠道按页面提示配置。
5. 推送到生产分支后，Cloudflare Pages 会自动部署。

D1 数据表会在首次使用时自动创建，无需手动执行 SQL。KV 和 D1 同时绑定时，首次默认使用 KV；可在“备份与迁移 → 更改存储”中自动复制并核对数据后切换。核对通过后，原数据库会自动清空。R2 或其他渠道中的图片文件不会移动。

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
