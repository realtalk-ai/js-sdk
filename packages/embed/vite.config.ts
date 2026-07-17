import { defineConfig } from "vite";

export default defineConfig({
  // Lib-mode builds don't statically replace NODE_ENV, so pin it for the
  // production React build.
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    lib: {
      entry: "src/index.ts",
      name: "RealtalkEmbed",
      formats: ["es", "iife"],
      fileName: (format) => (format === "iife" ? "embed.js" : "embed.es.js"),
    },
    target: "es2020",
    emptyOutDir: true,
  },
});
