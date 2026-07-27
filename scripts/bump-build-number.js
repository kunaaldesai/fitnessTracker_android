#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const appConfigPath = path.join(projectRoot, "app.json");
const appConfig = JSON.parse(fs.readFileSync(appConfigPath, "utf8"));
const requestedVersion = process.argv[2];

if (
  requestedVersion &&
  !/^\d+(?:\.\d+){0,2}$/.test(requestedVersion)
) {
  console.error(
    "Version must contain one to three numeric components, for example 1.1.0.",
  );
  process.exit(1);
}

function collectNames(directory, depth = 0) {
  if (!fs.existsSync(directory) || depth > 2) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return [entry.name, ...collectNames(entryPath, depth + 1)];
    }
    return [entry.name];
  });
}

const artifactNames = [
  ...collectNames(path.join(projectRoot, "dist")),
  ...collectNames(path.join(projectRoot, "build", "ios")),
];

const artifactBuildNumbers = artifactNames.flatMap((name) => {
  const matches = [
    ...name.matchAll(/versionCode(\d+)/gi),
    ...name.matchAll(/android-v(\d+)/gi),
    ...name.matchAll(/ios-build(\d+)/gi),
    ...name.matchAll(/archive-build(\d+)/gi),
  ];
  return matches.map((match) => Number(match[1]));
});

const currentIosBuild = Number(appConfig.expo.ios.buildNumber);
const currentAndroidBuild = Number(appConfig.expo.android.versionCode);
const nextBuildNumber =
  Math.max(currentIosBuild, currentAndroidBuild, ...artifactBuildNumbers) + 1;

if (requestedVersion) {
  appConfig.expo.version = requestedVersion;
}

appConfig.expo.ios.buildNumber = String(nextBuildNumber);
appConfig.expo.android.versionCode = nextBuildNumber;

fs.writeFileSync(
  appConfigPath,
  `${JSON.stringify(appConfig, null, 2)}\n`,
  "utf8",
);

console.log(
  `Prepared ${appConfig.expo.version} with iOS build ${nextBuildNumber} and Android versionCode ${nextBuildNumber}.`,
);
