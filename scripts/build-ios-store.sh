#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

bash ./scripts/release-preflight.sh ios
node ./scripts/assert-new-build-number.js ios

echo "Syncing the generated iOS project from app.json and installing pods..."
npx expo prebuild --platform ios

provisioning_profile="credentials/ios/logmaxxing_app_store_push.mobileprovision"
profile_name="$(
  security cms -D -i "$provisioning_profile" |
    plutil -extract Name raw -o - -
)"
profile_uuid="$(
  security cms -D -i "$provisioning_profile" |
    plutil -extract UUID raw -o - -
)"
profiles_directory="$HOME/Library/MobileDevice/Provisioning Profiles"
installed_profile="$profiles_directory/$profile_uuid.mobileprovision"

mkdir -p "$profiles_directory"
if [[ ! -f "$installed_profile" ]] ||
  ! cmp -s "$provisioning_profile" "$installed_profile"
then
  install -m 600 "$provisioning_profile" "$installed_profile"
fi

workspace="$(
  find ios -maxdepth 1 -type d -name '*.xcworkspace' -print |
    sed -n '1p'
)"
if [[ -z "$workspace" ]]; then
  echo "No iOS workspace was generated." >&2
  exit 1
fi

scheme="$(basename "$workspace" .xcworkspace)"
app_version="$(node -p 'require("./app.json").expo.version')"
build_number="$(node -p 'require("./app.json").expo.ios.buildNumber')"
apple_team_id="$(node -p 'require("./app.json").expo.ios.appleTeamId')"
archive_path="dist/logmaxxing-${app_version}-ios-build${build_number}.xcarchive"
export_path="dist/ios-build${build_number}-export"
export_options="store-config/ios/ExportOptions.plist"

mkdir -p dist

echo "Archiving signed iOS build $build_number..."
xcodebuild archive \
  -workspace "$workspace" \
  -scheme "$scheme" \
  -configuration Release \
  -destination generic/platform=iOS \
  -archivePath "$archive_path" \
  DEVELOPMENT_TEAM="$apple_team_id" \
  CODE_SIGN_STYLE=Manual \
  CODE_SIGN_IDENTITY="Apple Distribution" \
  PROVISIONING_PROFILE_SPECIFIER="$profile_name" \
  COMPILER_INDEX_STORE_ENABLE=NO

echo "Exporting the App Store IPA..."
xcodebuild -exportArchive \
  -archivePath "$archive_path" \
  -exportOptionsPlist "$export_options" \
  -exportPath "$export_path"

ipa_path="$(
  find "$export_path" -maxdepth 1 -type f -name '*.ipa' -print |
    sed -n '1p'
)"
if [[ -z "$ipa_path" ]]; then
  echo "Xcode completed without producing an IPA." >&2
  exit 1
fi

echo "App Store IPA: $project_root/$ipa_path"
