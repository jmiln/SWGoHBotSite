export function parseEventDateTime(eventDT?: string, eventDTUtc?: string): number | null {
    const rawValue = eventDTUtc ?? eventDT;
    if (!rawValue) {
        return null;
    }

    const timestamp = Date.parse(rawValue);
    return Number.isNaN(timestamp) ? null : timestamp;
}
