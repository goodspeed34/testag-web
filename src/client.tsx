import { hydrateRoot } from "react-dom/client";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { App } from "./App.tsx";
import type { PageData } from "./types.ts";

const data = JSON.parse(
  document.querySelector("#page-data")!.textContent!,
) as PageData;
const nonce =
  document.querySelector<HTMLMetaElement>('meta[name="emotion-nonce"]')!
    .content;
const cache = createCache({ key: "mui", nonce });
hydrateRoot(
  document.querySelector("#root")!,
  <CacheProvider value={cache}>
    <App data={data} />
  </CacheProvider>,
);
