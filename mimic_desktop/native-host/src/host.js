const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const state = {
  activeSessionId: null,
  startedAt: null,
  captureProcess: null,
  captureDir: null,
  stopFile: null,
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

function safeSessionId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
}

function stopCaptureAgent() {
  if (state.stopFile) {
    try {
      fs.writeFileSync(state.stopFile, new Date().toISOString(), "utf8");
    } catch (error) {
      log({ event: "capture_stop_signal_failed", error: error.message });
    }
  }
  state.captureProcess = null;
}

function startCaptureAgent(sessionId) {
  stopCaptureAgent();

  const safeId = safeSessionId(sessionId);
  if (!safeId) throw new Error("missing_session_id");

  const captureDir = path.join(logDir, "captures", safeId);
  const stopFile = path.join(captureDir, ".stop");
  const agentPath = path.join(__dirname, "capture-agent.ps1");
  fs.mkdirSync(captureDir, { recursive: true });
  fs.rmSync(stopFile, { force: true });

  const child = spawn("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", agentPath,
    "-SessionId", sessionId,
    "-OutputDir", captureDir,
    "-StopFile", stopFile,
  ], {
    windowsHide: true,
    stdio: "ignore",
  });

  child.on("error", (error) => {
    log({ event: "capture_agent_error", session_id: sessionId, error: error.message });
  });
  child.on("exit", (code) => {
    log({ event: "capture_agent_exit", session_id: sessionId, code });
    if (state.captureProcess === child) state.captureProcess = null;
  });

  state.captureProcess = child;
  state.captureDir = captureDir;
  state.stopFile = stopFile;
  return captureDir;
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
    const captureDir = startCaptureAgent(state.activeSessionId);
    log({ event: "start_capture_session", message });
    return {
      ok: true,
      type: "CAPTURE_SESSION_STARTED",
      capture_session_id: state.activeSessionId,
      started_at: state.startedAt,
      capture_dir: captureDir,
    };
  }

  if (message.type === "STOP_CAPTURE_SESSION") {
    const stoppedSessionId = state.activeSessionId;
    const captureDir = state.captureDir;
    stopCaptureAgent();
    log({ event: "stop_capture_session", message, active_session_id: stoppedSessionId });
    state.activeSessionId = null;
    state.startedAt = null;
    return {
      ok: true,
      type: "CAPTURE_SESSION_STOPPED",
      capture_session_id: message.capture_session_id || stoppedSessionId,
      capture_dir: captureDir,
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
  stopCaptureAgent();
  log({ event: "stdin_end", active_session_id: state.activeSessionId });
});
