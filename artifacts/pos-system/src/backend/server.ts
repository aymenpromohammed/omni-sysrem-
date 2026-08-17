import express from "express";
import path from "node:path";
import fs from "node:fs";
import app from "../../../api-server/src/app";

const PORT = 3000;

export async function startServer(): Promise<any> {
  const isProd = process.env.NODE_ENV === "production" || !process.env.NODE_ENV;

  if (isProd) {
    const distPath = process.env.FRONTEND_DIST || path.resolve(__dirname, "dist/public");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        if (req.path.startsWith("/api")) {
          res.sendStatus(404);
          return;
        }
        res.sendFile(path.join(distPath, "index.html"));
      });
    } else {
      console.warn(`Production frontend dist directory not found at: ${distPath}`);
    }
  }

  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, "127.0.0.1", () => {
      console.log(`Server running on http://127.0.0.1:${PORT}`);
      resolve(server);
    });
    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        console.warn(`Port ${PORT} is already in use, assuming another instance of OmniSystem is running.`);
        resolve(null);
      } else {
        reject(err);
      }
    });
  });
}
