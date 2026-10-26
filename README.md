# cf-imghub

**cf-imghub** is a file and image hosting application maintained by [hooleeas](https://github.com/hooleeas). It supports Docker and Cloudflare deployments, with multiple storage providers and a web-based administration panel.

[简体中文](./README_zh.md)

## Features

- Upload, browse, manage, and share files through a web interface and API.
- Use storage providers including Telegram, Discord, Cloudflare R2, S3, Hugging Face, and WebDAV.
- Store application configuration and image metadata in KV or D1, separately from image files.
- Configure access control and site settings from the administration panel.
- Deploy with Docker, Cloudflare Pages, or Cloudflare Workers.

For detailed feature and deployment guides, see the [project documentation](https://cfbed.sanyue.de).

## Docker

### Run the Docker image directly

Run the current image:

```bash
docker run -d --name cf-imghub --restart=always \
  -p 7654:8080 \
  -v "$(pwd)/data:/app/data" \
  ghcr.io/hooleeas/cf-imghub:latest
```

Check the service:

```bash
curl http://localhost:7654/
```

### Docker Compose

The Compose setup uses host port `7654` and persists data in `./data`:

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

Save it as `docker-compose.yml`, then run:

```bash
docker compose up -d
```

Open [http://localhost:7654](http://localhost:7654) after the container starts.

`7654` is the host port and `8080` is the fixed container port. To use another host port, change only the left side of `-p`.

The Compose file uses `ghcr.io/hooleeas/cf-imghub:latest`. GitHub Actions publishes a development image from pushes to `main`. To publish a versioned release, push a semantic version tag such as `v2.7.5`; the workflow publishes `2.7.5`, `2.7`, `2`, and `latest` tags for that release. If the package is private, make it public in GitHub Packages before pulling it anonymously.

To inspect logs or stop the service:

```bash
docker compose logs -f
docker compose down
```

## Cloudflare deployment

### Cloudflare Pages

Connect this repository to Cloudflare Pages with these build settings:

- **Framework preset:**

  ```text
  None
  ```
- **Build command:**

  ```sh
  npm ci --omit=dev --omit=optional
  ```

- **Build output directory:**

  ```text
  frontend-dist
  ```

The frontend assets are already included in the repository; the build command installs the runtime dependencies required to bundle Pages Functions. Leaving the build command empty causes Functions bundling to fail because npm dependencies are unavailable. In Pages → Settings → Functions → Bindings, configure at least one metadata database binding (`KV` or `D1`) and configure the credentials and bindings for at least one image storage provider. KV/D1 store application configuration, image paths, and metadata; image providers such as R2, Telegram, S3, Discord, Hugging Face, and WebDAV store the actual image files. R2 is required only when you choose R2 as your image provider. Add the environment variables required by the selected provider. Pages deploys automatically after pushes to the production branch.

D1 tables are created automatically on first use. When both KV and D1 are bound, KV is selected initially; use **Backup & Migration → Change storage** to copy and verify metadata before switching. After verification, the old database is cleared automatically. Image files in R2 or other providers are not moved.

### Cloudflare Workers

The Worker configuration is in [`deploy/worker/wrangler.toml`](./deploy/worker/wrangler.toml). Before deploying, configure one metadata database binding (`D1` or `KV`) and at least one image storage provider. The database stores configuration, image paths, and metadata; providers such as R2, Telegram, S3, Discord, Hugging Face, and WebDAV store image files. Bind an R2 bucket only if you use R2 as an image provider, and configure the selected provider's required credentials. The project also includes a GitHub Actions workflow for Worker deployments; see [`.github/workflows/deploy-worker.yml`](./.github/workflows/deploy-worker.yml) for its required secrets and behavior.

## Local development

Requirements: Node.js 22 or later and npm.

```bash
npm ci
npm start
```

The local Pages development server is available at [http://localhost:8080](http://localhost:8080). Local database and image files are stored under `./data`.

Run the test suite with:

```bash
npm test
```

## License

See [`LICENSE`](./LICENSE).
