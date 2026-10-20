const { spawn } = require("node:child_process");
const path = require("node:path");
const server = spawn(
  process.execPath,
  [
    path.resolve(__dirname, "../web/node_modules/vite/bin/vite.js"),
    "--host",
    "127.0.0.1",
    "--port",
    "5175",
    "--strictPort",
  ],
  {
    cwd: path.resolve(__dirname, "../web"),
    env: {
      ...process.env,
      VITE_SUPABASE_URL: "https://test.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-key",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
// The Vite path is relative to the repository, while its cwd is web.

let started = false;
server.stderr.on("data", (d) => process.stderr.write(d));
server.stdout.on("data", (d) => {
  if (!started && d.toString().includes("Local:")) {
    started = true;
    const test = spawn(
      process.execPath,
      [process.argv[2] || "tests/ux-browser.cjs"],
      {
        cwd: path.resolve(__dirname, ".."),
        env: process.env,
        stdio: "inherit",
      },
    );
    test.on("exit", (code) => {
      server.kill();
      process.exitCode = code || 0;
    });
  }
});
server.on("exit", (code) => {
  if (!started) {
    console.error("Vite did not start");
    process.exitCode = code || 1;
  }
});
process.on("SIGINT", () => {
  server.kill();
  process.exit(130);
});
