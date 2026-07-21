const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const hostPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, "..", "src", "host.js");
const nodePath = process.argv[3]
  ? path.resolve(process.argv[3])
  : process.execPath;

function encode(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  return Buffer.concat([header, body]);
}

function decodeAvailable(buffer) {
  const messages = [];
  let pending = buffer;

  while (pending.length >= 4) {
    const length = pending.readUInt32LE(0);
    if (pending.length < 4 + length) break;
    const raw = pending.subarray(4, 4 + length).toString("utf8");
    messages.push(JSON.parse(raw));
    pending = pending.subarray(4 + length);
  }

  return { messages, pending };
}

async function main() {
  const testDataDir = path.resolve(__dirname, "..", "dist", "native-host-smoke");
  fs.rmSync(testDataDir, { recursive: true, force: true });
  fs.mkdirSync(testDataDir, { recursive: true });
  const child = spawn(nodePath, [hostPath], {
    stdio: ["pipe", "pipe", "inherit"],
    env: { ...process.env, PARRO_DESKTOP_DATA_DIR: testDataDir },
  });

  let pending = Buffer.alloc(0);
  const received = [];

  child.stdout.on("data", (chunk) => {
    pending = Buffer.concat([pending, chunk]);
    const decoded = decodeAvailable(pending);
    pending = decoded.pending;
    received.push(...decoded.messages);
  });

  child.stdin.write(encode({ type: "PING" }));
  child.stdin.write(encode({
    type: "START_CAPTURE_SESSION",
    capture_session_id: "cap_smoke",
    extension_id: "dev-extension",
  }));
  child.stdin.write(encode({
    type: "PAUSE_CAPTURE_SESSION",
    capture_session_id: "cap_smoke",
  }));
  child.stdin.write(encode({
    type: "RESUME_CAPTURE_SESSION",
    capture_session_id: "cap_smoke",
  }));
  child.stdin.write(encode({
    type: "STOP_CAPTURE_SESSION",
    capture_session_id: "cap_smoke",
  }));
  child.stdin.write(encode({
    type: "GET_CAPTURE_SESSION",
    capture_session_id: "cap_smoke",
    request_id: "summary-1",
  }));
  child.stdin.end();

  await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code && code !== 0) reject(new Error(`host exited with ${code}`));
      else resolve();
    });
  });

  const types = received.map((message) => message.type);
  if (!types.includes("PONG")) throw new Error("missing PONG");
  const pong = received.find((message) => message.type === "PONG");
  if (pong?.version !== "0.5.1") throw new Error(`unexpected desktop version: ${pong?.version || "missing"}`);
  if (!types.includes("CAPTURE_SESSION_STARTED")) throw new Error("missing CAPTURE_SESSION_STARTED");
  if (!types.includes("CAPTURE_SESSION_PAUSED")) throw new Error("missing CAPTURE_SESSION_PAUSED");
  if (!types.includes("CAPTURE_SESSION_RESUMED")) throw new Error("missing CAPTURE_SESSION_RESUMED");
  if (!types.includes("CAPTURE_SESSION_STOPPED")) throw new Error("missing CAPTURE_SESSION_STOPPED");
  const summary = received.find((message) => message.type === "CAPTURE_SESSION");
  if (!summary || summary.request_id !== "summary-1") throw new Error("missing capture session summary");
  if (!Array.isArray(summary.events)) throw new Error("capture session events are missing");

  console.log(JSON.stringify({ ok: true, nodePath, hostPath, received }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
