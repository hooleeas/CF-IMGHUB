const ESCAPE_HTML = VALUE => String(VALUE ?? '').replace(/[&<>"']/g, CHAR => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[CHAR]));

const CREATE_BUTTON = (VARIANT, LABEL, ACTION = '') => ({
  LABEL,
  ACTION,
  CLASS_NAME: `button button-${VARIANT}`,
});

export const BUTTON_WHITE = (LABEL, ACTION) => CREATE_BUTTON('white', LABEL, ACTION);
export const BUTTON_BLACK = (LABEL, ACTION) => CREATE_BUTTON('black', LABEL, ACTION);
export const BUTTON_RED = (LABEL, ACTION) => CREATE_BUTTON('red', LABEL, ACTION);

export const CONTAINER = (SLOTS, CLASS_NAME = '') => ({
  CLASS_NAME: `ui-container ${CLASS_NAME}`.trim(),
  SLOTS,
});

export const CC = (MESSAGE, TYPE = 'success', ICON = '') => {
  window.dispatchEvent(new CustomEvent('imgbed:toast', { detail: { MESSAGE, TYPE, ICON } }));
};

export const OPEN_MODAL = (TITLE, CONTENT) => {
  const BACKDROP = document.createElement('div');
  BACKDROP.className = 'ui-modal-backdrop';
  BACKDROP.innerHTML = `<section class="ui-modal" role="dialog" aria-modal="true"><h2>${ESCAPE_HTML(TITLE)}</h2><div class="ui-modal-content"></div></section>`;
  BACKDROP.querySelector('.ui-modal-content').append(CONTENT);
  BACKDROP.addEventListener('click', EVENT => {
    if (EVENT.target === BACKDROP) BACKDROP.remove();
  });
  document.body.append(BACKDROP);
  return BACKDROP;
};

export const CLOSE_MODAL = MODAL => MODAL?.remove();
