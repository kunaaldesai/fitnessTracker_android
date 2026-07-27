#!/usr/bin/env bash

# Shared Android SDK setup. This file is intended to be sourced.

if [[ -z "${JAVA_HOME:-}" ]]; then
  for android_java_candidate in \
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
    "/Applications/Android Studio Preview.app/Contents/jbr/Contents/Home"
  do
    if [[ -x "$android_java_candidate/bin/java" ]]; then
      export JAVA_HOME="$android_java_candidate"
      break
    fi
  done
fi

if [[ -z "${ANDROID_HOME:-}" && -d "$HOME/Library/Android/sdk" ]]; then
  export ANDROID_HOME="$HOME/Library/Android/sdk"
fi

if [[ -z "${ANDROID_SDK_ROOT:-}" && -n "${ANDROID_HOME:-}" ]]; then
  export ANDROID_SDK_ROOT="$ANDROID_HOME"
fi

prepend_android_path() {
  if [[ -n "${1:-}" && -d "$1" ]]; then
    export PATH="$1:$PATH"
  fi
}

if [[ -n "${JAVA_HOME:-}" ]]; then
  prepend_android_path "$JAVA_HOME/bin"
fi

if [[ -n "${ANDROID_HOME:-}" ]]; then
  prepend_android_path "$ANDROID_HOME/emulator"
  prepend_android_path "$ANDROID_HOME/platform-tools"
  prepend_android_path "$ANDROID_HOME/cmdline-tools/latest/bin"
fi

if ! command -v java >/dev/null 2>&1; then
  echo "Android requires Java. Install Android Studio or set JAVA_HOME." >&2
  return 1
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "Android requires adb. Install Android Studio SDK tools or set ANDROID_HOME." >&2
  return 1
fi

if ! command -v emulator >/dev/null 2>&1; then
  echo "Android requires the emulator package from Android Studio's SDK Manager." >&2
  return 1
fi

pin_android_gradle_wrapper() {
  local gradle_wrapper_path="$1/android/gradle/wrapper/gradle-wrapper.properties"

  if [[ -f "$gradle_wrapper_path" ]]; then
    # Gradle 9.x currently breaks this Android plugin set via JvmVendorSpec.IBM_SEMERU.
    perl -0pi -e 's#distributionUrl=https\\://services\.gradle\.org/distributions/gradle-[^\n]+-bin\.zip#distributionUrl=https\\://services.gradle.org/distributions/gradle-8.14.3-bin.zip#' "$gradle_wrapper_path"
  fi
}

resolve_android_upload_keystore() {
  local android_project_root="$1"
  local configured_keystore="${LOGMAXXING_UPLOAD_STORE_FILE:-}"

  if [[ -z "$configured_keystore" || "$configured_keystore" == /* ]]; then
    return 0
  fi

  if [[ -f "$android_project_root/$configured_keystore" ]]; then
    export LOGMAXXING_UPLOAD_STORE_FILE="$android_project_root/$configured_keystore"
  else
    export LOGMAXXING_UPLOAD_STORE_FILE="$(
      node -e '
        const path = require("node:path");
        process.stdout.write(path.resolve(process.argv[1], "android/app", process.argv[2]));
      ' "$android_project_root" "$configured_keystore"
    )"
  fi
}
