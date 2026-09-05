# Tunnel public — API SuperU

Expose l’API locale (`server`, port **8787**) pour les **builds installés** (APK / TestFlight) et les autres Wi‑Fi.

## Build (marche-dore + CourseGO)

L’URL est figée au moment du build via `EXPO_PUBLIC_API_URL` :

1. `.env` de chaque app
2. `eas.json` → `build.*.env.EXPO_PUBLIC_API_URL`

URL actuelle (Cloudflare, ngrok bloqué sur cette machine) :

```text
https://YOUR-TUNNEL.trycloudflare.com
```

Quand le tunnel redémarre et que l’URL change :

1. Mets à jour `marche-dore/.env`, `CourseGO/.env`, `server/.env` (`PUBLIC_API_URL`)
2. Mets à jour `eas.json` (les deux apps)
3. **Rebuild** (`eas build`) — un build déjà installé garde l’ancienne URL

```powershell
# Exemple rebuild preview Android
cd marche-dore
eas build -p android --profile preview
cd ../CourseGO
eas build -p android --profile preview
```

Pendant le test : PC allumé + `npm run dev:api` + `npm run tunnel:api`.

## Runtime

```powershell
npm run dev:api
npm run tunnel:api
```

## Brancher sans rebuild

Réglages → *Adresse API SuperU* → coller la nouvelle URL https → Enregistrer  
(utile si le tunnel a changé sans refaire un build)

## ngrok

Sur cette machine, Windows Smart App Control bloque ngrok ≥ 3.20 → `tunnel:api` bascule sur Cloudflare.  
Authtoken (si ngrok redevient utilisable) :

```powershell
.\ngrok.cmd config add-authtoken VOTRE_TOKEN
```

Forcer Cloudflare : `$env:SUPERU_TUNNEL='cloudflare'; npm run tunnel:api`
