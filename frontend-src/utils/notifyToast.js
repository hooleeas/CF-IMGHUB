export default function notifyToast(message, type = 'success', icon = '') {
  window.dispatchEvent(new CustomEvent('imgbed:toast', {
    detail: {
      MESSAGE: message,
      TYPE: type,
      ICON: icon
    }
  }));
}
