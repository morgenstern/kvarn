import { execSync } from "node:child_process";
import { defineConfig } from "vitest/config";

function getCommitCount() {
  try {
    return execSync("git rev-list --count HEAD").toString().trim();
  } catch {
    return "0";
  }
}
const commitCount = getCommitCount();

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(commitCount),
  },
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
  },
});
