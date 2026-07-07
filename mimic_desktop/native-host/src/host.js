const fs = require("fs");
const os = require("os");
const path = require("path");

const state = {
  activeSessionId: null,
  startedAt: null,
};

const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const logDir = path.join(localAppData, "MIMIC", "DesktopCompanion");
const logPath = path.join(logDir, "native-host.log");

function log(entry) {
  fs.mkdirSync(logDir, { recursive: true });
  fs.appendFileSync(logPath, `${JSON.stringify({ time: new Date().toISOString(), ...entry })}\n`);
}

function send(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  process.stdout.write(header);
  process.stdout.write(body);
}

function handleMessage(message) {
  if (!message || typeof message !== "object") {
    return { ok: false, error: "invalid_message" };
  }

  if (message.type === "PING") {
    return {
      ok: true,
      type: "PONG",
      host: "mimic-desktop-companion-dev",
      active_session_id: state.activeSessionId,
    };
  }

  if (message.type === "START_CAPTURE_SESSION") {
    state.activeSessionId = message.capture_session_id || null;
    state.startedAt = new Date().toISOString();
    log({ event: "start_capture_session", message });
    return {
      ok: true,
      type: "CAPTURE_SESSION_STARTED",
      capture_session_id: state.activeSessionId,
      started_at: state.startedAt,
    };
  }

  if (message.type === "STOP_CAPTURE_SESSION") {
    const stoppedSessionId = state.activeSessionId;
    log({ event: "stop_capture_session", message, active_session_id: stoppedSessionId });
    state.activeSessionId = null;
    state.startedAt = null;
    return {
      ok: true,
      type: "CAPTURE_SESSION_STOPPED",
      capture_session_id: message.capture_session_id || stoppedSessionId,
    };
  }

  log({ event: "unknown_message", message });
  return { ok: false, error: "unknown_message_type", type: message.type };
}

let pending = Buffer.alloc(0);

process.stdin.on("data", (chunk) => {
  pending = Buffer.concat([pending, chunk]);

  while (pending.length >= 4) {
    const length = pending.readUInt32LE(0);
    if (pending.length < 4 + length) return;

    const raw = pending.subarray(4, 4 + length).toString("utf8");
    pending = pending.subarray(4 + length);

    try {
      const message = JSON.parse(raw);
      const response = handleMessage(message);
      send(response);
    } catch (error) {
      log({ event: "host_error", error: error.message });
      send({ ok: false, error: "host_error", message: error.message });
    }
  }
});

process.stdin.on("end", () => {
  log({ event: "stdin_end", active_session_id: state.activeSessionId });
});
