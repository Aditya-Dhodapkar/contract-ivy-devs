// Sanity client. Credentials are env-driven so we develop against our own free
// dev project now and swap to the client's project later with zero code change
// (see needs.md — account ownership stays with the client).

import { createClient } from "@sanity/client";

export const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID || "placeholder",
  dataset: process.env.SANITY_DATASET || "production",
  apiVersion: "2024-01-01",
  useCdn: false, // back office needs fresh data, never cached
  token: process.env.SANITY_WRITE_TOKEN, // server-only; never exposed to client
});
