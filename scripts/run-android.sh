#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$project_root/scripts/android-env.sh"
pin_android_gradle_wrapper "$project_root"

running_emulator="$(
  adb devices |
    awk '$1 ~ /^emulator-/ && $2 == "device" { print $1; exit }'
)"
selected_avd=""

if [[ -z "$running_emulator" ]]; then
  selected_avd="${LOGMAXXING_ANDROID_AVD:-}"

  if [[ -z "$selected_avd" ]]; then
    selected_avd="$(
      emulator -list-avds |
        awk '/^Pixel_/ { print; exit }'
    )"
  fi

  if [[ -z "$selected_avd" ]]; then
    selected_avd="$(emulator -list-avds | sed -n '1p')"
  fi

  if [[ -z "$selected_avd" ]]; then
    echo "No Android Virtual Device is installed." >&2
    echo "Create one in Android Studio > Device Manager, then retry." >&2
    exit 1
  fi

  if [[ "${LOGMAXXING_DRY_RUN:-0}" == "1" ]]; then
    echo "Android emulator: $selected_avd"
    exit 0
  fi

  emulator_log="${TMPDIR:-/tmp}/logmaxxing-android-emulator.log"
  echo "Starting Android emulator: $selected_avd"
  emulator -avd "$selected_avd" -no-snapshot-save >>"$emulator_log" 2>&1 &

  for ((android_wait_attempt = 0; android_wait_attempt < 90; android_wait_attempt++)); do
    running_emulator="$(
      adb devices |
        awk '$1 ~ /^emulator-/ && $2 == "device" { print $1; exit }'
    )"
    if [[ -n "$running_emulator" ]]; then
      break
    fi
    sleep 2
  done
fi

if [[ -z "$running_emulator" ]]; then
  echo "The Android emulator did not become available." >&2
  echo "See ${TMPDIR:-/tmp}/logmaxxing-android-emulator.log for emulator output." >&2
  exit 1
fi

expo_device_name="$(
  {
    adb -s "$running_emulator" emu avd name 2>/dev/null || true
  } |
    awk 'NR == 1 { sub(/\r$/, ""); print; exit }'
)"

if [[ -z "$expo_device_name" || "$expo_device_name" == "OK" || "$expo_device_name" == KO:* ]]; then
  expo_device_name="$selected_avd"
fi

if [[ -z "$expo_device_name" ]]; then
  echo "Could not determine the AVD name for Android emulator $running_emulator." >&2
  exit 1
fi

if [[ "${LOGMAXXING_DRY_RUN:-0}" == "1" ]]; then
  echo "Android emulator: $expo_device_name ($running_emulator)"
  exit 0
fi

echo "Using Android emulator: $expo_device_name ($running_emulator)"
cd "$project_root"
exec expo run:android --device "$expo_device_name" "$@"
