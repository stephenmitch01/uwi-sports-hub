/**
 * Canonical campus slug normalizer shared by auth and route scoping.
 *
 * Unknown values intentionally fall back to Cave Hill for legacy records and
 * local development defaults; new UI should still send an explicit campus.
 */
export function normalizeCampus(value) {
  const raw = String(value || "").trim().toLowerCase().replace(/[_\s-]+/g, "");
  if (raw === "mona") return "mona";
  if (raw === "staugustine" || raw === "staug") return "staugustine";
  if (raw === "cavehill" || raw === "cave") return "cavehill";
  if (raw === "fiveislands" || raw === "fiveisland") return "fiveislands";
  return "cavehill";
}

export function normalizeRole(value) {
  return String(value || "viewer").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function canManage(role) {
  return !["viewer", "read_only", "readonly", "guest"].includes(normalizeRole(role));
}

export function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function cleanObject(value) {
  const output = {};
  Object.entries(value || {}).forEach(([key, item]) => {
    if (item !== undefined) output[key] = item;
  });
  return output;
}

export function sendError(res, status, message, details) {
  res.status(status).json(cleanObject({ error: message, details }));
}

/**
 * Merges JSON `data` fields onto API responses for frontend compatibility.
 *
 * The database keeps flexible sport/profile metadata in `data`, while older
 * pages often expect top-level properties. Flattening preserves both during the
 * migration toward backend-backed records.
 */
export function flattenRecord(record) {
  if (!record) return null;
  const data = record.data && typeof record.data === "object" ? record.data : {};
  return {
    ...record,
    ...data,
    id: record.id,
    data,
    createdAt: record.createdAt?.toISOString?.() || record.createdAt,
    updatedAt: record.updatedAt?.toISOString?.() || record.updatedAt
  };
}

export function flattenMany(records) {
  return (records || []).map(flattenRecord);
}
