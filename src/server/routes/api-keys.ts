import { Router } from "express";
import { db, siteConfigTable } from "../../db";
import { eq } from "drizzle-orm";
import { kvGetJson, kvSetJson } from "../lib/replit-kv";

const KV_GEMINI_KEY = "GEMINI_KEYS";

const router = Router();

import { requireAdmin } from "../lib/admin-auth";

const API_KEY_NAMES = [
  "GEMINI_API_KEY",
  "BREVO_SMTP_USER",
  "BREVO_SMTP_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_PUBLISHABLE_KEY",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_SECRET",
  "LEMONSQUEEZY_API_KEY",
  "LEMONSQUEEZY_STORE_ID",
  "PAYSTACK_SECRET_KEY",
  "PAYSTACK_PUBLIC_KEY",
  "FLUTTERWAVE_SECRET_KEY",
  "FLUTTERWAVE_PUBLIC_KEY",
];

function maskKey(val: string): string {
  if (!val || val.length < 8) return "••••••••";
  return "••••••••" + val.slice(-4);
}

// ─── Gemini API key pool (multiple keys, rotational) ───────────────────────

const GEMINI_POOL_CONFIG_KEY = "GEMINI_API_KEYS";

type GeminiPoolEntry = { id: string; key: string; label?: string; addedAt: string };

let geminiRotationIndex = 0;

async function readGeminiPool(): Promise<GeminiPoolEntry[]> {
  // Try DB first
  try {
    const rows = await db
      .select()
      .from(siteConfigTable)
      .where(eq(siteConfigTable.key, GEMINI_POOL_CONFIG_KEY))
      .limit(1);

    if (rows[0]?.value) {
      const parsed = JSON.parse(rows[0].value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Keep KV in sync
        kvSetJson(KV_GEMINI_KEY, parsed).catch(() => {});
        return parsed;
      }
    }

    // Migrate legacy single GEMINI_API_KEY into the pool, if present
    const legacy = await getConfigKey("GEMINI_API_KEY");
    if (legacy) {
      const migrated: GeminiPoolEntry[] = [
        { id: randomId(), key: legacy, label: "Key 1", addedAt: new Date().toISOString() },
      ];
      await writeGeminiPool(migrated);
      return migrated;
    }
  } catch { /* DB unavailable — fall through to KV */ }

  // KV fallback
  const kvPool = await kvGetJson<GeminiPoolEntry[]>(KV_GEMINI_KEY);
  if (kvPool && kvPool.length > 0) return kvPool;

  // Env-var fallback
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey) return [{ id: "__env__", key: envKey, label: "From environment", addedAt: "" }];

  return [];
}

async function writeGeminiPool(pool: GeminiPoolEntry[]): Promise<void> {
  const value = JSON.stringify(pool);
  // Always write to KV so production stays in sync
  kvSetJson(KV_GEMINI_KEY, pool).catch(() => {});
  try {
    const existing = await db
      .select()
      .from(siteConfigTable)
      .where(eq(siteConfigTable.key, GEMINI_POOL_CONFIG_KEY))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(siteConfigTable)
        .set({ value, updatedAt: new Date() })
        .where(eq(siteConfigTable.key, GEMINI_POOL_CONFIG_KEY));
    } else {
      await db.insert(siteConfigTable).values({ key: GEMINI_POOL_CONFIG_KEY, value });
    }
  } catch { /* DB unavailable — KV write above is the fallback */ }
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

router.get("/admin/gemini-keys", requireAdmin, async (_req, res) => {
  try {
    const integrationKey = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
    const pool = await readGeminiPool();
    const customKeys = pool.filter((k) => k.id !== "__env__");
    res.json({
      viaIntegration: Boolean(integrationKey),
      keys: customKeys.map((k) => ({
        id: k.id,
        label: k.label || "Gemini Pool Key",
        masked: maskKey(k.key),
        addedAt: k.addedAt,
      })),
    });
  } catch (err) {
    console.error("Get gemini-keys error", err);
    res.status(500).json({ error: "Failed to load Gemini keys" });
  }
});

