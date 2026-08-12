const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, execFileSync } = require("child_process");

const DESKTOP_COMPANION_VERSION = "0.6.7";

const state = {
  activeSessionId: null,
  startedAt: null,
  captureProcess: null,
  captureDir: null,
  stopFile: null,
  pauseFile: null,
  undoFile: null,
  manualCaptureFile: null,
  blurNextFile: null,
  toolbarBoundsFile: null,
};

const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const logDir = process.env.PARRO_DESKTOP_DATA_DIR
  ? path.resolve(process.env.PARRO_DESKTOP_DATA_DIR)
  : path.join(localAppData, "Parro", "DesktopCompanion");
const logPath = path.join(logDir, "native-host.log");

function log(entry) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(logPath, `${JSON.stringify({ time: new Date().toISOString(), ...entry })}\n`);
  } catch {
    // Logging must never take down the Native Messaging transport. A locked or
    // permission-restricted log directory should not make the app look missing.
  }
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

function listDisplays() {
  const command = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$items = @([System.Windows.Forms.Screen]::AllScreens | ForEach-Object {",
    "  [ordered]@{ id = $_.DeviceName; primary = $_.Primary; left = $_.Bounds.Left; top = $_.Bounds.Top; width = $_.Bounds.Width; height = $_.Bounds.Height }",
    "})",
    "$items | ConvertTo-Json -Compress",
  ].join("; ");
  const output = execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 5000,
  }).replace(/^\uFEFF/, "").trim();
  const parsed = output ? JSON.parse(output) : [];
  return (Array.isArray(parsed) ? parsed : [parsed])
    .map((display) => ({
      id: String(display.id || ""),
      primary: !!display.primary,
      left: Math.round(Number(display.left) || 0),
      top: Math.round(Number(display.top) || 0),
      width: Math.round(Number(display.width) || 0),
      height: Math.round(Number(display.height) || 0),
    }))
    .filter((display) => display.id && display.width > 0 && display.height > 0)
    .sort((left, right) => left.left - right.left || left.top - right.top);
}

