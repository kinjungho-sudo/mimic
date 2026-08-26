# Parro product naming

- The product and all user-facing copy must use **Parro**.
- `MIMIC` is a legacy name. Keep it only where an existing internal identifier must remain stable for compatibility, such as the repository name, database fields, or the Chrome Native Messaging host ID.
- New local storage paths, installer labels, application windows, documentation, and download names must use `Parro`.

# Workspace isolation

- The canonical local checkout must use a root directory named `parro`.
- Treat any checkout rooted at `mimic` as a legacy workspace. Do not build, package, or load the Parro dev Recorder from it.
- Load the unpacked dev Recorder only from `<parro-root>/mimic_recorder`. The internal directory name remains unchanged for compatibility.
- Before Recorder development, packaging, or browser reload, run `powershell -ExecutionPolicy Bypass -File scripts/verify-parro-workspace.ps1` from the repository root.
- When Chrome still points at a legacy unpacked path, deploy only through `scripts/deploy-parro-recorder-dev.ps1`. It reads Chrome's actual path, snapshots it, installs the verified ZIP, and checks every packaged file hash. Never edit that legacy target directly.
- Do not delete or rewrite a legacy `mimic` checkout. It can contain unrelated local work and is not the Parro source of truth.
