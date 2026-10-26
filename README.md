# cf-imghub

**cf-imghub** is a file and image hosting application maintained by [hooleeas](https://github.com/hooleeas). It supports Docker and Cloudflare deployments, with multiple storage providers and a web-based administration panel.

[简体中文](./README_zh.md)

## Features

- Upload, browse, manage, and share files through a web interface and API.
- Use storage providers including Telegram, Discord, Cloudflare R2, S3, Hugging Face, and WebDAV.
- Store application configuration and image metadata in KV or D1, separately from image files.
- Configure access control and site settings from the administration panel.
- Deploy with Docker or Cloudflare Pages.

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

1. Fork this repository and connect your fork to Cloudflare Pages.
2. Enter these build settings:
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

3. Bind one metadata database: choose KV or D1. The binding name must be `KV` or `D1`, respectively.
4. Add an image storage provider in the admin panel. If you choose R2, bind the bucket with the name `R2`; configure other providers as prompted.
5. Push to the production branch. Cloudflare Pages deploys automatically.

D1 tables are created automatically on first use. When both KV and D1 are bound, KV is selected initially; use **Backup & Migration → Change storage** to copy and verify metadata before switching. After verification, the old database is cleared automatically. Image files in R2 or other providers are not moved.

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
