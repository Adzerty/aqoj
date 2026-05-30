import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Désactivé : en dev, le double-montage des effets de StrictMode perturbe le
  // cycle de vie des sockets (join/leave en rafale, lobby détruit puis recréé).
  reactStrictMode: false,
  // Fixe la racine du projet (un lockfile parasite existe dans le home).
  turbopack: { root: __dirname },
  allowedDevOrigins: ["192.168.1.65"],
};

export default nextConfig;
