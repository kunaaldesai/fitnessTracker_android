#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$project_root/scripts/android-env.sh"
pin_android_gradle_wrapper "$project_root"

cd "$project_root"
exec expo run:android --device "$@"
