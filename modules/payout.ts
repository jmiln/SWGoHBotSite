const dayMS = 24 * 60 * 60 * 1000;
const hrMS = 60 * 60 * 1000;
const minMS = 60 * 1000;

export const ARENA_OFFSETS = { char: 18, fleet: 19 } as const;

export function getTimeLeft(poOffset: number, arenaOffset: number): number {
    const now = Date.now();
    const date = new Date();

    // Establish "Today's" payout time in UTC
    // We use the player's PO offset and the specific arena offset
    const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    let payout = midnight - poOffset * 60000 - arenaOffset * 3600000;

    // If that time has already passed today, add a day
    while (payout < now) {
        payout += dayMS;
    }

    return payout - now;
}

function formatMs(ms: number): string {
    const h = Math.floor(ms / hrMS);
    const m = Math.floor((ms % hrMS) / minMS);
    return `${h}h ${m}m`;
}

export function formatPayoutTimes(poOffset: number): { char: string; fleet: string } {
    return {
        char: formatMs(getTimeLeft(poOffset, ARENA_OFFSETS.char)),
        fleet: formatMs(getTimeLeft(poOffset, ARENA_OFFSETS.fleet)),
    };
}
