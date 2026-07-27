import { describe, expect, it } from "vitest";

import androidReleasePlugin from "./with-android-release-gradle-properties.js";

const { patchAppBuildGradle, verifyPatchedBuildGradle } =
  androidReleasePlugin;

const buildGradleFixture = `def enableMinifyInReleaseBuilds = false

android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}
`;

describe("Android release signing config plugin", () => {
  it("adds environment-backed release signing to a generated Gradle file", () => {
    const patched = verifyPatchedBuildGradle(
      patchAppBuildGradle(buildGradleFixture),
    );

    expect(patched).toContain(
      "System.getenv('LOGMAXXING_UPLOAD_STORE_FILE')",
    );
    expect(patched).toContain("storeFile file(releaseStoreFile)");
    expect(patched).toContain("signingConfig signingConfigs.release");
    expect(
      patched.match(/signingConfig signingConfigs\.release/g),
    ).toHaveLength(1);
  });

  it("is idempotent", () => {
    const patched = patchAppBuildGradle(buildGradleFixture);

    expect(patchAppBuildGradle(patched)).toBe(patched);
  });
});
