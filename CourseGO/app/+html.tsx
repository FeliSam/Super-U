import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#fafaf9" />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&family=Manrope:wght@400;500;600;700;800&display=swap');
html, body, #root { height: 100%; }
html { background: #0f172a; }
body { margin: 0; background: #0f172a; overflow: hidden; font-family: Manrope, system-ui, sans-serif; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
#root { display: flex; flex-direction: column; min-height: 100%; min-height: 100dvh; }
@media (max-width: 430px) {
  html, body { background: #fafaf9; }
}
`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
