/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Supabase Storage public URLs live at *.supabase.co
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },
};

module.exports = nextConfig;
