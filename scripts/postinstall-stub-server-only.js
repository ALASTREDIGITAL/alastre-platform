import fs from "node:fs";
import path from "node:path";

try {
  const target = path.join(process.cwd(), "node_modules", "server-only", "index.js");
  if (fs.existsSync(path.dirname(target))) {
    fs.writeFileSync(target, "module.exports = {};\n", "utf8");
  }
} catch {
  // Silent fallback for test environment
}
