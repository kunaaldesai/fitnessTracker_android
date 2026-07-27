#!/usr/bin/env bash
set -uo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
requested_platform="${1:-all}"
preflight_errors=0
preflight_warnings=0

if [[ "$requested_platform" != "all" &&
  "$requested_platform" != "android" &&
  "$requested_platform" != "ios" ]]; then
  echo "Usage: bash scripts/release-preflight.sh [all|android|ios]" >&2
  exit 1
fi

preflight_pass() {
  echo "✓ $1"
}

preflight_fail() {
  echo "✗ $1" >&2
  preflight_errors=$((preflight_errors + 1))
}

preflight_warn() {
  echo "! $1"
  preflight_warnings=$((preflight_warnings + 1))
}

cd "$project_root"

if node -e '
  const config = require("./app.json").expo;
  const valid =
    config.ios.bundleIdentifier === "com.kunaaldesai.logmaxxing" &&
    config.android.package === "com.kunaaldesai.logmaxxing" &&
    config.ios.appleTeamId === "4VZ445BX2G" &&
    Number.isInteger(config.android.versionCode) &&
    /^\d+$/.test(config.ios.buildNumber);
  process.exit(valid ? 0 : 1);
'; then
  preflight_pass "App identifiers, Apple team, and build numbers are configured"
else
  preflight_fail "App identifiers, Apple team, or build numbers are invalid"
fi

if [[ ! -f .env ]]; then
  preflight_fail ".env is missing"
