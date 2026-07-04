import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // Server-seitige Pakete mit nativen Bindings / Dateisystemzugriff nicht bundeln
  serverExternalPackages: ["minio", "sharp", "pg-boss", "pino", "nodemailer"],
};

export default nextConfig;
