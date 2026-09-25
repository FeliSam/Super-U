# Tunnel public — API SuperU

## Domaine ngrok fixe (recommandé)

Domaine réservé : `https://giveaway-rack-obtrusive.ngrok-free.dev`

Le dashboard reste sur **“Waiting…”** tant que le tunnel local n’est pas lancé.

1. API : `npm run dev:api` (port **8787**, pas 8085)
2. Tunnel : `npm run tunnel:ngrok` — **laisse ce terminal ouvert**

```powershell
npm run tunnel:ngrok
```

Quand c’est bon : health `https://giveaway-rack-obtrusive.ngrok-free.dev/health` → `{"ok":true,...}`  
et le dashboard passe à **online**.

Sur **tous** les téléphones : Réglages → Adresse API →  
`https://giveaway-rack-obtrusive.ngrok-free.dev`

Cette URL **ne change pas** à chaque restart.

Authtoken : fichier `%LOCALAPPDATA%\ngrok\ngrok.yml`, ou :

```powershell
$env:NGROK_AUTHTOKEN="ton_token"
npm run tunnel:ngrok
```

## Pourquoi l’exemple ngrok parlait de 8085 ?

Leur démo pointe `localhost:8085`. Chez SuperU l’API est sur **8787** — c’est ce que `tunnel:ngrok` utilise.

## Cloudflare (fallback)

```powershell
npm run tunnel:api
```

URL `*.trycloudflare.com` **change** à chaque lancement.

## Build EAS

```powershell
npm run api:url -- https://giveaway-rack-obtrusive.ngrok-free.dev
```
