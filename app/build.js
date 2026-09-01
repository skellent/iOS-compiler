const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:8000";

const result = await Bun.build({
  entrypoints: ["src/main.js"],
  outdir: "www/js",
  target: "browser",
  format: "esm",
  bundle: false,
  splitting: true,
  define: {
    "import.meta.env.API_BASE_URL": JSON.stringify(apiBaseUrl),
  }
});
