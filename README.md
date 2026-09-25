# SuperU — monorepo Marché Doré

Un dépôt, une API, une base Postgres. Deux apps Expo 57.

| Dossier | Rôle | Port web | Auth |
| --- | --- | --- | --- |
| `marche-dore/` | Boutique client | 8081 | `public.users` (comptes clients) |
| `CourseGO/` | Staff picking + livraison | 8082 | `ops.staff` terrain |
| `marche-admin/` | Back-office catalogue, stock et personnel | 8083 | `ops.staff` back-office |
| `server/` | API Hono | 8787 | — |

Les identifiants (démo, staff, admin) sont fournis en privé : ils ne figurent pas dans ce dépôt.

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

## TestFlight / EAS

- `testflight` / `production` : API `https://giveaway-rack-obtrusive.ngrok-free.dev` (lancer `npm run tunnel:ngrok`) ou une API HTTPS prod.
- Rebuild EAS requis après ajout des plugins `react-native-maps` et `@maplibre/maplibre-react-native`.
- Identifiants staff CourseGO : fournis en privé.

