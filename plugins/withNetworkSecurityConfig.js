// plugins/withNetworkSecurityConfig.js
// expo config plugin to add network security config for android
const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");
const { writeFileSync, mkdirSync, existsSync } = require("fs");
const { resolve } = require("path");

const networkSecurityConfig = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system"/>
            <certificates src="user"/>
        </trust-anchors>
    </base-config>
</network-security-config>`;

function withNetworkSecurityConfig(config) {
  // add the xml file
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const xmlDir = resolve(
        config.modRequest.platformProjectRoot,
        "app/src/main/res/xml"
      );

      if (!existsSync(xmlDir)) {
        mkdirSync(xmlDir, { recursive: true });
      }

      writeFileSync(
        resolve(xmlDir, "network_security_config.xml"),
        networkSecurityConfig
      );

      return config;
    },
  ]);

  // reference it in manifest
  config = withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application[0];
    mainApplication.$["android:networkSecurityConfig"] = "@xml/network_security_config";
    return config;
  });

  return config;
}

module.exports = withNetworkSecurityConfig;
