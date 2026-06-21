const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("@expo/config-plugins");

const DEPLOYMENT_TARGET = "16.4";
const TARGET_VARIABLE =
  "ios_deployment_target = podfile_properties['ios.deploymentTarget'] || '" +
  DEPLOYMENT_TARGET +
  "'";
const POST_INSTALL_MARKER =
  "config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = ios_deployment_target";

function patchPodfile(contents) {
  let next = contents.replace(
    /platform :ios, podfile_properties\['ios\.deploymentTarget'\] \|\| '[^']+'/,
    `${TARGET_VARIABLE}\nplatform :ios, ios_deployment_target`,
  );

  if (next.includes(POST_INSTALL_MARKER)) {
    return next;
  }

  const deploymentTargetBlock = `

    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = ios_deployment_target
      end
    end`;

  return next.replace(
    /(react_native_post_install\([\s\S]*?\n    \)\n)/,
    `$1${deploymentTargetBlock}\n`,
  );
}

module.exports = function withIosPodDeploymentTarget(config) {
  return withDangerousMod(config, [
    "ios",
    async (modConfig) => {
      const podfilePath = path.join(
        modConfig.modRequest.platformProjectRoot,
        "Podfile",
      );
      const contents = fs.readFileSync(podfilePath, "utf8");
      const patched = patchPodfile(contents);

      if (patched !== contents) {
        fs.writeFileSync(podfilePath, patched);
      }

      return modConfig;
    },
  ]);
};

module.exports.patchPodfile = patchPodfile;
