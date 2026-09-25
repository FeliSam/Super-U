# Publication stores + push — SuperU

Guide opérationnel pour CourseGO (`com.superu.coursego`) et Marché Doré (`com.superu.marchedore`).

## 1. Comptes (à créer hors repo)

- [ ] Apple Developer Program
- [ ] Google Play Console
- [ ] Compte Expo (https://expo.dev) — un projet EAS **par app**

## 2. Lier EAS et coller le `projectId`

Dans chaque app :

```bash
cd CourseGO
npx eas-cli login
npx eas-cli init
# copie le projectId dans CourseGO/app.json → expo.extra.eas.projectId

cd ../marche-dore
npx eas-cli init
# copie le projectId dans marche-dore/app.json → expo.extra.eas.projectId
```

Remplace `REPLACE_WITH_EAS_PROJECT_ID` dans les deux `app.json`.

## 3. Credentials push (FCM + APNs)

### Android (FCM)

1. Créer un projet Firebase (un par app ou un projet multi-apps).
2. Ajouter l’application Android avec le package :
   - CourseGO : `com.superu.coursego`
   - Marché Doré : `com.superu.marchedore`
3. Télécharger la clé de compte de service Google Cloud (JSON) pour FCM.
4. Dans chaque dossier app :

```bash
npx eas-cli credentials
# Platform: Android → Push Notifications → Set up Google Service Account
```

### iOS (APNs)

1. Dans Apple Developer → Keys → créer une **Apple Push Notifications key** (`.p8`).
2. Activer Push Notifications sur l’App ID (`com.superu.coursego` / `com.superu.marchedore`).
3. Puis :

```bash
npx eas-cli credentials
# Platform: iOS → Push Notifications → upload .p8 / Team ID / Key ID
```

Les builds **production** (pas Expo Go) sont requis pour tester les push réelles.

## 4. Builds production

```bash
# Prévisualisation interne (APK)
cd CourseGO && npx eas-cli build --platform android --profile preview
cd ../marche-dore && npx eas-cli build --platform android --profile preview

# Stores
cd CourseGO && npx eas-cli build --platform all --profile production
cd ../marche-dore && npx eas-cli build --platform all --profile production

# Soumission (après App Store Connect / Play listing)
npx eas-cli submit --platform android --profile production
npx eas-cli submit --platform ios --profile production
```

Remplace `REPLACE_AFTER_APP_STORE_CONNECT` dans chaque `eas.json` → `submit.production.ios.ascAppId` par l’ID numérique App Store Connect.

## 5. URLs légales & conformité

Déjà référencées dans `app.json` → `extra` :

- Privacy : `https://marchedore.bj/privacy`
- CGU : `https://marchedore.bj/terms`
- Support : `support@marchedore.bj`

À faire avant soumission :

- [ ] Pages HTTPS réellement en ligne (FR)
- [ ] Play Console → Data safety (localisation, caméra, micro, notifications, compte)
- [ ] App Store Connect → App Privacy (mêmes catégories)
- [ ] Screenshots téléphone (+ tablette si `supportsTablet: true`)
- [ ] Icône 1024×1024
- [ ] Compte reviewer Apple pour CourseGO (staff démo) + notes de review
- [ ] API prod HTTPS dans `EXPO_PUBLIC_API_URL` (jamais `127.0.0.1` en store)

## 6. Ce qui est déjà dans le code

| Élément | CourseGO | marche-dore | server |
|---|---|---|---|
| package / bundleId / versionCode | oui | oui | — |
| eas.json production AAB | oui | oui | — |
| expo-notifications + provider | oui | oui | — |
| `POST /comms/devices` | oui | oui | oui |
| Envoi Expo Push (chat, call, ops, commandes) | — | — | oui (`src/push.ts`) |

## 7. Test push

1. Build preview installé sur device physique.
2. Se connecter → accepter notifications.
3. Vérifier une ligne dans `comms.devices` avec `push_token` type `ExponentPushToken[...]`.
4. Déclencher un message / appel / changement de statut commande → notification système.
