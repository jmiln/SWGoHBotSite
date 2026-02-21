const dayMS = 24 * 60 * 60 * 1000;
const hrMS = 60 * 60 * 1000;
const minMS = 60 * 1000;

const ARENA_OFFSETS = { char: 6, fleet: 5 } as const;

function getUTCFromOffset(offset: number): number {
    const date = new Date();
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - offset * minMS;
}

function getTimeLeft(offset: number, hrDiff: number): number {
    const now = Date.now();
    let then = dayMS - 1 + getUTCFromOffset(offset) - hrDiff * hrMS;
    if (then < now) then += dayMS;
    return then - now;
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
