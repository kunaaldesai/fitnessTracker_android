const { withGradleProperties } = require("@expo/config-plugins");

const RELEASE_GRADLE_PROPERTIES = {
  "android.enableMinifyInReleaseBuilds": "true",
  "android.enableShrinkResourcesInReleaseBuilds": "true",
  "org.gradle.jvmargs": "-Xmx4096m -XX:MaxMetaspaceSize=1024m",
};

function upsertProperty(properties, key, value) {
  const existing = properties.find(
    (property) => property.type === "property" && property.key === key,
  );

  if (existing) {
    existing.value = value;
  } else {
    properties.push({ type: "property", key, value });
  }

  return properties;
}

module.exports = function withAndroidReleaseGradleProperties(config) {
  return withGradleProperties(config, (modConfig) => {
    for (const [key, value] of Object.entries(RELEASE_GRADLE_PROPERTIES)) {
      upsertProperty(modConfig.modResults, key, value);
    }

    return modConfig;
  });
};

module.exports.upsertProperty = upsertProperty;
