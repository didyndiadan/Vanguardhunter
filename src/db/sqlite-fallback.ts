import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/pg-proxy";
import fs from "fs";
import os from "os";
import path from "path";
import * as schema from "./schema";

const BOOLEAN_COLUMNS = new Set([
  "secure",
  "imap_enabled",
  "active",
  "auto_paused",
  "auto_hunt_enabled",
  "auto_score",
  "auto_email",
  "auto_reply",
  "follow_up_enabled",
  "read",
  "is_active",
  "proposal_requested",
  "bulk_hunt_enabled",
  "auto_pilot_enabled",
  "is_popular",
  "read_by_user",
  "read_by_admin",
  "claim_requested",
]);

/**
 * Extracts column default expressions from CREATE TABLE statements in SCHEMA_SQL
 * so that PostgreSQL `VALUES (default, $1, ...)` can be translated into valid SQLite literals.
 */
function buildColumnDefaultsMap(schemaSql: string): Map<string, Map<string, string>> {
  const tableMap = new Map<string, Map<string, string>>();
  const createRegex = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-zA-Z0-9_"]+)\s*\(([\s\S]*?)\);/gi;
  let match: RegExpExecArray | null;

  while ((match = createRegex.exec(schemaSql)) !== null) {
    const tableName = match[1].replace(/"/g, "").trim().toLowerCase();
    const body = match[2];
    const colDefaults = new Map<string, string>();

    const lines = body
      .split("\n")
      .map((l) => l.trim().replace(/,$/, ""))
      .filter(Boolean);

    for (const line of lines) {
      if (/^(PRIMARY|UNIQUE|CONSTRAINT|CHECK|FOREIGN)\b/i.test(line)) continue;
      const colMatch = line.match(/^("?[a-zA-Z0-9_]+"?)\s+(.+)$/);
      if (!colMatch) continue;
      const colName = colMatch[1].replace(/"/g, "").toLowerCase();
      const rest = colMatch[2];

      if (/\bSERIAL\b/i.test(rest)) {
        colDefaults.set(colName, "NULL");
        continue;
      }

      const defMatch = rest.match(/\bDEFAULT\s+(.+)$/i);
      if (defMatch) {
        let defExpr = defMatch[1].trim().replace(/::[a-zA-Z0-9_]+/g, "");
        if (/^false$/i.test(defExpr)) defExpr = "0";
        else if (/^true$/i.test(defExpr)) defExpr = "1";
        else if (/^CURRENT_TIMESTAMP$/i.test(defExpr)) defExpr = "CURRENT_TIMESTAMP";
        colDefaults.set(colName, defExpr);
      } else {
        colDefaults.set(colName, "NULL");
      }
    }

    tableMap.set(tableName, colDefaults);
  }

  return tableMap;
}

export function toSqliteSchemaSql(pgSchemaSql: string): string {
  return pgSchemaSql
    .replace(/ALTER\s+TABLE\s+[^\n;]+;/gi, "")
    .replace(/\bSERIAL\s+PRIMARY\s+KEY\b/gi, "INTEGER PRIMARY KEY AUTOINCREMENT")
    .replace(/\bJSONB\b/gi, "TEXT")
    .replace(/::jsonb\b/gi, "")
    .replace(/\bBOOLEAN\b/gi, "INTEGER")
    .replace(/\bDEFAULT\s+false\b/gi, "DEFAULT 0")
    .replace(/\bDEFAULT\s+true\b/gi, "DEFAULT 1")
    .replace(/\bTIMESTAMP\b/gi, "TEXT")
    .replace(/\bDESC\)/gi, ")");
}

export class SqliteCompatClient {
  private sqlite: DatabaseSync;
  private colDefaults: Map<string, Map<string, string>>;

  constructor(schemaSql: string) {
    const dataDir = process.env.PGDATA_DIR || path.join(os.tmpdir(), "ai-business-hunter-sqlite-v1");
    let dbFile = ":memory:";
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      dbFile = path.join(dataDir, "vanguard-hunter.sqlite");
    } catch {
      dbFile = ":memory:";
    }

    try {
      this.sqlite = new DatabaseSync(dbFile);
      this.sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
    } catch {
      this.sqlite = new DatabaseSync(":memory:");
    }

    this.colDefaults = buildColumnDefaultsMap(schemaSql);
  }

  async exec(rawSql: string): Promise<void> {
    const converted = toSqliteSchemaSql(rawSql);
    this.sqlite.exec(converted);
  }

  private translateQuery(rawSql: string, rawParams: any[]): { sql: string; params: any[] } {
    let sql = rawSql
      .replace(/::jsonb\b/gi, "")
      .replace(/::int\b/gi, "")
      .replace(/::text\b/gi, "");

    // Translate PostgreSQL `INSERT INTO "tbl" ("c1", "c2", ...) VALUES (default, $1, ...)`
    const insertMatch = sql.match(
      /^(insert\s+into\s+"?([a-zA-Z0-9_]+)"?\s*\(([^)]+)\)\s*values\s*)([\s\S]+?)(\s+on\s+conflict[\s\S]*|\s+returning[\s\S]*|;?\s*)$/i
    );

    if (insertMatch) {
      const prefix = insertMatch[1];
      const tableName = insertMatch[2].replace(/"/g, "").toLowerCase();
      const cols = insertMatch[3].split(",").map((c) => c.replace(/"/g, "").trim().toLowerCase());
      const valuesBody = insertMatch[4];
      const suffix = insertMatch[5] || "";
      const tableDefs = this.colDefaults.get(tableName);

      const rewrittenValues = valuesBody.replace(/\(([^()]+)\)/g, (_full, tupleContent: string) => {
        const tokens = tupleContent.split(",").map((t) => t.trim());
        const replaced = tokens.map((tok, idx) => {
          if (/^default$/i.test(tok)) {
            const colName = cols[idx] || "";
            return tableDefs?.get(colName) ?? "NULL";
          }
          return tok;
        });
        return `(${replaced.join(", ")})`;
      });

      sql = `${prefix}${rewrittenValues}${suffix}`;
    }

    // Map PostgreSQL positional parameters ($1, $2, ...) to SQLite (?)
    const mappedParams: any[] = [];
    const finalSql = sql.replace(/\$(\d+)/g, (_m, numStr) => {
      const idx = Number(numStr) - 1;
      const val = rawParams[idx];
      if (val === undefined || val === null) {
        mappedParams.push(null);
      } else if (typeof val === "boolean") {
        mappedParams.push(val ? 1 : 0);
      } else if (val instanceof Date) {
        mappedParams.push(val.toISOString());
      } else if (typeof val === "object") {
        mappedParams.push(JSON.stringify(val));
      } else {
        mappedParams.push(val);
      }
      return "?";
    });

    return { sql: finalSql, params: mappedParams };
  }

  async query(rawSql: string, rawParams: any[] = []): Promise<{ rows: any[] }> {
    const { sql, params } = this.translateQuery(rawSql, rawParams);
    const stmt = this.sqlite.prepare(sql);
    const isReturningOrSelect = /^\s*select\b|\breturning\b/i.test(sql);
    if (isReturningOrSelect) {
      const rows = stmt.all(...params) as any[];
      return { rows };
    } else {
      stmt.run(...params);
      return { rows: [] };
    }
  }

  createDrizzleInstance() {
    return drizzle(
      async (rawSql, rawParams, method) => {
        const { sql, params } = this.translateQuery(rawSql, rawParams);
        const stmt = this.sqlite.prepare(sql);
        const isReturningOrSelect = /^\s*select\b|\breturning\b/i.test(sql);

        if (method === "execute" && !isReturningOrSelect) {
          stmt.run(...params);
          return { rows: [] };
        }

        const colsMeta = stmt.columns();
        stmt.setReturnArrays(true);
        const rawRows = stmt.all(...params) as unknown as any[][];

        const convertedRows = rawRows.map((row) =>
          row.map((cell, idx) => {
            const colName = colsMeta[idx]?.name?.toLowerCase() || "";
            if (BOOLEAN_COLUMNS.has(colName) && cell !== null && cell !== undefined) {
              return Boolean(Number(cell));
            }
            return cell;
          })
        );

        return { rows: convertedRows };
      },
      { schema }
    );
  }
}
