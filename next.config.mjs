/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Prevents double-subscription in dev mode for SSE
  webpack: (config, { dev }) => {
    if (dev) {
      // Disable disk cache in development to prevent OneDrive file-locking collisions
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
