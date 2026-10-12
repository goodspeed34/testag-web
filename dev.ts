import { context } from "esbuild";
import { buildOptions } from "./build.ts";

// `deno task preview` passes preview.ts to serve sample data instead.
const entrypoint = Deno.args[0] ?? "main.ts";

await Deno.mkdir("dist", { recursive: true });
const builder = await context(buildOptions);
await builder.rebuild();
await builder.watch();
const server = new Deno.Command(Deno.execPath(), {
  args: [
    "run",
    "--env-file=.env",
    `--watch=src,public,dist,${entrypoint}`,
    "-A",
    entrypoint,
  ],
  env: { NODE_ENV: "production" },
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
}).spawn();
const stopServer = () => {
  try {
    server.kill("SIGINT");
  } catch { /* Child already exited. */ }
};
Deno.addSignalListener("SIGINT", stopServer);
try {
  await server.status;
} finally {
  await builder.dispose();
  Deno.removeSignalListener("SIGINT", stopServer);
}
