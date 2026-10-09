import assert from "node:assert";
import { describe, it } from "node:test";
import { isSafeLocalPath } from "../modules/safeRedirect.ts";

describe("isSafeLocalPath", () => {
    for (const path of ["/", "/config", "/guild/123/edit", "/commands?category=Admin", "/moviechecker/#list"]) {
        it(`accepts same-origin path ${JSON.stringify(path)}`, () => {
            assert.strictEqual(isSafeLocalPath(path), true);
        });
    }

    const offOrigin = [
        "//evil.com",
        "/\\evil.com",
        "/\\/evil.com",
        "/\t/evil.com",
        "/\n/evil.com",
        "https://evil.com",
        "javascript:alert(1)",
        "evil.com",
        "",
    ];
    for (const path of offOrigin) {
        it(`rejects ${JSON.stringify(path)}`, () => {
            assert.strictEqual(isSafeLocalPath(path), false);
        });
    }

    for (const path of ["//", "/\\", "//@", "//host:99999"]) {
        it(`rejects unparseable ${JSON.stringify(path)} without throwing`, () => {
            assert.strictEqual(isSafeLocalPath(path), false);
        });
    }

    it("rejects non-string values such as a repeated form field", () => {
        assert.strictEqual(isSafeLocalPath(undefined), false);
        assert.strictEqual(isSafeLocalPath(["/config", "//evil.com"]), false);
    });
});
