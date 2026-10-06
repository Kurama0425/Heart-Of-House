import "dotenv/config";
import cors from "cors";
import express from "express";
import { checkDatabaseConnection } from "./db";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await checkDatabaseConnection();

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

app.use((_req, res) => {
  res.status(404).json({
    error: "Not Found"
  });
});

app.listen(port, () => {
  console.log(`Heart of House API listening on port ${port}`);
});
