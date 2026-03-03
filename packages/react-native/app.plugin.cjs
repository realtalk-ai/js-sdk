const {
  withSettingsGradle,
  withAppBuildGradle,
  withMainApplication,
  createRunOncePlugin,
} = require("expo/config-plugins");

function withRealTalkAudio(config) {
  config = withSettingsGradle(config, (config) => {
    const source = config.modResults.contents;
    if (!source.includes("realtalk-react-native")) {
      config.modResults.contents =
        source +
        `\ninclude ':realtalk-react-native'\n` +
        `project(':realtalk-react-native').projectDir = new File(rootProject.projectDir, '../node_modules/@realtalk-ai/react-native/android')\n`;
    }
    return config;
  });

  config = withAppBuildGradle(config, (config) => {
    const source = config.modResults.contents;
    if (!source.includes("realtalk-react-native")) {
      config.modResults.contents = source.replace(
        /dependencies\s*\{/,
        `dependencies {\n    implementation project(':realtalk-react-native')`
      );
    }
    return config;
  });

  config = withMainApplication(config, (config) => {
    const source = config.modResults.contents;
    if (!source.includes("RealTalkAudioPackage")) {
      config.modResults.contents = source
        .replace(
          "import com.facebook.react.ReactPackage",
          "import com.facebook.react.ReactPackage\nimport ml.realtalk.audio.RealTalkAudioPackage"
        )
        .replace(
          "// packages.add(MyReactNativePackage())",
          "// packages.add(MyReactNativePackage())\n            packages.add(RealTalkAudioPackage())"
        );
    }
    return config;
  });

  return config;
}

const pkg = require("./package.json");
module.exports = createRunOncePlugin(
  withRealTalkAudio,
  "realtalk-react-native",
  pkg.version
);
