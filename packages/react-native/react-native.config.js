module.exports = {
  dependency: {
    platforms: {
      ios: {
        podspecPath: __dirname + "/realtalk-react-native.podspec",
      },
      android: {
        sourceDir: __dirname + "/android",
        packageImportPath: "import ml.realtalk.audio.RealTalkAudioPackage;",
      },
    },
  },
};
