type CaptureSchemaError = {
  code?: string;
  message?: string;
} | null | undefined;

type CaptureWriteResult = {
  error: CaptureSchemaError;
};

type CaptureWriteInput = Record<string, unknown> | Array<Record<string, unknown>>;

const COMPATIBILITY_COLUMN_GROUPS = [
  {
    pattern: /action_info/i,
    columns: ['action_info'],
  },
  {
    pattern: /target_context/i,
    columns: ['target_context'],
  },
  {
    pattern: /step_type|capture_source|capture_failure_reason/i,
    columns: ['step_type', 'capture_source', 'capture_failure_reason'],
  },
] as const;

export function removeUnsupportedCaptureColumns<T extends Record<string, unknown>>(
  row: T,
  error: CaptureSchemaError,
): { row: T; removed: boolean } {
  const message = error?.message ?? '';
  const next = { ...row };
  let removed = false;

  for (const group of COMPATIBILITY_COLUMN_GROUPS) {
    if (!group.pattern.test(message)) continue;

    for (const column of group.columns) {
      if (column in next) {
        delete next[column];
        removed = true;
      }
    }
  }

  return { row: next, removed };
}

function cloneCaptureWriteInput<TInput extends CaptureWriteInput>(input: TInput): TInput {
  if (Array.isArray(input)) {
    return input.map(row => ({ ...row })) as TInput;
  }
  return { ...input } as TInput;
}

function removeUnsupportedCaptureInput<TInput extends CaptureWriteInput>(
  input: TInput,
  error: CaptureSchemaError,
): { input: TInput; removed: boolean } {
  if (!Array.isArray(input)) {
    const stripped = removeUnsupportedCaptureColumns(input, error);
    return { input: stripped.row as TInput, removed: stripped.removed };
  }

  let removed = false;
  const rows = input.map(row => {
    const stripped = removeUnsupportedCaptureColumns(row, error);
    removed ||= stripped.removed;
    return stripped.row;
  }) as TInput;
  return { input: rows, removed };
}

export async function writeWithCaptureSchemaCompatibility<
  TInput extends CaptureWriteInput,
  TResult extends CaptureWriteResult,
>(
  input: TInput,
  write: (candidate: TInput) => Promise<TResult>,
): Promise<TResult> {
  let candidate = cloneCaptureWriteInput(input);
  let result = await write(candidate);

  for (let retry = 0; result.error && retry < COMPATIBILITY_COLUMN_GROUPS.length; retry += 1) {
    const stripped = removeUnsupportedCaptureInput(candidate, result.error);
    if (!stripped.removed) return result;

    candidate = stripped.input;
    result = await write(candidate);
  }

  return result;
}
