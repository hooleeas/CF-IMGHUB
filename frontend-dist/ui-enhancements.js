(() => {
  'use strict';

  const LEGACY_BACKUP_PATH = /^\/[A-Za-z0-9_-]{1,128}\/JSON$/.test(window.location.pathname)
    ? window.location.pathname
    : '';

  const ESCAPE_HTML = (VALUE) => String(VALUE ?? '').replace(/[&<>"']/g, (CHAR) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[CHAR]);

  const BUTTON_VARIANTS = Object.freeze({
    white: 'secondary',
    black: 'primary',
    red: 'danger',
  });

  const BUTTON_VARIANT_CLASSES = Object.freeze({
    secondary: 'ui-button-secondary',
    primary: 'ui-button-primary',
    danger: 'ui-button-danger',
  });

  const MODAL_SELECTOR = [
    '.ui-modal-backdrop',
    '.client-settings-backdrop',
    '.admin-settings-modal-backdrop',
    '.el-overlay',
    '.el-message-box__wrapper',
    '.el-image-viewer__wrapper',
    '.el-drawer__container',
    '#admin-backup-root > .overlay.open',
  ].join(', ');
  let MODAL_SCROLL_POSITION = 0;
  let MODAL_SCROLL_LOCKED = false;
  let MODAL_BODY_STYLES;
  let MODAL_HTML_OVERFLOW;

  const HAS_VISIBLE_MODAL = () => [...document.querySelectorAll(MODAL_SELECTOR)].some((MODAL) => {
    const STYLE = window.getComputedStyle(MODAL);
    return STYLE.display !== 'none'
      && STYLE.visibility !== 'hidden'
      && MODAL.getClientRects().length > 0;
  });

  const SYNC_MODAL_SCROLL_LOCK = () => {
    if (!document.body) return;

    const SHOULD_LOCK = HAS_VISIBLE_MODAL();
    if (SHOULD_LOCK === MODAL_SCROLL_LOCKED) return;

    if (SHOULD_LOCK) {
      MODAL_SCROLL_POSITION = window.scrollY;
      MODAL_BODY_STYLES = ['position', 'top', 'left', 'right', 'width', 'overflow']
        .reduce((STYLES, PROPERTY) => {
          STYLES[PROPERTY] = {
            value: document.body.style.getPropertyValue(PROPERTY),
            priority: document.body.style.getPropertyPriority(PROPERTY),
          };
          return STYLES;
        }, {});
      MODAL_HTML_OVERFLOW = {
        value: document.documentElement.style.getPropertyValue('overflow'),
        priority: document.documentElement.style.getPropertyPriority('overflow'),
      };
      MODAL_SCROLL_LOCKED = true;
      document.documentElement.classList.add('modal-scroll-locked');
      document.body.classList.add('modal-scroll-locked');
      document.documentElement.style.setProperty('overflow', 'hidden');
      document.body.style.setProperty('position', 'fixed');
      document.body.style.setProperty('top', `-${MODAL_SCROLL_POSITION}px`);
      document.body.style.setProperty('left', '0');
      document.body.style.setProperty('right', '0');
      document.body.style.setProperty('width', '100%');
      document.body.style.setProperty('overflow', 'hidden');
      return;
    }

    MODAL_SCROLL_LOCKED = false;
    document.documentElement.classList.remove('modal-scroll-locked');
    document.body.classList.remove('modal-scroll-locked');
    Object.entries(MODAL_BODY_STYLES).forEach(([PROPERTY, DECLARATION]) => {
      if (DECLARATION.value) {
        document.body.style.setProperty(PROPERTY, DECLARATION.value, DECLARATION.priority);
      } else {
        document.body.style.removeProperty(PROPERTY);
      }
    });
    if (MODAL_HTML_OVERFLOW.value) {
      document.documentElement.style.setProperty(
        'overflow',
        MODAL_HTML_OVERFLOW.value,
        MODAL_HTML_OVERFLOW.priority,
      );
    } else {
      document.documentElement.style.removeProperty('overflow');
    }
    window.scrollTo(0, MODAL_SCROLL_POSITION);
  };

  new MutationObserver(SYNC_MODAL_SCROLL_LOCK).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'open', 'aria-hidden'],
  });

  const GET_BUTTON_VARIANT = (BUTTON_ELEMENT) => {
    if (BUTTON_ELEMENT.matches(
      '.storage-disclosure, .el-dialog__headerbtn, .plyr__control',
    )) return null;

    if ([...BUTTON_ELEMENT.classList].some((CLASS_NAME) => (
      /(?:^|[-_])(?:danger|delete|remove|destroy)(?:$|[-_])/i.test(CLASS_NAME)
    ))) return 'danger';
    if (BUTTON_ELEMENT.matches(
      '.button-red, .el-button--danger, .danger-button, .danger, .ui-button-danger',
    )) return 'danger';
    if (BUTTON_ELEMENT.matches(
      '.button-white, .el-button--default, .secondary-button, .secondary, .security-button, .close-button, .ui-button-secondary, .admin-client-settings-trigger, .admin-security-trigger, .admin-settings-modal-close, .client-settings-close, .client-settings-cancel, .admin-settings-modal-cancel, .home-menu-action',
    )) return 'secondary';
    if (BUTTON_ELEMENT.matches(
      '.button-black, .el-button--primary, .ui-button-primary, .admin-inline-save, .client-settings-save, .admin-settings-modal-save',
    )) return 'primary';
    if (BUTTON_ELEMENT.matches('.el-button')) return 'secondary';
    if (BUTTON_ELEMENT.matches('button, .button')) return 'primary';
    return null;
  };

  const NORMALIZE_BUTTONS = (ROOT = document) => {
    const BUTTONS = [];
    if (ROOT.matches?.('button, .button')) BUTTONS.push(ROOT);
    BUTTONS.push(...ROOT.querySelectorAll('button, .button'));

    BUTTONS.forEach((BUTTON_ELEMENT) => {
      const VARIANT = GET_BUTTON_VARIANT(BUTTON_ELEMENT);
      if (!VARIANT) {
        BUTTON_ELEMENT.classList.remove(
          'ui-button',
          ...Object.values(BUTTON_VARIANT_CLASSES),
        );
        return;
      }
      BUTTON_ELEMENT.classList.add('ui-button');
      Object.values(BUTTON_VARIANT_CLASSES).forEach((CLASS_NAME) => {
        BUTTON_ELEMENT.classList.toggle(CLASS_NAME, CLASS_NAME === BUTTON_VARIANT_CLASSES[VARIANT]);
      });
    });
  };

  const NORMALIZE_SELECTS = (ROOT = document) => {
    const SELECTS = [];
    if (ROOT.matches?.('select')) SELECTS.push(ROOT);
    SELECTS.push(...ROOT.querySelectorAll('select'));

    SELECTS.forEach((SELECT) => SELECT.classList.add('ui-select'));
  };

  const NORMALIZE_CONTROLS = (ROOT = document) => {
    NORMALIZE_BUTTONS(ROOT);
    NORMALIZE_SELECTS(ROOT);
  };

  const BUTTON = (VARIANT, LABEL, ACTION = '') => {
    const UI_VARIANT = BUTTON_VARIANTS[VARIANT];
    if (!UI_VARIANT) throw new Error(`Unsupported button variant: ${VARIANT}`);
    const BUTTON_ELEMENT = document.createElement('button');
    BUTTON_ELEMENT.className = `button button-${VARIANT}`;
    BUTTON_ELEMENT.type = 'button';
    BUTTON_ELEMENT.dataset.action = String(ACTION ?? '');
    BUTTON_ELEMENT.textContent = String(LABEL ?? '');
    NORMALIZE_CONTROLS(BUTTON_ELEMENT);
    return BUTTON_ELEMENT.outerHTML;
  };

  window.BUTTON = BUTTON;

  window.BUTTON_WHITE = (LABEL, ACTION) => BUTTON('white', LABEL, ACTION);
  window.BUTTON_BLACK = (LABEL, ACTION) => BUTTON('black', LABEL, ACTION);
  window.BUTTON_RED = (LABEL, ACTION) => BUTTON('red', LABEL, ACTION);
  window.CFSubsUI = Object.assign(window.CFSubsUI || {}, {
    normalizeControls: NORMALIZE_CONTROLS,
  });

  const ENHANCE_PASTE_METHOD_SELECTS = (ROOT = document) => {
    const GROUPS = [];
    if (ROOT.matches?.('.paste-card-method-group')) GROUPS.push(ROOT);
    GROUPS.push(...ROOT.querySelectorAll('.paste-card-method-group'));

    GROUPS.forEach((GROUP) => {
      if (GROUP.dataset.nativeSelectReady) return;
      const ACTIONS = GROUP.closest('.paste-card-actions');
      if (!ACTIONS) return;

      const RADIOS = [...GROUP.querySelectorAll('input[type="radio"]')];
      if (!RADIOS.length) return;

      const SELECT = document.createElement('select');
      SELECT.className = 'paste-card-method-select';
      SELECT.setAttribute('aria-label', '粘贴上传方式');
      RADIOS.forEach((RADIO) => {
        const OPTION = document.createElement('option');
        OPTION.value = RADIO.value;
        OPTION.textContent = RADIO.parentElement?.querySelector('.el-radio-button__inner')
          ?.textContent.trim() || RADIO.value;
        SELECT.appendChild(OPTION);
      });
      SELECT.value = RADIOS.find((RADIO) => RADIO.checked)?.value || RADIOS[0].value;
      SELECT.addEventListener('change', () => {
        const RADIO = [...GROUP.querySelectorAll('input[type="radio"]')]
          .find((ITEM) => ITEM.value === SELECT.value);
        const LABEL = RADIO?.closest('label');
        if (!LABEL) throw new Error(`Missing upload method option: ${SELECT.value}`);
        LABEL.click();
      });

      GROUP.dataset.nativeSelectReady = 'true';
      ACTIONS.insertBefore(SELECT, GROUP);
    });
  };

  NORMALIZE_CONTROLS();
  ENHANCE_PASTE_METHOD_SELECTS();
  new MutationObserver((RECORDS) => {
    RECORDS.forEach((RECORD) => {
      RECORD.addedNodes.forEach((NODE) => {
        if (NODE.nodeType === Node.ELEMENT_NODE) {
          NORMALIZE_CONTROLS(NODE);
          ENHANCE_PASTE_METHOD_SELECTS(NODE);
        }
      });
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

  window.CONTAINER = (CONTENT, CLASS_NAME = '') => (
    `<section class="ui-container ${ESCAPE_HTML(CLASS_NAME)}">${CONTENT}</section>`
  );

  window.CC = (MESSAGE, ERROR = false) => {
    let TOAST = document.querySelector('.ui-toast');

    if (!TOAST) {
      TOAST = document.createElement('div');
      TOAST.className = 'ui-toast';
      TOAST.setAttribute('role', 'status');
      document.body.appendChild(TOAST);
    }

    TOAST.textContent = MESSAGE || '';
    TOAST.classList.toggle('is-error', ERROR);
    TOAST.classList.add('is-visible');
    clearTimeout(TOAST.__TIMER);
    TOAST.__TIMER = setTimeout(() => TOAST.classList.remove('is-visible'), 2800);
  };

  window.addEventListener('imgbed:toast', (EVENT) => {
    const DETAIL = EVENT.detail || {};
    window.CC(DETAIL.MESSAGE, DETAIL.TYPE === 'error');
  });

  window.OPEN_MODAL = (TITLE, CONTENT) => {
    const MODAL = document.createElement('div');
    MODAL.className = 'ui-modal-backdrop';
    MODAL.innerHTML = `<section class="ui-modal" role="dialog" aria-modal="true"><h2>${ESCAPE_HTML(TITLE)}</h2><div>${CONTENT}</div></section>`;
    MODAL.addEventListener('click', (EVENT) => {
      if (EVENT.target === MODAL) MODAL.remove();
    });
    document.body.appendChild(MODAL);
    return MODAL;
  };

  window.CLOSE_MODAL = (MODAL) => MODAL?.remove();

  const OPEN_ADMIN_SETTINGS_MODAL = async (TYPE) => {
    if (document.querySelector('.admin-settings-modal-backdrop')) return;
    const SECURITY = TYPE === 'security';
    const BACKDROP = document.createElement('div');
    BACKDROP.className = 'admin-settings-modal-backdrop';
    BACKDROP.innerHTML = SECURITY
      ? `<section class="admin-settings-modal" role="dialog" aria-modal="true" aria-labelledby="admin-security-title">
          <header class="admin-settings-modal-header"><h2 id="admin-security-title">安全</h2><button class="admin-settings-modal-close" type="button" aria-label="关闭">×</button></header>
          <form class="admin-settings-modal-form">
            <label>管理员用户名<input name="username" type="text" maxlength="256" autocomplete="username" required></label>
            <label>管理员密码（至少 8 个字符）<input name="password" type="password" minlength="8" maxlength="1024" autocomplete="new-password" required></label>
            <label>再次输入管理员密码<input name="passwordConfirmation" type="password" minlength="8" maxlength="1024" autocomplete="new-password" required></label>
            <p class="admin-settings-modal-message" role="status"></p>
            <footer class="admin-settings-modal-footer"><button class="admin-settings-modal-cancel button button-white" type="button">取消</button><button class="admin-settings-modal-save button button-black" type="submit">保存</button></footer>
          </form>
        </section>`
      : `<section class="admin-settings-modal" role="dialog" aria-modal="true" aria-labelledby="admin-site-title">
          <header class="admin-settings-modal-header"><h2 id="admin-site-title">站点</h2><button class="admin-settings-modal-close" type="button" aria-label="关闭">×</button></header>
          <form class="admin-settings-modal-form">
            <label>管理路径<input name="adminPath" type="text" maxlength="128" pattern="[A-Za-z0-9_\\-]{1,128}" autocomplete="off" required><small>更改后通过新路径访问管理面板。</small></label>
            <label>站点名称<input name="siteName" type="text" maxlength="100" autocomplete="organization" required><small>管理面板标题将显示为“站点名称 管理面板”。</small></label>
            <p class="admin-settings-modal-message" role="status"></p>
            <footer class="admin-settings-modal-footer"><button class="admin-settings-modal-cancel button button-white" type="button">取消</button><button class="admin-settings-modal-save button button-black" type="submit">保存</button></footer>
          </form>
        </section>`;

    document.body.appendChild(BACKDROP);
    NORMALIZE_CONTROLS(BACKDROP);
    const FORM = BACKDROP.querySelector('form');
    const MESSAGE = BACKDROP.querySelector('.admin-settings-modal-message');
    const SAVE = BACKDROP.querySelector('.admin-settings-modal-save');
    const CLOSE = () => {
      BACKDROP.remove();
      document.removeEventListener('keydown', ON_KEYDOWN);
    };
    const ON_KEYDOWN = (EVENT) => {
      if (EVENT.key === 'Escape' && document.body.contains(BACKDROP)) CLOSE();
    };
    document.addEventListener('keydown', ON_KEYDOWN);
    BACKDROP.addEventListener('click', (EVENT) => {
      if (EVENT.target === BACKDROP) CLOSE();
    });
    BACKDROP.querySelector('.admin-settings-modal-close').addEventListener('click', CLOSE);
    BACKDROP.querySelector('.admin-settings-modal-cancel').addEventListener('click', CLOSE);

    try {
      const RESPONSE = await fetch(SECURITY ? '/api/manage/sysConfig/security' : '/api/manage/sysConfig/site', {
        credentials: 'include',
      });
      const SETTINGS = await RESPONSE.json();
      if (!RESPONSE.ok) throw new Error(SETTINGS.error || `Settings request failed (${RESPONSE.status})`);
      if (SECURITY) {
        FORM.elements.username.value = SETTINGS.username || '';
      } else {
        FORM.elements.adminPath.value = String(SETTINGS.adminPath || '/admin').replace(/^\/+/, '');
        FORM.elements.siteName.value = SETTINGS.siteName || 'cf-imghub';
      }
      BACKDROP.querySelector('.admin-settings-modal-close').focus();
    } catch (ERROR) {
      console.error(`Failed to load ${TYPE} settings:`, ERROR);
      MESSAGE.textContent = ERROR.message || '加载设置失败，请稍后重试。';
      MESSAGE.classList.add('is-error');
      SAVE.disabled = true;
      return;
    }

    FORM.addEventListener('submit', async (EVENT) => {
      EVENT.preventDefault();
      if (!FORM.reportValidity()) return;
      SAVE.disabled = true;
      MESSAGE.textContent = '';
      MESSAGE.classList.remove('is-error');
      const PAYLOAD = SECURITY
        ? {
            username: FORM.elements.username.value,
            password: FORM.elements.password.value,
            passwordConfirmation: FORM.elements.passwordConfirmation.value,
          }
        : {
            adminPath: FORM.elements.adminPath.value,
            siteName: FORM.elements.siteName.value,
          };
      try {
        const RESPONSE = await fetch(SECURITY ? '/api/manage/sysConfig/security' : '/api/manage/sysConfig/site', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(PAYLOAD),
        });
        const RESULT = await RESPONSE.json();
        if (!RESPONSE.ok) throw new Error(RESULT.error || `Settings save failed (${RESPONSE.status})`);
        if (SECURITY && RESULT.adminPasswordChanged) {
          MESSAGE.textContent = '管理员账号已更新，正在返回登录页…';
          setTimeout(() => window.location.assign('/adminLogin'), 600);
          return;
        }
        if (SECURITY) {
          MESSAGE.textContent = '管理员账号已设置，管理接口现在需要登录。';
        } else {
          const CURRENT_PATH = window.location.pathname;
          CURRENT_ADMIN_PATH = RESULT.adminPath;
          APPLY_SITE_NAME(RESULT.siteName, true);
          if (CURRENT_PATH !== RESULT.adminPath) {
            window.location.assign(`${RESULT.adminPath}${window.location.search}${window.location.hash}`);
            return;
          }
          MESSAGE.textContent = '站点设置已保存。';
        }
      } catch (ERROR) {
        console.error(`Failed to save ${TYPE} settings:`, ERROR);
        MESSAGE.textContent = ERROR.message || '保存失败，请稍后重试。';
        MESSAGE.classList.add('is-error');
      } finally {
        SAVE.disabled = false;
      }
    });
  };

  let CURRENT_SITE_NAME = 'cf-imghub';
  let CURRENT_ADMIN_PATH = '/admin';
  let SITE_TITLE_OBSERVER;

  const UPDATE_ADMIN_PANEL_HEADING = () => {
    const HEADING = document.querySelector('.admin-panel-heading');
    if (HEADING) HEADING.textContent = `${CURRENT_SITE_NAME} 管理面板`;
  };

  const APPLY_SITE_NAME = (SITE_NAME, IS_ADMIN = false) => {
    const NAME = SITE_NAME || 'cf-imghub';
    CURRENT_SITE_NAME = NAME;
    const TITLE = IS_ADMIN ? `${NAME} 管理面板` : NAME;
    document.title = TITLE;
    UPDATE_ADMIN_PANEL_HEADING();
    let OG_TITLE = document.querySelector('meta[property="og:title"]');
    if (!OG_TITLE) {
      OG_TITLE = document.createElement('meta');
      OG_TITLE.setAttribute('property', 'og:title');
      document.head.appendChild(OG_TITLE);
    }
    OG_TITLE.content = TITLE;
    if (!SITE_TITLE_OBSERVER) {
      const TITLE_ELEMENT = document.querySelector('title');
      SITE_TITLE_OBSERVER = new MutationObserver(() => {
        const IS_ADMIN_PAGE = window.location.pathname === CURRENT_ADMIN_PATH
          || window.location.pathname === '/adminLogin';
        const CURRENT_TITLE = IS_ADMIN_PAGE
          ? `${CURRENT_SITE_NAME} 管理面板`
          : CURRENT_SITE_NAME;
        if (document.title !== CURRENT_TITLE) document.title = CURRENT_TITLE;
        OG_TITLE.content = CURRENT_TITLE;
      });
      SITE_TITLE_OBSERVER.observe(TITLE_ELEMENT, { childList: true });
    }
  };

  const ADD_CONFIGURED_ADMIN_ROUTE = (ADMIN_PATH) => {
    if (!ADMIN_PATH) return false;
    const ROOT = document.getElementById('app');
    const ROUTER = ROOT?.__vue_app__?.config?.globalProperties?.$router
      || ROOT?.__vue_app__?._instance?.proxy?.$router;
    if (!ROUTER) return false;
    const ADMIN_ROUTE = ROUTER.getRoutes().find((ROUTE) => ROUTE.path === '/admin');
    if (!ADMIN_ROUTE?.components?.default) return false;
    if (ADMIN_PATH !== '/admin' && !ROUTER.hasRoute('configured-admin-path')) {
      ROUTER.addRoute({
        path: ADMIN_PATH,
        name: 'configured-admin-path',
        component: ADMIN_ROUTE.components.default,
        beforeEnter: ADMIN_ROUTE.beforeEnter,
        meta: ADMIN_ROUTE.meta,
        props: ADMIN_ROUTE.props,
      });
    }
    if (window.location.pathname === ADMIN_PATH) {
      ROUTER.replace(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    }
    return true;
  };

  const LOAD_SITE_CONFIGURATION = async () => {
    try {
      const RESPONSE = await fetch('/api/siteConfig', { credentials: 'include' });
      if (!RESPONSE.ok) throw new Error(`Site settings request failed (${RESPONSE.status})`);
      const SETTINGS = await RESPONSE.json();
      CURRENT_ADMIN_PATH = SETTINGS.adminPath || '/admin';
      const ADMIN_PATH = SETTINGS.adminPath || '/admin';
      const IS_ADMIN = window.location.pathname === ADMIN_PATH
        || window.location.pathname === '/adminLogin';
      APPLY_SITE_NAME(SETTINGS.siteName || 'cf-imghub', IS_ADMIN);
      if (LEGACY_BACKUP_PATH) {
        window.location.replace(`${ADMIN_PATH}#JSON`);
        return;
      }
      if (window.location.pathname === '/admin' && ADMIN_PATH !== '/admin') {
        window.location.replace(`${ADMIN_PATH}${window.location.search}${window.location.hash}`);
        return;
      }
      if (window.location.pathname !== ADMIN_PATH) return;
      let RETRIES = 0;
      const TRY_ADD_ROUTE = () => {
        if (ADD_CONFIGURED_ADMIN_ROUTE(ADMIN_PATH) || RETRIES++ >= 100) return;
        setTimeout(TRY_ADD_ROUTE, 100);
      };
      TRY_ADD_ROUTE();
    } catch (ERROR) {
      console.error('Failed to load site settings:', ERROR);
    }
  };

  LOAD_SITE_CONFIGURATION();

  const ADD_STORAGE_DISCLOSURES = () => {
    const SETTINGS = document.querySelector('.admin-settings-content > .upload-settings');
    let PANEL = SETTINGS?.querySelector(':scope > .channel-management-panel');
    const HEADER = PANEL?.querySelector(':scope > .page-header')
      || SETTINGS?.querySelector(':scope > .page-header');
    if (!SETTINGS || !HEADER) return;

    if (PANEL) {
      [...PANEL.children].forEach((CHILD) => SETTINGS.insertBefore(CHILD, PANEL));
      PANEL.remove();
    }

    let CHANNEL_LIST = SETTINGS.querySelector(':scope > .channel-list-container');
    if (!CHANNEL_LIST) {
      CHANNEL_LIST = document.createElement('div');
      CHANNEL_LIST.className = 'channel-list-container';
      HEADER.insertAdjacentElement('afterend', CHANNEL_LIST);
    } else if (HEADER.nextElementSibling !== CHANNEL_LIST) {
      HEADER.insertAdjacentElement('afterend', CHANNEL_LIST);
    }

    const GROUPS = [
      ...SETTINGS.querySelectorAll(':scope > .channel-group'),
      ...CHANNEL_LIST.querySelectorAll(':scope > .channel-group'),
    ];

    let HAS_VISIBLE_GROUP = false;
    GROUPS.forEach((GROUP, INDEX) => {
      GROUP.querySelector(':scope > .storage-disclosure')?.remove();
      delete GROUP.dataset.expanded;
      GROUP.dataset.empty = String(GROUP.querySelectorAll('.channel-card').length === 0);
      GROUP.dataset.firstVisible = String(GROUP.dataset.empty === 'false' && !HAS_VISIBLE_GROUP);
      if (GROUP.dataset.empty === 'false') HAS_VISIBLE_GROUP = true;
      if (!GROUP.id) GROUP.id = `storage-channel-group-${INDEX}`;
    });

    let DISCLOSURE = SETTINGS.querySelector(':scope > .storage-disclosure-all')
      || CHANNEL_LIST.querySelector(':scope > .storage-disclosure-all');
    if (!DISCLOSURE) {
      const NEW_DISCLOSURE = document.createElement('button');
      NEW_DISCLOSURE.type = 'button';
      NEW_DISCLOSURE.className = 'storage-disclosure storage-disclosure-all';
      NEW_DISCLOSURE.setAttribute('aria-expanded', 'false');

      const COUNT = document.createElement('span');
      COUNT.className = 'storage-disclosure-count';
      const LABEL = document.createElement('span');
      LABEL.className = 'storage-disclosure-label';
      LABEL.textContent = '点击展开';
      const CARET = document.createElement('span');
      CARET.className = 'storage-disclosure-caret';
      CARET.setAttribute('aria-hidden', 'true');
      NEW_DISCLOSURE.append(COUNT, LABEL, CARET);
      NEW_DISCLOSURE.setAttribute('aria-controls', GROUPS.map((GROUP) => GROUP.id).join(' '));

      NEW_DISCLOSURE.addEventListener('click', () => {
        const EXPANDED = NEW_DISCLOSURE.getAttribute('aria-expanded') === 'true';
        NEW_DISCLOSURE.setAttribute('aria-expanded', String(!EXPANDED));
        SETTINGS.dataset.channelsExpanded = String(!EXPANDED);
        LABEL.textContent = EXPANDED ? '点击展开' : '收起';
      });
      DISCLOSURE = NEW_DISCLOSURE;
    }

    DISCLOSURE.setAttribute('aria-controls', GROUPS.map((GROUP) => GROUP.id).join(' '));
    if (DISCLOSURE.parentElement !== CHANNEL_LIST || CHANNEL_LIST.firstElementChild !== DISCLOSURE) {
      CHANNEL_LIST.prepend(DISCLOSURE);
    }
    GROUPS.forEach((GROUP) => {
      if (GROUP.parentElement !== CHANNEL_LIST) CHANNEL_LIST.append(GROUP);
    });

    const CHANNEL_COUNT = GROUPS.reduce((TOTAL, GROUP) => TOTAL + GROUP.querySelectorAll('.channel-card').length, 0);
    const COUNT = DISCLOSURE.querySelector('.storage-disclosure-count');
    if (COUNT && COUNT.textContent !== `${CHANNEL_COUNT} 个渠道`) {
      COUNT.textContent = `${CHANNEL_COUNT} 个渠道`;
    }
    ADD_BACKUP_MIGRATION_CARD(SETTINGS);
  };

  const ADD_BACKUP_MIGRATION_CARD = (SETTINGS) => {
    if (!SETTINGS) return;
    let CARD = SETTINGS.parentElement.querySelector(':scope > .admin-backup-migration-card');
    if (CARD) {
      if (SETTINGS.nextElementSibling !== CARD) SETTINGS.after(CARD);
      return;
    }

    CARD = document.createElement('section');
    CARD.className = 'admin-backup-migration-card';
    const COPY = document.createElement('div');
    COPY.className = 'admin-backup-migration-copy';
    const TITLE = document.createElement('h2');
    TITLE.textContent = '备份与迁移';
    const NOTE = document.createElement('p');
    NOTE.textContent = '备份、恢复并查看 KV 中所有配置、订阅与链接 JSON。';
    COPY.append(TITLE, NOTE);
    const LINK = document.createElement('a');
    LINK.className = 'button ui-button ui-button-primary';
    LINK.href = `${CURRENT_ADMIN_PATH}#JSON`;
    LINK.textContent = '进入';
    CARD.append(COPY, LINK);
    SETTINGS.after(CARD);
  };

  const INIT_ADMIN_BACKUP_PAGE = () => {
    if (window.location.pathname !== CURRENT_ADMIN_PATH || window.location.hash !== '#JSON') return;
    document.body.classList.add('admin-backup-page', 'migration-page');
    if (document.getElementById('admin-backup-root')) return;

    const ROOT = document.createElement('main');
    ROOT.id = 'admin-backup-root';
    ROOT.innerHTML = `
      <header class="migration-header">
        <div class="migration-header-main"><h1>备份与迁移</h1><p class="subtitle">共 <span id="entry-count" data-backup-count>0</span> 项 KV 数据；导入时同名键覆盖，其他数据保留</p></div>
        <div class="migration-actions">
          <button type="button" class="danger" id="reset-open" data-backup-action="reset">恢复出厂设置</button>
          <button type="button" id="export-all" data-backup-action="export">导出</button>
          <button type="button" class="secondary" id="import-all" data-backup-action="import">导入</button>
          <button type="button" class="secondary" id="refresh-all" data-backup-action="refresh">刷新</button>
          <a class="back-link ui-button ui-button-secondary" data-backup-home>返回管理面板</a>
        </div>
      </header>
      <div id="json-list" class="json-list" aria-live="polite"></div>
      <input class="admin-backup-file" type="file" accept=".json,application/json" hidden>
      <div class="overlay" id="view-overlay" aria-hidden="true"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="view-title"><div class="dialog-header"><h2 id="view-title"></h2><button type="button" class="dialog-close secondary" id="view-close" aria-label="关闭">×</button></div><pre class="json-value" id="view-value"></pre></section></div>
      <div class="overlay" id="reset-overlay" aria-hidden="true"><section class="dialog reset-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-title"><h2 id="reset-title">恢复出厂设置</h2><p class="reset-warning">此操作会永久删除当前 KV 中的全部数据，包括管理员设置、文件记录及索引。请先导出备份；删除后无法撤销。</p><label>输入 DELETE 以确认<input id="reset-confirmation" type="text" autocomplete="off" required></label><div class="dialog-actions"><button type="button" class="secondary" id="reset-cancel">取消</button><button type="button" class="danger" id="reset-confirm">确认删除全部数据</button></div></section></div>
      <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
      `;
    document.body.appendChild(ROOT);

    const LIST = ROOT.querySelector('#json-list');
    const SUBTITLE = ROOT.querySelector('.subtitle');
    const COUNT = ROOT.querySelector('#entry-count');
    const FILE_INPUT = ROOT.querySelector('.admin-backup-file');
    const TOAST = ROOT.querySelector('#toast');
    const VIEW_OVERLAY = ROOT.querySelector('#view-overlay');
    const RESET_OVERLAY = ROOT.querySelector('#reset-overlay');
    const ENTRIES = [];
    let TOAST_TIMER;

    ROOT.querySelector('[data-backup-home]').href = CURRENT_ADMIN_PATH;
    const SHOW_MESSAGE = (MESSAGE, IS_ERROR = false) => {
      TOAST.textContent = MESSAGE;
      TOAST.style.background = IS_ERROR ? '#b42318' : '';
      TOAST.hidden = false;
      clearTimeout(TOAST_TIMER);
      TOAST_TIMER = setTimeout(() => { TOAST.hidden = true; }, 2600);
    };
    const REQUEST_JSON = async (URL, OPTIONS) => {
      const RESPONSE = await fetch(URL, { credentials: 'same-origin', ...OPTIONS });
      let RESULT;
      try {
        RESULT = await RESPONSE.json();
      } catch {
        throw new Error(`服务器返回了无效响应（HTTP ${RESPONSE.status}）。`);
      }
      if (!RESPONSE.ok || RESULT.ok === false) {
        throw new Error(RESULT.error || `请求失败（HTTP ${RESPONSE.status}）。`);
      }
      return RESULT;
    };
    const LOAD_ENTRIES = async () => {
      LIST.replaceChildren();
      ENTRIES.length = 0;
      SUBTITLE.textContent = '正在读取 KV 数据…';
      let CURSOR = null;
      do {
        const QUERY = CURSOR ? `?cursor=${encodeURIComponent(CURSOR)}` : '';
        const PAGE = await REQUEST_JSON(`/api/manage/batch/kv${QUERY}`);
        if (!Array.isArray(PAGE.entries)) throw new Error('KV 数据列表格式无效。');
        ENTRIES.push(...PAGE.entries);
        CURSOR = PAGE.cursor || null;
        SUBTITLE.textContent = `正在读取 ${ENTRIES.length} 项 KV 数据…`;
      } while (CURSOR);

      ENTRIES.sort((LEFT, RIGHT) => LEFT.name.localeCompare(RIGHT.name));
      COUNT.textContent = String(ENTRIES.length);
      SUBTITLE.textContent = `共 ${ENTRIES.length} 项 KV 数据；导入时同名键覆盖，其他数据保留`;
      const CARDS = ENTRIES.length ? ENTRIES.map((ENTRY, INDEX) => {
        const CARD = document.createElement('article');
        CARD.className = 'json-entry';
        const HEAD = document.createElement('div');
        HEAD.className = 'json-entry-head';
        const NAME = document.createElement('div');
        NAME.className = 'json-key';
        NAME.textContent = ENTRY.name;
        const SHOW = document.createElement('button');
        SHOW.type = 'button';
        SHOW.className = 'secondary json-show';
        SHOW.textContent = '展示';
        SHOW.dataset.backupIndex = String(INDEX);
        HEAD.append(NAME, SHOW);
        CARD.append(HEAD);
        return CARD;
      }) : [Object.assign(document.createElement('div'), {
        className: 'json-entry json-empty',
        textContent: 'KV 暂无数据',
      })];
      LIST.replaceChildren(...CARDS);
      NORMALIZE_CONTROLS(ROOT);
    };
    const READ_ENTRY = async (KEY) => {
      const QUERY = new URLSearchParams({ key: KEY });
      const RESULT = await REQUEST_JSON(`/api/manage/batch/kv?${QUERY}`);
      if (!RESULT.entry || RESULT.entry.name !== KEY) throw new Error(`KV 项目“${KEY}”读取结果无效。`);
      return RESULT.entry;
    };
    const DOWNLOAD_BACKUP = async (BUTTON) => {
      BUTTON.disabled = true;
      const DATA = Object.create(null);
      try {
        for (let INDEX = 0; INDEX < ENTRIES.length; INDEX += 10) {
          const BATCH = ENTRIES.slice(INDEX, INDEX + 10);
          const VALUES = await Promise.all(BATCH.map((ENTRY) => READ_ENTRY(ENTRY.name)));
          VALUES.forEach((ENTRY) => { DATA[ENTRY.name] = ENTRY.raw; });
          SUBTITLE.textContent = `正在导出 KV 数据 ${Math.min(INDEX + BATCH.length, ENTRIES.length)}/${ENTRIES.length}…`;
        }
        const BLOB = new Blob([JSON.stringify(DATA, null, 2)], {
          type: 'application/json;charset=utf-8',
        });
        const OBJECT_URL = URL.createObjectURL(BLOB);
        const ANCHOR = document.createElement('a');
        ANCHOR.href = OBJECT_URL;
        ANCHOR.download = `cf-imghub-kv-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(ANCHOR);
        ANCHOR.click();
        ANCHOR.remove();
        setTimeout(() => URL.revokeObjectURL(OBJECT_URL), 1000);
        SUBTITLE.textContent = `共 ${ENTRIES.length} 项 KV 数据；导入时同名键覆盖，其他数据保留`;
        SHOW_MESSAGE('已导出全部 KV 数据。');
      } catch (ERROR) {
        SUBTITLE.textContent = ERROR.message;
        SHOW_MESSAGE(ERROR.message, true);
      } finally {
        BUTTON.disabled = false;
      }
    };
    const OPEN_OVERLAY = (OVERLAY) => {
      OVERLAY.classList.add('open');
      OVERLAY.setAttribute('aria-hidden', 'false');
    };
    const CLOSE_OVERLAY = (OVERLAY) => {
      OVERLAY.classList.remove('open');
      OVERLAY.setAttribute('aria-hidden', 'true');
    };

    ROOT.addEventListener('click', async (EVENT) => {
        const ACTION = EVENT.target.closest('[data-backup-action]')?.dataset.backupAction;
      if (ACTION === 'export') {
        await DOWNLOAD_BACKUP(EVENT.target.closest('[data-backup-action]'));
      } else if (ACTION === 'refresh') {
        try {
          await LOAD_ENTRIES();
          SHOW_MESSAGE('KV 数据已刷新。');
        } catch (ERROR) {
          SUBTITLE.textContent = ERROR.message;
          SHOW_MESSAGE(ERROR.message, true);
        }
      } else if (ACTION === 'import') {
        FILE_INPUT.click();
      } else if (ACTION === 'reset') {
        OPEN_OVERLAY(RESET_OVERLAY);
      }

      const SHOW = EVENT.target.closest('[data-backup-index]');
      if (SHOW) {
        const ENTRY = ENTRIES[Number(SHOW.dataset.backupIndex)];
        if (!ENTRY) return;
        SHOW.disabled = true;
        try {
          const VALUE = await READ_ENTRY(ENTRY.name);
          ROOT.querySelector('#view-title').textContent = VALUE.name;
          ROOT.querySelector('#view-value').textContent = VALUE.value;
          OPEN_OVERLAY(VIEW_OVERLAY);
        } catch (ERROR) {
          SHOW_MESSAGE(ERROR.message, true);
        } finally {
          SHOW.disabled = false;
        }
      }
      if (EVENT.target.closest('#view-close')) CLOSE_OVERLAY(VIEW_OVERLAY);
      if (EVENT.target === VIEW_OVERLAY) CLOSE_OVERLAY(VIEW_OVERLAY);
      if (EVENT.target === RESET_OVERLAY) CLOSE_OVERLAY(RESET_OVERLAY);
      if (EVENT.target.closest('#reset-cancel')) CLOSE_OVERLAY(RESET_OVERLAY);
      if (EVENT.target.closest('#reset-confirm')) {
        const CONFIRMATION = ROOT.querySelector('#reset-confirmation').value;
        if (CONFIRMATION !== 'DELETE') {
          SHOW_MESSAGE('请输入 DELETE 以确认恢复出厂设置。', true);
          return;
        }
        const BUTTON = EVENT.target.closest('#reset-confirm');
        BUTTON.disabled = true;
        try {
          const RESULT = await REQUEST_JSON('/api/manage/batch/kv', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'factory_reset', confirmation: CONFIRMATION }),
          });
          CLOSE_OVERLAY(RESET_OVERLAY);
          SHOW_MESSAGE(`已删除 ${RESULT.deleted} 项 KV 数据。`);
          setTimeout(() => window.location.assign(CURRENT_ADMIN_PATH), 900);
        } catch (ERROR) {
          SHOW_MESSAGE(ERROR.message, true);
          BUTTON.disabled = false;
        }
      }
    });
    document.addEventListener('keydown', (EVENT) => {
      if (EVENT.key === 'Escape') {
        CLOSE_OVERLAY(VIEW_OVERLAY);
        CLOSE_OVERLAY(RESET_OVERLAY);
      }
    });
    FILE_INPUT.addEventListener('change', async () => {
      const FILE = FILE_INPUT.files?.[0];
      if (!FILE) return;
      try {
        if (FILE.size > 20 * 1024 * 1024) throw new Error('备份文件过大，单次导入上限为 20 MB。');
        const PAYLOAD = JSON.parse(await FILE.text());
        if (!PAYLOAD || typeof PAYLOAD !== 'object' || Array.isArray(PAYLOAD)) {
          throw new Error('导入内容必须是一个 JSON 对象。');
        }
        if (!window.confirm(`将导入 ${Object.keys(PAYLOAD).length} 项数据。同名键会被覆盖，其他数据保留。是否继续？`)) return;
        const RESULT = await REQUEST_JSON('/api/manage/batch/kv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'import_all_json', payload: PAYLOAD }),
        });
        await LOAD_ENTRIES();
        SHOW_MESSAGE(`已导入 ${RESULT.count} 项数据。`);
      } catch (ERROR) {
        SHOW_MESSAGE(ERROR.message || '导入失败。', true);
      } finally {
        FILE_INPUT.value = '';
      }
    });
    LOAD_ENTRIES().catch((ERROR) => {
      SUBTITLE.textContent = ERROR.message;
      SHOW_MESSAGE(ERROR.message, true);
    });
  };

  const SYNC_VISUAL_VIEWPORT = () => {
    const ROOT = document.documentElement;
    const VIEWPORT = window.visualViewport;
    const LEFT = VIEWPORT ? VIEWPORT.offsetLeft : 0;
    const WIDTH = VIEWPORT ? VIEWPORT.width : window.innerWidth;
    ROOT.style.setProperty('--ADMIN-VISUAL-LEFT', `${LEFT}px`);
    ROOT.style.setProperty('--ADMIN-VISUAL-WIDTH', `${WIDTH}px`);
    ROOT.style.setProperty('--ADMIN-VISUAL-GUTTER', `${WIDTH * 0.04}px`);
    ROOT.style.setProperty('--ADMIN-VISUAL-CONTENT-WIDTH', `${WIDTH * 0.92}px`);
  };

  const MOVE_HOME_ACTIONS = () => {
    const HOME = document.querySelector('.upload-home');
    if (!HOME) return;
    document.querySelectorAll('.history-container').forEach((PANEL) => PANEL.remove());
    document.querySelectorAll('.el-dropdown-menu__item').forEach((ITEM) => {
      if (
        ITEM.dataset.homeMenuAction === 'history'
        || ITEM.querySelector('.fa-clock-rotate-left')
        || /上传记录|upload history/i.test(`${ITEM.textContent} ${ITEM.title} ${ITEM.getAttribute('aria-label') || ''}`)
      ) ITEM.remove();
    });
    HOME.querySelectorAll('.quick-toolbar-button').forEach((BUTTON) => {
      if (BUTTON.querySelector('svg[data-icon="cloud-arrow-up"]')) BUTTON.remove();
    });
    document.querySelectorAll('.el-dialog.settings-dialog').forEach((DIALOG) => {
      if (!DIALOG.querySelector('.dialog-section')) return;
      DIALOG.closest('.el-overlay')?.remove();
    });
    HOME.querySelectorAll('.mobile-more-dropdown, .mobile-more-button').forEach((MENU) => {
      const DROPDOWN = MENU.matches('.mobile-more-button') ? MENU.closest('.mobile-more-dropdown') : MENU;
      const MENU_ID = DROPDOWN?.querySelector('button[aria-controls]')?.getAttribute('aria-controls');
      document.getElementById(MENU_ID)?.closest('.el-popper')?.remove();
      DROPDOWN?.remove();
    });

    let ACTIONS = HOME.querySelector(':scope > .home-top-actions');
    if (!ACTIONS) {
      ACTIONS = document.createElement('div');
      ACTIONS.className = 'home-top-actions';
      ACTIONS.setAttribute('aria-label', '页面操作');
      HOME.prepend(ACTIONS);
    }

    const MORE_MENU = HOME.querySelector('.more-dropdown.desktop-only');
    const UPLOAD_METHOD = HOME.querySelector('.upload-method-button');
    const QUICK_ACTIONS = HOME.querySelector('.quick-toolbar-actions-inner');
    const QUICK_BUTTONS = QUICK_ACTIONS ? [...QUICK_ACTIONS.querySelectorAll(':scope > .quick-toolbar-button')] : [];
    const FLOATING_UPLOAD = HOME.querySelector('.quick-toolbar > .quick-toolbar-button');
    if (MORE_MENU) {
      MORE_MENU.classList.remove('desktop-only');
      MORE_MENU.classList.add('home-menu-source');
      if (MORE_MENU.parentElement !== HOME) HOME.appendChild(MORE_MENU);
    }

    const MENU_ID = MORE_MENU?.querySelector('.more-button')?.getAttribute('aria-controls');
    const SOURCE_ITEMS = MENU_ID
      ? [...(document.getElementById(MENU_ID)?.querySelectorAll(':scope > .el-dropdown-menu__item') || [])]
      : [];
    const MENU_ACTIONS = [
      ...ACTIONS.querySelectorAll('[data-home-menu-action="language"]'),
      ...SOURCE_ITEMS.filter((ITEM) => /^(English|中文|简体中文|繁體中文)$/i.test(ITEM.textContent.trim())),
    ];

    MENU_ACTIONS.forEach((ITEM) => {
      ITEM.dataset.homeMenuAction = 'language';
      ITEM.classList.add('home-menu-action');
      ITEM.setAttribute('role', 'button');
      ITEM.setAttribute('tabindex', '0');
      ITEM.setAttribute('aria-label', '切换语言');
      ITEM.title = '切换语言';
      [...ITEM.childNodes].forEach((CHILD) => {
        if (CHILD.nodeType === Node.TEXT_NODE) CHILD.remove();
      });
      if (!ITEM.dataset.homeKeyboardReady) {
        ITEM.dataset.homeKeyboardReady = 'true';
        ITEM.addEventListener('keydown', (EVENT) => {
          if (EVENT.key === 'Enter' || EVENT.key === ' ') {
            EVENT.preventDefault();
            ITEM.click();
          }
        });
      }
      if (ITEM.parentElement !== ACTIONS) ACTIONS.appendChild(ITEM);
    });

    const MENU_BUTTONS = [...ACTIONS.querySelectorAll('[data-home-menu-action]')];
    const BUTTONS = [...MENU_BUTTONS, UPLOAD_METHOD, ...QUICK_BUTTONS, FLOATING_UPLOAD].filter(Boolean);

    UPLOAD_METHOD?.classList.remove('desktop-only');

    BUTTONS.forEach((BUTTON) => {
      if (BUTTON.parentElement !== ACTIONS) ACTIONS.appendChild(BUTTON);
    });
  };

  const ADD_ADMIN_CLIENT_SETTINGS_BUTTON = () => {
    const ADMIN_PAGE = document.querySelector('.admin-settings-page');
    const CONTAINER = ADMIN_PAGE?.querySelector('.admin-settings-content > .upload-settings');
    if (!CONTAINER || CONTAINER.querySelector(':scope > .admin-panel-heading-row')) return;

    const ACTIONS = document.createElement('div');
    ACTIONS.className = 'admin-header-actions';
    const HEADER_ROW = document.createElement('div');
    HEADER_ROW.className = 'admin-panel-heading-row';
    const HEADING = document.createElement('h1');
    HEADING.className = 'admin-panel-heading';
    HEADING.textContent = `${CURRENT_SITE_NAME} 管理面板`;
    HEADER_ROW.append(HEADING, ACTIONS);
    const LOGOUT = async () => {
      try {
        const RESPONSE = await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
        });
        if (!RESPONSE.ok) throw new Error(`Logout request failed (${RESPONSE.status})`);
        window.location.assign('/');
      } catch (ERROR) {
        console.error('Failed to log out:', ERROR);
        window.alert('退出登录失败，请重试。');
      }
    };
    [
      ['admin-client-settings-trigger', '客户端设置', OPEN_CLIENT_SETTINGS],
      ['admin-security-trigger', '安全', () => OPEN_ADMIN_SETTINGS_MODAL('security')],
      ['admin-site-trigger button-black', '站点', () => OPEN_ADMIN_SETTINGS_MODAL('site')],
      ['admin-logout-trigger button-red', '退出', LOGOUT],
    ].forEach(([CLASS_NAME, LABEL, HANDLER]) => {
      const BUTTON = document.createElement('button');
      BUTTON.type = 'button';
      BUTTON.className = CLASS_NAME;
      BUTTON.setAttribute('aria-label', LABEL);
      BUTTON.title = LABEL;
      BUTTON.textContent = LABEL;
      BUTTON.addEventListener('click', HANDLER);
      ACTIONS.appendChild(BUTTON);
    });
    CONTAINER.insertBefore(HEADER_ROW, CONTAINER.firstChild);
    NORMALIZE_CONTROLS(HEADER_ROW);
  };

  const OPEN_CLIENT_SETTINGS = async () => {
    if (document.querySelector('.client-settings-backdrop')) return;

    const ENGLISH = document.documentElement.lang === 'en';
    const BACKDROP = document.createElement('div');
    BACKDROP.className = 'client-settings-backdrop';
    BACKDROP.innerHTML = `
      <section class="client-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="client-settings-title">
        <header class="client-settings-header">
          <h2 id="client-settings-title">${ENGLISH ? 'Client Settings' : '客户端设置'}</h2>
          <button class="client-settings-close" type="button" aria-label="${ENGLISH ? 'Close' : '关闭'}">×</button>
        </header>
        <form id="client-settings-form" class="client-settings-form">
          <section class="client-settings-upload-settings" aria-labelledby="client-settings-upload-title">
            <h3 id="client-settings-upload-title">${ENGLISH ? 'Upload Settings' : '上传设置'}</h3>
            <div class="client-settings-fields" aria-live="polite">${ENGLISH ? 'Loading…' : '正在加载…'}</div>
            <p class="client-settings-message" role="status"></p>
          </section>
        </form>
        <div class="client-settings-extra"></div>
        <footer class="client-settings-footer">
          <button class="client-settings-cancel" type="button">${ENGLISH ? 'Cancel' : '取消'}</button>
          <button class="client-settings-save" type="submit" form="client-settings-form">${ENGLISH ? 'Save' : '保存'}</button>
        </footer>
      </section>`;
    const EXTRA = BACKDROP.querySelector('.client-settings-extra');
    const ADMIN_SETTINGS_CONTENT = document.querySelector('.admin-settings-content');
    let SETTINGS_PARKING = ADMIN_SETTINGS_CONTENT?.querySelector(
      ':scope > .client-settings-source-parking',
    );
    if (ADMIN_SETTINGS_CONTENT && !SETTINGS_PARKING) {
      SETTINGS_PARKING = document.createElement('div');
      SETTINGS_PARKING.className = 'client-settings-source-parking';
      SETTINGS_PARKING.setAttribute('aria-hidden', 'true');
      ADMIN_SETTINGS_CONTENT.appendChild(SETTINGS_PARKING);
    }
    const OTHER_SETTINGS = ADMIN_SETTINGS_CONTENT?.querySelector(':scope > .others-settings');
    const MOVED_SETTINGS = [];
    const IS_CLIENT_SETTINGS_SECTION = (CARD) => {
      const TITLE = CARD.querySelector('.first-title')?.textContent.trim() || '';
      return /^CloudFlare API Token\b/i.test(TITLE) || /^WebDAV\b/i.test(TITLE);
    };
    if (SETTINGS_PARKING) {
      OTHER_SETTINGS?.querySelectorAll(':scope > .first-settings').forEach((CARD) => {
        if (!IS_CLIENT_SETTINGS_SECTION(CARD)) return;
        MOVED_SETTINGS.push(CARD);
        SETTINGS_PARKING.appendChild(CARD);
      });
      const FLOATING_SAVE = OTHER_SETTINGS?.querySelector(':scope > .floating-save-btn');
      if (FLOATING_SAVE) SETTINGS_PARKING.appendChild(FLOATING_SAVE);
    }
    if (OTHER_SETTINGS && !OTHER_SETTINGS.querySelector('.first-settings, input, textarea, select, .el-input, .el-select, .el-switch, .el-checkbox, .el-radio')) {
      OTHER_SETTINGS.remove();
    }
    if (SETTINGS_PARKING) {
      SETTINGS_PARKING.querySelectorAll(':scope > .first-settings').forEach((CARD) => {
        if (!CARD.querySelector(':scope > .first-title, :scope > .el-form')) {
          CARD.remove();
        }
      });
      SETTINGS_PARKING.querySelectorAll(':scope > .first-settings').forEach((CARD) => {
        if (IS_CLIENT_SETTINGS_SECTION(CARD) && !MOVED_SETTINGS.includes(CARD)) {
          MOVED_SETTINGS.push(CARD);
        }
      });
      const SPLIT_SETTINGS = [];
      MOVED_SETTINGS.forEach((CARD) => {
        const TOKEN_TITLE = [...CARD.querySelectorAll(':scope > .first-title')]
          .find((TITLE) => /^CloudFlare API Token\b/i.test(TITLE.textContent.trim()));
        const DAV_TITLE = [...CARD.querySelectorAll(':scope > .first-title')]
          .find((TITLE) => /^WebDAV\b/i.test(TITLE.textContent.trim()));
        const DAV_FORM = DAV_TITLE?.nextElementSibling;
        if (!TOKEN_TITLE || !DAV_TITLE || !DAV_FORM?.matches('.el-form')) return;

        const DAV_CARD = CARD.cloneNode(false);
        CARD.after(DAV_CARD);
        DAV_CARD.append(DAV_TITLE, DAV_FORM);
        const SAVE_BUTTON = CARD.querySelector(':scope > .admin-inline-save');
        if (SAVE_BUTTON) DAV_CARD.appendChild(SAVE_BUTTON);
        SPLIT_SETTINGS.push(DAV_CARD);
      });
      MOVED_SETTINGS.push(...SPLIT_SETTINGS);
      MOVED_SETTINGS.forEach((CARD) => {
        CARD.querySelectorAll(
          '.first-title .el-tooltip__trigger, .first-title .fa-circle-question',
        ).forEach((ICON) => ICON.remove());
        EXTRA.appendChild(CARD);
        NORMALIZE_CONTROLS(CARD);
      });
      const PARKED_SAVE = SETTINGS_PARKING.querySelector(':scope > .floating-save-btn');
      if (PARKED_SAVE) {
        SETTINGS_PARKING.appendChild(PARKED_SAVE);
      }
    }
    const CLOSE = () => {
      MOVED_SETTINGS.forEach((CARD) => SETTINGS_PARKING?.appendChild(CARD));
      SETTINGS_PARKING?.querySelectorAll(':scope > .first-settings').forEach((CARD) => {
        if (!CARD.querySelector(':scope > .first-title, :scope > .el-form')) {
          CARD.remove();
        }
      });
      BACKDROP.remove();
      document.removeEventListener('keydown', ON_KEYDOWN);
    };
    BACKDROP.addEventListener('click', (EVENT) => {
      if (EVENT.target === BACKDROP) CLOSE();
    });
    BACKDROP.querySelector('.client-settings-close').addEventListener('click', CLOSE);
    BACKDROP.querySelector('.client-settings-cancel').addEventListener('click', CLOSE);
    const ON_KEYDOWN = (EVENT) => {
      if (EVENT.key === 'Escape' && document.body.contains(BACKDROP)) {
        CLOSE();
        document.removeEventListener('keydown', ON_KEYDOWN);
      }
    };
    document.addEventListener('keydown', ON_KEYDOWN);
    document.body.appendChild(BACKDROP);
    NORMALIZE_CONTROLS(BACKDROP);

    const FORM = BACKDROP.querySelector('.client-settings-form');
    FORM.noValidate = true;
    const FIELDS = BACKDROP.querySelector('.client-settings-fields');
    const MESSAGE = BACKDROP.querySelector('.client-settings-message');
    const LABELS = {
      showDirectorySuggestions: ['目录候选项', 'Directory Suggestions'],
      defaultUploadChannel: ['默认渠道类型', 'Default Channel Type'],
      defaultChannelName: ['默认渠道名称', 'Default Channel Name'],
      defaultConvertToWebp: ['默认转换 WebP', 'Default Convert to WebP'],
      defaultCustomerCompress: ['是否开启压缩', 'Enable Compression'],
      defaultCompressBar: ['默认压缩阈值 (MB)', 'Default Compress Threshold (MB)'],
      defaultCompressQuality: ['默认压缩期望 (MB)', 'Default Compress Target (MB)'],
    };
    let SETTINGS;
    let CHANNELS;

    const MAKE_FIELD = (SETTING) => {
      const ID = SETTING.id;
      const WRAPPER = document.createElement('label');
      WRAPPER.className = 'client-settings-field';
      const TITLE = document.createElement('span');
      TITLE.className = 'client-settings-label';
      TITLE.textContent = LABELS[ID]?.[ENGLISH ? 1 : 0] || SETTING.label || ID;
      WRAPPER.appendChild(TITLE);
      let CONTROL;

      if (ID === 'showDirectorySuggestions' || ID === 'defaultConvertToWebp' || ID === 'defaultCustomerCompress') {
        CONTROL = document.createElement('input');
        CONTROL.type = 'checkbox';
        const VALUE = SETTING.value ?? SETTING.default ?? false;
        CONTROL.checked = VALUE === true || VALUE === 'true';
        if (ID === 'defaultCustomerCompress') {
          CONTROL.className = 'client-settings-toggle';
          CONTROL.setAttribute('role', 'switch');
        } else {
          CONTROL.className = 'client-settings-checkbox';
        }
      } else if (ID === 'defaultUploadChannel' || ID === 'defaultChannelName') {
        CONTROL = document.createElement('select');
        CONTROL.className = 'client-settings-select';
        if (ID === 'defaultUploadChannel') {
          (SETTING.options || []).forEach((OPTION) => {
            const ITEM = document.createElement('option');
            ITEM.value = OPTION.value;
            ITEM.textContent = ENGLISH ? OPTION.label_en || OPTION.label : OPTION.label;
            CONTROL.appendChild(ITEM);
          });
          CONTROL.value = SETTING.value ?? SETTING.placeholder ?? '';
          CONTROL.addEventListener('change', () => {
            const NAME_SETTING = SETTINGS.config.find((ITEM) => ITEM.id === 'defaultChannelName');
            const VALID_NAMES = CHANNELS[CONTROL.value] || [];
            if (NAME_SETTING && !VALID_NAMES.some((CHANNEL) => CHANNEL.name === NAME_SETTING.value)) {
              NAME_SETTING.value = '';
              const NAME_CONTROL = FORM.elements.defaultChannelName;
              if (NAME_CONTROL) NAME_CONTROL.value = '';
            }
            UPDATE_CHANNEL_NAMES();
          });
        } else {
          UPDATE_CHANNEL_NAMES(CONTROL);
        }
      } else {
        CONTROL = document.createElement('input');
        CONTROL.type = 'number';
        CONTROL.min = ID === 'defaultCompressBar' ? '1' : '0.5';
        CONTROL.max = ID === 'defaultCompressBar' ? '20' : '20';
        CONTROL.step = ID === 'defaultCompressBar' ? '1' : '0.1';
        CONTROL.value = SETTING.value ?? SETTING.placeholder ?? '';
        CONTROL.className = 'client-settings-input';
      }

      CONTROL.name = ID;
      if (ID === 'defaultChannelName') {
        CONTROL.disabled = true;
        CONTROL.addEventListener('change', () => {
          SETTING.value = CONTROL.value;
        });
      }
      WRAPPER.appendChild(CONTROL);
      return WRAPPER;
    };

    const UPDATE_CHANNEL_NAMES = (CONTROL = FORM.elements.defaultChannelName) => {
      if (!CONTROL) return;
      const TYPE = FORM.elements.defaultUploadChannel?.value || '';
      const OPTIONS = CHANNELS?.[TYPE] || [];
      const PREVIOUS = CONTROL.value || SETTINGS?.config.find((ITEM) => ITEM.id === 'defaultChannelName')?.value || '';
      CONTROL.replaceChildren();
      const PLACEHOLDER = document.createElement('option');
      PLACEHOLDER.value = '';
      PLACEHOLDER.textContent = ENGLISH ? 'Select a channel' : '请选择渠道';
      CONTROL.appendChild(PLACEHOLDER);
      OPTIONS.forEach((CHANNEL) => {
        const OPTION = document.createElement('option');
        OPTION.value = CHANNEL.name;
        OPTION.textContent = CHANNEL.name;
        CONTROL.appendChild(OPTION);
      });
      CONTROL.disabled = OPTIONS.length === 0;
      CONTROL.value = OPTIONS.some((CHANNEL) => CHANNEL.name === PREVIOUS) ? PREVIOUS : '';
    };

    FORM.addEventListener('submit', async (EVENT) => {
      EVENT.preventDefault();
      const THRESHOLD = Number(FORM.elements.defaultCompressBar.value);
      const QUALITY = Number(FORM.elements.defaultCompressQuality.value);
      if (!Number.isFinite(THRESHOLD) || THRESHOLD < 1 || THRESHOLD > 20
        || !Number.isFinite(QUALITY) || QUALITY < 0.5 || QUALITY > THRESHOLD) {
        MESSAGE.textContent = ENGLISH
          ? 'Threshold must be 1–20 MB and target must be 0.5 MB or less than the threshold.'
          : '压缩阈值需为 1–20 MB，压缩期望需为 0.5 MB 以上且不超过阈值。';
        MESSAGE.classList.add('is-error');
        return;
      }

      const SAVE = FORM.querySelector('.client-settings-save');
      SAVE.disabled = true;
      MESSAGE.textContent = '';
      MESSAGE.classList.remove('is-error');
      try {
        SETTINGS.config.forEach((SETTING) => {
          const CONTROL = FORM.elements[SETTING.id];
          if (!CONTROL) return;
          SETTING.value = CONTROL.type === 'checkbox' ? CONTROL.checked : CONTROL.value;
        });
        const RESPONSE = await fetch('/api/manage/sysConfig/page', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(SETTINGS),
        });
        if (!RESPONSE.ok) throw new Error(`Settings save failed (${RESPONSE.status})`);
        MESSAGE.textContent = ENGLISH ? 'Settings saved.' : '设置已保存';
      } catch (ERROR) {
        console.error('Failed to save client settings:', ERROR);
        MESSAGE.textContent = ENGLISH ? 'Failed to save settings.' : '保存设置失败，请稍后重试';
        MESSAGE.classList.add('is-error');
      } finally {
        SAVE.disabled = false;
      }
    });

    try {
      const [CONFIG_RESPONSE, CHANNEL_RESPONSE] = await Promise.all([
        fetch('/api/manage/sysConfig/page', { credentials: 'include' }),
        fetch('/api/channels', { credentials: 'include' }),
      ]);
      if (!CONFIG_RESPONSE.ok) throw new Error(`Settings request failed (${CONFIG_RESPONSE.status})`);
      if (!CHANNEL_RESPONSE.ok) throw new Error(`Channel request failed (${CHANNEL_RESPONSE.status})`);
      SETTINGS = await CONFIG_RESPONSE.json();
      CHANNELS = await CHANNEL_RESPONSE.json();
      FIELDS.replaceChildren();
      SETTINGS.config
        .filter((SETTING) => Object.hasOwn(LABELS, SETTING.id))
        .forEach((SETTING) => FIELDS.appendChild(MAKE_FIELD(SETTING)));
      UPDATE_CHANNEL_NAMES();
      BACKDROP.querySelector('.client-settings-close').focus();
    } catch (ERROR) {
      console.error('Failed to load client settings:', ERROR);
      FIELDS.textContent = ENGLISH ? 'Failed to load settings. Please try again.' : '加载设置失败，请关闭后重试。';
      MESSAGE.classList.add('is-error');
    }
  };

  SYNC_VISUAL_VIEWPORT();
  window.addEventListener('resize', SYNC_VISUAL_VIEWPORT, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', SYNC_VISUAL_VIEWPORT, { passive: true });
    window.visualViewport.addEventListener('scroll', SYNC_VISUAL_VIEWPORT, { passive: true });
  }

  const SYSTEM_THEME = window.matchMedia('(prefers-color-scheme: dark)');
  const SYNC_AUTOMATIC_THEME = () => {
    document.documentElement.classList.toggle('dark', SYSTEM_THEME.matches);
  };

  let PAGE_SETTINGS_INSTANCE;
  const GET_PAGE_SETTINGS_INSTANCE = () => {
    if (PAGE_SETTINGS_INSTANCE && !PAGE_SETTINGS_INSTANCE.isUnmounted) return PAGE_SETTINGS_INSTANCE;

    const ROOT_INSTANCE = document.querySelector('#app')?._vnode?.component;
    const VISITED = new Set();
    const FIND_INSTANCE = (INSTANCE) => {
      if (!INSTANCE || VISITED.has(INSTANCE)) return null;
      VISITED.add(INSTANCE);
      if (INSTANCE.proxy?.currentUploadChannel !== undefined
        && Array.isArray(INSTANCE.proxy.settings?.config)) {
        return INSTANCE;
      }

      let FOUND = null;
      const FIND_VNODE = (VNODE) => {
        if (!VNODE || FOUND) return;
        if (VNODE.component) FOUND = FIND_INSTANCE(VNODE.component);
        if (!FOUND && Array.isArray(VNODE.children)) VNODE.children.forEach(FIND_VNODE);
      };
      FIND_VNODE(INSTANCE.subTree);
      return FOUND;
    };

    PAGE_SETTINGS_INSTANCE = FIND_INSTANCE(ROOT_INSTANCE);
    return PAGE_SETTINGS_INSTANCE;
  };

  const SYNC_NATIVE_PAGE_SELECTS = () => {
    const PAGE = document.querySelector('.page-settings');
    const INSTANCE = GET_PAGE_SETTINGS_INSTANCE();
    if (!PAGE || !INSTANCE) return;

    const VM = INSTANCE.proxy;
    const SETTINGS = VM.settings.config;
    const FIELDS = ['defaultUploadChannel', 'defaultChannelName']
      .map((ID) => SETTINGS.find((SETTING) => SETTING.id === ID))
      .filter(Boolean);

    FIELDS.forEach((FIELD) => {
      const LABEL = VM.isEn ? FIELD.label_en || FIELD.label : FIELD.label;
      const FORM_ITEM = [...PAGE.querySelectorAll('.el-form-item')].find((ITEM) => (
        ITEM.querySelector('.el-form-item__label')?.textContent.trim() === LABEL
      ));
      const COMPONENT = FORM_ITEM?.querySelector('.el-select');
      if (!COMPONENT) return;

      let SELECT = FORM_ITEM.querySelector(`select[data-native-system-select="${FIELD.id}"]`);
      if (!SELECT) {
        SELECT = document.createElement('select');
        SELECT.className = 'native-system-select';
        SELECT.dataset.nativeSystemSelect = FIELD.id;
        SELECT.setAttribute('aria-label', LABEL);
        SELECT.addEventListener('change', () => {
          FIELD.value = SELECT.value;
          requestAnimationFrame(SYNC_NATIVE_PAGE_SELECTS);
        });
        COMPONENT.insertAdjacentElement('afterend', SELECT);
      }
      SELECT.setAttribute('aria-label', LABEL);
      COMPONENT.style.display = 'none';

      const OPTIONS = FIELD.id === 'defaultUploadChannel'
        ? (FIELD.options || []).map((OPTION) => ({
          value: OPTION.value,
          label: VM.isEn ? OPTION.label_en || OPTION.label : OPTION.label,
        }))
        : VM.currentChannelList.map((CHANNEL) => ({
          value: CHANNEL.name,
          label: CHANNEL.name,
        }));
      const SIGNATURE = JSON.stringify(OPTIONS);
      if (SELECT.dataset.optionsSignature !== SIGNATURE) {
        SELECT.replaceChildren();
        if (FIELD.id === 'defaultChannelName') {
          const PLACEHOLDER = document.createElement('option');
          PLACEHOLDER.value = '';
          PLACEHOLDER.textContent = VM.isEn ? 'Select a channel' : '请选择渠道';
          SELECT.appendChild(PLACEHOLDER);
        }
        OPTIONS.forEach(({ value, label }) => {
          const OPTION = document.createElement('option');
          OPTION.value = String(value);
          OPTION.textContent = label;
          SELECT.appendChild(OPTION);
        });
        SELECT.dataset.optionsSignature = SIGNATURE;
      }

      SELECT.disabled = FIELD.id === 'defaultChannelName'
        && (!VM.currentUploadChannel || VM.currentChannelList.length === 0);
      if (FIELD.id === 'defaultChannelName' && SELECT.disabled) {
        const PLACEHOLDER = VM.isEn
          ? 'Select an upload channel first'
          : '请先选择上传渠道';
        if (SELECT.options[0].textContent !== PLACEHOLDER) {
          SELECT.options[0].textContent = PLACEHOLDER;
        }
      }

      const CURRENT_VALUE = FIELD.id === 'defaultUploadChannel'
        ? FIELD.value ?? FIELD.placeholder ?? ''
        : FIELD.value ?? '';
      SELECT.value = OPTIONS.some((OPTION) => String(OPTION.value) === String(CURRENT_VALUE))
        ? String(CURRENT_VALUE)
        : '';
    });
  };

  let WEB_DAV_SETTINGS_INSTANCE;
  const GET_WEB_DAV_SETTINGS_INSTANCE = () => {
    if (WEB_DAV_SETTINGS_INSTANCE && !WEB_DAV_SETTINGS_INSTANCE.isUnmounted) {
      return WEB_DAV_SETTINGS_INSTANCE;
    }

    const ROOT_INSTANCE = document.querySelector('#app')?._vnode?.component;
    const VISITED = new Set();
    const FIND_INSTANCE = (INSTANCE) => {
      if (!INSTANCE || VISITED.has(INSTANCE)) return null;
      VISITED.add(INSTANCE);
      if (INSTANCE.proxy?.settings?.webDAV
        && INSTANCE.proxy.availableChannels
        && typeof INSTANCE.proxy.settings.webDAV.uploadChannel === 'string') {
        return INSTANCE;
      }

      let FOUND = null;
      const FIND_VNODE = (VNODE) => {
        if (!VNODE || FOUND) return;
        if (VNODE.component) FOUND = FIND_INSTANCE(VNODE.component);
        if (!FOUND && Array.isArray(VNODE.children)) VNODE.children.forEach(FIND_VNODE);
      };
      FIND_VNODE(INSTANCE.subTree);
      return FOUND;
    };

    WEB_DAV_SETTINGS_INSTANCE = FIND_INSTANCE(ROOT_INSTANCE);
    return WEB_DAV_SETTINGS_INSTANCE;
  };

  const SYNC_NATIVE_WEB_DAV_SELECT = () => {
    const SECTION = document.querySelector('.others-settings');
    const INSTANCE = GET_WEB_DAV_SETTINGS_INSTANCE();
    if (!SECTION || !INSTANCE) return;

    const VM = INSTANCE.proxy;
    const ITEM = [...SECTION.querySelectorAll('.el-form-item')].find((FORM_ITEM) => (
      /^(上传渠道|upload channel)$/i.test(
        FORM_ITEM.querySelector('.el-form-item__label')?.textContent.trim() || '',
      )
    ));
    const COMPONENT = ITEM?.querySelector('.el-select');
    if (!ITEM || !COMPONENT) return;

    const INPUT = COMPONENT.querySelector('input[role="combobox"]');
    const OPTION_LIST = INPUT?.getAttribute('aria-controls')
      ? document.getElementById(INPUT.getAttribute('aria-controls'))
      : null;
    const CHANNEL_TYPES = Object.keys(VM.availableChannels || {});
    const OPTION_LABELS = OPTION_LIST
      ? [...OPTION_LIST.querySelectorAll('[role="option"]')]
        .map((OPTION) => OPTION.textContent.trim())
        .filter(Boolean)
      : [];

    if (!CHANNEL_TYPES.length || !OPTION_LABELS.length) return;
    if (OPTION_LABELS.length !== CHANNEL_TYPES.length) {
      console.error('Unable to synchronize native WebDAV channel selector: option list does not match available channel types.');
      return;
    }

    let SELECT = ITEM.querySelector('select[data-native-webdav-channel-select]');
    if (!SELECT) {
      SELECT = document.createElement('select');
      SELECT.className = 'native-system-select';
      SELECT.dataset.nativeWebdavChannelSelect = '';
      SELECT.setAttribute(
        'aria-label',
        ITEM.querySelector('.el-form-item__label')?.textContent.trim() || 'Upload channel',
      );
      SELECT.addEventListener('change', () => {
        const SETTINGS = VM.settings.webDAV;
        if (!SETTINGS) {
          console.error('Unable to update the WebDAV channel: settings are unavailable.');
          return;
        }
        SETTINGS.uploadChannel = SELECT.value;
        requestAnimationFrame(SYNC_NATIVE_WEB_DAV_SELECT);
      });
      COMPONENT.insertAdjacentElement('afterend', SELECT);
    }

    const PLACEHOLDER = COMPONENT.querySelector('.el-select__placeholder')?.textContent.trim()
      || '默认渠道';
    const OPTIONS = [
      { value: '', label: PLACEHOLDER },
      ...CHANNEL_TYPES.map((VALUE, INDEX) => ({
        value: VALUE,
        label: OPTION_LABELS[INDEX],
      })),
    ];
    const SIGNATURE = JSON.stringify(OPTIONS);
    if (SELECT.dataset.optionsSignature !== SIGNATURE) {
      SELECT.replaceChildren();
      OPTIONS.forEach(({ value, label }) => {
        const OPTION = document.createElement('option');
        OPTION.value = value;
        OPTION.textContent = label;
        SELECT.appendChild(OPTION);
      });
      SELECT.dataset.optionsSignature = SIGNATURE;
    }

    SELECT.value = OPTIONS.some(({ value }) => value === VM.settings.webDAV.uploadChannel)
      ? VM.settings.webDAV.uploadChannel
      : '';
    COMPONENT.style.display = 'none';
  };

  if (SYSTEM_THEME.addEventListener) SYSTEM_THEME.addEventListener('change', SYNC_AUTOMATIC_THEME);
  else SYSTEM_THEME.addListener(SYNC_AUTOMATIC_THEME);

  const SYNC_ADMIN_BACKUP_VIEW = () => {
    if (!document.body) return false;
    const IS_BACKUP_VIEW = window.location.pathname === CURRENT_ADMIN_PATH
      && window.location.hash === '#JSON';
    if (IS_BACKUP_VIEW) {
      document.body.classList.add('admin-backup-page', 'migration-page');
      return true;
    }
    document.body.classList.remove('admin-backup-page', 'migration-page');
    document.getElementById('admin-backup-root')?.remove();
    return false;
  };

  new MutationObserver(SYNC_AUTOMATIC_THEME).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  const HIDE_REMOVED_SETTINGS = () => {
    if (SYNC_ADMIN_BACKUP_VIEW()) {
      INIT_ADMIN_BACKUP_PAGE();
      return;
    }

    if (document.querySelector('.admin-settings-page')) {
      document.documentElement.classList.add('admin-layout');
      document.body?.classList.add('admin-layout');
      ADD_ADMIN_CLIENT_SETTINGS_BUTTON();
    }

    ADD_STORAGE_DISCLOSURES();
    ADD_ADMIN_CLIENT_SETTINGS_BUTTON();
    MOVE_HOME_ACTIONS();
    SYNC_NATIVE_PAGE_SELECTS();
    SYNC_NATIVE_WEB_DAV_SELECT();

    document.querySelectorAll('.admin-settings-content > .security-settings').forEach((SECTION) => SECTION.remove());

    document.querySelectorAll('.el-form-item').forEach((ITEM) => {
      const LABEL = ITEM.querySelector('.el-form-item__label')?.textContent?.trim() || ITEM.textContent || '';
      if (/公告|默认上传目录|默认命名方式|登录页背景图|上传页背景图|上传目录|上传路径|文件夹|命名方式/.test(LABEL)) ITEM.remove();
    });

    document.querySelectorAll('.directory-tree-picker, .directory-suggestion-input').forEach((CONTROL) => CONTROL.remove());
    document.querySelectorAll('.upload-folder').forEach((FOLDER) => {
      if (!FOLDER.children.length && !FOLDER.textContent.trim()) FOLDER.remove();
    });
    document.querySelectorAll('.upload-folder-container').forEach((CONTAINER) => {
      if (!CONTAINER.children.length && !CONTAINER.textContent.trim()) CONTAINER.remove();
    });
    document.querySelectorAll('button, .el-button, a').forEach((ITEM) => {
      if (/选择目录|浏览目录|选择文件夹/.test((ITEM.textContent || '').trim())) ITEM.remove();
    });

    document.querySelectorAll('.el-dialog, .el-message-box').forEach((DIALOG) => {
      if (/公告|announcement/i.test(DIALOG.textContent || '')) DIALOG.remove();
    });

    document.querySelectorAll('.admin-settings-page, .upload-home').forEach((SURFACE) => {
      SURFACE.querySelectorAll('[role="menuitem"], .el-dropdown-menu__item, button, a').forEach((ITEM) => {
        const LABEL = (ITEM.textContent || '').trim();
        if (/^(公告|查看公告|退出登录|登出|登录|管理端登录)$/i.test(LABEL)) ITEM.remove();
      });
    });

    document.querySelectorAll('#themeToggle, .toggle-dark, .toggle-dark-button, .theme-toggle-btn').forEach((CONTROL) => CONTROL.remove());
    document.querySelectorAll('[role="menuitem"], .el-dropdown-menu__item').forEach((ITEM) => {
      const LABEL = (ITEM.textContent || '').trim();
      if (/浅色模式|深色模式|自动模式|light mode|dark mode|auto mode/i.test(LABEL)) ITEM.remove();
    });

    const REMOVED_LABELS = [
      '远端遥测',
      '随机图像API',
      '访客图库',
      '图像审查',
      'IP归属地查询',
      '管理端设置',
    ];

    document.querySelectorAll('.others-settings .first-settings').forEach((CARD) => {
      const TEXT = CARD.textContent || '';
      if (REMOVED_LABELS.some((LABEL) => TEXT.includes(LABEL))) CARD.remove();
    });

    document.querySelectorAll('.page-settings .first-settings').forEach((CARD) => {
      const TEXT = CARD.textContent || '';
      if (REMOVED_LABELS.some((LABEL) => TEXT.includes(LABEL))) CARD.remove();
    });

    document.querySelectorAll('.others-settings').forEach((SECTION) => {
      const HAS_SETTINGS = SECTION.querySelector(
        '.first-settings, input, textarea, select, .el-input, .el-select, .el-switch, .el-checkbox, .el-radio'
      );
      if (!HAS_SETTINGS) SECTION.remove();
    });

    document.querySelectorAll('.admin-settings-header').forEach((HEADER) => HEADER.remove());

    document.querySelectorAll('img.logo, .upload-home .footer, .login .footer, .page-footer').forEach((ELEMENT) => {
      const LINK = ELEMENT.closest('a');
      if (LINK && LINK.querySelectorAll('img').length === 1) LINK.remove();
      else ELEMENT.remove();
    });
    document.querySelectorAll('.upload-home .header').forEach((HEADER) => {
      if (HEADER.textContent.includes('cf-imghub')) HEADER.remove();
    });
    document.querySelectorAll('.quick-toolbar-more').forEach((BUTTON) => BUTTON.remove());
    document.querySelectorAll('.quick-toolbar-actions').forEach((ACTIONS) => {
      ACTIONS.style.gridTemplateRows = '1fr';
      ACTIONS.style.marginBottom = '4px';
      ACTIONS.style.opacity = '1';
      ACTIONS.style.pointerEvents = 'auto';
      ACTIONS.style.transform = 'none';
      const INNER = ACTIONS.querySelector('.quick-toolbar-actions-inner');
      if (INNER) {
        INNER.style.minHeight = 'unset';
        INNER.style.overflow = 'visible';
      }
    });
    document.querySelectorAll('[role="menuitem"]').forEach((ITEM) => {
      if (ITEM.textContent.includes('查看文档')) ITEM.remove();
    });

    document.querySelectorAll(
      '.page-settings .first-settings, .others-settings .first-settings'
    ).forEach((CARD) => {
      if (CARD.querySelector(':scope > .admin-inline-save')) return;

      const SETTINGS = CARD.closest('.page-settings, .others-settings');
      const ORIGINAL_SAVE = SETTINGS?.querySelector('.floating-save-btn');
      if (!ORIGINAL_SAVE) return;

      const BUTTON = document.createElement('button');
      BUTTON.type = 'button';
      BUTTON.className = 'admin-inline-save';
      BUTTON.setAttribute('aria-label', ORIGINAL_SAVE.textContent.trim() || '保存');
      BUTTON.append(document.createTextNode(ORIGINAL_SAVE.textContent.trim() || '保存'));
      BUTTON.addEventListener('click', () => ORIGINAL_SAVE.click());
      CARD.appendChild(BUTTON);
    });
  };

  const SETTINGS_OBSERVER = new MutationObserver(HIDE_REMOVED_SETTINGS);
  SETTINGS_OBSERVER.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', HIDE_REMOVED_SETTINGS);
  HIDE_REMOVED_SETTINGS();
})();
