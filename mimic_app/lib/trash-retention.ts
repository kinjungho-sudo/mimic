export const TRASH_RETENTION_DAYS = 7;
export const TRASH_CLEANUP_BATCH_SIZE = 100;

export function trashCutoff(now = Date.now()): string {
  return new Date(now - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}
