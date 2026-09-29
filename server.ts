import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { initDatabase } from "./src/db";
import crmAiRouter from "./src/server/routes/crm-ai";
import automationRouter, { startScheduler } from "./src/server/routes/automation";
import reportsRouter from "./src/server/routes/reports";
import brevoRouter from "./src/server/routes/brevo";
import apiKeysRouter from "./src/server/routes/api-keys";
import affiliateRouter from "./src/server/routes/affiliate";
import saasRouter from "./src/server/routes/saas";
import websiteBuilderRouter from "./src/server/routes/website-builder";

function resolvePort(): number {
  const portArgIdx = process.argv.indexOf("--port");
  if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
    const parsed = Number(process.argv[portArgIdx + 1]);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  if (process.env.DEFAULT_APP_PORT) {
    return Number(process.env.DEFAULT_APP_PORT) || 3000;
  }
  const envPort = Number(process.env.PORT);
  if (process.env.RENDER && envPort > 0) {
    return envPort;
  }
  if (envPort && String(envPort) !== process.env.NGINX_PORT && envPort !== 8080) {
    return envPort;
  }
  return 3000;
}

async function startServer() {
  const app = express();
  const PORT = resolvePort();

  const dbReady = initDatabase().catch((err) => {
    console.error("[server] Database init error:", err);
  });

  app.use(cors());
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Healthcheck (responds immediately)
  app.get("/api/healthz", (_req, res) => {
    res.json({ status: "ok", app: "ai-business-hunter" });
  });
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", app: "ai-business-hunter" });
  });

  // Ensure DB is initialized before processing API routes
  app.use("/api", async (_req, _res, next) => {
    await dbReady;
    next();
  });

  // Mount AI Business Hunter & CRM routes
  app.use("/api", saasRouter);
  app.use("/api", websiteBuilderRouter);
  app.use("/api", crmAiRouter);
  app.use("/api", automationRouter);
  app.use("/api", reportsRouter);
  app.use("/api", brevoRouter);
  app.use("/api", apiKeysRouter);
  app.use("/api", affiliateRouter);

  // Ensure any unmatched /api/* route returns JSON 404 instead of SPA HTML
  app.use("/api", (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
  });

  const distPath = path.join(process.cwd(), "dist");
  const hasBuiltDist = fs.existsSync(path.join(distPath, "index.html"));
  const isProdRuntime =
    Boolean(process.env.RENDER) ||
    process.env.NODE_ENV === "production";

  if (!isProdRuntime || !hasBuiltDist) {
    let vitePromise: Promise<any> | null = null;
    app.use(async (req, res, next) => {
      try {
        if (!vitePromise) {
          const { createServer: createViteServer } = await import("vite");
          vitePromise = createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
          });
        }
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    app.use(express.static(distPath, { maxAge: "1h" }));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const listenWithRetry = (retriesLeft = 10) => {
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`AI Business Hunter server running on http://0.0.0.0:${PORT}`);
      dbReady.then(() => startScheduler());
    });

    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE" && retriesLeft > 0) {
        console.warn(`[server] Port ${PORT} busy, retrying in 350ms (${retriesLeft} retries left)...`);
        setTimeout(() => {
          try {
            server.close();
          } catch {}
          listenWithRetry(retriesLeft - 1);
        }, 350);
      } else {
        console.error("[server] Server listen error:", err);
        process.exit(1);
      }
    });
  };

  listenWithRetry();
}

startServer().catch((err) => {
  console.error("Failed to start AI Business Hunter server:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[server] Handled unhandledRejection safely:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[server] Handled uncaughtException safely:", err?.message || err);
});

