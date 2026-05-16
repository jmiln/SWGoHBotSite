import assert from "node:assert";
import { afterEach, describe, it, mock } from "node:test";

process.env.DISCORD_CLIENT_ID = "test-client-id";
process.env.DISCORD_CLIENT_SECRET = "test-client-secret";
process.env.DISCORD_REDIRECT_URI = "http://localhost:3300/callback";
process.env.MONGODB_URI = "mongodb://localhost:27018/test?directConnection=true";
process.env.MONGODB_BOT_DB = "testBotDB";
process.env.MONGODB_SWAPI_DB = "testSwapiDB";
process.env.SESSION_SECRET = "test-session-secret-16ch";
process.env.DISCORD_BOT_TOKEN = "test-bot-token";
process.env.ADMIN_DISCORD_ID = "test-admin-id";
process.env.BOT_DATA_PATH = "/tmp";
process.env.BOT_SCHEMAS_PATH = "/tmp";

const { refreshAccessToken, exchangeCodeForToken, buildDiscordAuthURL, fetchDiscordUser, fetchUserGuilds } = await import("../modules/auth.ts");

describe("refreshAccessToken", () => {
    afterEach(() => mock.restoreAll());

    it("throws when Discord returns a non-OK response", async () => {
        mock.method(globalThis, "fetch", async () => ({
            ok: false,
            status: 400,
            text: async () => '{"error":"invalid_grant"}',
        }));
        await assert.rejects(
            () => refreshAccessToken("bad-token"),
            (err: Error) => {
                assert.ok(err.message.includes("Token refresh failed"));
                assert.ok(err.message.includes("400"));
                return true;
            },
        );
    });

    it("returns new tokens when Discord responds successfully", async () => {
        mock.method(globalThis, "fetch", async () => ({
            ok: true,
            json: async () => ({
                access_token: "new-access-token",
                refresh_token: "new-refresh-token",
                expires_in: 604800,
            }),
        }));
        const result = await refreshAccessToken("valid-refresh-token");
        assert.strictEqual(result.accessToken, "new-access-token");
        assert.strictEqual(result.refreshToken, "new-refresh-token");
        assert.strictEqual(result.expiresIn, 604800);
    });
});

describe("buildDiscordAuthURL", () => {
    it("returns a Discord OAuth URL with the expected query params", () => {
        const url = buildDiscordAuthURL("test-state");
        const parsed = new URL(url);
        assert.ok(url.startsWith("https://discord.com/oauth2/authorize?"));
        assert.strictEqual(parsed.searchParams.get("client_id"), "test-client-id");
        assert.strictEqual(parsed.searchParams.get("state"), "test-state");
        assert.strictEqual(parsed.searchParams.get("response_type"), "code");
        assert.ok(parsed.searchParams.get("scope")?.includes("identify"));
        assert.ok(parsed.searchParams.get("scope")?.includes("guilds"));
    });
});

describe("fetchDiscordUser", () => {
    afterEach(() => mock.restoreAll());

    it("returns user data when Discord responds successfully", async () => {
        const fakeUser = { id: "123", username: "testuser", avatar: null };
        mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => fakeUser }));
        const result = await fetchDiscordUser("valid-token");
        assert.deepStrictEqual(result, fakeUser);
    });

    it("throws when Discord returns a non-OK response", async () => {
        mock.method(globalThis, "fetch", async () => ({ ok: false, status: 401 }));
        await assert.rejects(
            () => fetchDiscordUser("bad-token"),
            (err: Error) => {
                assert.ok(err.message.includes("Failed to fetch Discord user"));
                assert.ok(err.message.includes("401"));
                return true;
            },
        );
    });
});

describe("fetchUserGuilds", () => {
    afterEach(() => mock.restoreAll());

    it("returns guild list when Discord responds successfully", async () => {
        const fakeGuilds = [{ id: "111", name: "My Guild", icon: null, permissions: "0" }];
        mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => fakeGuilds }));
        const result = await fetchUserGuilds("valid-token");
        assert.deepStrictEqual(result, fakeGuilds);
    });

    it("throws when Discord returns a non-OK response", async () => {
        mock.method(globalThis, "fetch", async () => ({ ok: false, status: 403 }));
        await assert.rejects(
            () => fetchUserGuilds("bad-token"),
            (err: Error) => {
                assert.ok(err.message.includes("Failed to fetch user guilds"));
                assert.ok(err.message.includes("403"));
                return true;
            },
        );
    });
});

describe("exchangeCodeForToken", () => {
    afterEach(() => mock.restoreAll());

    it("throws when Discord returns a non-OK response", async () => {
        mock.method(globalThis, "fetch", async () => ({
            ok: false,
            status: 401,
            text: async () => '{"error":"invalid_code"}',
        }));
        await assert.rejects(
            () => exchangeCodeForToken("invalid-code"),
            (err: Error) => {
                assert.ok(err.message.includes("Token exchange failed"));
                assert.ok(err.message.includes("401"));
                return true;
            },
        );
    });

    it("returns accessToken, refreshToken, and expiresIn on success", async () => {
        mock.method(globalThis, "fetch", async () => ({
            ok: true,
            json: async () => ({
                access_token: "the-access-token",
                refresh_token: "the-refresh-token",
                expires_in: 604800,
            }),
        }));
        const result = await exchangeCodeForToken("auth-code");
        assert.strictEqual(result.accessToken, "the-access-token");
        assert.strictEqual(result.refreshToken, "the-refresh-token");
        assert.strictEqual(result.expiresIn, 604800);
    });
});
