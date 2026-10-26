import { getSiteConfig } from './utils/siteConfig.js';
import { checkDatabaseConfig } from './utils/databaseAdapter.js';
import { notFoundResponse } from './utils/notFoundResponse.js';
import { isHiddenLegacyAdminPath } from './utils/adminPathRouting.js';

function missingDatabaseResponse(request) {
    const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>需要配置存储 · cf-imghub</title>
  <style>
    :root { color-scheme: light dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { box-sizing: border-box; min-height: 100vh; margin: 0; padding: 24px; display: grid; place-items: center; background: #111315; color: #f3f4f6; }
    main { width: min(100%, 640px); padding: clamp(24px, 6vw, 40px); border: 1px solid #383b40; border-radius: 20px; background: #1d2024; box-shadow: 0 20px 60px #0005; }
    h1 { margin: 0 0 12px; font-size: clamp(24px, 5vw, 32px); }
    p, li { color: #c2c8d0; line-height: 1.7; }
    ol { padding-left: 24px; }
    code { padding: 2px 6px; border-radius: 6px; background: #101215; color: #a7f3d0; }
    .en { margin-top: 28px; padding-top: 22px; border-top: 1px solid #383b40; }
    @media (prefers-color-scheme: light) {
      body { background: #f3f4f6; color: #202124; }
      main { background: #fff; border-color: #dfe3e8; }
      p, li { color: #596579; }
      code { background: #f1f5f9; color: #047857; }
      .en { border-color: #e5e7eb; }
    }
  </style>
</head>
<body>
  <main>
    <h1>尚未配置数据库</h1>
    <p>cf-imghub 需要 Cloudflare KV 或 D1 才能运行。当前部署没有检测到可用的数据库绑定，因此暂时无法显示应用。</p>
    <ol>
      <li>打开 Cloudflare 控制台中的 Workers 和 Pages 项目设置。</li>
      <li>进入 <strong>Settings → Functions → Bindings</strong>，添加 KV 命名空间，变量名称填写 <code>KV</code>；或添加 D1 数据库，变量名称填写 <code>D1</code>。</li>
      <li>保存绑定并重新部署。</li>
    </ol>
    <section class="en" lang="en">
      <h1>Database not configured</h1>
      <p>cf-imghub requires a Cloudflare KV namespace or D1 database. No usable database binding was found, so the application cannot load yet.</p>
      <ol>
        <li>Open your project settings in the Cloudflare dashboard.</li>
        <li>Go to <strong>Settings → Functions → Bindings</strong>. Add a KV namespace with the variable name <code>KV</code>, or a D1 database with the variable name <code>D1</code>.</li>
        <li>Save the binding and redeploy.</li>
      </ol>
    </section>
  </main>
</body>
</html>`;

    return new Response(request.method === 'HEAD' ? null : html, {
        status: 503,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
}

export async function onRequest(context) {
    const url = new URL(context.request.url);
    const acceptsHtml = context.request.headers.get('Accept')?.includes('text/html');
    if (
        !checkDatabaseConfig(context.env).configured
        && ['GET', 'HEAD'].includes(context.request.method)
        && acceptsHtml
    ) {
        return missingDatabaseResponse(context.request);
    }

    const isLegacyLoginPath = url.pathname === '/adminLogin' || url.pathname === '/adminLogin/';
    const isLegacyAdminPath = url.pathname === '/admin' || url.pathname === '/admin/';
    const isBrowserNavigation = ['GET', 'HEAD'].includes(context.request.method)
        && acceptsHtml
        && !url.pathname.split('/').at(-1)?.includes('.');

    if (isLegacyLoginPath) return notFoundResponse(context.request);
    if (!isLegacyAdminPath && !isBrowserNavigation) return context.next();

    const { adminPath } = await getSiteConfig(context.env);
    if (isHiddenLegacyAdminPath(url.pathname, adminPath)) return notFoundResponse(context.request);

    if (!isBrowserNavigation) return context.next();

    if (/^\/(api|file|dav|upload)(\/|$)/.test(url.pathname) || url.pathname === '/random') {
        return context.next();
    }

    const normalizedPath = url.pathname.replace(/\/$/, '') || '/';
    const isKnownPage = normalizedPath === '/'
        || normalizedPath === '/customerConfig'
        || normalizedPath === '/blockimg'
        || normalizedPath === '/whiteliston'
        || normalizedPath === '/admin'
        || normalizedPath === adminPath
        || normalizedPath === '/browse'
        || normalizedPath.startsWith('/browse/');
    if (!isKnownPage) return notFoundResponse(context.request);

    return context.next();
}
