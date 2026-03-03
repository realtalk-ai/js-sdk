const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const config = getDefaultConfig(__dirname);

const localSdkPath = path.resolve(__dirname, "../..");
const useLocalSdk = fs.existsSync(
  path.join(localSdkPath, "packages/react-native/src")
);

if (useLocalSdk) {
  const localPackages = {
    "@realtalk-ai/core": path.resolve(localSdkPath, "packages/core"),
    "@realtalk-ai/react-native": path.resolve(
      localSdkPath,
      "packages/react-native"
    ),
  };

  const appNodeModules = path.resolve(__dirname, "node_modules");

  config.watchFolders = [
    ...(config.watchFolders || []),
    ...Object.values(localPackages),
  ];

  config.resolver.nodeModulesPaths = [
    appNodeModules,
    ...(config.resolver.nodeModulesPaths || []),
  ];

  const originalResolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    for (const [pkg, pkgPath] of Object.entries(localPackages)) {
      if (moduleName === pkg || moduleName.startsWith(pkg + "/")) {
        const rest = moduleName === pkg ? "" : moduleName.slice(pkg.length);
        const newModuleName = pkgPath + rest;
        return context.resolveRequest(context, newModuleName, platform);
      }
    }
    if (originalResolveRequest) {
      return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
