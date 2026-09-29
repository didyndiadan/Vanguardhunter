import fs from "fs";
import path from "path";
import { PGlite } from "@electric-sql/pglite";

async function prebuildPgData() {
  const templateDir = path.join(process.cwd(), "dist", "pgdata-template");
  try {
    fs.rmSync(templateDir, { recursive: true, force: true });
    fs.mkdirSync(templateDir, { recursive: true });
    console.log("[prebuild-pgdata] Initializing clean PGlite cluster template at dist/pgdata-template...");
    const pg = new PGlite(templateDir, {
      relaxedDurability: true,
      startParams: [
        ...PGlite.defaultStartParams,
        "-c",
        "shared_buffers=4MB",
        "-c",
        "work_mem=1MB",
        "-c",
        "temp_buffers=1MB",
        "-c",
        "wal_buffers=256kB",
      ],
    });
    await pg.waitReady;
    await pg.exec("SELECT 1;");
    await pg.close();
    console.log("[prebuild-pgdata] Clean PGlite cluster template ready.");
  } catch (err) {
    console.warn("[prebuild-pgdata] Warning (non-fatal):", err?.message || err);
  }
}

prebuildPgData();
