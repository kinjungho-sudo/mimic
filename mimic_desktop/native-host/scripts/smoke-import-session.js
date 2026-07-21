const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const dataDir = process.argv[2];
const sessionId = process.argv[3];
const hostPath = process.argv[4]
  ? path.resolve(process.argv[4])
  : path.resolve(__dirname, "..", "src", "host.js");

if (!dataDir || !sessionId) {
  console.error("Usage: node smoke-import-session.js <desktop-data-dir> <session-id> [host-path]");
  process.exit(2);
}

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
    messages.push(JSON.parse(pending.subarray(4, 4 + length).toString("utf8")));
    pending = pending.subarray(4 + length);
  }
  return { messages, pending };
}

async function sendRequests(requests) {
  const child = spawn(process.execPath, [hostPath], {
    env: { ...process.env, PARRO_DESKTOP_DATA_DIR: path.resolve(dataDir) },
    stdio: ["pipe", "pipe", "inherit"],
  });
  let pending = Buffer.alloc(0);
  const received = [];
  child.stdout.on("data", (chunk) => {
    pending = Buffer.concat([pending, chunk]);
    const decoded = decodeAvailable(pending);
    pending = decoded.pending;
    received.push(...decoded.messages);
  });
  for (const request of requests) child.stdin.write(encode(request));
  child.stdin.end();
  await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => code ? reject(new Error(`host exited with ${code}`)) : resolve());
  });
  return received;
}

async function main() {
  const initial = await sendRequests([
    { type: "PING", request_id: "ping" },
    { type: "GET_CAPTURE_SESSION", capture_session_id: sessionId, request_id: "session" },
  ]);
  const pong = initial.find((message) => message.request_id === "ping");
  const session = initial.find((message) => message.request_id === "session");
  if (!pong?.ok || !pong.version) throw new Error("missing versioned PONG");
  if (!session?.ok || !Array.isArray(session.events) || !session.events.length) {
    throw new Error("capture session did not return events");
  }

  const event = session.events.find((item) => item.screenshot_size > 0);
  if (!event) throw new Error("capture session contains no screenshot");
  const chunkRequests = [];
  for (let offset = 0; offset < event.screenshot_size; offset += 384 * 1024) {
    chunkRequests.push({
      type: "READ_CAPTURE_IMAGE_CHUNK",
      capture_session_id: sessionId,
      step_number: event.step_number,
      offset,
      request_id: `chunk-${offset}`,
    });
  }
  const chunks = await sendRequests(chunkRequests);
  const bytes = chunks
    .sort((a, b) => a.offset - b.offset)
    .map((message) => Buffer.from(message.data || "", "base64"));
  const image = Buffer.concat(bytes);
  if (image.length !== event.screenshot_size) throw new Error("reassembled screenshot size mismatch");
  if (image.subarray(1, 4).toString("ascii") !== "PNG") throw new Error("reassembled screenshot is not PNG");

  const sourcePath = path.join(path.resolve(dataDir), "captures", sessionId, event.screenshot_name);
  if (!fs.existsSync(sourcePath) || !image.equals(fs.readFileSync(sourcePath))) {
    throw new Error("reassembled screenshot differs from saved source");
  }

  console.log(JSON.stringify({
    ok: true,
    hostVersion: pong.version,
    sessionId,
    eventCount: session.events.length,
    verifiedStep: event.step_number,
    verifiedBytes: image.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
