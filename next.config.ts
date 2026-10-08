import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist", "sharp", "tesseract.js"],
};

export default nextConfig;
