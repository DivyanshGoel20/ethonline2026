import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@worldcoin/idkit", "@worldcoin/idkit-core"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@worldcoin/idkit$": path.resolve(__dirname, "../node_modules/@worldcoin/idkit/build/index.js"),
    };
    return config;
  },
};

export default nextConfig;
