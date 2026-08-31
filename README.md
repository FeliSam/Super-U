# SuperU — monorepo Marché Doré

Un dépôt, une API, une base Postgres. Deux apps Expo 57.

| Dossier | Rôle | Port web | Auth |
| --- | --- | --- | --- |
| `marche-dore/` | Boutique client | 8081 | `public.users` — `demo@marchedore.bj` / `marche2024` |
| `CourseGO/` | Staff picking + livraison | 8082 | `ops.staff` — `picker@marchedore.bj` ou `courier@marchedore.bj` / `marche2024` |
| `marche-admin/` | Back-office catalogue, stock et personnel | 8083 | `ops.staff` — `admin@marchedore.bj` ou `rh@marchedore.bj` / `marche2024` |
| `server/` | API Hono | 8787 | — |

Les PNG catalogue vivent dans `marche-dore/assets/images/catalog/`. L’API les sert sur `/catalog/media/:id`. CourseGO les `require()` aussi en local (même dossier).

## Démarrer

```bash
docker compose up -d          # Postgres :5432
npm run dev:api               # API
npm run dev:shop              # boutique
npm run dev:course            # CourseGO
npm run dev:admin             # Marché Admin (catalogue + RH)
```

Ou dans chaque dossier : `npm install` puis `npm run web` / `npm run dev`.

`install-strategy=nested` dans `.npmrc` : chaque app garde son `node_modules` (Metro Expo).

## Règle

CourseGO n’est pas une 2e boutique. Elle avance `ops.pick_jobs` / `ops.deliveries`. Le serveur met à jour le statut vu par le client.
