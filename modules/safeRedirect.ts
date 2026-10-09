const PLACEHOLDER_ORIGIN = "http://placeholder.invalid";

// Resolved the way browsers resolve it, so `/\evil.com` is caught as well as `//evil.com`.
export function isSafeLocalPath(path: unknown): path is string {
    if (typeof path !== "string" || !path.startsWith("/")) return false;
    try {
        return new URL(path, PLACEHOLDER_ORIGIN).origin === PLACEHOLDER_ORIGIN;
    } catch {
        return false;
    }
}
