import { Platform } from 'react-native';

let ghost: HTMLInputElement | null = null;

/** Keep the mobile web keyboard open across a navigation (must run in the tap handler). */
export function pinWebKeyboard() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  let el = ghost;
  if (!el || !el.isConnected) {
    el = document.createElement('input');
    el.type = 'search';
    el.autocomplete = 'off';
    el.inputMode = 'search';
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText =
      'position:fixed;left:0;top:0;width:16px;height:16px;font-size:16px;opacity:0.01;border:0;padding:0;caret-color:transparent;';
    document.body.appendChild(el);
    ghost = el;
  }
  el.focus();
}

export function transferWebKeyboard(target: { focus: () => void } | null) {
  if (!target) return;
  target.focus();
  if (ghost?.parentNode) {
    ghost.blur();
    ghost.remove();
    ghost = null;
  }
}
