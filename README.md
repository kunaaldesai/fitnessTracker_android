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

## Run

```bash
npm run android
npm run ios
npm run web
```

## Verify

```bash
npm run typecheck
npm test
npm run lint
npx expo-doctor
```
