import { Platform, type TextStyle } from 'react-native';

/**
 * Mobile Safari auto-zooms focused fields when computed font-size &lt; 16px.
 * Use on every TextInput / multiline “textarea” style.
 */
export const INPUT_FONT_SIZE = 16;

/** Style fragment to merge into TextInput `style` (last wins). */
export const noZoomInputStyle: TextStyle =
  Platform.OS === 'web'
    ? // Safari measures CSS px; RNW number sometimes loses under scaled ancestors.
      ({ fontSize: '16px' } as unknown as TextStyle)
    : { fontSize: INPUT_FONT_SIZE };

/** Call once on web to keep viewport from scaling on input focus. */
export function lockWebInputZoom(): () => void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return () => undefined;
  }

  const VIEWPORT =
    'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

  const ensureViewport = () => {
    let meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      document.head.appendChild(meta);
    }
    if (meta.getAttribute('content') !== VIEWPORT) {
      meta.setAttribute('content', VIEWPORT);
    }
  };

  const STYLE_ID = 'marche-dore-no-input-zoom';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      input, textarea, select, [contenteditable="true"],
      input:focus, textarea:focus, select:focus {
        font-size: 16px !important;
      }
    `;
    document.head.appendChild(style);
  }

  ensureViewport();
  // Do not observe `attributes` on all of <head>: RN-web / Expo rewrite tags on
  // every layout, which would call setAttribute → visualViewport resize →
  // useWindowDimensions setState → infinite "Maximum update depth exceeded".
  const obs = new MutationObserver(() => {
    ensureViewport();
  });
  obs.observe(document.head, { childList: true, subtree: false });

  return () => obs.disconnect();
}
