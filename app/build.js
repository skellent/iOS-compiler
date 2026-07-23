const apiBaseUrl = process.env.API_BASE_URL || "http://10.0.2.2:8000";

const result = await Bun.build({
  entrypoints: ["src/main.js"],
  outdir: "www/js",
  target: "browser",
  format: "esm",
  define: {
    "import.meta.env.API_BASE_URL": JSON.stringify(apiBaseUrl),
  },
});

if (!result.success) {
  for (const message of result.logs) console.error(message);
  process.exit(1);
}

console.log(`Built www/js/main.js (API_BASE_URL=${apiBaseUrl})`);
