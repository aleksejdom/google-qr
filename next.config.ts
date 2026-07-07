import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // Server-seitige Pakete mit nativen Bindings / Dateisystemzugriff nicht bundeln
  serverExternalPackages: ["minio", "sharp", "pg-boss", "pino", "nodemailer"],
  experimental: {
    serverActions: {
      // Uploads via Server Actions: CSV-Import bis 5 MB, Banner/Logo bis 2 MB
      // (Standard waere 1 MB und wuerde groessere Dateien ablehnen)
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