router.post("/admin/gemini-keys", requireAdmin, async (req, res) => {
  try {
    const { apiKey, label } = req.body ?? {};
    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      res.status(400).json({ error: "API key is required" });
      return;
    }
    const pool = (await readGeminiPool()).filter((k) => k.id !== "__env__");
    const entry: GeminiPoolEntry = {
      id: randomId(),
      key: apiKey.trim(),
      label: label?.trim() || `Gemini Node ${pool.length + 1}`,
      addedAt: new Date().toISOString(),
    };
    pool.push(entry);
    await writeGeminiPool(pool);
    res.json({ success: true, id: entry.id, count: pool.length });
  } catch (err) {
    console.error("Add gemini-key error", err);
    res.status(500).json({ error: "Failed to save Gemini key" });
  }
});

router.delete("/admin/gemini-keys/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = (await readGeminiPool()).filter((k) => k.id !== "__env__");
    const next = pool.filter((k) => k.id !== id);
    await writeGeminiPool(next);
    res.json({ success: true, count: next.length });
  } catch (err) {
    console.error("Delete gemini-key error", err);
    res.status(500).json({ error: "Failed to delete Gemini key" });
  }
});

router.put("/admin/gemini-keys/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { apiKey, label } = req.body ?? {};
    const pool = (await readGeminiPool()).filter((k) => k.id !== "__env__");
    const idx = pool.findIndex((k) => k.id === id);
    if (idx === -1) {
      res.status(404).json({ error: "Gemini key not found" });
      return;
    }
    pool[idx] = {
      ...pool[idx],
      label: label !== undefined && String(label).trim() ? String(label).trim() : pool[idx].label,
      key: apiKey !== undefined && String(apiKey).trim() ? String(apiKey).trim() : pool[idx].key,
    };
    await writeGeminiPool(pool);
    res.json({ success: true, id: pool[idx].id, label: pool[idx].label, masked: maskKey(pool[idx].key) });
  } catch (err) {
    console.error("Update gemini-key error", err);
    res.status(500).json({ error: "Failed to update Gemini key" });
  }
});

router.get("/admin/api-keys", requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(siteConfigTable)
      .then((r) => r.filter((x) => API_KEY_NAMES.includes(x.key)));

    const result: Record<string, { masked: string; set: boolean; viaIntegration?: boolean }> = {};
    for (const name of API_KEY_NAMES) {
      const envVal = process.env[name];
      const dbRow = rows.find((r) => r.key === name);
      const effectiveVal = envVal || dbRow?.value || "";
      result[name] = {
        masked: effectiveVal ? maskKey(effectiveVal) : "",
        set: !!effectiveVal,
      };
    }

    // Report platform Gemini integration status
    const integrationKey = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
    if (integrationKey) {
      result["GEMINI_API_KEY"] = {
        masked: maskKey(integrationKey),
        set: true,
        viaIntegration: true,
      };
    }

    res.json(result);
  } catch (err) {
    console.error("Get api-keys error", err);
    res.status(500).json({ error: "Failed to load API keys" });
  }
});

router.post("/admin/api-keys", requireAdmin, async (req, res) => {
  try {
    const updates: Record<string, string> = req.body ?? {};
    const saved: string[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (!API_KEY_NAMES.includes(key)) continue;
      if (!value || typeof value !== "string") continue;

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

      process.env[key] = value;
      saved.push(key);
    }

    res.json({ success: true, saved });
  } catch (err) {
    console.error("Save api-keys error", err);
    res.status(500).json({ error: "Failed to save API keys" });
  }
});

router.delete("/admin/api-keys/:key", requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    if (!API_KEY_NAMES.includes(key)) {
      res.status(400).json({ error: "Unknown key" });
      return;
    }
    await db.delete(siteConfigTable).where(eq(siteConfigTable.key, key));
    delete process.env[key];
    res.json({ success: true });
  } catch (err) {
    console.error("Delete api-key error", err);
    res.status(500).json({ error: "Failed to delete API key" });
  }
});

