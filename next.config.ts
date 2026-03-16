import { execSync } from "child_process";
import type { NextConfig } from "next";

const commitHash = (() => {
  try {
    return execSync("git rev-parse --short HEAD")
      .toString()
      .trim();
  } catch {
    return "dev";
  }
})();

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_COMMIT_HASH: commitHash,
  },
};

export default nextConfig;
