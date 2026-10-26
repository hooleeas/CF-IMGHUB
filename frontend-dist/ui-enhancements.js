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

  const CC_ICONS = Object.freeze({
    'loader-circle': ['M12 2v4', 'm16.2 7.8 2.9-2.9', 'M18 12h4', 'm16.2 16.2 2.9 2.9', 'M12 18v4', 'm4.9 19.1 2.9-2.9', 'M2 12h4', 'm4.9 4.9 2.9 2.9'],
    'check-circle': ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'm9 11 3 3L22 4'],
    'check-check': ['m18 6-7 7-3-3', 'm22 10-7.5 7.5L13 16'],
    'circle-x': ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'm15 9-6 6', 'm9 9 6 6'],
    'file-warning': ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M12 12v4', 'M12 18h.01'],
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
      if (BUTTON_ELEMENT.matches('.login .submit')) {
        BUTTON_ELEMENT.classList.add('button-black');
      }
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

  const IS_LOGIN_INPUT = (TARGET) => TARGET instanceof Element
    && TARGET.matches('.login input');
  document.addEventListener('compositionstart', (EVENT) => {
    if (IS_LOGIN_INPUT(EVENT.target)) {
      EVENT.target.dataset.imeComposing = 'true';
    }
  }, true);
  document.addEventListener('compositionend', (EVENT) => {
    if (!IS_LOGIN_INPUT(EVENT.target)) return;
    const INPUT = EVENT.target;
    delete INPUT.dataset.imeComposing;
    INPUT.dataset.imeCommitKeyup = 'true';
  }, true);
  document.addEventListener('keydown', (EVENT) => {
    if (!IS_LOGIN_INPUT(EVENT.target) || EVENT.key !== 'Enter') return;
    const INPUT = EVENT.target;
    if (EVENT.isComposing || EVENT.keyCode === 229
      || INPUT.dataset.imeComposing === 'true') {
      INPUT.dataset.imeCommitKeyup = 'true';
    } else {
      delete INPUT.dataset.imeCommitKeyup;
    }
  }, true);
  document.addEventListener('keyup', (EVENT) => {
    if (!IS_LOGIN_INPUT(EVENT.target) || EVENT.key !== 'Enter') return;
    const INPUT = EVENT.target;
    if (!EVENT.isComposing && EVENT.keyCode !== 229
      && INPUT.dataset.imeCommitKeyup !== 'true') return;
    EVENT.stopImmediatePropagation();
    EVENT.stopPropagation();
    EVENT.preventDefault();
    delete INPUT.dataset.imeCommitKeyup;
  }, true);

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
  const UPDATE_CHANNEL_DIALOG = (ROOT = document) => {
    const DIALOGS = [];
    if (ROOT.matches?.('.el-dialog.channel-dialog')) DIALOGS.push(ROOT);
    DIALOGS.push(...ROOT.querySelectorAll('.el-dialog.channel-dialog'));
    DIALOGS.forEach((DIALOG) => {
      const NAME_INPUT = DIALOG.querySelector('.el-form-item input.el-input__inner');
      NAME_INPUT?.closest('.el-form-item')?.classList.add('channel-name-form-item');
      DIALOG.querySelectorAll('.inline-warning-icon').forEach((ICON) => ICON.remove());
    });
  };
  const HIDE_DUPLICATE_R2_OPTION = () => {
    const ROOT_INSTANCE = document.querySelector('#app')?._vnode?.component;
    const VISITED = new Set();
    const PATCH = (INSTANCE) => {
      if (!INSTANCE || VISITED.has(INSTANCE)) return;
      VISITED.add(INSTANCE);
      const VM = INSTANCE.proxy;
      if (Array.isArray(VM?.addableChannels)
        && Array.isArray(VM?.cfr2Settings?.channels)) {
        const ORIGINAL_OPTIONS = INSTANCE.ctx.__allAddableChannels
          || (INSTANCE.ctx.__allAddableChannels = [...VM.addableChannels]);
        const OPTIONS = VM.cfr2Settings.channels.length
          ? ORIGINAL_OPTIONS.filter((OPTION) => OPTION.value !== 'cfr2')
          : ORIGINAL_OPTIONS;
        if (JSON.stringify(VM.addableChannels) !== JSON.stringify(OPTIONS)) {
          VM.addableChannels = OPTIONS;
        }
      }
      if (typeof VM?.confirmEditChannel === 'function'
        && !INSTANCE.ctx.__r2ChannelRenamePatched) {
        const ORIGINAL_CONFIRM = VM.confirmEditChannel;
        VM.confirmEditChannel = function (...ARGS) {
          const COMPONENT = this ?? VM;
          if (COMPONENT.currentChannelType !== 'cfr2') {
            return ORIGINAL_CONFIRM.apply(COMPONENT, ARGS);
          }
          const CHANNEL = COMPONENT.cfr2Settings?.channels?.[COMPONENT.currentChannelIndex];
          const FORM = COMPONENT.$refs.editForm;
          const VALIDATE = FORM?.validate;
          if (!CHANNEL || CHANNEL.fixed || typeof VALIDATE !== 'function') {
            return ORIGINAL_CONFIRM.apply(COMPONENT, ARGS);
          }
          FORM.validate = function (CALLBACK, ...VALIDATE_ARGS) {
            if (typeof CALLBACK !== 'function') {
              return VALIDATE.call(this, CALLBACK, ...VALIDATE_ARGS);
            }
            return VALIDATE.call(this, (IS_VALID, ...RESULT) => {
              if (!IS_VALID) return CALLBACK(IS_VALID, ...RESULT);
              CHANNEL.fixed = true;
              try {
                return CALLBACK(IS_VALID, ...RESULT);
              } finally {
                delete CHANNEL.fixed;
              }
            }, ...VALIDATE_ARGS);
          };
          try {
            return ORIGINAL_CONFIRM.apply(COMPONENT, ARGS);
          } finally {
            FORM.validate = VALIDATE;
          }
        };
        INSTANCE.ctx.__r2ChannelRenamePatched = true;
      }
      if (VM?.currentChannelType === 'cfr2' && VM.showEditDialog) {
        const NAME_INPUT = document.querySelector('.el-dialog.channel-dialog .el-form-item input.el-input__inner');
        if (NAME_INPUT) {
          NAME_INPUT.disabled = false;
          NAME_INPUT.removeAttribute('disabled');
          NAME_INPUT.closest('.el-input')?.classList.remove('is-disabled');
        }
      }
      const WALK = (VNODE) => {
        if (VNODE?.component) PATCH(VNODE.component);
        if (Array.isArray(VNODE?.children)) VNODE.children.forEach(WALK);
      };
      WALK(INSTANCE.subTree);
    };
    PATCH(ROOT_INSTANCE);
  };
  UPDATE_CHANNEL_DIALOG();
  HIDE_DUPLICATE_R2_OPTION();
  new MutationObserver((RECORDS) => {
    RECORDS.forEach((RECORD) => {
      RECORD.addedNodes.forEach((NODE) => {
        if (NODE.nodeType === Node.ELEMENT_NODE) {
          NORMALIZE_CONTROLS(NODE);
          ENHANCE_PASTE_METHOD_SELECTS(NODE);
          UPDATE_CHANNEL_DIALOG(NODE);
          HIDE_DUPLICATE_R2_OPTION();
          if (NODE.matches('.language-switcher') || NODE.querySelector('.language-switcher')) {
            SYNC_LANGUAGE_SWITCHERS(NODE);
          }
        }
      });
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

  window.CONTAINER = (CONTENT, CLASS_NAME = '') => (
    `<section class="ui-container ${ESCAPE_HTML(CLASS_NAME)}">${CONTENT}</section>`
  );

  window.CC = (MESSAGE, ERROR = false, ICON = '') => {
    const TOASTS = [...document.querySelectorAll('.ui-toast')];
    let TOAST = TOASTS.shift();
    TOASTS.forEach((EXTRA_TOAST) => {
      clearTimeout(EXTRA_TOAST.__TIMER);
      EXTRA_TOAST.remove();
    });
    document.querySelectorAll('.el-message, .el-notification').forEach((NOTICE) => NOTICE.remove());

    if (!TOAST) {
      TOAST = document.createElement('div');
      TOAST.className = 'ui-toast';
      document.body.appendChild(TOAST);
    }

    TOAST.setAttribute('role', ERROR ? 'alert' : 'status');
    TOAST.setAttribute('aria-live', ERROR ? 'assertive' : 'polite');
    TOAST.replaceChildren();
    const ICON_PATHS = CC_ICONS[ICON];
    if (ICON_PATHS) {
      const SVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      SVG.setAttribute('viewBox', '0 0 24 24');
      SVG.setAttribute('width', '1em');
      SVG.setAttribute('height', '1em');
      SVG.setAttribute('fill', 'none');
      SVG.setAttribute('stroke', 'currentColor');
      SVG.setAttribute('stroke-width', '2');
      SVG.setAttribute('stroke-linecap', 'round');
      SVG.setAttribute('stroke-linejoin', 'round');
      SVG.setAttribute('aria-hidden', 'true');
      SVG.setAttribute('class', `lucide lucide-${ICON}`);
      ICON_PATHS.forEach((PATH) => {
        const NODE = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        NODE.setAttribute('d', PATH);
        SVG.appendChild(NODE);
      });
      TOAST.append(SVG, document.createTextNode(' '));
    }
    TOAST.appendChild(document.createTextNode(MESSAGE || ''));
    TOAST.dataset.icon = ICON_PATHS ? ICON : '';
    TOAST.classList.toggle('has-icon', Boolean(ICON_PATHS));
    TOAST.classList.toggle('is-error', ERROR);
    TOAST.classList.add('is-visible');
    clearTimeout(TOAST.__TIMER);
    TOAST.__TIMER = setTimeout(() => TOAST.classList.remove('is-visible'), 4000);
  };

  const STORE_PENDING_CC = (MESSAGE) => {
    try {
      sessionStorage.setItem('imgbed:pending-cc', JSON.stringify({ message: MESSAGE, error: false }));
      return true;
    } catch (ERROR) {
      console.error('Failed to save notification for the next page:', ERROR);
      return false;
    }
  };
  const SHOW_PENDING_CC = () => {
    let PENDING_CC;
    try {
      PENDING_CC = sessionStorage.getItem('imgbed:pending-cc');
      if (!PENDING_CC) return;
      sessionStorage.removeItem('imgbed:pending-cc');
    } catch (ERROR) {
      console.error('Failed to restore pending notification:', ERROR);
      return;
    }
    try {
      const { message, error } = JSON.parse(PENDING_CC);
      if (message) window.CC(message, error);
    } catch (ERROR) {
      console.error('Failed to restore pending notification:', ERROR);
    }
  };
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', SHOW_PENDING_CC, { once: true });
  } else {
    SHOW_PENDING_CC();
  }

  window.addEventListener('imgbed:toast', (EVENT) => {
    const DETAIL = EVENT.detail || {};
    window.CC(DETAIL.MESSAGE, DETAIL.TYPE === 'error', DETAIL.ICON || '');
  });

  const PATCH_VUE_MESSAGE_TO_CC = () => {
    const GLOBAL_PROPERTIES = document.querySelector('#app')?.__vue_app__?.config?.globalProperties;
    if (!GLOBAL_PROPERTIES || GLOBAL_PROPERTIES.$message?.__ccToast) return;

    const SHOW_TOAST = (OPTIONS, TYPE = 'info') => {
      const MESSAGE = typeof OPTIONS === 'string' ? OPTIONS : OPTIONS?.message;
      if (MESSAGE) window.CC(MESSAGE, TYPE === 'error');
      return { close() {} };
    };
    SHOW_TOAST.__ccToast = true;
    SHOW_TOAST.success = (OPTIONS) => SHOW_TOAST(OPTIONS, 'success');
    SHOW_TOAST.info = (OPTIONS) => SHOW_TOAST(OPTIONS, 'info');
    SHOW_TOAST.warning = (OPTIONS) => SHOW_TOAST(OPTIONS, 'warning');
    SHOW_TOAST.error = (OPTIONS) => SHOW_TOAST(OPTIONS, 'error');
    SHOW_TOAST.closeAll = () => {
      const TOAST = document.querySelector('.ui-toast');
      clearTimeout(TOAST?.__TIMER);
      TOAST?.classList.remove('is-visible');
    };
    GLOBAL_PROPERTIES.$message = SHOW_TOAST;
  };

  const GET_UPLOAD_FAILURE_REASON = (ERROR) => {
    const DATA = ERROR?.response?.data;
    const REASON = typeof DATA === 'string' ? DATA : DATA?.error || DATA?.message || ERROR?.message;
    if (!REASON || /network error/i.test(REASON)) return '网络连接失败，请检查服务是否正常运行。';
    if (/<\/?(?:html|body|div|table)\b/i.test(REASON)) {
      return `服务器返回异常页面（HTTP ${ERROR?.response?.status || '错误'}），请检查服务配置。`;
    }
    return String(REASON);
  };

  const PATCH_UPLOAD_FAILURE_MESSAGE = () => {
    const ROOT_INSTANCE = document.querySelector('#app')?._vnode?.component;
    const VISITED = new Set();
    const PATCH = (INSTANCE) => {
      if (!INSTANCE || VISITED.has(INSTANCE)) return;
      VISITED.add(INSTANCE);
      const VM = INSTANCE.proxy;
      if (INSTANCE.type?.name === 'UploadHome'
        && !INSTANCE.ctx.__defaultChannelIdApplied
        && VM?.userConfig?.defaultChannelId
        && VM?.availableChannels) {
        const MATCH = Object.entries(VM.availableChannels)
          .flatMap(([TYPE, CHANNELS]) => CHANNELS.map((CHANNEL) => ({ ...CHANNEL, type: TYPE })))
          .find((CHANNEL) => CHANNEL.id === VM.userConfig.defaultChannelId);
        if (MATCH) {
          VM.uploadChannel = MATCH.type;
          INSTANCE.proxy.$nextTick(() => {
            if (VM.uploadChannel === MATCH.type && !VM.channelName) {
              VM.channelName = MATCH.name;
              INSTANCE.ctx.__defaultChannelIdApplied = true;
            }
          });
        }
      }
      if (VM?.fileList && typeof VM.handleError === 'function' && !INSTANCE.ctx.__detailedUploadErrorPatched) {
        const HANDLER = (ERROR, FILE) => {
          const ITEM = VM.fileList.find((ENTRY) => ENTRY.uid === FILE?.uid);
          if (!ITEM) return;
          const NAME = typeof VM.truncateFilename === 'function'
            ? VM.truncateFilename(FILE.name)
            : FILE.name;
          ITEM.status = 'exception';
          window.CC(`上传失败：${NAME}。原因：${GET_UPLOAD_FAILURE_REASON(ERROR)}`, true);
        };
        INSTANCE.ctx.handleError = HANDLER;
        INSTANCE.ctx.__detailedUploadErrorPatched = true;
      }
      const WALK = (VNODE) => {
        if (VNODE?.component) PATCH(VNODE.component);
        if (Array.isArray(VNODE?.children)) VNODE.children.forEach(WALK);
      };
      WALK(INSTANCE.subTree);
    };
    PATCH(ROOT_INSTANCE);
  };

  let CONFIGURED_UPLOAD_CHANNELS = null;
  const REFRESH_CONFIGURED_UPLOAD_CHANNELS = async () => {
    try {
      const RESPONSE = await fetch('/api/channels', { credentials: 'include' });
      if (!RESPONSE.ok) return;
      const CHANNELS = await RESPONSE.json();
      CONFIGURED_UPLOAD_CHANNELS = Object.values(CHANNELS || {})
        .flat()
        .filter((CHANNEL) => CHANNEL && typeof CHANNEL === 'object');
    } catch (ERROR) {
      console.warn('Failed to check configured upload channels:', ERROR);
    }
  };
  REFRESH_CONFIGURED_UPLOAD_CHANNELS();
  window.addEventListener('focus', REFRESH_CONFIGURED_UPLOAD_CHANNELS);
  document.addEventListener('change', (EVENT) => {
    const INPUT = EVENT.target;
    if (!(INPUT instanceof HTMLInputElement)
      || INPUT.type !== 'file'
      || !INPUT.closest('.upload-home')
      || CONFIGURED_UPLOAD_CHANNELS === null
      || CONFIGURED_UPLOAD_CHANNELS.length > 0) return;

    EVENT.preventDefault();
    EVENT.stopImmediatePropagation();
    INPUT.value = '';
    window.CC('暂无可用存储，请先在管理面板添加渠道。', true);
  }, true);

  document.addEventListener('change', (EVENT) => {
    const INPUT = EVENT.target;
    if (!(INPUT instanceof HTMLInputElement)
      || INPUT.type !== 'file'
      || !INPUT.closest('.upload-home')) return;

    const ROOT_INSTANCE = document.querySelector('#app')?._vnode?.component;
    const VISITED = new Set();
    let UPLOAD_INSTANCE;
    const FIND_UPLOAD_INSTANCE = (INSTANCE) => {
      if (!INSTANCE || VISITED.has(INSTANCE) || UPLOAD_INSTANCE) return;
      VISITED.add(INSTANCE);
      if (INSTANCE.proxy?.uploadChannel !== undefined
        && INSTANCE.proxy?.channelName !== undefined
        && INSTANCE.proxy?.beforeUpload) {
        UPLOAD_INSTANCE = INSTANCE.proxy;
        return;
      }
      const WALK = (VNODE) => {
        if (VNODE?.component) FIND_UPLOAD_INSTANCE(VNODE.component);
        if (Array.isArray(VNODE?.children)) VNODE.children.forEach(WALK);
      };
      WALK(INSTANCE.subTree);
    };
    FIND_UPLOAD_INSTANCE(ROOT_INSTANCE);
    // Channel selection is administrator-controlled and resolved server-side.
    // Do not block uploads merely because this browser has no local selection.
    if (!UPLOAD_INSTANCE || UPLOAD_INSTANCE.channelName) return;
  }, true);

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
      window.CC(ERROR.message || '加载设置失败，请稍后重试。', true);
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
        if (SECURITY && RESULT.adminPasswordChanged && !RESULT.adminSessionRenewed) {
          window.CC('管理员账号已更新，正在返回登录页…');
          setTimeout(() => window.location.assign('/adminLogin'), 600);
          return;
        }
        if (SECURITY) {
          CLOSE();
          window.CC(RESULT.adminPasswordChanged
            ? '管理员账号已更新，已返回管理面板。'
            : '管理员账号已设置，已返回管理面板。');
        } else {
          const CURRENT_PATH = window.location.pathname;
          CURRENT_ADMIN_PATH = RESULT.adminPath;
          APPLY_SITE_NAME(RESULT.siteName, true);
          if (CURRENT_PATH !== RESULT.adminPath) {
            const SAVED_TOAST = STORE_PENDING_CC('站点设置已保存，已返回管理面板。');
            const ADMIN_URL = `${RESULT.adminPath}${window.location.search}${window.location.hash}`;
            if (!SAVED_TOAST) {
              window.CC('站点设置已保存，正在返回管理面板。');
              setTimeout(() => window.location.assign(ADMIN_URL), 600);
              return;
            }
            window.location.assign(ADMIN_URL);
            return;
          }
          CLOSE();
          window.CC('站点设置已保存。');
        }
      } catch (ERROR) {
        console.error(`Failed to save ${TYPE} settings:`, ERROR);
        window.CC(ERROR.message || '保存失败，请稍后重试。', true);
      } finally {
        SAVE.disabled = false;
      }
    });
  };

  let CURRENT_SITE_NAME = 'cf-imghub';
  let CURRENT_ADMIN_PATH = '/admin';
  const INITIAL_PATHNAME = window.location.pathname;
  let SITE_TITLE_OBSERVER;

  const UPDATE_ADMIN_PANEL_HEADING = () => {
    const HEADING = document.querySelector('.admin-panel-heading');
    if (HEADING) HEADING.textContent = `${CURRENT_SITE_NAME} 管理面板`;
  };

  const REMOVE_LEGACY_LOGIN_ROUTE = () => {
    const ROOT = document.getElementById('app');
    const ROUTER = ROOT?.__vue_app__?.config?.globalProperties?.$router
      || ROOT?.__vue_app__?._instance?.proxy?.$router;
    if (!ROUTER || ROUTER.hasRoute('legacy-login-redirect')) return;
    if (ROUTER.hasRoute('login')) ROUTER.removeRoute('login');
    ROUTER.addRoute({
      path: '/login',
      name: 'legacy-login-redirect',
      redirect: '/',
    });
    if (window.location.pathname === '/login') ROUTER.replace('/');
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
    if (ROUTER.currentRoute.value.path !== ADMIN_PATH) {
      ROUTER.replace(`${ADMIN_PATH}${window.location.search}${window.location.hash}`);
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
      const IS_ADMIN = INITIAL_PATHNAME === ADMIN_PATH
        || window.location.pathname === ADMIN_PATH
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
      if (INITIAL_PATHNAME !== ADMIN_PATH && window.location.pathname !== ADMIN_PATH) return;
      // The configured admin path is rendered by admin-app.js and no longer
      // needs the legacy Vue router route injection.
      if (INITIAL_PATHNAME === ADMIN_PATH || window.location.pathname === ADMIN_PATH) return;
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

  const UNIFY_STORAGE_CHANNEL_CARDS = () => {
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

    GROUPS.forEach((GROUP, INDEX) => {
      GROUP.dataset.empty = String(GROUP.querySelectorAll('.channel-card').length === 0);
      if (!GROUP.id) GROUP.id = `storage-channel-group-${INDEX}`;
      GROUP.hidden = GROUP.dataset.empty === 'true';
      GROUP.inert = GROUP.dataset.empty === 'true';
      GROUP.setAttribute('aria-hidden', String(GROUP.dataset.empty === 'true'));

      const TYPE_ICON = GROUP.querySelector('.group-icon');
      GROUP.querySelectorAll('.channel-card').forEach((CARD) => {
        const TITLE = CARD.querySelector('.card-title');
        if (!TYPE_ICON || !TITLE || TITLE.querySelector('.channel-card-type-icon')) return;
        const ICON = TYPE_ICON.cloneNode(true);
        ICON.classList.add('channel-card-type-icon');
        ICON.setAttribute('aria-hidden', 'true');
        TITLE.prepend(ICON);
      });
    });

    const DISCLOSURE = SETTINGS.querySelector(':scope > .storage-disclosure-all')
      || CHANNEL_LIST.querySelector(':scope > .storage-disclosure-all');
    DISCLOSURE?.remove();
    GROUPS.forEach((GROUP) => {
      if (GROUP.parentElement !== CHANNEL_LIST) CHANNEL_LIST.append(GROUP);
    });
    ADD_BACKUP_MIGRATION_CARD(SETTINGS);
  };

  const ADD_BACKUP_MIGRATION_CARD = (SETTINGS) => {
    if (!SETTINGS) return;
    const PARENT = SETTINGS.parentElement;
    let CARD = PARENT.querySelector(':scope > .admin-backup-migration-card');
    let FILE_CARD = PARENT.querySelector(':scope > .admin-file-management-card');
    if (CARD && FILE_CARD) {
      SETTINGS.after(FILE_CARD);
      FILE_CARD.after(CARD);
      return;
    }

    FILE_CARD = document.createElement('section');
    FILE_CARD.className = 'admin-backup-migration-card admin-file-management-card';
    const FILE_COPY = document.createElement('div');
    FILE_COPY.className = 'admin-backup-migration-copy';
    const FILE_TITLE = document.createElement('h2');
    FILE_TITLE.textContent = '图片管理';
    const FILE_NOTE = document.createElement('p');
    FILE_NOTE.textContent = '查看、搜索和管理已上传的图片文件。';
    FILE_COPY.append(FILE_TITLE, FILE_NOTE);
    const FILE_LINK = document.createElement('a');
    FILE_LINK.className = 'button ui-button ui-button-primary';
    FILE_LINK.href = `${CURRENT_ADMIN_PATH}#File`;
    FILE_LINK.textContent = '进入';
    FILE_CARD.append(FILE_COPY, FILE_LINK);

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
    SETTINGS.after(FILE_CARD);
    FILE_CARD.after(CARD);
  };

  const INIT_ADMIN_BACKUP_PAGE = () => {
    if (window.location.pathname !== CURRENT_ADMIN_PATH || window.location.hash !== '#JSON') return;
    document.body.classList.add('admin-backup-page', 'migration-page');
    if (document.getElementById('admin-backup-root')) return;

    const ROOT = document.createElement('main');
    ROOT.id = 'admin-backup-root';
    ROOT.innerHTML = `
      <header class="migration-header">
        <div class="migration-header-main"><h1>备份与迁移</h1><p class="subtitle">共 <span id="entry-count" data-backup-count>0</span> 项数据库数据</p></div>
        <div class="migration-actions">
          <button type="button" class="danger" id="reset-open" data-backup-action="reset">恢复出厂设置</button>
          <button type="button" id="export-all" data-backup-action="export">导出</button>
          <button type="button" class="secondary" id="import-all" data-backup-action="import">导入</button>
          <button type="button" class="secondary" id="refresh-all" data-backup-action="refresh">刷新</button>
          <button type="button" class="secondary" id="database-storage-open" data-backup-action="database-storage" hidden>更改存储</button>
          <a class="back-link ui-button ui-button-secondary" data-backup-home>返回管理面板</a>
        </div>
      </header>
      <div id="json-list" class="json-list" aria-live="polite"></div>
      <input class="admin-backup-file" type="file" accept=".json,application/json" hidden>
      <div class="overlay" id="view-overlay" aria-hidden="true"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="view-title"><div class="dialog-header"><h2 id="view-title"></h2><button type="button" class="dialog-close secondary" id="view-close" aria-label="关闭">×</button></div><pre class="json-value" id="view-value"></pre></section></div>
      <div class="overlay" id="reset-overlay" aria-hidden="true"><section class="dialog reset-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-title"><h2 id="reset-title">恢复出厂设置</h2><p class="reset-warning">此操作会永久删除当前数据库中的全部配置、文件记录及索引。请先导出备份；删除后无法撤销。</p><label>输入 DELETE 以确认<input id="reset-confirmation" type="text" autocomplete="off" required></label><div class="dialog-actions"><button type="button" class="secondary" id="reset-cancel">取消</button><button type="button" class="danger" id="reset-confirm">确认删除全部数据</button></div></section></div>
      <div class="overlay" id="database-storage-overlay" aria-hidden="true"><section class="dialog reset-dialog" role="dialog" aria-modal="true" aria-labelledby="database-storage-title"><div class="dialog-header"><h2 id="database-storage-title">更改元数据数据库</h2><button type="button" class="dialog-close secondary" data-storage-close aria-label="关闭">×</button></div><p id="database-storage-current">正在读取当前数据库…</p><fieldset id="database-storage-options" style="display:grid;gap:10px;margin:0;padding:14px;border:1px solid rgba(120,130,140,.35);border-radius:12px"><legend>选择目标数据库</legend><label><input type="radio" name="database-storage-target" value="KV"> KV</label><label><input type="radio" name="database-storage-target" value="D1"> D1</label></fieldset><p class="reset-warning" style="color:inherit">迁移会复制并核对配置、图片路径和元数据；核对通过后自动切换并清空原数据库。R2、Telegram、S3、WebDAV 等图片文件不会移动。</p><div class="dialog-actions"><button type="button" class="secondary" data-storage-close>取消</button><button type="button" class="secondary" id="database-storage-switch">迁移并切换</button></div></section></div>
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
    const DATABASE_STORAGE_OVERLAY = ROOT.querySelector('#database-storage-overlay');
    const DATABASE_STORAGE_CURRENT = ROOT.querySelector('#database-storage-current');
    const DATABASE_STORAGE_OPEN = ROOT.querySelector('#database-storage-open');
    const DATABASE_STORAGE_SWITCH = ROOT.querySelector('#database-storage-switch');
    let DATABASE_STATUS = null;
    const ENTRIES = [];
    const DISPLAY_ENTRIES = [];
    let TOAST_TIMER;

    ROOT.querySelector('[data-backup-home]').href = CURRENT_ADMIN_PATH;
    const SHOW_MESSAGE = (MESSAGE, IS_ERROR = false) => {
      TOAST.textContent = MESSAGE;
      TOAST.style.background = IS_ERROR ? '#b42318' : '';
      TOAST.hidden = false;
      clearTimeout(TOAST_TIMER);
      TOAST_TIMER = setTimeout(() => { TOAST.hidden = true; }, 2600);
    };
    const UPDATE_SUBTITLE = () => {
      const TYPE = DATABASE_STATUS?.current || 'KV';
      SUBTITLE.textContent = `当前使用 ${TYPE}；共 ${ENTRIES.length} 项配置、图片路径与元数据`;
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
    const SYNC_DATABASE_STORAGE_BUTTON = () => {
      DATABASE_STORAGE_OPEN.hidden = DATABASE_STATUS?.canSwitch !== true;
    };
    const LOAD_ENTRIES = async () => {
      LIST.replaceChildren();
      ENTRIES.length = 0;
      DISPLAY_ENTRIES.length = 0;
      DATABASE_STATUS = await REQUEST_JSON('/api/manage/batch/kv?database=status');
      SYNC_DATABASE_STORAGE_BUTTON();
      SUBTITLE.textContent = `正在读取 ${DATABASE_STATUS.current} 数据…`;
      let CURSOR = null;
      do {
        const QUERY = CURSOR ? `?cursor=${encodeURIComponent(CURSOR)}` : '';
        const PAGE = await REQUEST_JSON(`/api/manage/batch/kv${QUERY}`);
        if (!Array.isArray(PAGE.entries)) throw new Error('数据库列表格式无效。');
        ENTRIES.push(...PAGE.entries);
        CURSOR = PAGE.cursor || null;
        SUBTITLE.textContent = `正在读取 ${ENTRIES.length} 项数据库数据…`;
      } while (CURSOR);

      ENTRIES.sort((LEFT, RIGHT) => LEFT.name.localeCompare(RIGHT.name));
      DISPLAY_ENTRIES.push(...ENTRIES);
      DISPLAY_ENTRIES.sort((LEFT, RIGHT) => LEFT.name.localeCompare(RIGHT.name));
      COUNT.textContent = String(ENTRIES.length);
      UPDATE_SUBTITLE();
      const CARDS = DISPLAY_ENTRIES.length ? DISPLAY_ENTRIES.map((ENTRY, INDEX) => {
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
        ANCHOR.download = `cf-imghub-database-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(ANCHOR);
        ANCHOR.click();
        ANCHOR.remove();
        setTimeout(() => URL.revokeObjectURL(OBJECT_URL), 1000);
        UPDATE_SUBTITLE();
        SHOW_MESSAGE('已导出全部数据库数据。');
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
        SHOW_MESSAGE('数据库数据已刷新。');
        } catch (ERROR) {
          SUBTITLE.textContent = ERROR.message;
          SHOW_MESSAGE(ERROR.message, true);
        }
      } else if (ACTION === 'import') {
        FILE_INPUT.click();
      } else if (ACTION === 'reset') {
        OPEN_OVERLAY(RESET_OVERLAY);
      } else if (ACTION === 'database-storage') {
        try {
          DATABASE_STATUS = await REQUEST_JSON('/api/manage/batch/kv?database=status');
          SYNC_DATABASE_STORAGE_BUTTON();
          if (!DATABASE_STATUS.canSwitch) {
            SHOW_MESSAGE('需要同时绑定 KV 和 D1 才能更改存储。', true);
            return;
          }
          DATABASE_STORAGE_CURRENT.textContent = `当前数据库：${DATABASE_STATUS.current}。可用：${Object.entries(DATABASE_STATUS.available).filter(([, AVAILABLE]) => AVAILABLE).map(([TYPE]) => TYPE).join('、') || '无'}`;
          ROOT.querySelectorAll('[name="database-storage-target"]').forEach((OPTION) => {
            OPTION.disabled = !DATABASE_STATUS.available[OPTION.value];
            OPTION.checked = OPTION.value === DATABASE_STATUS.current;
          });
          DATABASE_STORAGE_SWITCH.disabled = true;
          OPEN_OVERLAY(DATABASE_STORAGE_OVERLAY);
        } catch (ERROR) {
          SHOW_MESSAGE(ERROR.message, true);
        }
      }

      const SHOW = EVENT.target.closest('[data-backup-index]');
      if (SHOW) {
        const ENTRY = DISPLAY_ENTRIES[Number(SHOW.dataset.backupIndex)];
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
      if (EVENT.target.closest('[data-storage-close]') || EVENT.target === DATABASE_STORAGE_OVERLAY) CLOSE_OVERLAY(DATABASE_STORAGE_OVERLAY);
      if (EVENT.target.closest('#database-storage-switch')) {
        const TARGET = ROOT.querySelector('[name="database-storage-target"]:checked')?.value;
        if (!TARGET) {
          SHOW_MESSAGE('请选择一个已绑定的数据库。', true);
          return;
        }
        const BUTTON = EVENT.target.closest('#database-storage-switch');
        BUTTON.disabled = true;
        DATABASE_STORAGE_CURRENT.textContent = `正在将配置、图片路径和元数据迁移到 ${TARGET}，核对通过后会自动切换并清理原数据库…`;
        try {
          const RESULT = await REQUEST_JSON('/api/manage/batch/kv', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'switch_database', target: TARGET }),
          });
          DATABASE_STATUS = await REQUEST_JSON('/api/manage/batch/kv?database=status');
          SYNC_DATABASE_STORAGE_BUTTON();
          CLOSE_OVERLAY(DATABASE_STORAGE_OVERLAY);
          SHOW_MESSAGE(RESULT.sourceCleared === false ? `已切换到 ${TARGET}，但原数据库清理失败：${RESULT.cleanupError || '请检查数据库绑定'}` : `已核对 ${RESULT.verified ?? 0} 项并切换到 ${TARGET}。` , RESULT.sourceCleared === false);
          await LOAD_ENTRIES();
        } catch (ERROR) {
          DATABASE_STORAGE_CURRENT.textContent = ERROR.message;
          SHOW_MESSAGE(ERROR.message, true);
        } finally {
          BUTTON.disabled = false;
        }
      }
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
          SHOW_MESSAGE(`已删除 ${RESULT.deleted} 项数据库数据。`);
          setTimeout(() => window.location.assign(CURRENT_ADMIN_PATH), 900);
        } catch (ERROR) {
          SHOW_MESSAGE(ERROR.message, true);
          BUTTON.disabled = false;
        }
      }
    });
    ROOT.addEventListener('change', (EVENT) => {
      if (EVENT.target.name === 'database-storage-target') {
        DATABASE_STORAGE_SWITCH.disabled = EVENT.target.value === DATABASE_STATUS?.current;
      }
    });
    document.addEventListener('keydown', (EVENT) => {
      if (EVENT.key === 'Escape') {
        CLOSE_OVERLAY(VIEW_OVERLAY);
        CLOSE_OVERLAY(RESET_OVERLAY);
        CLOSE_OVERLAY(DATABASE_STORAGE_OVERLAY);
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

  const REPLACE_LANGUAGE_ICON = (CONTROL) => {
    let ICON = CONTROL.querySelector('.text-language-icon');
    if (!ICON) {
      ICON = document.createElement('span');
      ICON.className = 'text-language-icon';
      ICON.setAttribute('aria-hidden', 'true');
      const PRIMARY = document.createElement('span');
      PRIMARY.className = 'text-language-icon-primary';
      PRIMARY.textContent = '文';
      const SECONDARY = document.createElement('span');
      SECONDARY.className = 'text-language-icon-secondary';
      SECONDARY.textContent = 'A';
      ICON.append(PRIMARY, SECONDARY);
    }
    CONTROL.replaceChildren(ICON);
  };

  const SYNC_LANGUAGE_SWITCHERS = (ROOT = document) => {
    const CONTROLS = [];
    if (ROOT.matches?.('.language-switcher')) CONTROLS.push(ROOT);
    CONTROLS.push(...ROOT.querySelectorAll('.language-switcher'));
    CONTROLS.forEach(REPLACE_LANGUAGE_ICON);
  };

  const OPEN_UPLOAD_HISTORY = () => {
    const ENGLISH = document.documentElement.lang === 'en';
    const TEXT = ENGLISH
      ? { title: 'Upload history', close: 'Close', copy: 'Copy link', delete: 'Delete', empty: 'No upload history yet.', imageError: 'Preview unavailable' }
      : { title: '历史上传', close: '关闭', copy: '复制链接', delete: '删除', empty: '暂无上传记录', imageError: '图片暂时无法预览' };
    let OVERLAY = document.querySelector('.upload-history-overlay');
    if (!OVERLAY) {
      OVERLAY = document.createElement('div');
      OVERLAY.className = 'ui-modal-backdrop upload-history-overlay';
      OVERLAY.setAttribute('role', 'presentation');
      const DIALOG = document.createElement('section');
      DIALOG.className = 'upload-history-dialog';
      DIALOG.setAttribute('role', 'dialog');
      DIALOG.setAttribute('aria-modal', 'true');
      DIALOG.setAttribute('aria-label', TEXT.title);
      const HEADER = document.createElement('header');
      HEADER.className = 'upload-history-header';
      const TITLE = document.createElement('h2');
      TITLE.textContent = TEXT.title;
      const CLOSE = document.createElement('button');
      CLOSE.type = 'button';
      CLOSE.className = 'upload-history-close';
      CLOSE.setAttribute('aria-label', TEXT.close);
      CLOSE.title = TEXT.close;
      CLOSE.textContent = '×';
      const GRID = document.createElement('div');
      GRID.className = 'upload-history-grid';
      HEADER.append(TITLE, CLOSE);
      DIALOG.append(HEADER, GRID);
      OVERLAY.appendChild(DIALOG);
      OVERLAY.addEventListener('click', (EVENT) => {
        if (EVENT.target === OVERLAY) OVERLAY.remove();
      });
      OVERLAY.addEventListener('keydown', (EVENT) => {
        if (EVENT.key === 'Escape') OVERLAY.remove();
      });
      CLOSE.addEventListener('click', () => OVERLAY.remove());
      document.body.appendChild(OVERLAY);
    }

    const DIALOG = OVERLAY.querySelector('.upload-history-dialog');
    const TITLE = DIALOG.querySelector('.upload-history-header h2');
    const CLOSE = DIALOG.querySelector('.upload-history-close');
    const GRID = DIALOG.querySelector('.upload-history-grid');
    DIALOG.setAttribute('aria-label', TEXT.title);
    TITLE.textContent = TEXT.title;
    CLOSE.setAttribute('aria-label', TEXT.close);
    CLOSE.title = TEXT.close;
    GRID.replaceChildren();

    const MAKE_ACTION = (LABEL, ICON_PATH, CLASS_NAME) => {
      const BUTTON = document.createElement('button');
      BUTTON.type = 'button';
      BUTTON.className = `upload-history-action ${CLASS_NAME}`;
      BUTTON.setAttribute('aria-label', LABEL);
      BUTTON.title = LABEL;
      const ICON = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      ICON.setAttribute('viewBox', '0 0 24 24');
      ICON.setAttribute('width', '18');
      ICON.setAttribute('height', '18');
      ICON.setAttribute('fill', 'none');
      ICON.setAttribute('stroke', 'currentColor');
      ICON.setAttribute('stroke-width', '2');
      ICON.setAttribute('stroke-linecap', 'round');
      ICON.setAttribute('stroke-linejoin', 'round');
      const PATH = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      PATH.setAttribute('d', ICON_PATH);
      ICON.appendChild(PATH);
      BUTTON.appendChild(ICON);
      return BUTTON;
    };

    let ITEMS;
    try {
      const STORED = localStorage.getItem('uploadHistory');
      ITEMS = STORED ? JSON.parse(STORED) : [];
      if (!Array.isArray(ITEMS)) throw new TypeError('Upload history must be an array.');
    } catch (ERROR) {
      console.error('Failed to load upload history:', ERROR);
      const MESSAGE = document.createElement('p');
      MESSAGE.className = 'upload-history-empty';
      MESSAGE.textContent = ENGLISH ? 'Unable to load upload history.' : '上传历史加载失败，请重试。';
      GRID.appendChild(MESSAGE);
      window.CC(ERROR.message || MESSAGE.textContent, true);
      OVERLAY.classList.add('is-open');
      CLOSE.focus();
      return;
    }

    ITEMS.forEach((ITEM) => {
      if (!ITEM || typeof ITEM.url !== 'string' || !ITEM.url) return;
      const CARD = document.createElement('article');
      CARD.className = 'upload-history-card';
      const PREVIEW = document.createElement('div');
      PREVIEW.className = 'upload-history-preview';
      const IS_VIDEO = ['mp4', 'webm', 'ogg', 'mkv'].includes(
        String(ITEM.type || ITEM.name || '').split('.').pop().toLowerCase(),
      );
      const MEDIA = document.createElement(IS_VIDEO ? 'video' : 'img');
      MEDIA.src = ITEM.url;
      if (IS_VIDEO) {
        MEDIA.muted = true;
        MEDIA.preload = 'metadata';
      } else {
        MEDIA.alt = ITEM.name || '';
        MEDIA.loading = 'lazy';
        MEDIA.addEventListener('error', () => {
          MEDIA.remove();
          const FALLBACK = document.createElement('span');
          FALLBACK.textContent = TEXT.imageError;
          PREVIEW.appendChild(FALLBACK);
        }, { once: true });
      }
      PREVIEW.appendChild(MEDIA);
      const FOOTER = document.createElement('div');
      FOOTER.className = 'upload-history-card-footer';
      const NAME = document.createElement('span');
      NAME.className = 'upload-history-name';
      NAME.textContent = ITEM.name || ITEM.url.split('/').pop();
      NAME.title = NAME.textContent;
      const ACTIONS = document.createElement('div');
      ACTIONS.className = 'upload-history-actions';
      const COPY = MAKE_ACTION(TEXT.copy, 'M8 7V3h12v12h-4M4 7h12v14H4z', 'is-copy');
      COPY.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(ITEM.url);
          window.CC(ENGLISH ? 'Image link copied' : '图片链接已复制');
        } catch (ERROR) {
          console.error('Failed to copy upload history link:', ERROR);
          window.CC(ENGLISH ? 'Failed to copy image link.' : '复制链接失败，请检查剪贴板权限。', true);
        }
      });
      const DELETE = MAKE_ACTION(TEXT.delete, 'M3 6h18m-2 0-.9 14H5.9L5 6m4 0V4h6v2m-5 4v6m4-6v6', 'is-delete');
      DELETE.addEventListener('click', () => {
        const UPDATED = ITEMS.filter((ENTRY) => ENTRY !== ITEM);
        try {
          localStorage.setItem('uploadHistory', JSON.stringify(UPDATED));
          ITEMS = UPDATED;
          CARD.remove();
          if (!GRID.querySelector('.upload-history-card')) {
            const EMPTY = document.createElement('p');
            EMPTY.className = 'upload-history-empty';
            EMPTY.textContent = TEXT.empty;
            GRID.appendChild(EMPTY);
          }
          window.CC(ENGLISH ? 'Record deleted' : '记录已删除');
        } catch (ERROR) {
          console.error('Failed to delete upload history record:', ERROR);
          window.CC(ERROR.message || (ENGLISH ? 'Failed to delete record.' : '删除记录失败。'), true);
        }
      });
      ACTIONS.append(COPY, DELETE);
      FOOTER.append(NAME);
      PREVIEW.append(ACTIONS);
      CARD.append(PREVIEW, FOOTER);
      GRID.appendChild(CARD);
    });

    if (!GRID.childElementCount) {
      const EMPTY = document.createElement('p');
      EMPTY.className = 'upload-history-empty';
      EMPTY.textContent = TEXT.empty;
      GRID.appendChild(EMPTY);
    }
    OVERLAY.classList.add('is-open');
    CLOSE.focus();
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
      if (BUTTON.querySelector('svg[data-icon="gear"], svg[data-icon="cloud-arrow-up"], svg[data-icon="right-from-bracket"]')) {
        BUTTON.remove();
      }
    });
    HOME.querySelectorAll('.quick-toolbar-button svg[data-icon="link"]').forEach((ICON) => {
      ICON.closest('.quick-toolbar-button')?.remove();
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
    const QUICK_BUTTONS = QUICK_ACTIONS
      ? [...QUICK_ACTIONS.querySelectorAll(':scope > .quick-toolbar-button')]
        .filter((BUTTON) => !BUTTON.querySelector('svg[data-icon="link"], svg[data-icon="gear"]'))
      : [];
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
    let HISTORY_BUTTON = ACTIONS.querySelector('.home-history-button');
    if (!HISTORY_BUTTON) {
      HISTORY_BUTTON = document.createElement('button');
      HISTORY_BUTTON.type = 'button';
      HISTORY_BUTTON.className = 'quick-toolbar-button home-history-button ui-button ui-button-secondary';
      HISTORY_BUTTON.setAttribute('aria-label', document.documentElement.lang === 'en' ? 'Upload history' : '历史上传');
      HISTORY_BUTTON.title = document.documentElement.lang === 'en' ? 'Upload history' : '历史上传';
      const ICON = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      ICON.setAttribute('viewBox', '0 0 24 24');
      ICON.setAttribute('width', '18');
      ICON.setAttribute('height', '18');
      ICON.setAttribute('fill', 'none');
      ICON.setAttribute('stroke', 'currentColor');
      ICON.setAttribute('stroke-width', '2');
      ICON.setAttribute('stroke-linecap', 'round');
      ICON.setAttribute('stroke-linejoin', 'round');
      const PATH = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      PATH.setAttribute('d', 'M3 12a9 9 0 1 0 2.64-6.36L3 8m0-5v5h5m4-1v5l4 2');
      ICON.appendChild(PATH);
      HISTORY_BUTTON.appendChild(ICON);
      HISTORY_BUTTON.addEventListener('click', OPEN_UPLOAD_HISTORY);
    }

    MENU_ACTIONS.forEach((ITEM) => {
      ITEM.dataset.homeMenuAction = 'language';
      ITEM.classList.add('home-menu-action');
      ITEM.setAttribute('role', 'button');
      ITEM.setAttribute('tabindex', '0');
      ITEM.setAttribute('aria-label', '切换语言');
      ITEM.title = '切换语言';
      REPLACE_LANGUAGE_ICON(ITEM);
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
    const BUTTONS = [...MENU_BUTTONS, HISTORY_BUTTON, UPLOAD_METHOD, ...QUICK_BUTTONS, FLOATING_UPLOAD].filter(Boolean);

    UPLOAD_METHOD?.classList.remove('desktop-only');

    BUTTONS.forEach((BUTTON) => {
      if (BUTTON.parentElement !== ACTIONS) ACTIONS.appendChild(BUTTON);
    });

    MENU_ACTIONS.forEach((ITEM) => ACTIONS.appendChild(ITEM));
    MORE_MENU?.remove();
  };

  let DEFAULT_UPLOAD_CHANNEL_CONFIG;
  let DEFAULT_UPLOAD_CHANNEL_CONFIG_PROMISE;
  let CLIENT_UPLOAD_SETTINGS;
  let CLIENT_UPLOAD_SETTINGS_PROMISE;

  const CLIENT_UPLOAD_SETTING_LABELS = {
    defaultChannelId: ['上传渠道', 'Upload Channel'],
    defaultConvertToWebp: ['是否转换 WebP', 'Convert to WebP'],
    defaultCustomerCompress: ['开启压缩', 'Enable Compression'],
    defaultCompressBar: ['压缩阈值 (MB)', 'Compression Threshold (MB)'],
    defaultCompressQuality: ['压缩目标 (MB)', 'Compression Target (MB)'],
  };

  const MAKE_CLIENT_UPLOAD_SETTING_FIELD = (SETTING, ENGLISH) => {
    const ID = SETTING.id;
    const WRAPPER = document.createElement('label');
    WRAPPER.className = 'client-settings-field';
    const TITLE = document.createElement('span');
    TITLE.className = 'client-settings-label';
    TITLE.textContent = CLIENT_UPLOAD_SETTING_LABELS[ID]?.[ENGLISH ? 1 : 0] || SETTING.label || ID;
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
    } else if (ID === 'defaultChannelId') {
      CONTROL = document.createElement('select');
      CONTROL.className = 'client-settings-select';
      const PLACEHOLDER = document.createElement('option');
      PLACEHOLDER.value = '';
      PLACEHOLDER.textContent = ENGLISH ? 'Select a storage channel' : '请选择存储渠道';
      CONTROL.appendChild(PLACEHOLDER);
      const CHANNEL_OPTIONS = SETTING.options || [];
      if (!CHANNEL_OPTIONS.length) {
        PLACEHOLDER.textContent = ENGLISH
          ? 'No storage configured — add a channel first'
          : '暂无已配置存储，请先添加渠道';
        CONTROL.disabled = true;
      }
      CHANNEL_OPTIONS.forEach((OPTION) => {
        const ITEM = document.createElement('option');
        ITEM.value = OPTION.value;
        ITEM.textContent = ENGLISH ? OPTION.label_en || OPTION.label : OPTION.label;
        CONTROL.appendChild(ITEM);
      });
      CONTROL.value = SETTING.value || '';
    } else {
      CONTROL = document.createElement('input');
      CONTROL.type = 'number';
      CONTROL.min = ID === 'defaultCompressBar' ? '1' : '0.5';
      CONTROL.max = '20';
      CONTROL.step = ID === 'defaultCompressBar' ? '1' : '0.1';
      CONTROL.value = SETTING.value ?? SETTING.placeholder ?? '';
      CONTROL.className = 'client-settings-input';
    }

    CONTROL.name = ID;
    WRAPPER.appendChild(CONTROL);
    return WRAPPER;
  };

  const INIT_CLIENT_UPLOAD_SETTINGS_PANEL = () => {
    const PANEL = document.querySelector('.admin-default-upload-channel-panel');
    const FORM = PANEL?.querySelector('.client-settings-form');
    const FIELDS = PANEL?.querySelector('.client-settings-fields');
    if (!PANEL || !FORM || !FIELDS || FORM.dataset.initialized) return;
    FORM.dataset.initialized = 'true';
    FORM.noValidate = true;
    const ENGLISH = document.documentElement.lang === 'en';
    let SAVE_TIMER;
    let SAVE_IN_PROGRESS = false;
    let SAVE_PENDING = false;

    const SAVE_SETTINGS = async () => {
      if (SAVE_IN_PROGRESS) {
        SAVE_PENDING = true;
        return;
      }

      const THRESHOLD = Number(FORM.elements.defaultCompressBar.value);
      const QUALITY = Number(FORM.elements.defaultCompressQuality.value);
      if (!Number.isFinite(THRESHOLD) || THRESHOLD < 1 || THRESHOLD > 20
        || !Number.isFinite(QUALITY) || QUALITY < 0.5 || QUALITY > THRESHOLD) {
        window.CC(ENGLISH
          ? 'Threshold must be 1–20 MB and target must be 0.5 MB or less than the threshold.'
          : '压缩阈值需为 1–20 MB，压缩期望需为 0.5 MB 以上且不超过阈值。', true);
        return;
      }

      SAVE_IN_PROGRESS = true;
      try {
        CLIENT_UPLOAD_SETTINGS.config.forEach((SETTING) => {
          const CONTROL = FORM.elements[SETTING.id];
          if (CONTROL) SETTING.value = CONTROL.type === 'checkbox' ? CONTROL.checked : CONTROL.value;
        });
        const RESPONSE = await fetch('/api/manage/sysConfig/page', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...CLIENT_UPLOAD_SETTINGS,
            config: CLIENT_UPLOAD_SETTINGS.config.filter((SETTING) => SETTING.id !== 'defaultChannelId'),
          }),
        });
        if (!RESPONSE.ok) throw new Error(`Settings save failed (${RESPONSE.status})`);
        window.CC(ENGLISH ? 'Settings saved.' : '设置已保存');
      } catch (ERROR) {
        console.error('Failed to save client upload settings:', ERROR);
        window.CC(ERROR.message || (ENGLISH ? 'Failed to save settings.' : '保存设置失败，请稍后重试'), true);
      } finally {
        SAVE_IN_PROGRESS = false;
        if (SAVE_PENDING) {
          SAVE_PENDING = false;
          SAVE_SETTINGS();
        }
      }
    };

    const SCHEDULE_SAVE = () => {
      window.clearTimeout(SAVE_TIMER);
      SAVE_TIMER = window.setTimeout(SAVE_SETTINGS, 500);
    };
    FORM.addEventListener('submit', (EVENT) => EVENT.preventDefault());
    FORM.addEventListener('input', SCHEDULE_SAVE);

    if (!CLIENT_UPLOAD_SETTINGS_PROMISE) {
      CLIENT_UPLOAD_SETTINGS_PROMISE = fetch('/api/manage/sysConfig/page', {
        credentials: 'include',
      }).then(async (RESPONSE) => {
        const CONFIG = await RESPONSE.json();
        if (!RESPONSE.ok) throw new Error(CONFIG.error || `Settings request failed (${RESPONSE.status})`);
        return CONFIG;
      });
    }
    CLIENT_UPLOAD_SETTINGS_PROMISE.then((CONFIG) => {
      CLIENT_UPLOAD_SETTINGS = CONFIG;
      FIELDS.replaceChildren();
      CONFIG.config
        .filter((SETTING) => SETTING.id !== 'defaultChannelId'
          && Object.hasOwn(CLIENT_UPLOAD_SETTING_LABELS, SETTING.id))
        .forEach((SETTING) => FIELDS.appendChild(MAKE_CLIENT_UPLOAD_SETTING_FIELD(SETTING, ENGLISH)));
    }).catch((ERROR) => {
      console.error('Failed to load client upload settings:', ERROR);
      FIELDS.textContent = ENGLISH ? 'Failed to load upload settings.' : '上传设置加载失败。';
      window.CC(ERROR.message || (ENGLISH ? 'Failed to load settings.' : '加载设置失败，请重试。'), true);
    });
  };

  const ADD_DEFAULT_UPLOAD_CHANNEL_SELECTOR = () => {
    const SETTINGS = document.querySelector('.admin-settings-content > .upload-settings');
    if (!SETTINGS || SETTINGS.querySelector('.admin-default-upload-channel-control')) return;

    const ENGLISH = document.documentElement.lang === 'en';
    const CONTROL = document.createElement('label');
    CONTROL.className = 'admin-default-upload-channel-control';
    const LABEL = document.createElement('span');
    LABEL.className = 'admin-upload-channel-toolbar-label';
    LABEL.textContent = ENGLISH ? 'Upload Channel' : '上传渠道';
    const SELECT = document.createElement('select');
    SELECT.className = 'ui-select admin-default-upload-channel-select';
    SELECT.setAttribute('aria-label', LABEL.textContent);
    SELECT.disabled = true;
    CONTROL.append(SELECT);
    const HEADER = SETTINGS.querySelector(':scope > .page-header');
    const ACTIONS = HEADER?.querySelector('.header-actions');
    if (!HEADER || !ACTIONS) return;
    const CHANNEL_PANEL = document.createElement('div');
    CHANNEL_PANEL.className = 'admin-default-upload-channel-panel';
    const CHANNEL_LABEL = document.createElement('span');
    CHANNEL_LABEL.className = 'admin-default-upload-channel-label';
    CHANNEL_LABEL.textContent = LABEL.textContent;
    const UPLOAD_SETTINGS_FORM = document.createElement('form');
    UPLOAD_SETTINGS_FORM.className = 'client-settings-form';
    UPLOAD_SETTINGS_FORM.innerHTML = `
      <div class="client-settings-fields" aria-live="polite">
        <label class="client-settings-field"><span>是否转换 WebP</span><input name="defaultConvertToWebp" type="checkbox"></label>
        <label class="client-settings-field"><span>开启压缩</span><input name="defaultCustomerCompress" type="checkbox" checked></label>
        <label class="client-settings-field"><span>压缩阈值 (MB)</span><input name="defaultCompressBar" type="number" value="5"></label>
        <label class="client-settings-field"><span>压缩目标 (MB)</span><input name="defaultCompressQuality" type="number" value="4"></label>
      </div>`;
    CHANNEL_PANEL.append(CHANNEL_LABEL, CONTROL, UPLOAD_SETTINGS_FORM);
    ACTIONS.prepend(LABEL);
    SETTINGS.insertBefore(CHANNEL_PANEL, HEADER);
    INIT_CLIENT_UPLOAD_SETTINGS_PANEL();

    const LOAD_CONFIG = async () => {
      if (!DEFAULT_UPLOAD_CHANNEL_CONFIG_PROMISE) {
        DEFAULT_UPLOAD_CHANNEL_CONFIG_PROMISE = fetch('/api/manage/sysConfig/page', {
          credentials: 'include',
        }).then(async (RESPONSE) => {
          const CONFIG = await RESPONSE.json();
          if (!RESPONSE.ok) {
            throw new Error(CONFIG.error || `Settings request failed (${RESPONSE.status})`);
          }
          return CONFIG;
        });
      }
      return DEFAULT_UPLOAD_CHANNEL_CONFIG_PROMISE;
    };

    const SAVE_CHANNEL = async () => {
      const SETTING = DEFAULT_UPLOAD_CHANNEL_CONFIG?.config
        ?.find((ITEM) => ITEM.id === 'defaultChannelId');
      if (!SETTING) {
        window.CC(ENGLISH ? 'Upload channel settings are unavailable.' : '上传渠道设置不可用。', true);
        return;
      }

      const PREVIOUS_VALUE = SELECT.dataset.savedValue || '';
      SELECT.disabled = true;
      try {
        const RESPONSE = await fetch('/api/manage/sysConfig/page', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config: [{ id: SETTING.id, value: SELECT.value }],
          }),
        });
        const RESULT = await RESPONSE.json();
        if (!RESPONSE.ok) throw new Error(RESULT.error || `Settings save failed (${RESPONSE.status})`);
        SETTING.value = SELECT.value;
        SELECT.dataset.savedValue = SELECT.value;
        window.CC(ENGLISH ? 'Upload channel saved.' : '上传渠道已保存');
      } catch (ERROR) {
        console.error('Failed to save upload channel:', ERROR);
        SELECT.value = PREVIOUS_VALUE;
        window.CC(ERROR.message || (ENGLISH ? 'Failed to save upload channel.' : '上传渠道保存失败，请重试。'), true);
      } finally {
        SELECT.disabled = SELECT.options.length === 0
          || (SELECT.options.length === 1 && !SELECT.options[0].value);
      }
    };
    let CHANNEL_REFRESH_VERSION = 0;
    const SYNC_CHANNEL_OPTIONS = (CHANNEL_OPTIONS, SAVE_AUTOMATIC_SELECTION = false) => {
      const HAS_CURRENT_SELECTION = CHANNEL_OPTIONS.some((OPTION) => OPTION.value === SELECT.value);
      const SELECTED_VALUE = HAS_CURRENT_SELECTION
        ? SELECT.value
        : CHANNEL_OPTIONS[0]?.value || '';
      SELECT.replaceChildren();
      if (!CHANNEL_OPTIONS.length) {
        const PLACEHOLDER = document.createElement('option');
        PLACEHOLDER.value = '';
        PLACEHOLDER.textContent = ENGLISH ? 'No available channels' : '暂无开放渠道';
        SELECT.appendChild(PLACEHOLDER);
      }
      CHANNEL_OPTIONS.forEach((OPTION) => {
        const ITEM = document.createElement('option');
        ITEM.value = OPTION.value;
        ITEM.textContent = ENGLISH ? OPTION.label_en || OPTION.label : OPTION.label;
        SELECT.appendChild(ITEM);
      });
      SELECT.value = SELECTED_VALUE;
      SELECT.disabled = CHANNEL_OPTIONS.length === 0;
      if (SAVE_AUTOMATIC_SELECTION) {
        const SETTING = DEFAULT_UPLOAD_CHANNEL_CONFIG?.config
          ?.find((ITEM) => ITEM.id === 'defaultChannelId');
        if (SETTING && SELECTED_VALUE && SETTING.value !== SELECTED_VALUE) {
          SELECT.dataset.savedValue = SETTING.value || '';
          SAVE_CHANNEL();
        } else if (SETTING) {
          SELECT.dataset.savedValue = SETTING.value || '';
        }
      }
    };
    const REFRESH_CHANNEL_OPTIONS = async () => {
      const VERSION = ++CHANNEL_REFRESH_VERSION;
      try {
        const RESPONSE = await fetch('/api/manage/sysConfig/page', {
          credentials: 'include',
          cache: 'no-store',
        });
        const CONFIG = await RESPONSE.json();
        if (!RESPONSE.ok) throw new Error(CONFIG.error || `Settings request failed (${RESPONSE.status})`);
        if (VERSION !== CHANNEL_REFRESH_VERSION) return;

        DEFAULT_UPLOAD_CHANNEL_CONFIG = CONFIG;
        const SETTING = CONFIG.config?.find((ITEM) => ITEM.id === 'defaultChannelId');
        if (!SETTING) throw new Error('Upload channel setting is missing from page configuration.');

        SYNC_CHANNEL_OPTIONS(SETTING.options || [], true);
      } catch (ERROR) {
        console.error('Failed to refresh upload channels:', ERROR);
        window.CC(ERROR.message || (ENGLISH ? 'Failed to refresh upload channels.' : '刷新上传渠道失败，请重试。'), true);
      }
    };
    window.addEventListener('imgbed:upload-channels-changed', (EVENT) => {
      const OPTIONS = EVENT.detail?.options;
      if (!Array.isArray(OPTIONS)) return;
      CHANNEL_REFRESH_VERSION += 1;
      SYNC_CHANNEL_OPTIONS(OPTIONS);
    });
    window.addEventListener('imgbed:toast', (EVENT) => {
      if (EVENT.detail?.TYPE !== 'error') REFRESH_CHANNEL_OPTIONS();
    });

    SELECT.addEventListener('change', SAVE_CHANNEL);
    LOAD_CONFIG().then((CONFIG) => {
      DEFAULT_UPLOAD_CHANNEL_CONFIG = CONFIG;
      const SETTING = CONFIG.config?.find((ITEM) => ITEM.id === 'defaultChannelId');
      if (!SETTING) throw new Error('Upload channel setting is missing from page configuration.');

      SELECT.value = SETTING.value || '';
      SELECT.dataset.savedValue = SELECT.value;
      SYNC_CHANNEL_OPTIONS(SETTING.options || [], true);
    }).catch((ERROR) => {
      console.error('Failed to load upload channel:', ERROR);
      SELECT.replaceChildren();
      const OPTION = document.createElement('option');
      OPTION.textContent = ENGLISH ? 'Failed to load channels' : '加载上传渠道失败';
      SELECT.appendChild(OPTION);
      window.CC(ERROR.message || (ENGLISH ? 'Failed to load upload channel.' : '加载上传渠道失败，请重试。'), true);
    });
  };

  const ADD_ADMIN_CLIENT_SETTINGS_BUTTON = () => {
    const ADMIN_PAGE = document.querySelector('.admin-settings-page');
    const CONTENT = ADMIN_PAGE?.querySelector('.admin-settings-content');
    const CONTAINER = CONTENT?.querySelector(':scope > .upload-settings');
    if (!CONTENT || !CONTAINER || CONTENT.querySelector(':scope > .admin-panel-heading-row')) return;

    const EXISTING_HEADER = CONTAINER.querySelector(':scope > .admin-panel-heading-row');
    if (EXISTING_HEADER) {
      CONTENT.insertBefore(EXISTING_HEADER, CONTAINER);
      return;
    }

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
      ['admin-logout-trigger button-red', '退出', LOGOUT],
      ['admin-client-settings-trigger', '客户端设置', OPEN_CLIENT_SETTINGS],
      ['admin-security-trigger', '安全', () => OPEN_ADMIN_SETTINGS_MODAL('security')],
      ['admin-site-trigger button-black', '站点', () => OPEN_ADMIN_SETTINGS_MODAL('site')],
      ['admin-home-trigger', '返回主页', () => window.location.assign('/')],
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
    CONTENT.insertBefore(HEADER_ROW, CONTAINER);
    NORMALIZE_CONTROLS(HEADER_ROW);
  };

  const IS_CLIENT_SETTINGS_SECTION = (CARD) => {
    const TITLE = CARD.querySelector('.first-title')?.textContent.trim() || '';
    return /^CloudFlare API Token\b/i.test(TITLE) || /^WebDAV\b/i.test(TITLE);
  };

  const PARK_CLIENT_SETTINGS_SOURCES = () => {
    const ADMIN_SETTINGS_CONTENT = document.querySelector('.admin-settings-content');
    const OTHER_SETTINGS = ADMIN_SETTINGS_CONTENT?.querySelector(':scope > .others-settings');
    if (!ADMIN_SETTINGS_CONTENT || !OTHER_SETTINGS) return;

    const CLIENT_CARDS = [...OTHER_SETTINGS.querySelectorAll(':scope > .first-settings')]
      .filter(IS_CLIENT_SETTINGS_SECTION);
    if (!CLIENT_CARDS.length) return;

    let SETTINGS_PARKING = ADMIN_SETTINGS_CONTENT.querySelector(
      ':scope > .client-settings-source-parking',
    );
    if (!SETTINGS_PARKING) {
      SETTINGS_PARKING = document.createElement('div');
      SETTINGS_PARKING.className = 'client-settings-source-parking';
      SETTINGS_PARKING.setAttribute('aria-hidden', 'true');
      ADMIN_SETTINGS_CONTENT.appendChild(SETTINGS_PARKING);
    }

    CLIENT_CARDS.forEach((CARD) => SETTINGS_PARKING.appendChild(CARD));
    const HAS_OTHER_SETTINGS = OTHER_SETTINGS.querySelector(
      '.first-settings, input, textarea, select, .el-input, .el-select, .el-switch, .el-checkbox, .el-radio',
    );
    if (!HAS_OTHER_SETTINGS) {
      const FLOATING_SAVE = OTHER_SETTINGS.querySelector(':scope > .floating-save-btn');
      if (FLOATING_SAVE) SETTINGS_PARKING.appendChild(FLOATING_SAVE);
      OTHER_SETTINGS.remove();
    }
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
        <div class="client-settings-extra"></div>
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
      const ADD_OTHERS_SAVE_BUTTON = (CARD, KEY) => {
        const EXISTING_ROW = CARD.querySelector(':scope > .client-settings-section-save-row');
        if (EXISTING_ROW) {
          const STATUS = EXISTING_ROW.querySelector('.client-settings-section-message');
          const BUTTON = EXISTING_ROW.querySelector('button');
          STATUS.textContent = '';
          STATUS.classList.remove('is-error');
          BUTTON.disabled = false;
          return;
        }

        const ROW = document.createElement('div');
        ROW.className = 'client-settings-section-save-row';
        const STATUS = document.createElement('p');
        STATUS.className = 'client-settings-section-message';
        STATUS.setAttribute('role', 'status');
        const BUTTON = document.createElement('button');
        BUTTON.type = 'button';
        BUTTON.className = 'client-settings-save client-settings-section-save';
        BUTTON.textContent = ENGLISH ? 'Save' : '保存';
        ROW.append(STATUS, BUTTON);
        CARD.appendChild(ROW);

        BUTTON.addEventListener('click', async () => {
          const INSTANCE = GET_WEB_DAV_SETTINGS_INSTANCE();
          const MODEL = INSTANCE?.proxy?.settings?.[KEY];
          if (!MODEL) {
            window.CC(ENGLISH ? 'Settings are not ready. Reopen this dialog and try again.' : '设置尚未就绪，请关闭后重新打开再试。', true);
            return;
          }

          BUTTON.disabled = true;
          STATUS.textContent = '';
          STATUS.classList.remove('is-error');
          try {
            const READ_RESPONSE = await fetch('/api/manage/sysConfig/others', {
              credentials: 'include',
            });
            const CURRENT_SETTINGS = await READ_RESPONSE.json();
            if (!READ_RESPONSE.ok) {
              throw new Error(CURRENT_SETTINGS.error || `Settings request failed (${READ_RESPONSE.status})`);
            }

            const FIELDS = KEY === 'cloudflareApiToken'
              ? ['CF_ZONE_ID', 'CF_EMAIL', 'CF_API_KEY']
              : ['enabled', 'username', 'password', 'uploadChannel', 'channelName'];
            const SECTION_SETTINGS = { ...(CURRENT_SETTINGS[KEY] || {}) };
            FIELDS.forEach((FIELD) => {
              SECTION_SETTINGS[FIELD] = MODEL[FIELD];
            });
            if (KEY === 'webDAV') {
              SECTION_SETTINGS.enabled = MODEL.enabled === true || MODEL.enabled === 'true';
            }

            const SAVE_RESPONSE = await fetch('/api/manage/sysConfig/others', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...CURRENT_SETTINGS, [KEY]: SECTION_SETTINGS }),
            });
            const SAVED_SETTINGS = await SAVE_RESPONSE.json();
            if (!SAVE_RESPONSE.ok) {
              throw new Error(SAVED_SETTINGS.error || `Settings save failed (${SAVE_RESPONSE.status})`);
            }
            if (SAVED_SETTINGS[KEY]) Object.assign(MODEL, SAVED_SETTINGS[KEY]);
            if (SAVED_SETTINGS[KEY]) Object.assign(MODEL, SAVED_SETTINGS[KEY]);
            if (KEY === 'webDAV') requestAnimationFrame(SYNC_NATIVE_WEB_DAV_SELECT);
          } catch (ERROR) {
            console.error(`Failed to save ${KEY} settings:`, ERROR);
            console.error(`Failed to save ${KEY} settings:`, ERROR);
            window.CC(ERROR.message || (ENGLISH ? 'Failed to save settings. Please try again.' : '保存失败，请重试。'), true);
          } finally {
            BUTTON.disabled = false;
          }
        });
      };
      MOVED_SETTINGS.forEach((CARD) => {
        const TITLE = CARD.querySelector(':scope > .first-title')?.textContent.trim() || '';
        if (/CloudFlare API Token/i.test(TITLE)) {
          ADD_OTHERS_SAVE_BUTTON(CARD, 'cloudflareApiToken');
        } else if (/^WebDAV\b/i.test(TITLE)) {
          ADD_OTHERS_SAVE_BUTTON(CARD, 'webDAV');
        }
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
    const ON_KEYDOWN = (EVENT) => {
      if (EVENT.key === 'Escape' && document.body.contains(BACKDROP)) {
        CLOSE();
        document.removeEventListener('keydown', ON_KEYDOWN);
      }
    };
    document.addEventListener('keydown', ON_KEYDOWN);
    document.body.appendChild(BACKDROP);
    NORMALIZE_CONTROLS(BACKDROP);
    BACKDROP.querySelector('.client-settings-close').focus();
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
    const SECTION = document.querySelector('.client-settings-source-parking, .others-settings');
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

  const INIT_ADMIN_FILE_PAGE = async () => {
    if (window.location.pathname !== CURRENT_ADMIN_PATH || window.location.hash !== '#File') return;
    document.body.classList.add('admin-file-page');
    if (document.getElementById('admin-file-root')) return;
    document.querySelector('.admin-settings-page')?.remove();
    const ROOT = document.createElement('main');
    ROOT.id = 'admin-file-root';
    ROOT.innerHTML = '<section class="admin-backup-migration-card"><div class="admin-backup-migration-copy"><h2>图片管理</h2><p>查看、搜索和管理所有已上传的图片文件。</p></div><a class="back-link ui-button" href="/admin">返回管理面板</a></section><section class="admin-file-list"><h1>所有图片</h1><p class="admin-file-status">正在加载…</p><div class="admin-file-grid"></div></section>';
    document.body.append(ROOT);
    const GRID = ROOT.querySelector('.admin-file-grid');
    const STATUS = ROOT.querySelector('.admin-file-status');
    const DIALOG = (TITLE, MESSAGE, INPUT_VALUE = '') => new Promise((RESOLVE) => {
      const MODAL = window.OPEN_MODAL(TITLE, `<p>${MESSAGE}</p>${INPUT_VALUE ? `<input class="ui-modal-input" value="${INPUT_VALUE.replace(/"/g, '&quot;')}">` : ''}<div class="ui-modal-actions"><button type="button" class="ui-modal-cancel">取消</button><button type="button" class="ui-modal-confirm">确定</button></div>`);
      const INPUT = MODAL.querySelector('.ui-modal-input');
      MODAL.querySelector('.ui-modal-cancel').onclick = () => { MODAL.remove(); RESOLVE(null); };
      MODAL.querySelector('.ui-modal-confirm').onclick = () => { const VALUE = INPUT ? INPUT.value : true; MODAL.remove(); RESOLVE(VALUE); };
      INPUT?.focus();
    });
    try {
      const RESPONSE = await fetch('/api/manage/list?count=500&recursive=true', { credentials: 'include' });
      const DATA = await RESPONSE.json();
      if (!RESPONSE.ok) throw new Error(DATA.error || '加载失败');
      const FILES = DATA.files || [];
      STATUS.textContent = `共 ${FILES.length} 个文件`;
      FILES.forEach((FILE) => {
        const CARD = document.createElement('article');
        CARD.className = 'admin-file-item';
        const NAME = FILE.name || FILE.key || FILE.path || '';
        let CURRENT_NAME = NAME;
        CARD.innerHTML = `<div class="admin-file-thumb"><img src="${String(FILE.url || `/file/${NAME}`).replace(/"/g, '&quot;')}" alt=""></div><div class="admin-file-info"><strong></strong><button type="button" class="admin-file-rename">编辑</button><button type="button" class="button-red">删除</button></div>`;
        CARD.querySelector('strong').textContent = NAME;
        CARD.querySelector('.admin-file-rename').addEventListener('click', async () => {
          const DOT = CURRENT_NAME.lastIndexOf('.');
          const EXTENSION = DOT > 0 ? CURRENT_NAME.slice(DOT) : '';
          const STEM = DOT > 0 ? CURRENT_NAME.slice(0, DOT) : CURRENT_NAME;
          const NEW_STEM = await DIALOG('编辑图片名称', '请输入新的文件名（不含扩展名）', STEM);
          if (!NEW_STEM || NEW_STEM.trim() === STEM) return;
          const NEW_NAME = `${NEW_STEM.trim()}${EXTENSION}`;
          const RENAME_RESPONSE = await fetch(`/api/manage/rename/${encodeURIComponent(CURRENT_NAME)}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newFileId: NEW_NAME }) });
          if (!RENAME_RESPONSE.ok) { window.CC('重命名失败，请检查文件名。', true); return; }
          CARD.querySelector('strong').textContent = NEW_NAME.trim();
          CURRENT_NAME = NEW_NAME.trim();
          window.CC('图片名称已更新');
        });
        CARD.querySelector('button.button-red').addEventListener('click', async () => {
          const CONFIRMED = await DIALOG('删除图片', `确定删除“${CURRENT_NAME}”吗？`);
          if (!CONFIRMED) return;
          const DELETE_RESPONSE = await fetch(`/api/manage/delete/${encodeURIComponent(CURRENT_NAME)}`, { method: 'DELETE', credentials: 'include' });
          if (DELETE_RESPONSE.ok) CARD.remove(); else window.CC('删除失败，请重试。', true);
        });
        CARD.addEventListener('click', async (EVENT) => {
          if (EVENT.target.closest('button')) return;
          const URL = FILE.url || `${window.location.origin}/file/${CURRENT_NAME}`;
          try {
            await navigator.clipboard.writeText(URL);
            window.CC('图片链接已复制');
          } catch (ERROR) {
            window.CC('复制链接失败，请检查剪贴板权限。', true);
          }
        });
        GRID.append(CARD);
      });
    } catch (ERROR) {
      STATUS.textContent = `加载失败：${ERROR.message}`;
      window.CC(STATUS.textContent, true);
    }
  };

  new MutationObserver(SYNC_AUTOMATIC_THEME).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  const REMOVE_OBSOLETE_PAGE_CONTROLS = () => {
    document.querySelectorAll(
      '.directory-tree-picker, .directory-suggestion-input, .directory-tree-trigger, .upload-folder-container',
    ).forEach((CONTROL) => CONTROL.remove());

    document.querySelectorAll('.setting-input').forEach((CONTROL) => {
      const LABEL = CONTROL.parentElement?.querySelector('span')?.textContent?.trim() || '';
      if (/上传目录|upload directory/i.test(LABEL)) CONTROL.parentElement.remove();
    });
  };

  const REMOVE_LEGACY_ADMIN_SECTIONS = () => {
    if (!document.querySelector('.admin-settings-page')) return;
    const LEGACY = /^(认证管理|图像审查|IP管理|访问管理|安全设置|authentication management|image review|ip management|access management|security settings)$/i;

    document.querySelectorAll('.admin-settings-page .security-settings').forEach((SECTION) => SECTION.remove());
    document.querySelectorAll('.admin-settings-page h1, .admin-settings-page h2, .admin-settings-page h3, .admin-settings-page h4, .admin-settings-page .first-title, .admin-settings-page .section-title, .admin-settings-page .el-tabs__item, .admin-settings-page [role="tab"]').forEach((TITLE) => {
      if (!LEGACY.test(TITLE.textContent.trim())) return;
      const PANE_ID = TITLE.getAttribute('aria-controls');
      if (PANE_ID) document.getElementById(PANE_ID)?.remove();
      const SECTION = TITLE.closest('.first-settings, .admin-section, section, .settings-section');
      if (SECTION) SECTION.remove();
      else TITLE.remove();
    });

    document.querySelectorAll('.admin-settings-page .el-tabs__header').forEach((HEADER) => {
      if (!HEADER.querySelector('.el-tabs__item, [role="tab"]')) HEADER.remove();
    });
  };

  const REMOVE_CHANNEL_QUOTA_CONTROLS = () => {
    document.querySelectorAll('.el-dialog.channel-dialog .el-form-item').forEach((ITEM) => {
      const LABEL = ITEM.querySelector('.el-form-item__label')?.textContent?.trim() || '';
      if (/^(容量限制|容量上限\s*\(GB\)|停用阈值\s*\(%\)|quota limit|capacity limit|disable threshold)/i.test(LABEL)) {
        ITEM.remove();
      }
    });
  };

  const OBSOLETE_PAGE_CONTROLS_OBSERVER = new MutationObserver(REMOVE_OBSOLETE_PAGE_CONTROLS);
  OBSOLETE_PAGE_CONTROLS_OBSERVER.observe(document.documentElement, { childList: true, subtree: true });
  REMOVE_OBSOLETE_PAGE_CONTROLS();
  REMOVE_LEGACY_ADMIN_SECTIONS();

  const HIDE_REMOVED_SETTINGS = () => {
    // The standalone admin owns its markup and behavior; do not run DOM surgery
    // intended for the retired Vue settings component on this page.
    if (document.querySelector('.standalone-admin')) return;
    REMOVE_LEGACY_LOGIN_ROUTE();
    REMOVE_OBSOLETE_PAGE_CONTROLS();
    REMOVE_LEGACY_ADMIN_SECTIONS();
    REMOVE_CHANNEL_QUOTA_CONTROLS();
    PATCH_VUE_MESSAGE_TO_CC();
    PATCH_UPLOAD_FAILURE_MESSAGE();
    if (SYNC_ADMIN_BACKUP_VIEW()) {
      INIT_ADMIN_BACKUP_PAGE();
      return;
    }
    if (window.location.hash === '#File') {
      document.body.classList.add('admin-file-page');
      document.querySelector('.admin-settings-page')?.remove();
      INIT_ADMIN_FILE_PAGE();
      return;
    }

    if (document.querySelector('.admin-settings-page')) {
      document.documentElement.classList.add('admin-layout');
      document.body?.classList.add('admin-layout');
      document.documentElement.classList.add('admin-ready');
      document.documentElement.style.visibility = '';
      ADD_ADMIN_CLIENT_SETTINGS_BUTTON();
    }

    UNIFY_STORAGE_CHANNEL_CARDS();
    ADD_ADMIN_CLIENT_SETTINGS_BUTTON();
    ADD_DEFAULT_UPLOAD_CHANNEL_SELECTOR();
    MOVE_HOME_ACTIONS();
    PARK_CLIENT_SETTINGS_SOURCES();
    SYNC_NATIVE_WEB_DAV_SELECT();

    document.querySelectorAll('.admin-settings-page .security-settings').forEach((SECTION) => SECTION.remove());

    document.querySelectorAll('.el-form-item').forEach((ITEM) => {
      const LABEL = ITEM.querySelector('.el-form-item__label')?.textContent?.trim() || ITEM.textContent || '';
      if (/公告|默认上传目录|默认命名方式|登录页背景图|上传页背景图|上传目录|上传路径|文件夹|命名方式/.test(LABEL)) ITEM.remove();
    });

    // The retry control is intentionally removed: failed uploads remain visible
    // instead of being resubmitted automatically.
    document.querySelectorAll('.modern-action-btn-retry').forEach((BUTTON) => BUTTON.remove());
    const ROOT_INSTANCE = document.querySelector('#app')?._vnode?.component;
    const VISITED_INSTANCES = new Set();
    const DISABLE_AUTO_RETRY = (INSTANCE) => {
      if (!INSTANCE || VISITED_INSTANCES.has(INSTANCE)) return;
      VISITED_INSTANCES.add(INSTANCE);
      if (INSTANCE.proxy?.autoReUpload !== undefined) {
        INSTANCE.proxy.autoReUpload = false;
        if (INSTANCE.proxy.retryTimer) clearTimeout(INSTANCE.proxy.retryTimer);
      }
      const WALK = (VNODE) => {
        if (!VNODE) return;
        if (VNODE.component) DISABLE_AUTO_RETRY(VNODE.component);
        if (Array.isArray(VNODE.children)) VNODE.children.forEach(WALK);
      };
      WALK(INSTANCE.subTree);
    };
    DISABLE_AUTO_RETRY(ROOT_INSTANCE);

    document.querySelectorAll('.el-dialog, .el-message-box').forEach((DIALOG) => {
      if (/公告|announcement/i.test(DIALOG.textContent || '')) DIALOG.remove();
    });

    document.querySelectorAll('.admin-settings-page, .upload-home').forEach((SURFACE) => {
      SURFACE.querySelectorAll('[role="menuitem"], .el-dropdown-menu__item, button, a').forEach((ITEM) => {
        const LABEL = (ITEM.textContent || '').trim();
        if (/^(公告|查看公告|退出登录|登出|登录|管理端登录)$/i.test(LABEL)) ITEM.remove();
      });
    });

    // Element Plus teleports dropdown poppers to <body>, outside the app
    // surfaces above. Remove retired native menu actions there as well.
    document.querySelectorAll('[role="menuitem"], .el-dropdown-menu__item').forEach((ITEM) => {
      const LABEL = (ITEM.textContent || ITEM.getAttribute('aria-label') || ITEM.title || '').trim();
      if (/^(公告|查看公告|announcement|view announcement|退出登录|登出|登录|管理端登录|sign out|log out|sign in|admin login)$/i.test(LABEL)) {
        ITEM.remove();
      }
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

    document.querySelectorAll('.others-settings').forEach((SECTION) => {
      const HAS_SETTINGS = SECTION.querySelector(
        '.first-settings, input, textarea, select, .el-input, .el-select, .el-switch, .el-checkbox, .el-radio'
      );
      if (!HAS_SETTINGS) SECTION.remove();
    });

    document.querySelectorAll('.admin-settings-header').forEach((HEADER) => HEADER.remove());

    document.querySelectorAll('img.logo').forEach((ELEMENT) => {
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

    document.querySelectorAll('.others-settings .first-settings').forEach((CARD) => {
      if (CARD.querySelector(':scope > .admin-inline-save')) return;

      const ORIGINAL_SAVE = CARD.closest('.others-settings')?.querySelector('.floating-save-btn');
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

  let SETTINGS_SYNC_PENDING = false;
  let SETTINGS_OBSERVER_STOP_TIMER;
  const ADMIN_ENHANCEMENTS_READY = () => {
    if (window.location.pathname !== CURRENT_ADMIN_PATH) return false;
    if (document.querySelector('.standalone-admin')) return true;
    if (window.location.hash === '#JSON') return Boolean(document.querySelector('#admin-backup-root'));
    if (window.location.hash === '#File') return Boolean(document.querySelector('#admin-file-root'));
    const ADMIN_PAGE = document.querySelector('.admin-settings-page');
    return Boolean(ADMIN_PAGE?.querySelector('.admin-panel-heading-row')
      && ADMIN_PAGE.querySelector('.admin-default-upload-channel-panel')
      && !ADMIN_PAGE.querySelector('.security-settings'));
  };
  const SCHEDULE_SETTINGS_OBSERVER_STOP = () => {
    if (!ADMIN_ENHANCEMENTS_READY()) return;
    window.clearTimeout(SETTINGS_OBSERVER_STOP_TIMER);
    SETTINGS_OBSERVER_STOP_TIMER = window.setTimeout(() => {
      if (ADMIN_ENHANCEMENTS_READY()) SETTINGS_OBSERVER.disconnect();
    }, 1200);
  };
  const SETTINGS_OBSERVER = new MutationObserver(() => {
    if (SETTINGS_SYNC_PENDING) return;
    SETTINGS_SYNC_PENDING = true;
    requestAnimationFrame(() => {
      SETTINGS_SYNC_PENDING = false;
      // This routine moves and removes nodes. Pause observation while it runs so
      // those intentional mutations do not schedule an endless self-update loop.
      SETTINGS_OBSERVER.disconnect();
      HIDE_REMOVED_SETTINGS();
      SETTINGS_OBSERVER.observe(document.documentElement, { childList: true, subtree: true });
      SCHEDULE_SETTINGS_OBSERVER_STOP();
    });
  });
  SETTINGS_OBSERVER.observe(document.documentElement, { childList: true, subtree: true });
  // Wait for the custom view to be applied before stopping. On slower Pages
  // loads, the original Vue tree can mount well after this script executes.
  window.addEventListener('pagehide', () => {
    window.clearTimeout(SETTINGS_OBSERVER_STOP_TIMER);
    SETTINGS_OBSERVER.disconnect();
  }, { once: true });
  window.addEventListener('hashchange', HIDE_REMOVED_SETTINGS);
  HIDE_REMOVED_SETTINGS();
  let FAILURE_PATCH_ATTEMPTS = 0;
  const FAILURE_PATCH_TIMER = window.setInterval(() => {
    PATCH_UPLOAD_FAILURE_MESSAGE();
    FAILURE_PATCH_ATTEMPTS += 1;
    if (FAILURE_PATCH_ATTEMPTS >= 100) {
      window.clearInterval(FAILURE_PATCH_TIMER);
    }
  }, 200);
})();
