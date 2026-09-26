/**
 * Persistent Key-Value store backed by PostgreSQL `site_config` table
 * (with optional Replit KV HTTP fallback if REPLIT_DB_URL is set).
 */

import { db, siteConfigTable } from "../../db";
import { eq } from "drizzle-orm";

export const kvAvailable = true;

export async function kvGet(key: string): Promise<string | null> {
  try {
    const rows = await db
      .select()
      .from(siteConfigTable)
      .where(eq(siteConfigTable.key, `kv:${key}`))
      .limit(1);
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

export async function kvSet(key: string, value: string): Promise<boolean> {
  try {
    await db
      .insert(siteConfigTable)
      .values({ key: `kv:${key}`, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: siteConfigTable.key,
        set: { value, updatedAt: new Date() },
      });
    return true;
  } catch {
    return false;
  }
}

export async function kvDelete(key: string): Promise<boolean> {
  try {
    await db.delete(siteConfigTable).where(eq(siteConfigTable.key, `kv:${key}`));
    return true;
  } catch {
    return false;
  }
}

export async function kvGetJson<T>(key: string): Promise<T | null> {
  const raw = await kvGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function kvSetJson(key: string, value: unknown): Promise<boolean> {
  return kvSet(key, JSON.stringify(value));
}
