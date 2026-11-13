const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(full));
    } else if (file.endsWith(".ts")) {
      results.push(full);
    }
  }
  return results;
}

function bundleAll() {
  console.log("Bundling Lambda functions with esbuild in single invocation...");
  const isWindows = process.platform === "win32";
  const cmd = isWindows ? "npx.cmd" : "npx";

  // 1. All API handlers
  const handlersDir = path.join(__dirname, "../apps/api/src/handlers");
  const handlerFiles = getFiles(handlersDir);
  console.log(`Found ${handlerFiles.length} API handlers to bundle.`);

  execFileSync(
    cmd,
    [
      "esbuild",
      ...handlerFiles,
      "--bundle",
      "--platform=node",
      "--target=node20",
      `--outbase=${path.join(__dirname, "../apps/api/src")}`,
      `--outdir=${path.join(__dirname, "../apps/api/dist")}`,
      "--sourcemap",
      "--log-level=warning",
    ],
    { stdio: "inherit", shell: isWindows }
  );
  console.log("✓ API handlers bundled successfully.");

  // 2. Background Lambdas
  const lambdas = [
    {
      in: path.join(__dirname, "../apps/lambda/inbound-processor/src/index.ts"),
      out: path.join(__dirname, "../apps/lambda/inbound-processor/dist/index.js"),
    },
    {
      in: path.join(__dirname, "../apps/lambda/outbound-sender/src/index.ts"),
      out: path.join(__dirname, "../apps/lambda/outbound-sender/dist/index.js"),
    },
    {
      in: path.join(__dirname, "../apps/lambda/ses-event-processor/src/index.ts"),
      out: path.join(__dirname, "../apps/lambda/ses-event-processor/dist/index.js"),
    },
    {
      in: path.join(__dirname, "../apps/lambda/webhook-dispatcher/src/index.ts"),
      out: path.join(__dirname, "../apps/lambda/webhook-dispatcher/dist/index.js"),
    },
  ];

  for (const item of lambdas) {
    fs.mkdirSync(path.dirname(item.out), { recursive: true });
    execFileSync(
      cmd,
      [
        "esbuild",
        item.in,
        "--bundle",
        "--platform=node",
        "--target=node20",
        `--outfile=${item.out}`,
        "--sourcemap",
        "--log-level=warning",
      ],
      { stdio: "inherit", shell: isWindows }
    );
  }
  console.log("✓ Background Lambdas bundled successfully.");
}

try {
  bundleAll();
} catch (err) {
  console.error("Bundle failed:", err);
  process.exit(1);
}
