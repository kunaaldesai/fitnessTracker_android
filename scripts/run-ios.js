#!/usr/bin/env node

const { spawnSync } = require("node:child_process");

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    ...options,
  });
}

function runtimeVersion(runtimeIdentifier) {
  const match = runtimeIdentifier.match(/iOS-(\d+)-(\d+)(?:-(\d+))?$/);
  if (!match) {
    return [0, 0, 0];
  }

  return match.slice(1).map((part) => Number(part || 0));
}

function compareVersions(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] || 0) - (right[index] || 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

if (process.platform !== "darwin") {
  console.error("iOS Simulator builds require macOS and Xcode.");
  process.exit(1);
}

const simulatorList = run("xcrun", [
  "simctl",
  "list",
  "devices",
  "available",
  "--json",
]);

if (simulatorList.status !== 0) {
  process.stderr.write(simulatorList.stderr || "");
  console.error("Could not read the installed iOS Simulators.");
  process.exit(simulatorList.status || 1);
}

const simulatorData = JSON.parse(simulatorList.stdout);
const iphoneSimulators = Object.entries(simulatorData.devices)
  .flatMap(([runtime, devices]) =>
    devices.map((device) => ({
      ...device,
      runtime,
      version: runtimeVersion(runtime),
    })),
  )
  .filter(
    (device) =>
      device.isAvailable !== false &&
      device.runtime.includes("iOS-") &&
      device.name.startsWith("iPhone"),
  )
  .sort((left, right) => {
    if (left.state === "Booted" && right.state !== "Booted") {
      return -1;
    }
    if (right.state === "Booted" && left.state !== "Booted") {
      return 1;
    }
    return compareVersions(right.version, left.version);
  });

const requestedUdid = process.env.IOS_SIMULATOR_UDID;
const requestedName = process.env.IOS_SIMULATOR_NAME;
let selectedSimulator;

if (requestedUdid) {
  selectedSimulator = iphoneSimulators.find(
    (device) => device.udid === requestedUdid,
  );
} else if (requestedName) {
  selectedSimulator = iphoneSimulators.find(
    (device) => device.name === requestedName,
  );
} else {
  selectedSimulator = iphoneSimulators[0];
}

if (!selectedSimulator) {
  const requestedTarget = requestedUdid || requestedName;
  if (requestedTarget) {
    console.error(
      `The requested iOS Simulator is not available: ${requestedTarget}`,
    );
  } else {
    console.error(
      "No iPhone Simulator is installed. Add one in Xcode > Settings > Components.",
    );
  }
  process.exit(1);
}

const runtimeLabel = selectedSimulator.runtime
  .replace(/^com\.apple\.CoreSimulator\.SimRuntime\./, "")
  .replaceAll("-", ".");

console.log(
  `Using iOS Simulator: ${selectedSimulator.name} (${runtimeLabel})`,
);

if (process.env.LOGMAXXING_DRY_RUN === "1") {
  process.exit(0);
}

if (selectedSimulator.state !== "Booted") {
  const bootResult = run("xcrun", [
    "simctl",
    "boot",
    selectedSimulator.udid,
  ]);

  if (bootResult.status !== 0) {
    process.stderr.write(bootResult.stderr || "");
    console.error(`Could not boot ${selectedSimulator.name}.`);
    process.exit(bootResult.status || 1);
  }
}

run("open", ["-a", "Simulator"]);

const expoResult = spawnSync(
  "expo",
  [
    "run:ios",
    "--device",
    selectedSimulator.udid,
    ...process.argv.slice(2),
  ],
  { stdio: "inherit" },
);

if (expoResult.error) {
  console.error(expoResult.error.message);
}

process.exit(expoResult.status ?? 1);
