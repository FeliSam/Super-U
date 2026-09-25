# CourseGo

App Expo **staff** du monorepo SuperU (picking magasin + livraison). UI [Figma CourseGo](https://www.figma.com/design/hkDVeyquXWw7t1Cm2aHfwf/CourseGo).

Données **ops + comms** via l’API `server/` (`http://localhost:8787`). Pas de 2e base. Login client boutique interdit.

## Démarrer (depuis la racine SuperU)

1. `npm run db:up`
2. `npm run dev:api`
3. `npm run dev:course` → http://localhost:8082

Identifiants : fournis en privé (aucun compte ni mot de passe dans ce dépôt).

## Tabs

Accueil · Missions · Revenus · Historique · Profil

Les photos produit viennent du bundle `marche-dore/assets/images/catalog` (même fichiers que la boutique).
