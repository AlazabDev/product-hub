/**
 * Strip PostgREST filter metacharacters from user-supplied search input
 * to prevent .or()/ilike filter injection. Keep only safe characters and
 * cap length.
 */
export function sanitizeFilterInput(input: string, maxLen = 100): string {
  return String(input ?? "")
    .replace(/[,()*.\\%:]/g, "")
    .slice(0, maxLen);
}
