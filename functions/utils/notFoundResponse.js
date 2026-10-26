export function notFoundResponse(request) {
    const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>页面不存在 · Page not found · cf-imghub</title>
  <style>
    * { box-sizing: border-box; }
    body {
      min-height: 100vh;
      margin: 0;
      padding: 32px 20px;
      display: grid;
      place-items: center;
      color: #17251e;
      background-color: #f5f8f4;
      background-image: linear-gradient(#dfe9df 1px, transparent 1px), linear-gradient(90deg, #dfe9df 1px, transparent 1px);
      background-position: center center;
      background-size: 44px 44px;
      font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main { width: min(100%, 620px); text-align: center; animation: arrive 500ms ease-out both; }
    .mark { margin: 0; color: #143c2b; font: 700 136px/0.95 Georgia, "Times New Roman", serif; }
    .mark span { color: #2d8a58; }
    .eyebrow { margin: 28px 0 8px; color: #397252; font-size: 12px; font-weight: 700; letter-spacing: 2px; }
    h1 { margin: 0; font-size: 30px; line-height: 1.25; }
    .english { margin: 8px 0 0; color: #617068; font-size: 17px; }
    .home { min-height: 50px; margin-top: 30px; padding: 0 24px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 4px; color: #fff; background: #17623d; font: inherit; font-weight: 650; text-decoration: none; transition: background-color 160ms ease, transform 160ms ease; }
    .home:hover { background: #104c2f; transform: translateY(-2px); }
    .home:focus-visible { outline: 3px solid #75b994; outline-offset: 4px; }
    @keyframes arrive { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @media (max-width: 520px) { .mark { font-size: 96px; } h1 { font-size: 25px; } }
    @media (prefers-reduced-motion: reduce) { main { animation: none; } .home { transition: none; } }
  </style>
</head>
<body>
  <main>
    <p class="mark" aria-label="404">4<span>0</span>4</p>
    <p class="eyebrow">CF-IMGHUB · 404</p>
    <h1>页面不存在</h1>
    <p class="english" lang="en">The page you are looking for could not be found.</p>
    <a class="home" href="/">返回主页 <span lang="en">&nbsp;·&nbsp; Back to home</span></a>
  </main>
</body>
</html>`;

    return new Response(request.method === 'HEAD' ? null : html, {
        status: 404,
        headers: {
            'Cache-Control': 'no-store',
            'Content-Type': 'text/html; charset=utf-8',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}