else
  missing_public_env="$(
    node -e '
      const fs = require("node:fs");
      const required = [
        "EXPO_PUBLIC_FIREBASE_API_KEY",
        "EXPO_PUBLIC_FIREBASE_APP_ID",
        "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
        "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
        "EXPO_PUBLIC_FITNESS_API_BASE_URL",
        "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID",
        "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID",
      ];
      const keys = new Set(
        fs.readFileSync(".env", "utf8")
          .split(/\r?\n/)
          .map((line) => line.match(/^\s*(?:export\s+)?["'\'']?([^"'\'']+?)["'\'']?\s*=/)?.[1])
          .filter(Boolean),
      );
      process.stdout.write(required.filter((key) => !keys.has(key)).join(","));
    '
  )"

  if [[ -z "$missing_public_env" ]]; then
    preflight_pass "Required app environment variables are present"
  else
    preflight_fail "Missing .env variables: $missing_public_env"
  fi
fi

if [[ "$requested_platform" == "all" || "$requested_platform" == "android" ]]; then
  echo
  echo "Android"

  if source "$project_root/scripts/android-env.sh"; then
    preflight_pass "Java, Android SDK, adb, and emulator are available"
  else
    preflight_fail "Android SDK setup is incomplete"
  fi

  if [[ ! -d "${ANDROID_HOME:-}/platforms/android-36" ]]; then
    preflight_fail "Android SDK Platform 36 is not installed"
  else
    preflight_pass "Android SDK Platform 36 is installed"
  fi

  if [[ ! -f .env.signing.local ]]; then
    preflight_fail ".env.signing.local is missing"
  else
    set -a
    source .env.signing.local
    set +a
    resolve_android_upload_keystore "$project_root"

    missing_android_signing=()
    for signing_variable in \
      LOGMAXXING_UPLOAD_STORE_FILE \
      LOGMAXXING_UPLOAD_STORE_PASSWORD \
      LOGMAXXING_UPLOAD_KEY_ALIAS \
      LOGMAXXING_UPLOAD_KEY_PASSWORD
    do
      if [[ -z "${!signing_variable:-}" ]]; then
        missing_android_signing+=("$signing_variable")
      fi
    done

    if (( ${#missing_android_signing[@]} > 0 )); then
      preflight_fail "Missing Android signing variables: ${missing_android_signing[*]}"
    elif [[ ! -f "$LOGMAXXING_UPLOAD_STORE_FILE" ]]; then
      preflight_fail "The Android upload keystore file is missing"
    elif "$JAVA_HOME/bin/keytool" \
      -list \
      -keystore "$LOGMAXXING_UPLOAD_STORE_FILE" \
      -storepass "$LOGMAXXING_UPLOAD_STORE_PASSWORD" \
      -alias "$LOGMAXXING_UPLOAD_KEY_ALIAS" \
      -keypass "$LOGMAXXING_UPLOAD_KEY_PASSWORD" \
      >/dev/null 2>&1; then
      preflight_pass "Android upload keystore and alias are valid"

      upload_sha1="$(
        "$JAVA_HOME/bin/keytool" \
          -list \
          -v \
          -keystore "$LOGMAXXING_UPLOAD_STORE_FILE" \
          -storepass "$LOGMAXXING_UPLOAD_STORE_PASSWORD" \
          -alias "$LOGMAXXING_UPLOAD_KEY_ALIAS" \
          -keypass "$LOGMAXXING_UPLOAD_KEY_PASSWORD" 2>/dev/null |
          awk -F': ' '/SHA1:/{print $2; exit}' |
          tr -d ':' |
          tr '[:upper:]' '[:lower:]'
      )"

      if UPLOAD_SHA1="$upload_sha1" node -e '
        const fs = require("node:fs");
        const config = JSON.parse(fs.readFileSync("google-services.json", "utf8"));
        const hashes = config.client.flatMap((client) =>
          (client.oauth_client || [])
            .map((entry) => entry.android_info?.certificate_hash)
            .filter(Boolean),
        );
        process.exit(hashes.includes(process.env.UPLOAD_SHA1) ? 0 : 1);
      '; then
        preflight_pass "Android upload certificate is registered in Firebase"
      else
        preflight_fail "Android upload certificate is not registered in Firebase"
      fi
    else
      preflight_fail "Android upload keystore password or alias is invalid"
    fi
  fi

  android_build_number="$(
    node -p 'require("./app.json").expo.android.versionCode'
  )"
  if find dist -maxdepth 2 -iname "*versionCode${android_build_number}*" -print -quit 2>/dev/null |
    grep -q .
  then
    preflight_warn "Android versionCode $android_build_number already has a local artifact; bump before the next build"
  fi
fi

if [[ "$requested_platform" == "all" || "$requested_platform" == "ios" ]]; then
  echo
  echo "iOS"

  if command -v xcodebuild >/dev/null 2>&1 &&
    command -v xcrun >/dev/null 2>&1
  then
    preflight_pass "$(xcodebuild -version | tr '\n' ' ')"
  else
    preflight_fail "Xcode command-line tools are unavailable"
  fi

  apple_team_id="$(
    node -p 'require("./app.json").expo.ios.appleTeamId'
  )"
  if security find-identity -v -p codesigning 2>/dev/null |
    grep -q "Apple Distribution:.*($apple_team_id)"
  then
    preflight_pass "Apple Distribution identity for team $apple_team_id is installed"
  else
    preflight_fail "Apple Distribution identity for team $apple_team_id is missing"
  fi

  distribution_certificate="credentials/ios/apple_distribution.cer"
  if [[ ! -f "$distribution_certificate" ]]; then
    preflight_fail "Apple distribution certificate backup is missing"
  else
    certificate_expiration="$(
      openssl x509 \
        -inform DER \
        -in "$distribution_certificate" \
        -noout \
        -enddate 2>/dev/null |
        cut -d= -f2-
    )"
    if node -e '
      process.exit(Date.parse(process.argv[1]) > Date.now() ? 0 : 1)
    ' "$certificate_expiration"; then
      preflight_pass "Apple distribution certificate is valid until $certificate_expiration"
    else
      preflight_fail "Apple distribution certificate is expired or unreadable"
    fi
  fi

  provisioning_profile="credentials/ios/logmaxxing_app_store_push.mobileprovision"
  if [[ ! -f "$provisioning_profile" ]]; then
    preflight_fail "App Store provisioning profile is missing"
  else
    profile_name="$(
      security cms -D -i "$provisioning_profile" 2>/dev/null |
        plutil -extract Name raw -o - - 2>/dev/null
    )"
    profile_uuid="$(
      security cms -D -i "$provisioning_profile" 2>/dev/null |
        plutil -extract UUID raw -o - - 2>/dev/null
    )"
    profile_expiration="$(
      security cms -D -i "$provisioning_profile" 2>/dev/null |
        plutil -extract ExpirationDate raw -o - - 2>/dev/null
    )"
    profile_application_id="$(
      security cms -D -i "$provisioning_profile" 2>/dev/null |
        plutil -extract Entitlements.application-identifier raw -o - - 2>/dev/null
    )"
    profile_push_environment="$(
      security cms -D -i "$provisioning_profile" 2>/dev/null |
        plutil -extract Entitlements.aps-environment raw -o - - 2>/dev/null
    )"

    if [[ "$profile_application_id" != "$apple_team_id.com.kunaaldesai.logmaxxing" ]]; then
      preflight_fail "App Store profile has the wrong application identifier"
    elif [[ "$profile_push_environment" != "production" ]]; then
      preflight_fail "App Store profile does not include production push notifications"
    elif ! node -e '
      process.exit(Date.parse(process.argv[1]) > Date.now() ? 0 : 1)
    ' "$profile_expiration"; then
      preflight_fail "App Store provisioning profile is expired"
    else
      preflight_pass "$profile_name is valid until $profile_expiration"
    fi

    installed_profile="$HOME/Library/MobileDevice/Provisioning Profiles/$profile_uuid.mobileprovision"
    if [[ -f "$installed_profile" ]]; then
      preflight_pass "App Store provisioning profile is installed"
    else
      preflight_warn "App Store profile will be installed automatically by the release script"
    fi
  fi

  if security find-identity -v -p codesigning 2>/dev/null |
    grep -q '"Apple Development:'
  then
    preflight_pass "Apple Development identity is installed for physical-device builds"
  else
    preflight_warn "No Apple Development identity; npm run ios still works on the Simulator"
  fi

  ios_build_number="$(
    node -p 'require("./app.json").expo.ios.buildNumber'
  )"
  if find dist -maxdepth 2 -iname "*ios-build${ios_build_number}*" -print -quit 2>/dev/null |
    grep -q .
  then
    preflight_warn "iOS build $ios_build_number already has a local artifact; bump before the next build"
  fi
fi

echo
if (( preflight_errors > 0 )); then
  echo "Preflight failed with $preflight_errors error(s) and $preflight_warnings warning(s)." >&2
  exit 1
fi

echo "Preflight passed with $preflight_warnings warning(s)."
