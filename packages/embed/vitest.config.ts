import { defineConfig } from "vitest/config";
import packageJson from "./package.json";

export default defineConfig({
  define: {
    __EMBED_VERSION__: JSON.stringify(packageJson.version),
  },
  test: {
    environment: "jsdom",
  },
});
