#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! security find-identity -v -p codesigning |
  grep -q '"Apple Development:'
then
  cat >&2 <<'MESSAGE'
No Apple Development signing identity is installed.

`npm run ios` uses the iOS Simulator and does not need this certificate.
For a real iPhone, open the workspace with `xed ios`, then:
  1. Open the app target > Signing & Capabilities.
  2. Enable Automatically manage signing.
  3. Sign in and select team 4VZ445BX2G.
  4. Build to the connected iPhone once from Xcode.

After that one-time Apple setup, rerun `npm run ios:device`.
MESSAGE
  exit 1
fi

cd "$project_root"
exec expo run:ios --device "$@"
