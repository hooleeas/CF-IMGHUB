(() => {
  'use strict';

  const INITIALIZING_TEXT = localStorage.getItem('app-locale') === 'en' ? 'Loading admin panel…' : '正在加载管理面板…';
  const ROOT = document.getElementById('app');
  ROOT.innerHTML = `<main class="standalone-initializing" role="status" aria-live="polite"><span class="standalone-initializing-spinner" aria-hidden="true"></span><p>${INITIALIZING_TEXT}</p></main>`;
  const TYPES = [
    ['telegram', 'Telegram'], ['cfr2', 'Cloudflare R2'], ['s3', 'S3'],
    ['discord', 'Discord'], ['huggingface', 'HuggingFace'], ['webdav', 'WebDAV'],
  ];
  const CHANNEL_ICONS = {
    telegram: '<svg viewBox="0 0 1024 1024" aria-hidden="true"><path fill="#229ed9" d="M417.28 795.733333 429.226667 615.253333 756.906667 320C771.413333 306.773333 753.92 300.373333 734.72 311.893333L330.24 567.466667 155.306667 512C117.76 501.333333 117.333333 475.306667 163.84 456.533333L845.226667 193.706667C876.373333 179.626667 906.24 201.386667 894.293333 249.173333L778.24 795.733333C770.133333 834.56 746.666667 843.946667 714.24 826.026667L537.6 695.466667 452.693333 777.813333C442.88 787.626667 434.773333 795.733333 417.28 795.733333Z"/></svg>',
    cfr2: '<svg viewBox="0 0 640 512" aria-hidden="true"><path fill="#f38020" d="M407.9 319.9L177.1 317c-.7 0-1.4-.2-2-.5s-1.2-.8-1.6-1.4c-.4-.6-.7-1.3-.7-2s0-1.4 .2-2.1c.4-1.1 1.1-2.1 2.1-2.8s2.1-1.2 3.3-1.2l232.9-2.9c27.6-1.3 57.5-23.6 68-50.8l13.3-34.5c.4-.9 .5-1.9 .5-2.9 0-.5-.1-1.1-.2-1.6-7.4-32.2-25-61.1-50.3-82.3s-56.7-33.7-89.7-35.5-65.6 7.3-93 25.7-48 45.3-58.8 76.5c-11.3-8.5-24.9-13.3-39-13.7s-28 3.5-39.8 11.4-20.8 19.1-25.9 32.3-5.9 27.6-2.4 41.3c-52.3 1.5-94.2 44.1-94.2 96.5 0 4.7 .3 9.3 1 14 .2 1.1 .7 2.1 1.5 2.8s1.9 1.1 2.9 1.1l426.1 .1c0 0 .1 0 .1 0 1.2 0 2.3-.4 3.3-1.1s1.6-1.7 2-2.9l3.3-11.3c3.9-13.4 2.4-25.8-4.1-34.9-6-8.4-16.1-13.3-28.2-13.9zm105.9-98.8c-2.1 0-4.3 .1-6.4 .2-.8 .1-1.5 .3-2.1 .8s-1 1.1-1.3 1.8l-9.1 31.2c-3.9 13.4-2.4 25.8 4.1 34.9 6 8.4 16.1 13.3 28.2 13.9l49.2 2.9c.7 0 1.4 .2 2 .5s1.1 .8 1.5 1.4c.4 .6 .7 1.3 .8 2s0 1.5-.2 2.1c-.4 1.1-1.1 2.1-2.1 2.8s-2.1 1.2-3.3 1.2l-51.1 2.9c-27.8 1.3-57.7 23.6-68.1 50.8l-3.7 9.6c-.2 .4-.2 .8-.2 1.3s.2 .8 .4 1.2 .6 .7 .9 .9 .8 .3 1.2 .3c0 0 .1 0 .1 0l175.9 0c1 0 2-.3 2.8-.9s1.4-1.5 1.7-2.4c3.1-11.1 4.7-22.5 4.7-34 0-69.3-56.5-125.5-126.1-125.5z"/></svg>',
    s3: '<svg viewBox="0 0 640 512" aria-hidden="true"><path fill="#ff9900" d="M180.4 203c-.7 22.6 10.6 32.7 10.9 39-.1 1.3-.6 2.5-1.3 3.6s-1.7 2-2.8 2.6l-12.8 9c-1.7 1.2-3.6 1.8-5.6 1.9-.4 0-8.2 1.8-20.5-25.6-7.5 9.4-17 16.9-27.9 22s-22.7 7.7-34.7 7.5c-16.3 .9-60.4-9.2-58.1-56.2-1.6-38.3 34.1-62.1 70.9-60 7.1 0 21.6 .4 47 6.3l0-15.6c2.7-26.5-14.7-47-44.8-43.9-2.4 0-19.4-.5-45.8 10.1-7.4 3.4-8.3 2.8-10.8 2.8-7.4 0-4.4-21.5-2.9-24.2 5.2-6.4 35.9-18.4 65.9-18.2 20.1-1.8 40.1 4.4 55.7 17.3 6.3 7.1 11.2 15.4 14.2 24.4s4.2 18.5 3.5 28l0 69.3zM94 235.4c32.4-.5 46.2-20 49.3-30.5 2.5-10.1 2.1-16.4 2.1-27.4-9.7-2.3-23.6-4.9-39.6-4.9-15.2-1.1-42.8 5.6-41.7 32.3-1.2 16.8 11.1 31.4 30 30.5zm170.9 23.1c-7.9 .7-11.5-4.9-12.7-10.4L202.4 83.4c-1-2.8-1.6-5.6-1.9-8.6-.2-1.2 .1-2.4 .8-3.4s1.8-1.6 3-1.8c.2 0-2.1 0 22.2 0 8.8-.9 11.6 6 12.6 10.4L274.9 220.8 308.1 80c.5-3.2 2.9-11.1 12.8-10.2l17.2 0c2.2-.2 11.1-.5 12.7 10.4L384.1 222.7 421 80.1c.5-2.2 2.7-11.4 12.7-10.4l19.7 0c.9-.1 6.2-.8 5.3 8.6-.4 1.8 3.4-10.7-52.8 169.9-1.1 5.5-4.8 11.1-12.7 10.4l-18.7 0c-10.9 1.2-12.5-9.7-12.7-10.7l-33.2-137.1-32.8 137c-.2 1.1-1.7 11.9-12.7 10.7l-18.3 0 0 0zm273.5 5.6c-5.9 0-33.9-.3-57.4-12.3-2.3-1-4.3-2.6-5.7-4.8s-2.1-4.6-2.1-7.1l0-10.7c0-8.5 6.2-6.9 8.8-5.9 10 4.1 16.5 7.1 28.8 9.6 36.7 7.5 52.8-2.3 56.7-4.5 13.2-7.8 14.2-25.7 5.3-34.9-10.5-8.8-15.5-9.1-53.1-21-4.6-1.3-43.7-13.6-43.8-52.4-.6-28.2 25-56.2 69.5-56 12.7 0 46.4 4.1 55.6 15.6 1.4 2.1 2 4.6 1.9 7l0 10.1c0 4.4-1.6 6.7-4.9 6.7-7.7-.9-21.4-11.2-49.2-10.8-6.9-.4-39.9 .9-38.4 25-.4 19 26.6 26.1 29.7 26.9 36.5 11 48.6 12.8 63.1 29.6 17.1 22.2 7.9 48.3 4.3 55.4-19.1 37.5-68.4 34.4-69.3 34.4zm40.2 104.9c-70 51.7-171.7 79.2-258.5 79.2-117.1 .8-230.3-42.3-317.3-120.7-6.5-5.9-.8-14 7.2-9.5 96.5 55.2 205.7 84.2 316.9 84.1 83-.4 165.1-17.3 241.6-49.5 11.8-5 21.8 7.8 10.1 16.4zm29.2-33.3c-9-11.5-59.3-5.4-81.8-2.7-6.8 .8-7.9-5.1-1.8-9.5 40.1-28.2 105.9-20.1 113.4-10.6 7.5 9.5-2.1 75.4-39.6 106.9-5.8 4.9-11.3 2.3-8.7-4.1 8.4-21.3 27.4-68.5 18.4-80z"/></svg>',
    discord: '<svg viewBox="0 0 576 512" aria-hidden="true"><path fill="#5865f2" d="M492.5 69.8c-.2-.3-.4-.6-.8-.7-38.1-17.5-78.4-30-119.7-37.1-.4-.1-.8 0-1.1 .1s-.6 .4-.8 .8c-5.5 9.9-10.5 20.2-14.9 30.6-44.6-6.8-89.9-6.8-134.4 0-4.5-10.5-9.5-20.7-15.1-30.6-.2-.3-.5-.6-.8-.8s-.7-.2-1.1-.2c-41.3 7.1-81.6 19.6-119.7 37.1-.3 .1-.6 .4-.8 .7-76.2 113.8-97.1 224.9-86.9 334.5 0 .3 .1 .5 .2 .8s.3 .4 .5 .6c44.4 32.9 94 58 146.8 74.2 .4 .1 .8 .1 1.1 0s.7-.4 .9-.7c11.3-15.4 21.4-31.8 30-48.8 .1-.2 .2-.5 .2-.8s0-.5-.1-.8-.2-.5-.4-.6-.4-.3-.7-.4c-15.8-6.1-31.2-13.4-45.9-21.9-.3-.2-.5-.4-.7-.6s-.3-.6-.3-.9 0-.6 .2-.9 .3-.5 .6-.7c3.1-2.3 6.2-4.7 9.1-7.1 .3-.2 .6-.4 .9-.4s.7 0 1 .1c96.2 43.9 200.4 43.9 295.5 0 .3-.1 .7-.2 1-.2s.7 .2 .9 .4c2.9 2.4 6 4.9 9.1 7.2 .2 .2 .4 .4 .6 .7s.2 .6 .2 .9-.1 .6-.3 .9-.4 .5-.6 .6c-14.7 8.6-30 15.9-45.9 21.8-.2 .1-.5 .2-.7 .4s-.3 .4-.4 .7-.1 .5-.1 .8 .1 .5 .2 .8c8.8 17 18.8 33.3 30 48.8 .2 .3 .6 .6 .9 .7s.8 .1 1.1 0c52.9-16.2 102.6-41.3 147.1-74.2 .2-.2 .4-.4 .5-.6s.2-.5 .2-.8c12.3-126.8-20.5-236.9-86.9-334.5zm-302 267.7c-29 0-52.8-26.6-52.8-59.2s23.4-59.2 52.8-59.2c29.7 0 53.3 26.8 52.8 59.2 0 32.7-23.4 59.2-52.8 59.2zm195.4 0c-29 0-52.8-26.6-52.8-59.2s23.4-59.2 52.8-59.2c29.7 0 53.3 26.8 52.8 59.2 0 32.7-23.2 59.2-52.8 59.2z"/></svg>',
    huggingface: '<svg viewBox="0 0 1024 1024" aria-hidden="true"><path fill="#FFD21E" d="M509.0304 870.656c94.6432 0 185.4464-37.3504 252.3904-103.8336a353.28 353.28 0 0 0 104.5504-250.6752 353.28 353.28 0 0 0-104.5504-250.6752 358.1952 358.1952 0 0 0-252.416-103.8336 358.1696 358.1696 0 0 0-252.3904 103.8336 353.28 353.28 0 0 0-104.5504 250.6752 353.28 353.28 0 0 0 104.5504 250.6752 358.1696 358.1696 0 0 0 252.416 103.8336z"/><path fill="#3A3B45" d="M624.9984 419.7376c13.1328 4.5056 18.2784 31.232 31.5136 24.2944a51.2 51.2 0 0 0 21.1456-20.8896 50.688 50.688 0 0 0-5.4272-56.4224 51.3792 51.3792 0 0 0-54.5792-16.5888c-9.728 2.8928-18.3552 8.6016-24.832 16.384a50.8416 50.8416 0 0 0-5.7344 56.3968c6.272 11.7248 26.1888-7.3472 38.016-3.2768l-.1024.1024z m-241.92 0c-13.1328 4.5056-18.3808 31.232-31.5136 24.2944a51.2 51.2 0 0 1-21.1456-20.8896 50.688 50.688 0 0 1 5.4272-56.4224 51.4048 51.4048 0 0 1 54.5792-16.5888c9.728 2.8928 18.3808 8.6016 24.832 16.384a50.8416 50.8416 0 0 1 5.7344 56.3968c-6.272 11.7248-26.2912-7.3472-38.016-3.2768l.1024.1024z"/><path fill="#FF323D" d="M506.4448 664.4736c100.9664 0 133.5296-89.344 133.5296-135.2704 0-23.8592-16.128-16.3072-41.984-3.6608-23.9616 11.7248-56.0896 27.9552-91.4432 27.9552-73.8304 0-133.5296-70.1952-133.5296-24.2944 0 45.9008 32.4608 135.2704 133.5296 135.2704h-.1024z"/></svg>',
    webdav: '<svg viewBox="0 0 1024 1024" aria-hidden="true"><path fill="#2e9b61" d="M446.293333 810.666667C384 898.986667 262.4 921.173333 174.506667 859.733333c-87.466667-61.44-107.946667-183.893333-46.506667-273.066666a195.626667 195.626667 0 0 1 152.746667-84.48l2.133333 61.013333c-38.826667 2.986667-76.373333 23.04-100.693333 58.026667-42.666667 61.44-29.44 144.213333 29.013333 185.6 58.88 40.96 141.226667 25.173333 183.893333-35.84 13.226667-19.2 20.906667-40.106667 23.893334-61.44v-43.093334l238.08-1.706666 2.986666-4.693334c22.613333-39.253333 71.68-52.906667 110.08-30.72a81.066667 81.066667 0 0 1 29.013334 110.933334c-22.613333 38.826667-72.106667 52.48-110.506667 30.293333-17.493333-9.813333-29.866667-25.6-35.413333-43.52l-173.653334 .853333a211.626667 211.626667 0 0 1-33.28 82.773334m310.613334-304.64c107.946667 13.226667 184.746667 110.08 171.52 216.32-13.226667 106.666667-111.36 182.186667-219.306667 168.96a197.504 197.504 0 0 1-146.346667-94.293334l52.906667-30.72a137.386667 137.386667 0 0 0 98.986667 61.866667c74.666667 8.96 140.8-41.813333 149.76-113.066667 8.96-71.253333-43.946667-136.533333-117.76-145.493333-23.04-2.56-45.226667 .426667-65.28 7.68l-36.266667 18.773333-110.08-203.52h-9.386667a81.322667 81.322667 0 0 1-78.933333-83.2c1.28-44.373333 39.68-78.933333 84.48-77.226666 44.8 2.56 80.213333 38.826667 78.933333 83.2-.853333 18.773333-8.106667 35.84-19.626666 49.066666l81.066666 149.76c26.453333-8.533333 55.466667-11.52 85.333334-8.106666M352 389.973333c-42.666667-100.266667 2.56-215.04 101.12-256.853333 98.986667-41.813333 213.333333 5.546667 256 105.813333 25.173333 58.453333 20.053333 122.453333-8.533333 173.653334l-52.906667-30.72c17.92-34.56 20.906667-76.8 3.84-116.48-29.013333-68.266667-106.24-101.12-172.373333-73.386667-66.56 28.16-96.426667 106.666667-67.413334 174.933333 11.946667 28.16 32 49.92 56.32 64.426667l16.64 8.96-130.986666 212.906667c1.28 2.133333 2.986667 4.693333 4.266666 8.106666 20.906667 38.826667 6.4 87.893333-32.853333 108.8-38.826667 20.906667-87.893333 5.546667-109.226667-34.56-20.906667-39.68-6.4-88.746667 32.853334-109.653333 16.64-8.96 34.986667-11.093333 52.48-7.253333l98.56-160.853334c-20.053333-18.346667-37.12-41.386667-47.786667-67.84z"/></svg>'
  };
  const h = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let site = { adminPath: location.pathname, siteName: 'cf-imghub' };
  let channels = {};
  let channelAvailabilityGeneration = 0;
  const channelAvailability = new Map();
  const isEn = () => localStorage.getItem('app-locale') === 'en';
  const tr = (zh, en) => isEn() ? en : zh;
  const toggleLocale = () => {
    const nextLocale = isEn() ? 'zh-CN' : 'en';
    if (typeof window.APP_SET_LOCALE === 'function') {
      window.APP_SET_LOCALE(nextLocale);
      return;
    }
    localStorage.setItem('app-locale', nextLocale);
    document.documentElement.lang = nextLocale;
  };

  const request = async (url, options = {}) => {
    const response = await fetch(url, { credentials: 'include', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `请求失败 (${response.status})`);
    return data;
  };
  const toast = (message, error = false) => {
    let node = document.querySelector('.standalone-toast');
    if (!node) { node = document.createElement('div'); node.className = 'standalone-toast'; document.body.append(node); }
    node.textContent = message; node.classList.toggle('error', error); node.classList.add('show');
    clearTimeout(node.timer); node.timer = setTimeout(() => node.classList.remove('show'), 2800);
  };
  const renderLogin = () => {
    document.getElementById('admin-backup-root')?.remove();
    document.getElementById('admin-file-root')?.remove();
    document.body.classList.remove('admin-backup-page', 'migration-page', 'admin-file-page');
    const title = tr('管理员登录', 'Administrator Sign In');
    ROOT.innerHTML = `<main class="standalone-login-page"><form class="standalone-login-card"><button class="standalone-language-toggle ui-button ui-button-secondary" type="button" aria-label="Switch language"><span class="text-language-icon" aria-hidden="true"><span class="text-language-icon-primary">文</span><span class="text-language-icon-secondary">A</span></span></button><div class="standalone-login-heading"><h1>${h(site.siteName)}</h1><p>${title}</p></div><label>${tr('管理员用户名', 'Username')}<input name="username" type="text" autocomplete="username" required></label><label>${tr('管理员密码', 'Password')}<input name="password" type="password" autocomplete="current-password" required></label><p class="standalone-login-error" role="alert"></p><button class="button button-black" type="submit">${tr('登录', 'Sign in')}</button></form></main>`;
    ROOT.querySelector('.standalone-language-toggle').onclick = toggleLocale;
    ROOT.querySelector('form').onsubmit = async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('[type="submit"]');
      const error = form.querySelector('.standalone-login-error');
      button.disabled = true;
      error.textContent = '';
      try {
        await request('/api/auth/adminLogin', { method: 'POST', body: JSON.stringify({ username: form.elements.username.value, password: form.elements.password.value }) });
        await load();
      } catch (cause) {
        error.textContent = isEn() && cause.message === '用户名或密码错误。' ? 'Incorrect username or password.' : cause.message;
      } finally { button.disabled = false; }
    };
  };
  const shell = () => {
    const L = { panel: tr('管理面板','Admin Panel'), logout: tr('退出','Log out'), security: tr('安全','Security'), site: tr('站点','Site'), home: tr('返回主页','Home'), upload: tr('上传设置','Upload Settings'), channel: tr('上传渠道','Upload Channel'), images: tr('图片管理','Image Management'), imageDesc: tr('查看、搜索和管理已上传的图片文件。','Browse, search, and manage uploaded images.'), enter: tr('进入','Open'), backup: tr('备份与迁移','Backup & Migration'), backupDesc: tr('备份、恢复并查看配置、订阅与链接 JSON。','Back up, restore, and view configuration, subscription, and link JSON.'), cfDesc: tr('维护 Cloudflare API 凭据。','Manage Cloudflare API credentials.'), webdavDesc: tr('管理 WebDAV 服务配置。','Manage WebDAV settings.'), configure: tr('配置','Configure') };
    ROOT.innerHTML = `<main class="admin-settings-page standalone-admin"><header class="standalone-header"><h1>${h(site.siteName)} ${L.panel}</h1><nav><button data-action="logout" class="button button-red">${L.logout}</button><button data-action="security" class="button button-white">${L.security}</button><button data-action="site" class="button button-white">${L.site}</button><a class="button button-black" href="/">${L.home}</a><button type="button" class="standalone-language-toggle ui-button ui-button-secondary" aria-label="Switch language"><span class="text-language-icon" aria-hidden="true"><span class="text-language-icon-primary">文</span><span class="text-language-icon-secondary">A</span></span></button></nav></header><div class="admin-settings-content"><section class="upload-settings"><div class="page-header"><h2 class="first-title">${L.upload}</h2><div class="header-actions"><label class="admin-default-upload-channel-control"><span>${L.channel}</span><select id="default-channel" class="ui-select"></select></label></div><form id="client-form" class="client-settings-form"><div class="client-settings-fields" id="client-fields"></div></form></div><div class="channel-list-container" id="channel-groups"></div><section class="admin-backup-migration-card admin-file-management-card"><div><h2>${L.images}</h2><p>${L.imageDesc}</p></div><a class="button button-black" href="${h(site.adminPath)}#File">${L.enter}</a></section><section class="admin-backup-migration-card"><div><h2>${L.backup}</h2><p>${L.backupDesc}</p></div><a class="button button-black" href="${h(site.adminPath)}#JSON">${L.enter}</a></section><section class="standalone-config-cards"><article><h2>Cloudflare API Token</h2><p>${L.cfDesc}</p><button class="button button-white" data-action="cloudflare">${L.configure}</button></article><article><h2>WebDAV</h2><p>${L.webdavDesc}</p><button class="button button-white" data-action="webdav">${L.configure}</button></article></section></section></div></main>`;
    ROOT.querySelector('.standalone-language-toggle').onclick = toggleLocale;
    ROOT.querySelector('[data-action="logout"]').onclick = async () => { try { await request('/api/auth/logout', { method: 'POST' }); location.assign('/'); } catch (e) { toast(e.message, true); } };
    ROOT.querySelectorAll('[data-action]').forEach((button) => { if (button.dataset.action !== 'logout') button.onclick = () => openSettings(button.dataset.action); });
  };

  const load = async () => {
    const auth = await request('/api/auth/sessionCheck');
    if (auth.adminRequired && (!auth.valid || auth.authType !== 'admin')) { renderLogin(); return; }
    if (location.hash === '#File' || location.hash === '#JSON') return;
    site = await request('/api/siteConfig');
    shell();
    await Promise.all([loadChannels(), loadClientSettings()]);
  };
  window.RENDER_STANDALONE_ADMIN = () => load().catch((error) => toast(error.message, true));
  const loadChannels = async () => {
    channels = await request('/api/manage/sysConfig/upload');
    const page = await request('/api/manage/sysConfig/page');
    const availabilityGeneration = ++channelAvailabilityGeneration;
    channelAvailability.clear();
    for (const [type] of TYPES) {
      for (const channel of channels[type]?.channels || []) {
        if (channel.id) channelAvailability.set(`${type}:${channel.id}`, { state: 'checking' });
      }
    }
    const setting = page.config?.find((x) => x.id === 'defaultChannelId');
    const select = ROOT.querySelector('#default-channel');
    select.innerHTML = `<option value="">${tr('暂无开放渠道','No channels available')}</option>` + (setting?.options || []).map((x) => `<option value="${h(x.value)}">${h(x.label)}</option>`).join('');
    select.value = setting?.value || '';
    select.disabled = !(setting?.options || []).length;
    select.onchange = async () => { try { await request('/api/manage/sysConfig/page', { method: 'POST', body: JSON.stringify({ config: [{ id: 'defaultChannelId', value: select.value }] }) }); toast('默认上传渠道已保存'); } catch (e) { toast(e.message, true); } };
    const availabilityLabel = (state) => ({
      checking: tr('检测中', 'Checking'),
      available: tr('可用', 'Available'),
      unavailable: tr('不可用', 'Unavailable'),
    })[state] || tr('未检测', 'Not checked');
    const channelEntries = TYPES.flatMap(([type, label]) => (channels[type]?.channels || []).map((channel, index) => {
      const availability = channelAvailability.get(`${type}:${channel.id}`)?.state || 'checking';
      return `
      <article class="managed-channel-card">
        <header class="managed-channel-header">
          <div class="managed-channel-identity">
            <span class="managed-channel-icon">${CHANNEL_ICONS[type] || ''}</span>
            <div><span class="managed-channel-type">${h(label)}</span><h3>${h(channel.name || label)}</h3></div>
          </div>
          <label class="managed-channel-toggle">
            <span class="visually-hidden">${tr('启用渠道', 'Enable channel')} ${h(channel.name || label)}</span>
            <input class="managed-channel-switch" type="checkbox" role="switch" data-channel-toggle="${type}" data-index="${index}" aria-label="${tr('启用渠道', 'Enable channel')} ${h(channel.name || label)}" ${channel.enabled === false ? '' : 'checked'}>
            <span class="managed-channel-status">${channel.enabled === false ? tr('已停用', 'Disabled') : tr('已启用', 'Enabled')}</span>
          </label>
        </header>
        <div class="managed-channel-health-row">
          <span class="managed-channel-availability" data-type="${h(type)}" data-id="${h(channel.id || '')}" data-state="${availability}" aria-live="polite">${availabilityLabel(availability)}</span>
        </div>
        <footer class="managed-channel-actions">
          <button class="button button-white" data-details="${type}" data-index="${index}">${tr('详细', 'Details')}</button>
          <button class="button button-white" data-edit="${type}" data-index="${index}">${tr('编辑', 'Edit')}</button>
          <button class="button button-red" data-delete="${type}" data-index="${index}" ${channel.fixed ? 'disabled' : ''}>${tr('删除', 'Delete')}</button>
        </footer>
      </article>
    `;
    })).join('');
    ROOT.querySelector('#channel-groups').innerHTML = `
      <header class="channel-management-heading">
        <h2>${tr('上传渠道管理', 'Upload Channel Management')}</h2>
        <div class="channel-management-add">
          <label class="visually-hidden" for="channel-type-to-add">${tr('选择渠道类型', 'Select channel type')}</label>
          <select id="channel-type-to-add" class="ui-select"><option value="">${tr('选择渠道类型', 'Select channel type')}</option>${TYPES.filter(([type]) => type !== 'cfr2' || (channels.capabilities?.cfr2 === true && !(channels.cfr2?.channels || []).length)).map(([type, label]) => `<option value="${type}">${h(label)}</option>`).join('')}</select>
          <button id="add-channel-button" class="button button-black" type="button" disabled>＋ ${tr('添加渠道', 'Add Channel')}</button>
        </div>
      </header>
      ${channelEntries ? `<div class="managed-channel-list">${channelEntries}</div>` : `<p class="channel-empty">${tr('尚未添加上传渠道。请选择类型并添加。', 'No upload channels yet. Choose a type and add one.')}</p>`}
    `;
    const channelTypeSelect = ROOT.querySelector('#channel-type-to-add');
    const addChannelButton = ROOT.querySelector('#add-channel-button');
    channelTypeSelect.onchange = () => { addChannelButton.disabled = !channelTypeSelect.value; };
    addChannelButton.onclick = () => { if (channelTypeSelect.value) editChannel(channelTypeSelect.value); };
    ROOT.querySelectorAll('[data-details]').forEach((button) => button.onclick = () => {
      const type = button.dataset.details;
      const channel = channels[type]?.channels?.[Number(button.dataset.index)];
      if (channel) showChannelDetails(type, channel);
    });
    ROOT.querySelectorAll('[data-channel-toggle]').forEach((toggle) => toggle.onchange = async () => {
      const type = toggle.dataset.channelToggle;
      const channel = channels[type]?.channels?.[Number(toggle.dataset.index)];
      if (!channel) return;
      const previous = channel.enabled !== false;
      channel.enabled = toggle.checked;
      try {
        await request('/api/manage/sysConfig/upload', { method: 'POST', body: JSON.stringify(channels) });
        toast('渠道设置已保存');
        await loadChannels();
      } catch (error) {
        channel.enabled = previous;
        toggle.checked = previous;
        toast(error.message, true);
      }
    });
    ROOT.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => editChannel(b.dataset.edit, Number(b.dataset.index)));
    ROOT.querySelectorAll('[data-delete]').forEach((b) => b.onclick = async () => {
      const type = b.dataset.delete, index = Number(b.dataset.index);
      const name = channels[type].channels[index].name || type;
      if (!confirm(isEn() ? `Delete "${name}"?` : `确定删除“${name}”吗？`)) return;
      const [removed] = channels[type].channels.splice(index, 1);
      try {
        await saveChannels();
      } catch (error) {
        channels[type].channels.splice(index, 0, removed);
        toast(error.message, true);
      }
    });

    const checkAvailability = async (type, channel) => {
      const key = `${type}:${channel.id}`;
      if (!channel.id) return;
      try {
        const status = await request('/api/manage/sysConfig/checkChannel', {
          method: 'POST',
          body: JSON.stringify({ type, id: channel.id }),
        });
        if (availabilityGeneration !== channelAvailabilityGeneration) return;
        const state = status.available ? 'available' : 'unavailable';
        channelAvailability.set(key, { state, reason: status.reason });
        ROOT.querySelectorAll('.managed-channel-availability').forEach((element) => {
          if (element.dataset.type !== type || element.dataset.id !== channel.id) return;
          element.dataset.state = state;
          element.textContent = availabilityLabel(state);
          element.title = status.reason || '';
        });
      } catch (error) {
        if (availabilityGeneration !== channelAvailabilityGeneration) return;
        channelAvailability.set(key, { state: 'unavailable', reason: 'check_failed' });
        ROOT.querySelectorAll('.managed-channel-availability').forEach((element) => {
          if (element.dataset.type !== type || element.dataset.id !== channel.id) return;
          element.dataset.state = 'unavailable';
          element.textContent = availabilityLabel('unavailable');
          element.title = error.message;
        });
      }
    };
    for (const [type] of TYPES) {
      for (const channel of channels[type]?.channels || []) {
        void checkAvailability(type, channel);
      }
    }
  };
  const saveChannels = async () => {
    await request('/api/manage/sysConfig/upload', { method: 'POST', body: JSON.stringify(channels) });
    toast('渠道设置已保存');
    try {
      await loadChannels();
    } catch (error) {
      toast(error.message, true);
    }
  };
  const showChannelDetails = (type, channel) => {
    const labels = {
      accountId: ['账号 ID', 'Account ID'],
      accessKeyId: ['Access Key ID', 'Access Key ID'],
      secretAccessKey: ['Secret Access Key', 'Secret Access Key'],
      bucketName: ['存储桶名称', 'Bucket name'],
      publicUrl: ['公开访问链接', 'Public access URL'],
      endpoint: ['Endpoint', 'Endpoint'],
      region: ['存储区域', 'Region'],
      cdnDomain: ['CDN 域名', 'CDN domain'],
      pathStyle: ['路径风格', 'Path style'],
      botToken: ['Bot Token', 'Bot Token'],
      chatId: ['Chat ID', 'Chat ID'],
      proxyUrl: ['代理地址', 'Proxy URL'],
      channelId: ['频道 ID', 'Channel ID'],
      isNitro: ['Nitro 会员', 'Nitro member'],
      repo: ['仓库名称', 'Repository'],
      token: ['访问令牌', 'Access token'],
      isPrivate: ['私有仓库', 'Private repository'],
      baseUrl: ['WebDAV 地址', 'WebDAV URL'],
      username: ['用户名', 'Username'],
      password: ['密码', 'Password'],
      headers: ['自定义请求头', 'Custom headers'],
      createDirectory: ['自动创建目录', 'Auto-create directory'],
    };
    const channelType = TYPES.find(([channelTypeKey]) => channelTypeKey === type)?.[1] || type;
    const isEnvironment = channel.fixed === true
      || (channel.savePath ?? channel.savepath) === 'environment variable';
    const secretPattern = /token|secret|password|accesskey|headers/i;
    const rows = [
      {
        label: tr('渠道名称', 'Channel name'),
        value: channel.name || channelType,
      },
      {
        label: tr('渠道类型', 'Channel type'),
        value: channelType,
      },
      {
        label: tr('状态', 'Status'),
        value: channel.enabled === false ? tr('已停用', 'Disabled') : tr('已启用', 'Enabled'),
        badge: channel.enabled === false ? 'disabled' : 'enabled',
      },
      {
        label: tr('配置来源', 'Configuration source'),
        value: isEnvironment ? tr('环境变量', 'Environment variable') : tr('数据库', 'Database'),
        badge: isEnvironment ? 'environment' : 'database',
      },
      ...Object.entries(channel)
        .filter(([key, value]) => labels[key]
          && value !== ''
          && value !== null
          && value !== undefined
          && !(typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0))
        .map(([key, value]) => {
          const [zh, en] = labels[key];
          let displayValue;
          if (key === 'headers') {
            displayValue = tr('已配置（内容已隐藏）', 'Configured (content hidden)');
          } else if (secretPattern.test(key)) {
            const secret = String(value);
            const visible = secret.length >= 22 ? 10 : Math.ceil(secret.length / 3);
            displayValue = secret.length > visible * 2
              ? `${secret.slice(0, visible)}****${secret.slice(-visible)}`
              : '••••••••';
          } else if (typeof value === 'boolean') {
            displayValue = value ? tr('是', 'Yes') : tr('否', 'No');
          } else if (typeof value === 'object') {
            displayValue = JSON.stringify(value, null, 2);
          } else {
            displayValue = String(value);
          }
          return {
            label: tr(zh, en),
            value: displayValue,
            url: key === 'publicUrl',
          };
        }),
    ];
    const markup = rows.map(({ label, value, badge, url }) => `
      <div class="managed-channel-detail-row">
        <dt>${h(label)}</dt>
        <dd>${badge
          ? `<span class="managed-channel-detail-badge" data-kind="${badge}">${h(value)}</span>`
          : url
            ? `<div class="managed-channel-detail-url">${h(value)}</div>`
            : h(value)}</dd>
      </div>`).join('');
    openDialog(
      tr('渠道详细信息', 'Channel details'),
      `<dl class="managed-channel-details">${markup}</dl>`,
      null,
      tr('关闭', 'Close'),
      true,
    );
  };
  const editChannel = (type, index = -1) => {
    const editing = index >= 0;
    const old = editing ? channels[type].channels[index] : {
      name: '', enabled: true, region: 'auto', headers: {}, createDirectory: true,
      ...(type === 'webdav' ? { baseUrl: '', username: '', password: '', publicUrl: '' } : {}),
      ...(type === 's3' ? { endpoint: '', cdnDomain: '', accessKeyId: '', secretAccessKey: '', bucketName: '' } : {}),
      ...(type === 'telegram' ? { botToken: '', chatId: '', proxyUrl: '' } : {}),
      ...(type === 'discord' ? { botToken: '', channelId: '', proxyUrl: '', isNitro: false } : {}),
      ...(type === 'huggingface' ? { token: '', repo: '', isPrivate: false } : {}),
    };
    const isEnvironmentChannel = editing && (
      old.fixed === true || (old.savePath ?? old.savepath) === 'environment variable'
    );
    const channelSchemas = {
      telegram: [
        { key: 'botToken', label: ['Bot Token', 'Bot Token'], placeholder: ['请输入 Bot Token', 'Enter Bot Token'], secret: true, required: true },
        { key: 'chatId', label: ['Chat ID', 'Chat ID'], placeholder: ['请输入 Chat ID', 'Enter Chat ID'], required: true },
        { key: 'proxyUrl', label: ['代理地址', 'Proxy Domain'], placeholder: ['可选，例如: your-proxy.example.com', 'Optional, e.g. your-proxy.example.com'] },
      ],
      cfr2: [],
      s3: [
        { key: 'endpoint', label: ['Endpoint', 'Endpoint'], placeholder: ['例如: https://s3.us-east-005.backblazeb2.com', 'e.g. https://s3.us-east-005.backblazeb2.com'], required: true },
        { key: 'region', label: ['存储区域', 'Bucket Region'], placeholder: ['默认填写 auto', 'Default: auto'], required: true },
        { key: 'accessKeyId', label: ['访问密钥 ID', 'Access Key ID'], placeholder: ['请输入访问密钥 ID', 'Enter Access Key ID'], required: true },
        { key: 'secretAccessKey', label: ['机密访问密钥', 'Secret Access Key'], placeholder: ['请输入机密访问密钥', 'Enter Secret Access Key'], secret: true, required: true },
        { key: 'bucketName', label: ['存储桶名称', 'Bucket Name'], placeholder: ['请输入存储桶名称', 'Enter bucket name'], required: true },
        { key: 'cdnDomain', label: ['CDN 域名', 'CDN Domain'], placeholder: ['可选，请填写完整 CDN 访问地址前缀，例如：https://cdn.example.com', 'Optional. Enter the full CDN URL prefix, e.g. https://cdn.example.com'], hint: ['可用于生成和展示文件访问链接，服务端读取文件时也会优先尝试通过 CDN 访问。', 'Used to generate file links; server-side reads also try the CDN first.'] },
        { key: 'pathStyle', label: ['路径风格', 'Path Style'], checkbox: true, hint: ['部分服务不兼容虚拟主机风格时需开启。', 'Enable for services incompatible with virtual-host-style access.'] },
      ],
      discord: [
        { key: 'botToken', label: ['Bot Token', 'Bot Token'], placeholder: ['请输入 Bot Token', 'Enter Bot Token'], secret: true, required: true },
        { key: 'channelId', label: ['Channel ID', 'Channel ID'], placeholder: ['请输入 Channel ID', 'Enter Channel ID'], required: true },
        { key: 'proxyUrl', label: ['代理地址', 'Proxy Domain'], placeholder: ['可选，例如: your-proxy.example.com', 'Optional, e.g. your-proxy.example.com'] },
        { key: 'isNitro', label: ['Nitro 会员', 'Nitro Member'], checkbox: true, hint: ['Nitro 会员单文件限制为 25MB，否则为 10MB。', 'Nitro allows files up to 25 MB; otherwise the limit is 10 MB.'] },
      ],
      huggingface: [
        { key: 'repo', label: ['仓库名', 'Repository Name'], placeholder: ['格式: username/repo-name', 'Format: username/repo-name'], required: true },
        { key: 'token', label: ['Access Token', 'Access Token'], placeholder: ['请输入 Access Token', 'Enter Access Token'], secret: true, required: true },
        { key: 'isPrivate', label: ['私有仓库', 'Private Repository'], checkbox: true, hint: ['私有仓库限制为 100GB。', 'Private repositories are limited to 100 GB.'] },
      ],
      webdav: [
        { key: 'baseUrl', label: ['WebDAV 基础地址', 'WebDAV Base URL'], placeholder: ['例如: https://dav.example.com/remote.php/dav/files/user/imgbed/', 'e.g. https://dav.example.com/remote.php/dav/files/user/imgbed/'], required: true },
        { key: 'username', label: ['用户名', 'Username'], placeholder: ['可选用户名', 'Optional username'] },
        { key: 'password', label: ['密码', 'Password'], placeholder: ['可选密码', 'Optional password'], secret: true },
        { key: 'publicUrl', label: ['公开访问地址', 'Public URL'], placeholder: ['可选，请填写完整公开访问地址前缀，例如：https://cdn.example.com/imgbed', 'Optional. Enter the full public URL prefix, e.g. https://cdn.example.com/imgbed'], hint: ['服务端读取文件时会优先尝试通过此地址访问，失败后回退到 WebDAV API。', 'Server-side reads try this URL first and fall back to the WebDAV API.'] },
        { key: 'headersText', label: ['自定义请求头', 'Custom Headers'], placeholder: ['可选 JSON 对象，例如：{"X-Api-Key":"value"}', 'Optional JSON object, e.g. {"X-Api-Key":"value"}'], textarea: true, hint: ['请输入有效的 JSON 对象。', 'Enter a valid JSON object.'] },
        { key: 'createDirectory', label: ['自动创建目录', 'Auto-create directories'], checkbox: true, hint: ['上传文件前自动创建父级目录。', 'Create parent directories before uploading files.'] },
      ],
    }[type] || [];
    const environmentFields = {
      telegram: ['proxyUrl'],
      s3: ['cdnDomain'],
      discord: ['proxyUrl', 'isNitro'],
      huggingface: ['isPrivate'],
      webdav: ['publicUrl', 'headersText', 'createDirectory'],
    };
    const schema = isEnvironmentChannel
      ? channelSchemas.filter((field) => environmentFields[type]?.includes(field.key))
      : channelSchemas;
    const channelLabel = TYPES.find(([channelType]) => channelType === type)?.[1] || type;
    const dialogTitle = editing
      ? tr('编辑上传渠道', 'Edit upload channel')
      : `${tr('添加', 'Add')} ${channelLabel} ${tr('渠道', 'Channel')}`;
    const fieldMarkup = (field) => {
      const value = field.key === 'headersText'
        ? typeof old.headers === 'string' ? old.headers : JSON.stringify(old.headers || {}, null, 2)
        : old[field.key] ?? '';
      const fieldLabel = isEn() ? field.label[1] : field.label[0];
      const placeholder = field.placeholder ? (isEn() ? field.placeholder[1] : field.placeholder[0]) : '';
      const hint = field.hint ? (isEn() ? field.hint[1] : field.hint[0]) : '';
      if (field.checkbox) {
        return `<div class="standalone-channel-check-wrap"><label class="standalone-channel-check"><input name="${field.key}" type="checkbox" ${value ? 'checked' : ''}><span>${fieldLabel}</span></label>${hint ? `<small class="standalone-channel-hint">${hint}</small>` : ''}</div>`;
      }
      if (field.textarea) {
        return `<label class="standalone-channel-field"><span>${fieldLabel}</span><textarea name="${field.key}" rows="4" placeholder="${h(placeholder)}">${h(value)}</textarea>${hint ? `<small class="standalone-channel-hint">${hint}</small>` : ''}</label>`;
      }
      return `<label class="standalone-channel-field"><span>${fieldLabel}</span><input name="${field.key}" type="${field.secret ? 'password' : 'text'}" value="${h(value)}" placeholder="${h(placeholder)}" ${field.required ? 'required' : ''}>${hint ? `<small class="standalone-channel-hint">${hint}</small>` : ''}</label>`;
    };
    const fields = [
      `<label class="standalone-channel-field"><span>${tr('渠道名称', 'Channel name')}</span><input name="name" value="${h(old.name || '')}" placeholder="${tr('请输入渠道名称', 'Enter channel name')}" required ${isEnvironmentChannel ? 'readonly' : ''}></label>`,
      ...schema.map(fieldMarkup),
    ].join('');
    const channelNote = isEnvironmentChannel
      ? `<p class="standalone-channel-note">${tr('凭据由环境变量提供；这里只保存可覆盖的渠道选项。', 'Credentials come from environment variables; only supported channel overrides are saved here.')}</p>`
      : type === 'cfr2'
        ? `<p class="standalone-channel-note">${tr('使用当前项目绑定的 R2 存储桶，无需填写账号密钥；每个项目只能添加一个 R2 渠道。', 'Uses the R2 bucket bound to this project; no account keys are needed. Only one R2 channel can be added per project.')}</p>`
        : type === 'discord'
          ? `<p class="standalone-channel-note">${tr('Discord 有接口频率限制，不建议将其用于大规模并发场景。', 'Discord has API rate limits and is not recommended for high-concurrency scenarios.')}</p>`
        : '';

    openDialog(dialogTitle, `${channelNote}<div class="standalone-channel-fields">${fields}</div>`, async (form) => {
      const name = form.elements.name.value.trim();
      if (!name || !/^[\u4e00-\u9fa5a-zA-Z0-9_-]+$/.test(name)) {
        throw new Error(tr('渠道名称只能包含中英文、数字、下划线和连字符。', 'Channel name may only contain letters, numbers, underscores, and hyphens.'));
      }
      if (!editing && ['Telegram_env', 'S3_env', 'Discord_env', 'HuggingFace_env', 'WebDAV_env'].includes(name)) {
        throw new Error(tr('该名称为系统保留名称，请使用其他名称。', 'This name is reserved. Please choose another.'));
      }
      if (Object.entries(channels).some(([channelType, channelSettings]) =>
        (channelSettings.channels || []).some((channel, channelIndex) =>
          channel.name === name && (!editing || channelType !== type || channelIndex !== index)))) {
        throw new Error(tr('已存在同名渠道，请使用其他名称。', 'A channel with this name already exists.'));
      }
      if (!editing && type === 'cfr2' && (channels.cfr2?.channels || []).length > 0) {
        throw new Error(tr('Cloudflare R2 仅支持添加一个渠道。', 'Only one Cloudflare R2 channel can be added.'));
      }
      if (!editing && type === 'cfr2' && channels.capabilities?.cfr2 !== true) {
        throw new Error(tr('当前项目未绑定 Cloudflare R2 存储桶。', 'This project does not have an R2 bucket binding.'));
      }

      const value = { ...old, name, enabled: old.enabled !== false };
      for (const field of schema) {
        if (field.checkbox) value[field.key] = form.elements[field.key].checked;
        else if (field.key === 'headersText') {
          let headers;
          try {
            headers = JSON.parse(form.elements[field.key].value || '{}');
          } catch {
            throw new Error(tr('自定义请求头必须是有效的 JSON 对象。', 'Custom headers must be a valid JSON object.'));
          }
          if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
            throw new Error(tr('自定义请求头必须是有效的 JSON 对象。', 'Custom headers must be a valid JSON object.'));
          }
          value.headers = headers;
          delete value.headersText;
        } else value[field.key] = form.elements[field.key].value.trim();
      }

      if (!editing) {
        if (!channels[type]) channels[type] = { loadBalance: {}, channels: [] };
        const usedIds = new Set(Object.values(channels).flatMap((group) => (group.channels || []).map((channel) => channel.id).filter(Boolean)));
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let id = '';
        for (let attempt = 0; attempt < 100 && !id; attempt += 1) {
          const bytes = crypto.getRandomValues(new Uint8Array(5));
          const candidate = [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
          if (!usedIds.has(candidate)) id = candidate;
        }
        if (!id) throw new Error(tr('无法生成唯一的渠道 ID。', 'Unable to generate a unique channel ID.'));
        value.id = id;
        value.type = type;
        value.savePath ||= 'database';
        value.fixed = false;
        channels[type].channels.push(value);
      } else channels[type].channels[index] = value;
      await saveChannels();
    });
  };
  const loadClientSettings = async () => {
    const data = await request('/api/manage/sysConfig/page');
    const fields = data.config || [];
    const labels = isEn() ? { defaultConvertToWebp: 'Convert to WebP', defaultCustomerCompress: 'Enable compression', defaultCompressBar: 'Compression threshold (MB)', defaultCompressQuality: 'Target size (MB)' } : { defaultConvertToWebp: '是否转换 WebP', defaultCustomerCompress: '开启压缩', defaultCompressBar: '压缩阈值 (MB)', defaultCompressQuality: '压缩目标 (MB)' };
    ROOT.querySelector('#client-fields').innerHTML = fields.filter((x) => labels[x.id]).map((x) => `<label class="client-settings-field"><span>${labels[x.id]}</span><input name="${x.id}" type="${typeof x.value === 'boolean' ? 'checkbox' : 'number'}" ${typeof x.value === 'boolean' ? (x.value ? 'checked' : '') : `value="${h(x.value)}"`}></label>`).join('');
    const form = ROOT.querySelector('#client-form'); let timer;
    form.onchange = () => { clearTimeout(timer); timer = setTimeout(async () => { const config = fields.filter((x) => labels[x.id]).map((x) => ({ id: x.id, value: form.elements[x.id].type === 'checkbox' ? form.elements[x.id].checked : form.elements[x.id].value })); try { await request('/api/manage/sysConfig/page', { method: 'POST', body: JSON.stringify({ config }) }); toast('客户端设置已保存'); } catch (e) { toast(e.message, true); } }, 350); };
  };
  const openSettings = async (type) => {
    const isSite = type === 'site';
    const isSecurity = type === 'security';
    const isWebdav = type === 'webdav';
    const isCf = type === 'cloudflare';
    const title = isSite ? '站点设置' : isSecurity ? '安全设置' : isWebdav ? 'WebDAV' : isCf ? 'Cloudflare API Token' : '配置';
    try {
      const url = isSite ? '/api/manage/sysConfig/site' : isSecurity ? '/api/manage/sysConfig/security' : '/api/manage/sysConfig/others';
      const data = await request(url);
      let subset = isSite ? data : isSecurity ? { username: data.username } : isWebdav ? data.webDAV : data.cloudflareApiToken;
      const body = isSite ? `<label>管理路径<input name="adminPath" required value="${h(String(subset.adminPath || '/admin').replace(/^\//, ''))}"></label><label>站点名称<input name="siteName" required value="${h(subset.siteName || site.siteName)}"></label>`
        : isSecurity ? '<label>管理员用户名<input name="username" required></label><label>新密码<input name="password" type="password" minlength="8" required></label><label>确认密码<input name="passwordConfirmation" type="password" minlength="8" required></label>'
        : isWebdav ? `<label class="standalone-switch-field"><span>启用 WebDAV</span><input name="enabled" type="checkbox" role="switch" aria-label="启用 WebDAV" ${subset.enabled ? 'checked' : ''}></label><label>用户名<input name="username" value="${h(subset.username)}"></label><label>密码<input name="password" type="password" value="${h(subset.password)}"></label>`
          : isCf ? `<label>Zone ID<input name="CF_ZONE_ID" value="${h(subset.CF_ZONE_ID)}"></label><label>Cloudflare 邮箱<input name="CF_EMAIL" value="${h(subset.CF_EMAIL)}"></label><label>Cloudflare API Token / API Key<input name="CF_API_KEY" type="password" value="${h(subset.CF_API_KEY)}" autocomplete="new-password"></label>`
            : `<p>JSON 配置</p><textarea name="json" spellcheck="false">${h(JSON.stringify(subset, null, 2))}</textarea>`;
      openDialog(title, body, async (form) => {
        let payload;
        if (isSite) payload = { adminPath: form.elements.adminPath.value, siteName: form.elements.siteName.value };
        else if (isSecurity) payload = { username: form.elements.username.value, password: form.elements.password.value, passwordConfirmation: form.elements.passwordConfirmation.value };
        else if (isWebdav) payload = { ...data, webDAV: { ...subset, enabled: form.elements.enabled.checked, username: form.elements.username.value, password: form.elements.password.value } };
        else if (isCf) payload = { ...data, cloudflareApiToken: { ...subset, CF_ZONE_ID: form.elements.CF_ZONE_ID.value, CF_EMAIL: form.elements.CF_EMAIL.value, CF_API_KEY: form.elements.CF_API_KEY.value } };
        else { let value; try { value = JSON.parse(form.elements.json.value); } catch { throw new Error('JSON 格式无效'); } payload = { ...data, cloudflareApiToken: value }; }
        const result = await request(url, { method: 'POST', body: JSON.stringify(payload) });
        if (isSite) {
          site = result;
          if (result.adminPath && result.adminPath !== location.pathname) { location.assign(result.adminPath); return; }
          shell(); await Promise.all([loadChannels(), loadClientSettings()]);
        }
        toast(`${title}已保存`);
      });
    } catch (e) { toast(e.message, true); }
  };
  const openDialog = (title, contents, submit, submitLabel = tr('保存', 'Save'), closeOnly = false) => {
    document.querySelector('.standalone-dialog-backdrop')?.remove();
    const backdrop = document.createElement('div'); backdrop.className = 'standalone-dialog-backdrop';
    backdrop.innerHTML = closeOnly
      ? `<section class="standalone-dialog"><header><h2>${h(title)}</h2><button type="button" data-close aria-label="${tr('关闭', 'Close')}">×</button></header><div class="standalone-dialog-content">${contents}</div><footer><button type="button" data-close class="button button-black">${h(submitLabel)}</button></footer></section>`
      : `<section class="standalone-dialog"><header><h2>${h(title)}</h2><button type="button" data-close aria-label="关闭">×</button></header><form>${contents}<p class="dialog-error" role="alert"></p><footer><button type="button" data-close class="button button-white">${tr('取消', 'Cancel')}</button><button type="submit" class="button button-black">${h(submitLabel)}</button></footer></form></section>`;
    document.body.append(backdrop); backdrop.querySelectorAll('[data-close]').forEach((b) => b.onclick = () => backdrop.remove());
    backdrop.onclick = (e) => { if (e.target === backdrop) backdrop.remove(); };
    if (!closeOnly) {
      backdrop.querySelector('form').onsubmit = async (event) => { event.preventDefault(); const button = event.currentTarget.querySelector('[type="submit"]'); button.disabled = true; try { await submit(event.currentTarget); backdrop.remove(); } catch (e) { backdrop.querySelector('.dialog-error').textContent = e.message; } finally { button.disabled = false; } };
    }
    return backdrop;
  };
  load().catch((error) => { ROOT.innerHTML = `<main class="standalone-error"><h1>${tr('管理面板加载失败','Admin panel failed to load')}</h1><p>${h(error.message)}</p><a href="${h(site.adminPath)}">${tr('返回登录','Back to sign in')}</a></main>`; });
})();
