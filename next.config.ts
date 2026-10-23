import { execSync } from "child_process";
import type { NextConfig } from "next";

function gitRevParse(args: string): string | undefined {
  try {
    return execSync(`git rev-parse ${args}`).toString().trim();
  } catch {
    return undefined;
  }
}

const commitHash = gitRevParse("--short HEAD") ?? "dev";
// Full hash for the GitHub commit link; empty when git is unavailable.
const commitSha = gitRevParse("HEAD") ?? "";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_COMMIT_HASH: commitHash,
    NEXT_PUBLIC_COMMIT_SHA: commitSha,
  },
};

export default nextConfig;
