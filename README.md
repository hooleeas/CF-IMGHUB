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

The Compose file in this repository runs the application on port `7654` and persists its data in `./data`:

```bash
docker compose up -d
```

Open [http://localhost:7654](http://localhost:7654) after the container starts.

The Compose file uses `ghcr.io/hooleeas/cf-imghub:latest`. GitHub Actions publishes a development image from pushes to `main`. To publish a versioned release, push a semantic version tag such as `v2.7.5`; the workflow publishes `2.7.5`, `2.7`, `2`, and `latest` tags for that release. If the package is private, make it public in GitHub Packages before pulling it anonymously.

To inspect logs or stop the service:

```bash
docker compose logs -f
docker compose down
```

## Cloudflare deployment

### Cloudflare Pages

Deploy this repository as a Cloudflare Pages project. Set the build output directory to `frontend-dist` and configure the required bindings and environment variables in the Cloudflare dashboard.

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
