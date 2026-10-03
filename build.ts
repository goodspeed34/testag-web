import { build, type BuildOptions, stop } from "esbuild";

export const buildOptions: BuildOptions = {
  entryPoints: ["src/client.tsx"],
  outfile: "dist/client.js",
  bundle: true,
  minify: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "eof",
  logLevel: "info",
};
if (import.meta.main) {
  await Deno.mkdir("dist", { recursive: true });
  try {
    await build(buildOptions);
  } finally {
    stop();
  }
}
