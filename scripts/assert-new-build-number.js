#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const platform = process.argv[2];
if (!["android", "ios"].includes(platform)) {
  console.error("Usage: node scripts/assert-new-build-number.js <android|ios>");
  process.exit(1);
}

const projectRoot = path.resolve(__dirname, "..");
const appConfig = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "app.json"), "utf8"),
);
const buildNumber =
  platform === "android"
    ? Number(appConfig.expo.android.versionCode)
    : Number(appConfig.expo.ios.buildNumber);

const roots = [
  path.join(projectRoot, "dist"),
  path.join(projectRoot, "build", "ios"),
];

function containsBuildArtifact(directory, depth = 0) {
  if (!fs.existsSync(directory) || depth > 2) {
    return false;
  }

  return fs.readdirSync(directory, { withFileTypes: true }).some((entry) => {
    const platformPattern =
      platform === "android"
        ? new RegExp(`(?:versionCode|android-v)${buildNumber}(?:\\D|$)`, "i")
        : new RegExp(
            `(?:ios-build|archive-build)${buildNumber}(?:\\D|$)`,
            "i",
          );

    if (platformPattern.test(entry.name)) {
      return true;
    }

    return (
      entry.isDirectory() &&
      containsBuildArtifact(path.join(directory, entry.name), depth + 1)
    );
  });
}

if (roots.some((root) => containsBuildArtifact(root))) {
  const field =
    platform === "android" ? "android.versionCode" : "ios.buildNumber";
  console.error(
    `${field} ${buildNumber} already has a local store artifact. Run \`npm run release:bump\` before building again.`,
  );
  process.exit(1);
}
