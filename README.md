# FitTrack Mobile

Shared Expo-managed React Native app for FitTrack Android and iOS.

The app uses one TypeScript codebase with Expo Router. Android commands run from this folder. iOS commands also run from this folder; `../fitness_ios` is only a lightweight launcher/notes folder so platform source is not duplicated.

## Setup

```bash
npm install
cp .env.example .env
```

Fill in the Firebase web config values in `.env`. The backend base URL defaults to:

```bash
EXPO_PUBLIC_FITNESS_API_BASE_URL=https://fitness-tracker-39bca.web.app
```

The mobile login UI uses Google sign-in only. Email/password may remain enabled in Firebase Auth for admin/backward-compatibility purposes, but the app does not expose email/password login or signup screens.

Google sign-in uses the native `@react-native-google-signin/google-signin` package. It will not work inside Expo Go; use the native development build commands below.

For Google sign-in, keep the Firebase iOS/Android app config files in this folder and enable the Google provider in Firebase Authentication. The generated iOS client ID is already included in `.env.example`:

```bash
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=876391706816-2vod9139tpad47pmluhealah54mg6d2f.apps.googleusercontent.com
```

Use `EXPO_PUBLIC_GOOGLE_CLIENT_ID` only as a shared fallback. Android production sign-in also requires registering the app signing SHA-1/SHA-256 fingerprints in Firebase.

## Run

```bash
npm run android
npm run ios
npm run web
```

`npm run ios` and `npm run android` run `expo run:*` so native modules are built into the app.

## Verify

```bash
npm run typecheck
npm test
npm run lint
npx expo-doctor
```
