#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const sdkRoot = path.resolve(__dirname, "../..");
const packages = {
  "@realtalk-ai/core": "packages/core",
  "@realtalk-ai/react-native": "packages/react-native",
};

const filesToSync = ["dist", "ios", "android", "package.json", "react-native.config.js", "realtalk-react-native.podspec", "app.plugin.cjs"];

for (const [pkg, pkgDir] of Object.entries(packages)) {
  const src = path.join(sdkRoot, pkgDir);
  const dest = path.join(__dirname, "node_modules", pkg);

  if (!fs.existsSync(dest)) {
    console.log(`Skipping ${pkg} — not installed in node_modules`);
    continue;
  }

  for (const file of filesToSync) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);

    if (!fs.existsSync(srcPath)) continue;

    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      fs.rmSync(destPath, { recursive: true, force: true });
      fs.cpSync(srcPath, destPath, { recursive: true });
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }

  console.log(`Synced ${pkg}`);
}
