import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initDatabase } from "./src/db";
import crmAiRouter from "./src/server/routes/crm-ai";
import automationRouter, { startScheduler } from "./src/server/routes/automation";
import reportsRouter from "./src/server/routes/reports";
import brevoRouter from "./src/server/routes/brevo";
import apiKeysRouter from "./src/server/routes/api-keys";
import affiliateRouter from "./src/server/routes/affiliate";
import saasRouter from "./src/server/routes/saas";
import websiteBuilderRouter from "./src/server/routes/website-builder";

async function startServer() {
  await initDatabase();

  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Healthcheck
  app.get("/api/healthz", (_req, res) => {
    res.json({ status: "ok", app: "ai-business-hunter" });
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

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Business Hunter server running on http://0.0.0.0:${PORT}`);
    startScheduler();
  });
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

