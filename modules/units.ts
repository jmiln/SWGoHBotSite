import { getSwapiDB } from "./db.ts";

/**
 * Batch fetch unit display names from the SWAPI units collection.
 * Returns a map of defId (baseId) → nameKey.
 * Any defId not found will be absent from the map — callers should fall back to the raw defId.
 */
export async function getUnitNames(defIds: string[]): Promise<Record<string, string>> {
    if (!defIds.length) return {};

    const db = getSwapiDB();
    const units = await db
        .collection<{ baseId: string; nameKey: string }>("units")
        .find({ baseId: { $in: defIds }, language: "eng_us" }, { projection: { baseId: 1, nameKey: 1, _id: 0 } })
        .toArray();

    const nameMap: Record<string, string> = {};
    for (const unit of units) {
        nameMap[unit.baseId] = unit.nameKey;
    }
    return nameMap;
}
