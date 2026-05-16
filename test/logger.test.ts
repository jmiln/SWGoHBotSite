import assert from "node:assert";
import { test } from "node:test";

process.env.BOT_DATA_PATH = "/tmp";
process.env.BOT_SCHEMAS_PATH = "/tmp";
process.env.DISCORD_CLIENT_ID = "test";
process.env.DISCORD_CLIENT_SECRET = "test";
process.env.DISCORD_REDIRECT_URI = "http://localhost:3300/callback";
process.env.MONGODB_URI = "mongodb://localhost:27018/test";
process.env.MONGODB_BOT_DB = "test";
process.env.SESSION_SECRET = "test-session-secret-16ch";
process.env.DISCORD_BOT_TOKEN = "test";
process.env.MONGODB_SWAPI_DB = "test";
process.env.ADMIN_DISCORD_ID = "111111111111111111";

const { stringify, formatLogLine } = await import("../modules/logger.ts");

// --- stringify ---

test("stringify returns a string unchanged", () => {
    assert.strictEqual(stringify("hello world"), "hello world");
});

test("stringify returns an empty string unchanged", () => {
    assert.strictEqual(stringify(""), "");
});

test("stringify returns Error.stack when the stack is present", () => {
    const err = new Error("boom");
    assert.ok(err.stack, "precondition: Error has a stack in this runtime");
    assert.strictEqual(stringify(err), err.stack);
});

test("stringify falls back to Error.message when stack is absent", () => {
    const err = new Error("no stack here");
    delete err.stack;
    assert.strictEqual(stringify(err), "no stack here");
});

test("stringify JSON-serialises a plain object", () => {
    assert.strictEqual(stringify({ a: 1, b: "two" }), '{"a":1,"b":"two"}');
});

test("stringify JSON-serialises null as 'null'", () => {
    assert.strictEqual(stringify(null), "null");
});

test("stringify JSON-serialises a number", () => {
    assert.strictEqual(stringify(42), "42");
});

test("stringify JSON-serialises a boolean", () => {
    assert.strictEqual(stringify(true), "true");
});

// --- formatLogLine ---

test("formatLogLine formats a known INFO-level pino JSON line", () => {
    const raw = JSON.stringify({ level: 30, msg: "server started" });
    const result = formatLogLine(raw);
    assert.ok(result.includes("[INFO]"), `Expected [INFO] in: ${result}`);
    assert.ok(result.includes("server started"), `Expected message in: ${result}`);
    assert.ok(result.includes("SWGoHBotSite"), `Expected app name in: ${result}`);
    assert.ok(result.endsWith("\n"), "Result should end with newline");
});

test("formatLogLine formats a WARN-level line with the correct label", () => {
    const raw = JSON.stringify({ level: 40, msg: "low disk space" });
    const result = formatLogLine(raw);
    assert.ok(result.includes("[WARN]"), `Expected [WARN] in: ${result}`);
    assert.ok(result.includes("low disk space"), `Expected message in: ${result}`);
});

test("formatLogLine formats an ERROR-level line with the correct label", () => {
    const raw = JSON.stringify({ level: 50, msg: "unhandled exception" });
    const result = formatLogLine(raw);
    assert.ok(result.includes("[ERROR]"), `Expected [ERROR] in: ${result}`);
});

test("formatLogLine falls back to UNKNOWN for an unrecognised level number", () => {
    const raw = JSON.stringify({ level: 99, msg: "custom level" });
    const result = formatLogLine(raw);
    assert.ok(result.includes("[UNKNOWN]"), `Expected [UNKNOWN] in: ${result}`);
    assert.ok(result.includes("custom level"), `Expected message in: ${result}`);
});

test("formatLogLine returns the raw string when input is not valid JSON", () => {
    const raw = "not json at all";
    assert.strictEqual(formatLogLine(raw), raw);
});

test("formatLogLine uses empty string for msg when the field is absent", () => {
    const raw = JSON.stringify({ level: 30 });
    const result = formatLogLine(raw);
    assert.ok(result.includes("[INFO]"), `Expected [INFO] in: ${result}`);
    assert.ok(result.endsWith("\n"), "Result should end with newline");
});

// --- Logger public methods (thin wrappers; pino is silent so output is not observable,
//     but the methods must exist and dispatch without throwing) ---
const logger = (await import("../modules/logger.ts")).default;

test("logger.info is callable without throwing", () => {
    assert.doesNotThrow(() => logger.info("info message"));
});

test("logger.error is callable without throwing", () => {
    assert.doesNotThrow(() => logger.error("error message"));
});
