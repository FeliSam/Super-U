# Notifications push — CourseGO & Marché Doré

Le code est en place (clients + serveur Expo Push). Il reste la config **credentials** et un **build natif**.

## APIs d’automatisation (où cliquer)

Il y a **deux** APIs. Ce n’est pas la même page.

### A) App Store Connect API — upload / TestFlight / `eas submit`

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. **Utilisateurs et accès** (en haut)
3. Onglet **Intégrations** (pas Personnes, pas Finances)
4. Section **App Store Connect API** → **Générer une clé**
5. Tu y trouves : **Issuer ID**, **Key ID**, fichier `.p8`

Ça automatise : soumettre un IPA, TestFlight. **Pas** les notifications.

### B) APNs — notifications iOS

1. [developer.apple.com/account/resources/authkeys/list](https://developer.apple.com/account/resources/authkeys/list)
2. Ta clé actuelle : **TJMDGFHBFJ** (`Clé APN`)

Ça sert aux **push**. Expo doit quand même être **connecté à une équipe Apple** (Apple ID + mot de passe d’app). Je ne peux pas faire cette connexion à ta place : il faut ton mot de passe Apple / 2FA.

## CLI à lancer (toi, une fois)

```bash
cd marche-dore
npx eas-cli credentials -p ios
# Apple ID + mot de passe d'app
# Push key : TJMDGFHBFJ + AuthKey_TJMDGFHBFJ.p8 + Team K2DMD57HTQ

cd ../CourseGO
npx eas-cli credentials -p ios
# même clé APNs
```

Ensuite je peux enchaîner les builds :

```bash
npx eas-cli build --platform ios --profile production --non-interactive
npx eas-cli submit --platform ios --profile production --non-interactive --latest
```

## Projets EAS (déjà liés)

| App | Project ID | Dashboard |
|---|---|---|
| CourseGO | `ec3a7b59-415b-46e9-960a-10c49848420a` | https://expo.dev/accounts/feliciano6/projects/coursego |
| Marché Doré | `20abed55-9ebc-46bc-acd9-14523484f61a` | https://expo.dev/accounts/feliciano6/projects/marche-dore |

## Important : 2 clés `.p8` différentes

| Clé | Où elle se crée | Sert à |
|---|---|---|
| **App Store Connect API** | App Store Connect → Utilisateurs et accès → Intégrations | `eas submit` (upload store) |
| **APNs (Apple Push)** | developer.apple.com → Keys → Apple Push Notifications | **Notifications iOS** |

Si tu as seulement mis la clé **App Store Connect** dans EAS, les **push iOS ne marchent pas encore**. Il faut aussi la clé **APNs**.

## Configurer les push iOS (les 2 apps)

1. [developer.apple.com](https://developer.apple.com/account/resources/authkeys/list) → **Keys** → **+**
2. Coche **Apple Push Notifications service (APNs)** → Continue → Register
3. Télécharge le `.p8` (une seule fois) + note **Key ID** + **Team ID**
4. Pour chaque app :

```bash
cd CourseGO
npx eas-cli credentials
# iOS → production → Push Notifications → Set up with Apple Push Notifications Key

cd ../marche-dore
npx eas-cli credentials
# même chose
```

Ou via le dashboard Expo → projet → **Credentials** → iOS → Push Key.

## Configurer les push Android (FCM)

1. [Firebase Console](https://console.firebase.google.com) → créer / ouvrir un projet
2. Ajouter app Android :
   - CourseGO : `com.superu.coursego`
   - Marché Doré : `com.superu.marchedore`
3. Project settings → **Service accounts** → Generate new private key (JSON)
4. Puis :

```bash
cd CourseGO
npx eas-cli credentials
# Android → Push Notifications (FCM) → Google Service Account

cd ../marche-dore
npx eas-cli credentials
# même chose
```

## Tester

Les push **ne marchent pas dans Expo Go** de façon fiable pour la prod. Il faut un build :

```bash
# Preview installable
cd CourseGO && npx eas-cli build --platform android --profile preview
cd ../marche-dore && npx eas-cli build --platform android --profile preview

# iOS (device physique / TestFlight)
cd CourseGO && npx eas-cli build --platform ios --profile preview
cd ../marche-dore && npx eas-cli build --platform ios --profile preview
```

Ensuite :
1. Installer l’app → se connecter → accepter les notifications
2. Vérifier en base : table `comms.devices` avec `push_token` du type `ExponentPushToken[...]`
3. Déclencher un message chat / appel / changement de statut commande → notification système

## Déjà dans le code

- Permission + enregistrement token → `POST /comms/devices`
- CourseGO : `PushNotificationsContext` + écran permissions / settings
- Marché Doré : `PushNotificationsContext` + toggle Réglages
- Serveur : `server/src/push.ts` envoie via Expo Push API sur chat, appels, missions, commandes
