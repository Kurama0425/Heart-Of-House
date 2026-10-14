import "dotenv/config";
import { db } from "./db";
import { createApp } from "./app";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
createApp(db).listen(port, host, () => {
  console.log(`Heart of House API listening on ${host}:${port}`);
});