export async function getConfigKey(key: string): Promise<string | undefined> {
  if (key === "GEMINI_API_KEY" && (process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY)) {
    return process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  }
  if (process.env[key]) return process.env[key];
  try {
    const rows = await db
      .select()
      .from(siteConfigTable)
      .where(eq(siteConfigTable.key, key))
      .limit(1);
    if (rows[0]?.value) {
      process.env[key] = rows[0].value;
      return rows[0].value;
    }
  } catch {}
  return undefined;
}

// Returns a ready GoogleGenAI instance using the best available key + base URL.
// When multiple manual keys are configured, rotates round-robin across them.
export async function getGeminiAI() {
  const { GoogleGenAI } = await import("@google/genai");
  const envKey = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  const integrationBase = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  const pool = (await readGeminiPool()).filter((k) => k.id !== "__env__");

  if (pool.length > 0) {
    const allCandidates = envKey ? [...pool.map((p) => p.key), envKey] : pool.map((p) => p.key);
    const chosenKey = allCandidates[geminiRotationIndex % allCandidates.length];
    geminiRotationIndex = (geminiRotationIndex + 1) % allCandidates.length;
    if (chosenKey === envKey && integrationBase) {
      return new GoogleGenAI({
        apiKey: chosenKey,
        httpOptions: { apiVersion: "", baseUrl: integrationBase },
      });
    }
    return new GoogleGenAI({ apiKey: chosenKey });
  }

  if (envKey) {
    return new GoogleGenAI({
      apiKey: envKey,
      ...(integrationBase ? { httpOptions: { apiVersion: "", baseUrl: integrationBase } } : {}),
    });
  }
  throw new Error("Gemini AI not configured. Ensure GEMINI_API_KEY is set in environment or Admin Pool.");
}

// ─── Generic provider key-pool routes ────────────────────────────────────────
// Supports: foursquare | tomtom | here | google_maps | serpapi | hunter
// GET    /api/api-pools/:provider         — list keys (masked)
// POST   /api/api-pools/:provider         — add a key { apiKey, label? }
// DELETE /api/api-pools/:provider/:id     — remove a key
// GET    /api/api-pools/status            — counts for all providers + gemini

import { readPool, addToPool, removeFromPool, updateInPool } from "../lib/api-key-pools";

const SUPPORTED_PROVIDERS = ["foursquare", "tomtom", "here", "google_maps", "serpapi", "hunter"] as const;

function maskApiKey(key: string): string {
  if (!key || key.length < 8) return "••••••••";
  return key.slice(0, 4) + "••••••••" + key.slice(-4);
}

