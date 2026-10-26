(() => {
  'use strict';

  const ROOT = document.getElementById('app');
  if (location.hash === '#File' || location.hash === '#JSON') return;
  const TYPES = [
    ['telegram', 'Telegram'], ['cfr2', 'Cloudflare R2'], ['s3', 'S3'],
    ['discord', 'Discord'], ['huggingface', 'HuggingFace'], ['webdav', 'WebDAV'],
  ];
  const h = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let site = { adminPath: location.pathname, siteName: 'cf-imghub' };
  let channels = {};

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
  const shell = () => {
    ROOT.innerHTML = `<main class="admin-settings-page standalone-admin"><header class="standalone-header"><h1>${h(site.siteName)} 管理面板</h1><nav><button data-action="logout" class="button button-red">退出</button><button data-action="client" class="button button-white">客户端设置</button><button data-action="security" class="button button-white">安全</button><button data-action="site" class="button button-white">站点</button><a class="button button-black" href="/">返回主页</a></nav></header><div class="admin-settings-content"><section class="upload-settings"><div class="page-header"><h2 class="first-title">上传设置</h2><div class="header-actions"><label class="admin-default-upload-channel-control"><span>上传渠道</span><select id="default-channel" class="ui-select"></select></label></div><form id="client-form" class="client-settings-form"><div class="client-settings-fields" id="client-fields"></div></form></div><div class="channel-list-container" id="channel-groups"></div><section class="admin-backup-migration-card admin-file-management-card"><div><h2>图片管理</h2><p>查看、搜索和管理已上传的图片文件。</p></div><a class="button button-black" href="${h(site.adminPath)}#File">进入</a></section><section class="admin-backup-migration-card"><div><h2>备份与迁移</h2><p>备份、恢复并查看配置、订阅与链接 JSON。</p></div><a class="button button-black" href="${h(site.adminPath)}#JSON">进入</a></section><section class="standalone-config-cards"><article><h2>Cloudflare API Token</h2><p>维护 Cloudflare API 凭据。</p><button class="button button-white" data-action="cloudflare">配置</button></article><article><h2>WebDAV</h2><p>管理 WebDAV 服务配置。</p><button class="button button-white" data-action="webdav">配置</button></article></section></section></div></main>`;
    ROOT.querySelector('[data-action="logout"]').onclick = async () => { try { await request('/api/auth/logout', { method: 'POST' }); location.assign('/'); } catch (e) { toast(e.message, true); } };
    ROOT.querySelectorAll('[data-action]').forEach((button) => { if (button.dataset.action !== 'logout') button.onclick = () => openSettings(button.dataset.action); });
  };

  const load = async () => {
    const auth = await request('/api/auth/sessionCheck');
    if (auth.adminRequired && (!auth.valid || auth.authType !== 'admin')) { location.assign('/adminLogin'); return; }
    site = await request('/api/siteConfig');
    shell();
    await Promise.all([loadChannels(), loadClientSettings()]);
  };
  const loadChannels = async () => {
    channels = await request('/api/manage/sysConfig/upload');
    const page = await request('/api/manage/sysConfig/page');
    const setting = page.config?.find((x) => x.id === 'defaultChannelId');
    const select = ROOT.querySelector('#default-channel');
    select.innerHTML = '<option value="">暂无开放渠道</option>' + (setting?.options || []).map((x) => `<option value="${h(x.value)}">${h(x.label)}</option>`).join('');
    select.value = setting?.value || '';
    select.disabled = !(setting?.options || []).length;
    select.onchange = async () => { try { await request('/api/manage/sysConfig/page', { method: 'POST', body: JSON.stringify({ config: [{ id: 'defaultChannelId', value: select.value }] }) }); toast('默认上传渠道已保存'); } catch (e) { toast(e.message, true); } };
    ROOT.querySelector('#channel-groups').innerHTML = TYPES.map(([type, label]) => {
      const list = channels[type]?.channels || [];
      return `<section class="channel-group" data-empty="${!list.length}"><header class="group-header"><h3 class="group-title">${h(label)} <span>${list.length}</span></h3><button class="button button-black" data-add="${type}">＋ 添加渠道</button></header><div class="channel-cards">${list.map((ch, index) => `<article class="channel-card"><header class="card-header"><h4 class="card-title">${h(ch.name || label)}</h4><span>${ch.enabled === false ? '已停用' : '已启用'}</span></header><p>${h(ch.id || '')}</p><div class="card-actions"><button class="button button-white" data-edit="${type}" data-index="${index}">编辑</button><button class="button button-red" data-delete="${type}" data-index="${index}" ${ch.fixed ? 'disabled' : ''}>删除</button></div></article>`).join('') || '<p class="channel-empty">暂无渠道</p>'}</div></section>`;
    }).join('');
    ROOT.querySelectorAll('[data-add]').forEach((b) => b.onclick = () => editChannel(b.dataset.add));
    ROOT.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => editChannel(b.dataset.edit, Number(b.dataset.index)));
    ROOT.querySelectorAll('[data-delete]').forEach((b) => b.onclick = async () => {
      const type = b.dataset.delete, index = Number(b.dataset.index);
      if (!confirm(`确定删除“${channels[type].channels[index].name || type}”吗？`)) return;
      channels[type].channels.splice(index, 1); await saveChannels();
    });
  };
  const saveChannels = async () => { try { await request('/api/manage/sysConfig/upload', { method: 'POST', body: JSON.stringify(channels) }); toast('渠道设置已保存'); await loadChannels(); } catch (e) { toast(e.message, true); } };
  const editChannel = (type, index = -1) => {
    const old = index >= 0 ? channels[type].channels[index] : { name: '', enabled: true, ...(type === 'webdav' ? { baseUrl: '', username: '', password: '', publicUrl: '', headers: {}, createDirectory: true } : {}), ...(type === 'cfr2' ? { accountId: '', accessKeyId: '', secretAccessKey: '', bucketName: '', publicUrl: '' } : {}), ...(type === 's3' ? { endpoint: '', region: '', accessKeyId: '', secretAccessKey: '', bucketName: '', publicUrl: '' } : {}), ...(type === 'telegram' ? { botToken: '', chatId: '', publicUrl: '' } : {}), ...(type === 'discord' ? { botToken: '', channelId: '', publicUrl: '' } : {}), ...(type === 'huggingface' ? { token: '', repo: '', isPrivate: false, publicUrl: '' } : {}) };
    openDialog(index >= 0 ? '编辑上传渠道' : `添加 ${TYPES.find(([t]) => t === type)?.[1]} 渠道`, `<p>JSON 字段会按当前存储格式原样提交。</p><textarea name="json" spellcheck="false">${h(JSON.stringify(old, null, 2))}</textarea>`, async (form) => {
      let value; try { value = JSON.parse(form.elements.json.value); } catch { throw new Error('JSON 格式无效'); }
      if (!value || typeof value !== 'object' || Array.isArray(value) || !value.name) throw new Error('渠道 JSON 必须是对象并包含 name');
      if (!channels[type]) channels[type] = { loadBalance: {}, channels: [] };
      if (index < 0) channels[type].channels.push(value); else channels[type].channels[index] = value;
      await saveChannels();
    });
  };
  const loadClientSettings = async () => {
    const data = await request('/api/manage/sysConfig/page');
    const fields = data.config || [];
    const labels = { defaultConvertToWebp: '是否转换 WebP', defaultCustomerCompress: '开启压缩', defaultCompressBar: '压缩阈值 (MB)', defaultCompressQuality: '压缩目标 (MB)' };
    ROOT.querySelector('#client-fields').innerHTML = fields.filter((x) => labels[x.id]).map((x) => `<label class="client-settings-field"><span>${labels[x.id]}</span><input name="${x.id}" type="${typeof x.value === 'boolean' ? 'checkbox' : 'number'}" ${typeof x.value === 'boolean' ? (x.value ? 'checked' : '') : `value="${h(x.value)}"`}></label>`).join('');
    const form = ROOT.querySelector('#client-form'); let timer;
    form.onchange = () => { clearTimeout(timer); timer = setTimeout(async () => { const config = fields.filter((x) => labels[x.id]).map((x) => ({ id: x.id, value: form.elements[x.id].type === 'checkbox' ? form.elements[x.id].checked : form.elements[x.id].value })); try { await request('/api/manage/sysConfig/page', { method: 'POST', body: JSON.stringify({ config }) }); toast('客户端设置已保存'); } catch (e) { toast(e.message, true); } }, 350); };
  };
  const openSettings = async (type) => {
    if (type === 'client') { document.querySelector('#client-fields')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
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
        : isWebdav ? `<label><input name="enabled" type="checkbox" ${subset.enabled ? 'checked' : ''}> 启用 WebDAV</label><label>用户名<input name="username" value="${h(subset.username)}"></label><label>密码<input name="password" type="password" value="${h(subset.password)}"></label><label>上传渠道 ID<input name="uploadChannel" value="${h(subset.uploadChannel)}"></label><label>渠道名称<input name="channelName" value="${h(subset.channelName)}"></label>`
          : isCf ? `<label>Zone ID<input name="CF_ZONE_ID" value="${h(subset.CF_ZONE_ID)}"></label><label>Cloudflare 邮箱<input name="CF_EMAIL" value="${h(subset.CF_EMAIL)}"></label><label>Cloudflare API Token / API Key<input name="CF_API_KEY" type="password" value="${h(subset.CF_API_KEY)}" autocomplete="new-password"></label>`
            : `<p>JSON 配置</p><textarea name="json" spellcheck="false">${h(JSON.stringify(subset, null, 2))}</textarea>`;
      openDialog(title, body, async (form) => {
        let payload;
        if (isSite) payload = { adminPath: form.elements.adminPath.value, siteName: form.elements.siteName.value };
        else if (isSecurity) payload = { username: form.elements.username.value, password: form.elements.password.value, passwordConfirmation: form.elements.passwordConfirmation.value };
        else if (isWebdav) payload = { ...data, webDAV: { ...subset, enabled: form.elements.enabled.checked, username: form.elements.username.value, password: form.elements.password.value, uploadChannel: form.elements.uploadChannel.value, channelName: form.elements.channelName.value } };
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
  const openDialog = (title, contents, submit) => {
    document.querySelector('.standalone-dialog-backdrop')?.remove();
    const backdrop = document.createElement('div'); backdrop.className = 'standalone-dialog-backdrop';
    backdrop.innerHTML = `<section class="standalone-dialog"><header><h2>${h(title)}</h2><button type="button" data-close aria-label="关闭">×</button></header><form>${contents}<p class="dialog-error" role="alert"></p><footer><button type="button" data-close class="button button-white">取消</button><button type="submit" class="button button-black">保存</button></footer></form></section>`;
    document.body.append(backdrop); backdrop.querySelectorAll('[data-close]').forEach((b) => b.onclick = () => backdrop.remove());
    backdrop.onclick = (e) => { if (e.target === backdrop) backdrop.remove(); };
    backdrop.querySelector('form').onsubmit = async (event) => { event.preventDefault(); const button = event.currentTarget.querySelector('[type="submit"]'); button.disabled = true; try { await submit(event.currentTarget); backdrop.remove(); } catch (e) { backdrop.querySelector('.dialog-error').textContent = e.message; } finally { button.disabled = false; } };
  };
  load().catch((error) => { ROOT.innerHTML = `<main class="standalone-error"><h1>管理面板加载失败</h1><p>${h(error.message)}</p><a href="/adminLogin">返回登录</a></main>`; });
})();
