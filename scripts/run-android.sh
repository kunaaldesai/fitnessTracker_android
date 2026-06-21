#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${JAVA_HOME:-}" ]]; then
  for candidate in \
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
    "/Applications/Android Studio Preview.app/Contents/jbr/Contents/Home"
  do
    if [[ -x "$candidate/bin/java" ]]; then
      export JAVA_HOME="$candidate"
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

prepend_path() {
  if [[ -n "${1:-}" && -d "$1" ]]; then
    export PATH="$1:$PATH"
  fi
}

prepend_path "${JAVA_HOME:-}/bin"
prepend_path "${ANDROID_HOME:-}/emulator"
prepend_path "${ANDROID_HOME:-}/platform-tools"
prepend_path "${ANDROID_HOME:-}/cmdline-tools/latest/bin"

if ! command -v java >/dev/null 2>&1; then
  echo "Android build requires Java. Install Android Studio or set JAVA_HOME." >&2
  exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "Android build requires adb. Install Android Studio SDK tools or set ANDROID_HOME." >&2
  exit 1
fi

gradle_wrapper="$PWD/android/gradle/wrapper/gradle-wrapper.properties"
if [[ -f "$gradle_wrapper" ]]; then
  # Gradle 9.x currently breaks this Android plugin set via JvmVendorSpec.IBM_SEMERU.
  perl -0pi -e 's#distributionUrl=https\\://services\.gradle\.org/distributions/gradle-[^\n]+-bin\.zip#distributionUrl=https\\://services.gradle.org/distributions/gradle-8.14.3-bin.zip#' "$gradle_wrapper"
fi

exec expo run:android "$@"
