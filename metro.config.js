const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const defaultBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : [config.resolver.blockList];

// Signing files contain shell syntax and secrets. They must never enter Metro's
// module graph, even if a broad require.context expression scans the project.
config.resolver.blockList = [
  ...defaultBlockList,
  /[/\\]\.env(?:\.[^/\\]+)*\.local$/,
];

module.exports = config;
