// Builds the whole app into one self-contained HTML file: dist/blackjack-iq.html.
// Open it by double-clicking, host it anywhere static, or publish it as a single page.
// React, Recharts and the app code are bundled inline; only Google Fonts load from the web
// (with system-font fallbacks when offline).

import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "dist/blackjack-iq.html");

const js = await build({
  entryPoints: [resolve(root, "src/standalone/main.tsx")],
  bundle: true,
  write: false,
  minify: true,
  format: "iife",
  target: ["es2020"],
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: {
    "next/link": resolve(root, "src/standalone/Link.tsx"),
    "next/navigation": resolve(root, "src/standalone/router.ts"),
  },
  tsconfig: resolve(root, "tsconfig.json"),
  logLevel: "error",
  logOverride: { "unsupported-directive": "silent" },
});

const cssSource = await readFile(resolve(root, "src/app/globals.css"), "utf8");
const css = await postcss([tailwind({ base: root })]).process(cssSource, { from: resolve(root, "src/app/globals.css") });

// next/font normally provides these variables.
const fontVars = `:root{--font-playfair:"Playfair Display",ui-serif,Georgia,serif;--font-manrope:"Manrope",ui-sans-serif,system-ui,sans-serif;color-scheme:dark}`;
// Keep inline code from closing its own tag.
const safe = (s) => s.replace(/<\/(script|style)/gi, "<\\/$1");

const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Blackjack IQ</title>
<meta name="description" content="A blackjack table and basic-strategy coach. Virtual chips only.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700;800&display=swap">
<style>${fontVars}
${safe(css.css)}</style>
<div id="root"></div>
<script>${safe(js.outputFiles[0].text)}</script>
`;

await mkdir(dirname(out), { recursive: true });
await writeFile(out, html);
console.log(`Wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
