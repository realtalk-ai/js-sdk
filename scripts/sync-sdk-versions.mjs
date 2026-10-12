import { readFileSync, writeFileSync } from "node:fs";

const PACKAGES = ["core", "react", "react-native"];

for (const name of PACKAGES) {
  const { version } = JSON.parse(
    readFileSync(`packages/${name}/package.json`, "utf8"),
  );
  const versionFile = `packages/${name}/src/version.ts`;
  const source = readFileSync(versionFile, "utf8");
  writeFileSync(
    versionFile,
    source.replace(/SDK_VERSION = "[^"]*"/, `SDK_VERSION = "${version}"`),
  );
}