function openDesktopApp() {
  const launcherPath = path.join(__dirname, "ParroDesktop.exe");
  if (!fs.existsSync(launcherPath)) throw new Error("desktop_launcher_missing");
  const child = spawn(launcherPath, [], {
    cwd: __dirname,
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
  child.unref();
  log({ event: "open_desktop_app", launcher_path: launcherPath });
  return { ok: true, type: "DESKTOP_APP_OPENED" };
}

function normalizedCaptureTarget(target) {
  if (target?.mode === "all") return { mode: "all" };
  if (target?.mode === "monitor" && typeof target.display_id === "string") {
    const display = listDisplays().find((item) => item.id === target.display_id);
    if (!display) throw new Error("capture_display_not_found");
    return { mode: "monitor", display_id: display.id, ...display };
  }
  return { mode: "auto" };
}

function captureDirectoryFor(sessionId) {
  const safeId = safeSessionId(sessionId);
  if (!safeId) throw new Error("missing_session_id");
  const capturesRoot = path.resolve(logDir, "captures");
  const captureDir = path.resolve(capturesRoot, safeId);
  if (captureDir !== capturesRoot && !captureDir.startsWith(`${capturesRoot}${path.sep}`)) {
    throw new Error("invalid_session_id");
  }
  return captureDir;
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function readCaptureEvents(captureDir) {
  const eventsPath = path.join(captureDir, "events.jsonl");
  if (!fs.existsSync(eventsPath)) return [];
  const events = fs.readFileSync(eventsPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const editsPath = path.join(captureDir, "blur-edits.jsonl");
  if (!fs.existsSync(editsPath)) return events;
  const edits = fs.readFileSync(editsPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  for (const event of events) {
    const screenshotName = path.basename(String(event.screenshot_path || ""));
    const matching = edits.filter((edit) => path.basename(String(edit.screenshot_name || "")) === screenshotName);
    if (!matching.length) continue;
    event.blur_applied = true;
    event.blur_region = matching[matching.length - 1].region || null;
    event.blur_regions = matching.map((edit) => edit.region).filter(Boolean);
  }
  return events;
}

function writeFallbackStoppedSession(captureDir, sessionId, startedAt = null) {
  fs.mkdirSync(captureDir, { recursive: true });
  const sessionPath = path.join(captureDir, "session.json");
  if (fs.existsSync(sessionPath)) return readJsonFile(sessionPath);
  const now = new Date().toISOString();
  const events = readCaptureEvents(captureDir);
  const session = {
    session_id: sessionId,
    status: "stopped",
    started_at: startedAt || now,
    updated_at: now,
    captured_steps: events.length,
    events_file: path.join(captureDir, "events.jsonl"),
    capture_directory: captureDir,
    warning: "capture_agent_session_file_missing",
  };
  fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2), "utf8");
  return session;
}

function publicCaptureEvent(event, captureDir) {
  const screenshotName = path.basename(String(event.screenshot_path || ""));
  const screenshotPath = path.join(captureDir, screenshotName);
  const screenshotSize = screenshotName && fs.existsSync(screenshotPath)
    ? fs.statSync(screenshotPath).size
    : 0;
  return {
    step_number: Number(event.step_number) || 0,
    event_type: String(event.event_type || "click"),
    captured_at: event.captured_at || null,
    click_x: Number(event.click_x) || 0,
    click_y: Number(event.click_y) || 0,
    normalized_x: Number(event.normalized_x) || 0,
    normalized_y: Number(event.normalized_y) || 0,
    screen: event.screen || null,
    blur_applied: !!event.blur_applied,
    blur_region: event.blur_region || null,
    blur_regions: Array.isArray(event.blur_regions)
      ? event.blur_regions
      : (event.blur_region ? [event.blur_region] : []),
    window_title: String(event.window_title || "").slice(0, 300) || null,
    process_name: String(event.process_name || "").slice(0, 120) || null,
    ui_element: event.ui_element ? {
      name: String(event.ui_element.name || "").slice(0, 200) || null,
      automation_id: String(event.ui_element.automation_id || "").slice(0, 200) || null,
      control_type: String(event.ui_element.control_type || "").slice(0, 100) || null,
      class_name: String(event.ui_element.class_name || "").slice(0, 160) || null,
      left: Number(event.ui_element.left) || 0,
      top: Number(event.ui_element.top) || 0,
      width: Number(event.ui_element.width) || 0,
      height: Number(event.ui_element.height) || 0,
    } : null,
    screenshot_name: screenshotName,
    screenshot_size: screenshotSize,
  };
}

async function waitForSessionStopped(captureDir, timeoutMs = 6000) {
  const sessionPath = path.join(captureDir, "session.json");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const session = readJsonFile(sessionPath);
      if (session.status === "stopped") return session;
    } catch {
      // Agent may still be flushing the session file.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  try { return readJsonFile(sessionPath); } catch { return null; }
}

function stopCaptureAgent() {
  const child = state.captureProcess;
  if (state.stopFile) {
    try {
      fs.writeFileSync(state.stopFile, new Date().toISOString(), "utf8");
    } catch (error) {
      log({ event: "capture_stop_signal_failed", error: error.message });
    }
  }
  if (child && child.exitCode === null) {
    const forceStop = setTimeout(() => {
      if (child.exitCode === null) {
        try { child.kill(); } catch { }
      }
    }, 2500);
    forceStop.unref();
  }
  state.captureProcess = null;
}

function startCaptureAgent(sessionId, requestedTarget) {
  stopCaptureAgent();

  const safeId = safeSessionId(sessionId);
  if (!safeId) throw new Error("missing_session_id");

  const captureDir = captureDirectoryFor(safeId);
  const stopFile = path.join(captureDir, ".stop");
  const pauseFile = path.join(captureDir, ".pause");
  const undoFile = path.join(captureDir, ".undo");
  const manualCaptureFile = path.join(captureDir, ".manual-capture");
  const blurNextFile = path.join(captureDir, ".blur-next");
  const toolbarBoundsFile = path.join(captureDir, ".toolbar-bounds.json");
  const agentPath = path.join(__dirname, "capture-agent.ps1");
  fs.mkdirSync(captureDir, { recursive: true });
  fs.rmSync(stopFile, { force: true });
  fs.rmSync(pauseFile, { force: true });
  fs.rmSync(undoFile, { force: true });
  fs.rmSync(manualCaptureFile, { force: true });
  fs.rmSync(blurNextFile, { force: true });
  fs.rmSync(toolbarBoundsFile, { force: true });

  const captureTarget = normalizedCaptureTarget(requestedTarget);
  const captureArguments = ["-CaptureMode", captureTarget.mode];
  if (captureTarget.mode === "monitor") {
    captureArguments.push(
      "-CaptureLeft", String(captureTarget.left),
      "-CaptureTop", String(captureTarget.top),
      "-CaptureWidth", String(captureTarget.width),
      "-CaptureHeight", String(captureTarget.height),
    );
  }

  const child = spawn("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", agentPath,
    "-SessionId", sessionId,
    "-OutputDir", captureDir,
    "-StopFile", stopFile,
    "-PauseFile", pauseFile,
    "-UndoFile", undoFile,
    "-ManualCaptureFile", manualCaptureFile,
    "-BlurNextFile", blurNextFile,
    "-ToolbarBoundsFile", toolbarBoundsFile,
    "-OwnerProcessId", String(process.pid),
    ...captureArguments,
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
  state.pauseFile = pauseFile;
  state.undoFile = undoFile;
  state.manualCaptureFile = manualCaptureFile;
  state.blurNextFile = blurNextFile;
  state.toolbarBoundsFile = toolbarBoundsFile;
  return { captureDir, captureTarget };
}

function activeCaptureMatches(sessionId) {
  return !!state.activeSessionId && (!sessionId || sessionId === state.activeSessionId);
}

function requireActiveCaptureControl(message) {
  if (!activeCaptureMatches(message.capture_session_id)) {
    return { ok: false, error: "capture_session_not_active" };
  }
  if (!state.captureDir) {
    return { ok: false, error: "capture_session_not_ready" };
  }
  return null;
}

function writeCaptureControlFile(filePath, payload = "") {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, payload || new Date().toISOString(), "utf8");
}

function normalizedToolbarBounds(bounds) {
  if (!bounds || typeof bounds !== "object") throw new Error("missing_toolbar_bounds");
  const left = Number(bounds.left);
  const top = Number(bounds.top);
  const right = Number(bounds.right);
  const bottom = Number(bounds.bottom);
  if (![left, top, right, bottom].every(Number.isFinite)) throw new Error("invalid_toolbar_bounds");
  if (right <= left || bottom <= top) throw new Error("invalid_toolbar_bounds");
  return {
    left: Math.round(left),
    top: Math.round(top),
    right: Math.round(right),
    bottom: Math.round(bottom),
  };
}

async function waitForCapturedStepCount(captureDir, predicate, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const count = readCaptureEvents(captureDir).length;
    if (predicate(count)) return count;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  return readCaptureEvents(captureDir).length;
}

async function handleMessage(message) {
  if (!message || typeof message !== "object") {
    return { ok: false, error: "invalid_message" };
  }

  if (message.type === "PING") {
    return {
      ok: true,
      type: "PONG",
      host: "parro-desktop-companion-dev",
      version: DESKTOP_COMPANION_VERSION,
      active_session_id: state.activeSessionId,
    };
  }

  if (message.type === "LIST_DISPLAYS") {
    const displays = listDisplays();
    return {
      ok: true,
      type: "DISPLAY_LIST",
      displays,
      virtual_bounds: displays.length ? {
        left: Math.min(...displays.map((display) => display.left)),
        top: Math.min(...displays.map((display) => display.top)),
        right: Math.max(...displays.map((display) => display.left + display.width)),
        bottom: Math.max(...displays.map((display) => display.top + display.height)),
      } : null,
    };
  }

  if (message.type === "OPEN_DESKTOP_APP") {
    return openDesktopApp();
  }

  if (message.type === "START_CAPTURE_SESSION") {
    state.activeSessionId = message.capture_session_id || null;
    state.startedAt = new Date().toISOString();
    const { captureDir, captureTarget } = startCaptureAgent(state.activeSessionId, message.capture_target);
    log({ event: "start_capture_session", message });
    return {
      ok: true,
      type: "CAPTURE_SESSION_STARTED",
      capture_session_id: state.activeSessionId,
      started_at: state.startedAt,
      capture_dir: captureDir,
      capture_target: captureTarget,
    };
  }

  if (message.type === "STOP_CAPTURE_SESSION") {
    const stoppedSessionId = state.activeSessionId;
    const captureDir = state.captureDir || captureDirectoryFor(message.capture_session_id || stoppedSessionId);
    stopCaptureAgent();
    const session = await waitForSessionStopped(captureDir) || writeFallbackStoppedSession(captureDir, message.capture_session_id || stoppedSessionId, state.startedAt);
    log({ event: "stop_capture_session", message, active_session_id: stoppedSessionId });
    state.activeSessionId = null;
    state.startedAt = null;
    return {
      ok: true,
      type: "CAPTURE_SESSION_STOPPED",
      capture_session_id: message.capture_session_id || stoppedSessionId,
      capture_dir: captureDir,
      captured_steps: Number(session?.captured_steps) || 0,
    };
  }

  if (message.type === "PAUSE_CAPTURE_SESSION" || message.type === "RESUME_CAPTURE_SESSION") {
    if (!activeCaptureMatches(message.capture_session_id)) return { ok: false, error: "capture_session_not_active" };
    const paused = message.type === "PAUSE_CAPTURE_SESSION";
    if (paused) fs.writeFileSync(state.pauseFile, new Date().toISOString(), "utf8");
    else fs.rmSync(state.pauseFile, { force: true });
    log({ event: paused ? "pause_capture_session" : "resume_capture_session", session_id: state.activeSessionId });
    return {
      ok: true,
      type: paused ? "CAPTURE_SESSION_PAUSED" : "CAPTURE_SESSION_RESUMED",
      capture_session_id: state.activeSessionId,
      status: paused ? "paused" : "recording",
    };
  }

  if (message.type === "REQUEST_MANUAL_CAPTURE") {
    const controlError = requireActiveCaptureControl(message);
    if (controlError) return controlError;
    writeCaptureControlFile(state.manualCaptureFile);
    log({ event: "manual_capture_requested", session_id: state.activeSessionId });
    return {
      ok: true,
      type: "MANUAL_CAPTURE_REQUESTED",
      capture_session_id: state.activeSessionId,
    };
  }

  if (message.type === "MARK_NEXT_CAPTURE_PRIVATE") {
    const controlError = requireActiveCaptureControl(message);
    if (controlError) return controlError;
    writeCaptureControlFile(state.blurNextFile);
    log({ event: "next_capture_marked_private", session_id: state.activeSessionId });
    return {
      ok: true,
      type: "NEXT_CAPTURE_MARKED_PRIVATE",
      capture_session_id: state.activeSessionId,
    };
  }

  if (message.type === "UPDATE_TOOLBAR_BOUNDS") {
    const controlError = requireActiveCaptureControl(message);
    if (controlError) return controlError;
    const bounds = normalizedToolbarBounds(message.bounds);
    writeCaptureControlFile(state.toolbarBoundsFile, JSON.stringify(bounds));
    log({ event: "toolbar_bounds_updated", session_id: state.activeSessionId, bounds });
    return {
      ok: true,
      type: "TOOLBAR_BOUNDS_UPDATED",
      capture_session_id: state.activeSessionId,
      bounds,
    };
  }

  if (message.type === "UNDO_CAPTURE_STEP") {
    if (!activeCaptureMatches(message.capture_session_id)) return { ok: false, error: "capture_session_not_active" };
    const before = readCaptureEvents(state.captureDir).length;
    if (!before) return { ok: false, error: "nothing_to_undo", captured_steps: 0 };
    fs.writeFileSync(state.undoFile, new Date().toISOString(), "utf8");
    const capturedSteps = await waitForCapturedStepCount(state.captureDir, (count) => count < before);
    const undone = capturedSteps < before;
    log({ event: "undo_capture_step", session_id: state.activeSessionId, before, captured_steps: capturedSteps, undone });
    return {
      ok: undone,
      type: "CAPTURE_STEP_UNDONE",
      capture_session_id: state.activeSessionId,
      captured_steps: capturedSteps,
      error: undone ? undefined : "undo_timeout",
    };
  }

  if (message.type === "GET_CAPTURE_SESSION") {
    const sessionId = message.capture_session_id;
    const captureDir = captureDirectoryFor(sessionId);
    const sessionPath = path.join(captureDir, "session.json");
    if (!fs.existsSync(sessionPath)) return { ok: false, error: "capture_session_not_found" };
    let session = readJsonFile(sessionPath);
    if (session.status !== "stopped") {
      session = await waitForSessionStopped(captureDir, 8000) || session;
    }
    const events = readCaptureEvents(captureDir).map((event) => publicCaptureEvent(event, captureDir));
    return {
      ok: true,
      type: "CAPTURE_SESSION",
      capture_session_id: sessionId,
      session: {
        status: session.status || "unknown",
        started_at: session.started_at || null,
        updated_at: session.updated_at || null,
        captured_steps: events.length,
      },
      events,
    };
  }

  if (message.type === "READ_CAPTURE_IMAGE_CHUNK") {
    const sessionId = message.capture_session_id;
    const stepNumber = Number(message.step_number);
    const offset = Math.max(0, Number(message.offset) || 0);
    const captureDir = captureDirectoryFor(sessionId);
    const event = readCaptureEvents(captureDir).find((item) => Number(item.step_number) === stepNumber);
    if (!event) return { ok: false, error: "capture_step_not_found" };
    const screenshotName = path.basename(String(event.screenshot_path || ""));
    const screenshotPath = path.join(captureDir, screenshotName);
    if (!screenshotName || !fs.existsSync(screenshotPath)) return { ok: false, error: "capture_image_not_found" };
    const size = fs.statSync(screenshotPath).size;
    if (offset > size) return { ok: false, error: "invalid_chunk_offset" };
    const chunkSize = Math.min(384 * 1024, size - offset);
    const handle = fs.openSync(screenshotPath, "r");
    let bytes;
    try {
      bytes = Buffer.alloc(chunkSize);
      fs.readSync(handle, bytes, 0, chunkSize, offset);
    } finally {
      fs.closeSync(handle);
    }
    const nextOffset = offset + chunkSize;
    return {
      ok: true,
      type: "CAPTURE_IMAGE_CHUNK",
      capture_session_id: sessionId,
      step_number: stepNumber,
      offset,
      next_offset: nextOffset,
      total_size: size,
      done: nextOffset >= size,
      data: bytes.toString("base64"),
    };
  }

  log({ event: "unknown_message", message });
  return { ok: false, error: "unknown_message_type", type: message.type };
}

let pending = Buffer.alloc(0);
let messageQueue = Promise.resolve();

process.stdin.on("data", (chunk) => {
  pending = Buffer.concat([pending, chunk]);

  while (pending.length >= 4) {
    const length = pending.readUInt32LE(0);
    if (pending.length < 4 + length) return;

    const raw = pending.subarray(4, 4 + length).toString("utf8");
    pending = pending.subarray(4 + length);

    messageQueue = messageQueue.then(async () => {
      let message = null;
      try {
        message = JSON.parse(raw);
        const response = await handleMessage(message);
        send(message.request_id ? { ...response, request_id: message.request_id } : response);
      } catch (error) {
        log({ event: "host_error", error: error.message });
        const response = { ok: false, error: error.message || "host_error" };
        send(message?.request_id ? { ...response, request_id: message.request_id } : response);
      }
    });
  }
});

process.stdin.on("end", () => {
  stopCaptureAgent();
  log({ event: "stdin_end", active_session_id: state.activeSessionId });
});
