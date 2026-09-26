/**
 * Generic API key pool management — stored in siteConfigTable so
 * the admin can manage them from the CRM UI without touching Replit Secrets.
 *
 * Multiple keys per provider are supported and rotated round-robin,
 * effectively multiplying the free-tier quota.
 *
 * Pattern mirrors the existing Gemini key pool in routes/api-keys.ts.
 */

import { db, siteConfigTable } from "../../db";
import { eq } from "drizzle-orm";
import { kvGetJson, kvSetJson } from "./replit-kv";

export interface PoolEntry {
  id: string;
  key: string;
  label: string;
  addedAt: string;
}

// Per-process rotation counters — reset on restart, which is fine.
const rotationCursors: Record<string, number> = {};

function cfgKey(provider: string): string {
  return `API_KEY_POOL_${provider.toUpperCase()}`;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ─── Core read / write ────────────────────────────────────────────────────────

export async function readPool(provider: string): Promise<PoolEntry[]> {
  const kvKey = cfgKey(provider);
  try {
    const rows = await db
      .select()
      .from(siteConfigTable)
      .where(eq(siteConfigTable.key, kvKey))
      .limit(1);

    if (rows[0]?.value) {
      const parsed = JSON.parse(rows[0].value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        kvSetJson(kvKey, parsed).catch(() => {});
        return parsed as PoolEntry[];
      }
    }
  } catch { /* DB unavailable — fall through to KV */ }

  // KV fallback
  const kvPool = await kvGetJson<PoolEntry[]>(kvKey);
  if (kvPool && kvPool.length > 0) return kvPool;

  // Env-var fallback
  const envVal = process.env[`${provider.toUpperCase()}_API_KEY`];
  if (envVal) {
    return [{ id: "__env__", key: envVal, label: "From environment", addedAt: "" }];
  }

  return [];
}

async function writePool(provider: string, pool: PoolEntry[]): Promise<void> {
  const key = cfgKey(provider);
  const value = JSON.stringify(pool);
  // Always write to KV
  kvSetJson(key, pool).catch(() => {});
  try {
    const existing = await db
      .select()
      .from(siteConfigTable)
      .where(eq(siteConfigTable.key, key))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(siteConfigTable)
        .set({ value, updatedAt: new Date() })
        .where(eq(siteConfigTable.key, key));
    } else {
      await db.insert(siteConfigTable).values({ key, value });
    }
  } catch { /* DB unavailable — KV write is the fallback */ }
}

// ─── Public CRUD ──────────────────────────────────────────────────────────────

export async function addToPool(
  provider: string,
  apiKey: string,
  label?: string
): Promise<PoolEntry> {
  // Strip the virtual env entry before counting / writing
  const existing = (await readPool(provider)).filter(e => e.id !== "__env__");
  const entry: PoolEntry = {
    id: randomId(),
    key: apiKey.trim(),
    label: label?.trim() || `Account ${existing.length + 1}`,
    addedAt: new Date().toISOString(),
  };
  await writePool(provider, [...existing, entry]);
  return entry;
}

export async function removeFromPool(provider: string, id: string): Promise<void> {
  const pool = (await readPool(provider)).filter(e => e.id !== "__env__" && e.id !== id);
  await writePool(provider, pool);
}

export async function updateInPool(
  provider: string,
  id: string,
  updates: { apiKey?: string; label?: string }
): Promise<PoolEntry | null> {
  const pool = (await readPool(provider)).filter(e => e.id !== "__env__");
  const idx = pool.findIndex(e => e.id === id);
  if (idx === -1) return null;
  const current = pool[idx];
  const updated: PoolEntry = {
    ...current,
    label: updates.label !== undefined && updates.label.trim() ? updates.label.trim() : current.label,
    key: updates.apiKey !== undefined && updates.apiKey.trim() ? updates.apiKey.trim() : current.key,
  };
  pool[idx] = updated;
  await writePool(provider, pool);
  return updated;
}

// ─── Key rotation helpers (used by scrapers) ──────────────────────────────────

/** Returns ALL active keys for a provider (for parallel multi-account use). */
export async function getAllKeys(provider: string): Promise<string[]> {
  const pool = await readPool(provider);
  return pool.map(e => e.key).filter(Boolean);
}

/** Returns the next key in round-robin rotation; undefined if none configured. */
export async function rotateKey(provider: string): Promise<string | undefined> {
  const keys = await getAllKeys(provider);
  if (keys.length === 0) return undefined;
  const idx = (rotationCursors[provider] ?? 0) % keys.length;
  rotationCursors[provider] = idx + 1;
  return keys[idx];
}