// Status endpoint — pool counts for all providers + gemini (no key values)
router.get("/api-pools/status", requireAdmin, async (_req, res) => {
  try {
    const [fsPool, ttPool, herePool, gmapsPool, serpPool, hunterPool, gemPool] = await Promise.all([
      readPool("foursquare"),
      readPool("tomtom"),
      readPool("here"),
      readPool("google_maps"),
      readPool("serpapi"),
      readPool("hunter"),
      readGeminiPool(),
    ]);

    const baseYield = 25; // 18 built-in scrapers (YellowPages, SuperPages, OSM, etc.)
    const estimatedYieldPerCity =
      baseYield +
      (fsPool.length > 0 ? 50 * Math.max(fsPool.filter(k => k.id !== "__env__").length, 1) : 0) +
      (ttPool.length > 0 ? 100 * Math.max(ttPool.filter(k => k.id !== "__env__").length, 1) : 0) +
      (herePool.length > 0 ? 100 * Math.max(herePool.filter(k => k.id !== "__env__").length, 1) : 0) +
      (gmapsPool.length > 0 ? 60 * Math.max(gmapsPool.filter(k => k.id !== "__env__").length, 1) : 0) +
      (serpPool.length > 0 ? 80 * Math.max(serpPool.filter(k => k.id !== "__env__").length, 1) : 0);

    res.json({
      foursquare:  { count: fsPool.filter(k => k.id !== "__env__").length, active: fsPool.length > 0, envFallback: fsPool.some(k => k.id === "__env__") },
      tomtom:      { count: ttPool.filter(k => k.id !== "__env__").length, active: ttPool.length > 0, envFallback: ttPool.some(k => k.id === "__env__") },
      here:        { count: herePool.filter(k => k.id !== "__env__").length, active: herePool.length > 0, envFallback: herePool.some(k => k.id === "__env__") },
      google_maps: { count: gmapsPool.filter(k => k.id !== "__env__").length, active: gmapsPool.length > 0, envFallback: gmapsPool.some(k => k.id === "__env__") },
      serpapi:     { count: serpPool.filter(k => k.id !== "__env__").length, active: serpPool.length > 0, envFallback: serpPool.some(k => k.id === "__env__") },
      hunter:      { count: hunterPool.filter(k => k.id !== "__env__").length, active: hunterPool.length > 0, envFallback: hunterPool.some(k => k.id === "__env__") },
      gemini:      { count: gemPool.filter(k => k.id !== "__env__").length, active: gemPool.length > 0 || Boolean(process.env.GEMINI_API_KEY), envFallback: Boolean(process.env.GEMINI_API_KEY) },
      estimatedYieldPerCity,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load key pool status" });
  }
});

// List keys for a provider (masked)
router.get("/api-pools/:provider", requireAdmin, async (req, res) => {
  const { provider } = req.params;
  if (!SUPPORTED_PROVIDERS.includes(provider as any)) {
    res.status(400).json({ error: "Unknown provider" });
    return;
  }
  try {
    const pool = await readPool(provider);
    // Don't expose virtual env-var entries to the UI
    const uiPool = pool
      .filter(e => e.id !== "__env__")
      .map(e => ({ id: e.id, label: e.label, masked: maskApiKey(e.key), addedAt: e.addedAt }));
    res.json({ provider, keys: uiPool, envFallback: pool.some(e => e.id === "__env__") });
  } catch {
    res.status(500).json({ error: "Failed to load keys" });
  }
});

// Add a key
router.post("/api-pools/:provider", requireAdmin, async (req, res) => {
  const { provider } = req.params;
  if (!SUPPORTED_PROVIDERS.includes(provider as any)) {
    res.status(400).json({ error: "Unknown provider" });
    return;
  }
  const { apiKey, label } = req.body ?? {};
  if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
    res.status(400).json({ error: "apiKey is required" });
    return;
  }
  try {
    const entry = await addToPool(provider, apiKey, label);
    res.json({ success: true, id: entry.id, label: entry.label, masked: maskApiKey(entry.key) });
  } catch {
    res.status(500).json({ error: "Failed to save key" });
  }
});

// Delete a key
router.delete("/api-pools/:provider/:id", requireAdmin, async (req, res) => {
  const { provider, id } = req.params;
  if (!SUPPORTED_PROVIDERS.includes(provider as any)) {
    res.status(400).json({ error: "Unknown provider" });
    return;
  }
  try {
    await removeFromPool(provider, id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete key" });
  }
});

// Update / Edit a key in pool
router.put("/api-pools/:provider/:id", requireAdmin, async (req, res) => {
  const { provider, id } = req.params;
  if (!SUPPORTED_PROVIDERS.includes(provider as any)) {
    res.status(400).json({ error: "Unknown provider" });
    return;
  }
  const { apiKey, label } = req.body ?? {};
  try {
    const updated = await updateInPool(provider, id, { apiKey, label });
    if (!updated) {
      res.status(404).json({ error: "Key not found" });
      return;
    }
    res.json({ success: true, id: updated.id, label: updated.label, masked: maskApiKey(updated.key) });
  } catch {
    res.status(500).json({ error: "Failed to update key" });
  }
});

export default router;
