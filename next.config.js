/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the headless-Chromium packages out of the server bundle — they ship
  // native binaries the bundler can't (and shouldn't) trace into. They're
  // required at runtime from node_modules instead. See lib/brochure/browser.ts.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "puppeteer"],
  images: {
    // Supabase Storage public URLs live at *.supabase.co
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },
};

module.exports = nextConfig;
