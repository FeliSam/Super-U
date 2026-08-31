# Marché Admin

Back-office web (Vite + React + Redux) : catalogue / stock **et** personnel RH.

- URL : http://localhost:8083
- API : http://localhost:8787 (même Postgres que la boutique)
- Admin : `admin@marchedore.bj` / `marche2024` (catalogue + RH)
- Recruteur : `rh@marchedore.bj` / `marche2024` (personnel seulement, pas de prix)
- Terrain CourseGO : `picker@` / `courier@` / `marche2024` — 403 sur le catalogue

Pas de login client (`demo@…`). Trois mondes distincts : `public.users` (boutique), `ops.staff` terrain, `ops.staff` back-office.

## Rôles (extrait)

| Rôle | CourseGO | Catalogue | RH |
|---|---|---|---|
| coursier | ramasse + livre | non | non |
| picker | ramasse | non | non |
| courier | livre | non | non |
| magasinier | non | stock magasin | non |
| manager | non | son magasin | son magasin |
| admin | non | tous | tous |
| recruteur | non | non | créer / onboarding |

```bash
docker compose up -d
npm run dev:api
npm run dev:admin
```

Les images catalogue restent dans `marche-dore/assets/images/catalog/{id}.png`.
