# Marché Admin

Back-office web (Vite + React + Redux) pour le catalogue et le stock Super U.

- URL : http://localhost:8083
- API : http://localhost:8787 (même Postgres que la boutique)
- Login : `admin@marchedore.bj` / `marche2024` (compte `ops.staff`, rôle `admin`)

Pas de login client (`demo@…`). Un coursier (`courier@…`) reçoit un 403.

```bash
docker compose up -d
npm run dev:api
npm run dev:admin
```

Les images restent dans `marche-dore/assets/images/catalog/{id}.png`. Après un upload : `npm run catalog:map` puis rebuild Expo.
