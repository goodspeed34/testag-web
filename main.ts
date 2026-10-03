import { handleRequest } from "./src/server.tsx";

const port = Number(Deno.env.get("PORT") ?? "8000");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("Invalid PORT");
}
Deno.serve(
  { port },
  (request, info) =>
    handleRequest(request, (info.remoteAddr as Deno.NetAddr).hostname),
);
