import assert from "node:assert";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import ejs from "ejs";
import { ARENA_OFFSETS, formatPayoutTimes, getTimeLeft } from "../modules/payout.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_TEMPLATE = join(__dirname, "..", "pages", "config.ejs");

function escapeAttr(str: string): string {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// Minimal valid user config; the page reads account/watch rows from the joined view models below.
const userConfig = {
    patreonAmountCents: 100,
    accounts: [123456789],
    primaryAllyCode: 123456789,
    lang: { language: "en_US" },
    arenaAlert: { enableRankDMs: "off", arena: "none", payoutWarning: 0, enablePayoutResult: false },
    arenaWatch: { enabled: true, allyCodes: [{ allyCode: 987654321, poOffset: 0 }], report: "both", showvs: false },
    guildUpdate: { enabled: false, allycode: 0, sortBy: "name" },
    guildTickets: { enabled: false, sortBy: "name", showMax: false },
};

function baseLocals(overrides: Record<string, unknown>) {
    return {
        title: "My Config — SWGoHBot",
        description: "Your SWGoHBot configuration.",
        nonce: "test-nonce",
        user: { id: "123", username: "Tester", avatar: null },
        userConfig,
        isPatreon: true,
        pluginNavItems: [],
        isAdmin: false,
        logoutCsrfToken: "csrf",
        logoutReturnTo: "/config",
        currentPath: "/config",
        escapeAttr,
        formatPayoutTimes,
        getTimeLeft,
        ARENA_OFFSETS,
        linkedAccounts: [],
        watchAccounts: [],
        ...overrides,
    };
}

describe("config.ejs rendering", () => {
    it("renders a linked account that has no joined player doc, falling back to the ally code", async () => {
        const linkedAccounts = [{ allyCode: 123456789, name: undefined, lastCharRank: undefined, lastShipRank: undefined, primary: true }];
        const html = await ejs.renderFile(CONFIG_TEMPLATE, baseLocals({ linkedAccounts }));
        assert.ok(typeof html === "string");
        assert.ok(html.includes("123456789"));
        assert.ok(html.includes("Primary"));
    });

    it("renders a linked account joined with its arena player name and ranks", async () => {
        const linkedAccounts = [{ allyCode: 123456789, name: "TestPlayer", lastCharRank: 5, lastShipRank: 10, primary: true }];
        const html = await ejs.renderFile(CONFIG_TEMPLATE, baseLocals({ linkedAccounts }));
        assert.ok(html.includes("TestPlayer"));
        assert.ok(html.includes("#5"));
        assert.ok(html.includes("#10"));
    });

    it("renders an arena watch account that has no joined player doc", async () => {
        const watchAccounts = [{ allyCode: 987654321, name: undefined, lastCharRank: undefined, lastShipRank: undefined, poOffset: 0 }];
        const html = await ejs.renderFile(CONFIG_TEMPLATE, baseLocals({ watchAccounts }));
        assert.ok(typeof html === "string");
        assert.ok(html.includes("987654321"));
    });
});
