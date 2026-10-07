import cors from "cors";
import express, { ErrorRequestHandler } from "express";
import { restaurantRoutes, Database } from "./restaurants";

export function createApp(database: Database) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", async (_req, res) => {
    try {
      await database.query("SELECT 1");

      res.json({
        status: "ok",
        service: "heart-of-house-api",
        database: "connected",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Health check failed:", error);

      res.status(503).json({
        status: "degraded",
        service: "heart-of-house-api",
        database: "disconnected",
        timestamp: new Date().toISOString()
      });
    }
  });

  app.use("/api/v1/restaurants", restaurantRoutes(database));

  app.use((_req, res) => {
    res.status(404).json({
      error: "Not Found"
    });
  });

  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error.type === "entity.parse.failed") {
      res.status(400).json({ error: "Body must be valid JSON" });
    } else if (error.type === "entity.too.large") {
      res.status(413).json({ error: "Request body is too large" });
    } else {
      console.error("Request failed:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
  app.use(handleError);
  return app;
}
