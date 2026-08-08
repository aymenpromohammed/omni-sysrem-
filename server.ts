import express from "express";
import path from "node:path";
import fs from "node:fs";
import app from "./artifacts/api-server/src/app.js";

const PORT = Number(process.env.PORT ?? "3000");

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
      configFile: path.resolve(process.cwd(), "artifacts/pos-system/vite.config.ts"),
    });
    app.use(vite.middlewares);
  } else {
    const candidates = [
      path.resolve(process.cwd(), "dist/public"),
      path.resolve(process.cwd(), "artifacts/pos-system/dist/public"),
      path.resolve(__dirname, "dist/public"),
      path.resolve(__dirname, "artifacts/pos-system/dist/public"),
    ];
    const distPath = candidates.find((p) => fs.existsSync(path.join(p, "index.html"))) || candidates[0];

    process.env.FRONTEND_DIST = distPath;
    app.use(express.static(distPath));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        res.sendStatus(404);
        return;
      }
      res.sendFile(path.join(distPath, "index.html"), (err) => {
        if (err) next(err);
      });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 OmniSystem POS Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

