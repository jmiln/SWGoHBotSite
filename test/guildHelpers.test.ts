import assert from "node:assert";
import { test } from "node:test";
import { buildEventFromForm } from "../modules/guildHelpers.ts";

test("buildEventFromForm prefers explicit UTC eventDT when provided", () => {
    const event = buildEventFromForm({
        name: "TB",
        eventDT: "2026-05-06T20:38",
        eventDTUtc: "2026-05-07T03:38:00.000Z",
    });

    assert.strictEqual(event.eventDT, Date.parse("2026-05-07T03:38:00.000Z"));
});

test("buildEventFromForm falls back to raw datetime-local value when UTC eventDT is absent", () => {
    const event = buildEventFromForm({
        name: "TB",
        eventDT: "2026-05-06T20:38",
    });

    assert.strictEqual(event.eventDT, new Date("2026-05-06T20:38").getTime());
});
