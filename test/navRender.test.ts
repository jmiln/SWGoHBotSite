import assert from "node:assert";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import ejs from "ejs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const NAV_TEMPLATE = join(__dirname, "..", "partials", "nav.ejs");

const PUBLIC_ITEM = { label: "Public Thing", href: "/public-thing", requiresAuth: false };
const AUTH_ITEM = { label: "MovieChecker", href: "/moviechecker/guild-select", requiresAuth: true };
const ADMIN_ITEM = { label: "Cast & Bio", href: "/moviechecker/cast-bio", requiresAuth: true, requiresAdmin: true };

function baseLocals(overrides: Record<string, unknown> = {}) {
    return {
        user: { id: "123", username: "Tester", avatar: null },
        isAdmin: false,
        pluginNavItems: [],
        logoutCsrfToken: "csrf",
        logoutReturnTo: "/",
        currentPath: "/",
        ...overrides,
    };
}

describe("nav.ejs rendering", () => {
    it("does not link to the retired admin plugin, even for the admin", async () => {
        const html = await ejs.renderFile(NAV_TEMPLATE, baseLocals({ isAdmin: true }));
        assert.ok(!html.includes("/admin/stats"), "nav still links to the retired /admin/stats page");
    });

    it("hides requiresAdmin plugin nav items from a non-admin", async () => {
        const html = await ejs.renderFile(NAV_TEMPLATE, baseLocals({ isAdmin: false, pluginNavItems: [AUTH_ITEM, ADMIN_ITEM] }));
        assert.ok(html.includes(AUTH_ITEM.href), "a plain requiresAuth item should still show");
        assert.ok(!html.includes(ADMIN_ITEM.href), "a requiresAdmin item leaked to a non-admin");
    });

    it("shows requiresAdmin plugin nav items to the admin", async () => {
        const html = await ejs.renderFile(NAV_TEMPLATE, baseLocals({ isAdmin: true, pluginNavItems: [AUTH_ITEM, ADMIN_ITEM] }));
        assert.ok(html.includes(AUTH_ITEM.href));
        assert.ok(html.includes(ADMIN_ITEM.href));
    });

    it("shows no logged-in plugin items to a logged-out visitor", async () => {
        const html = await ejs.renderFile(NAV_TEMPLATE, baseLocals({ user: null, pluginNavItems: [PUBLIC_ITEM, AUTH_ITEM, ADMIN_ITEM] }));
        assert.ok(!html.includes(AUTH_ITEM.href));
        assert.ok(!html.includes(ADMIN_ITEM.href));
        assert.ok(html.includes("/login?returnTo="), "logged-out visitors should get the login button");
    });
});
