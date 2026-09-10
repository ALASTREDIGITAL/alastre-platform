export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeActorEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function externalWriteAllowed(mode: string, approved: boolean) {
  return mode === "approved_execution" && approved;
}

export function isExternalAction(action: unknown) {
  return typeof action === "string" && /^(execute|publish|sync_write|apply)_/i.test(action);
}
