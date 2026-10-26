# cf-imghub

**cf-imghub** is a file and image hosting application maintained by [hooleeas](https://github.com/hooleeas). It supports Docker and Cloudflare deployments, with multiple storage providers and a web-based administration panel.

[简体中文](./README_zh.md)

## Features

- Upload, browse, manage, and share files through a web interface and API.
- Use storage providers including Telegram, Discord, Cloudflare R2, S3, Hugging Face, and WebDAV.
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

Connect this repository to Cloudflare Pages. Use `None` as the framework preset, leave the build command empty, and set the build output directory to `frontend-dist`. In Pages → Settings → Functions → Bindings, configure the `KV` and `R2` bindings using the names expected by the code, and add the required environment variables. Pages will deploy automatically after pushes to the production branch.

### Cloudflare Workers

The Worker configuration is in [`deploy/worker/wrangler.toml`](./deploy/worker/wrangler.toml). Configure the required storage bindings (D1 or KV, and optionally R2) before deploying. The project also includes a GitHub Actions workflow for Worker deployments; see [`.github/workflows/deploy-worker.yml`](./.github/workflows/deploy-worker.yml) for its required secrets and behavior.

## Local development

Requirements: Node.js 22 or later and npm.

```bash
npm ci
npm start
```

The local Pages development server is available at [http://localhost:8080](http://localhost:8080). Local KV and R2 data is stored under `./data`.

Run the test suite with:

```bash
npm test
```

## License

See [`LICENSE`](./LICENSE).
