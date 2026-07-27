#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

bash ./scripts/release-preflight.sh android
node ./scripts/assert-new-build-number.js android

set -a
source .env.signing.local
set +a
source ./scripts/android-env.sh
resolve_android_upload_keystore "$project_root"

echo "Syncing the generated Android project from app.json..."
npx expo prebuild --platform android --no-install
pin_android_gradle_wrapper "$project_root"

echo "Building a signed Android App Bundle..."
(
  cd android
  ./gradlew :app:bundleRelease
)

app_version="$(node -p 'require("./app.json").expo.version')"
version_code="$(node -p 'require("./app.json").expo.android.versionCode')"
bundle_source="android/app/build/outputs/bundle/release/app-release.aab"
bundle_destination="dist/logmaxxing-${app_version}-android-versionCode${version_code}.aab"

if [[ ! -f "$bundle_source" ]]; then
  echo "Gradle completed without producing $bundle_source." >&2
  exit 1
fi

mkdir -p dist
install -m 644 "$bundle_source" "$bundle_destination"

mapping_source="android/app/build/outputs/mapping/release/mapping.txt"
if [[ -f "$mapping_source" ]]; then
  install -m 644 \
    "$mapping_source" \
    "dist/logmaxxing-${app_version}-android-versionCode${version_code}-mapping.txt"
fi

echo "Google Play bundle: $project_root/$bundle_destination"
