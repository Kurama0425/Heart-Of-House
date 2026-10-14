import "dotenv/config";
import { db } from "./db";
import { createApp } from "./app";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
const server = createApp(db).listen(port, host, () => {
  console.log(`Heart of House API listening on ${host}:${port}`);
});

let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  const deadline = setTimeout(() => process.exit(1), 10000); deadline.unref();
  server.close(() => { db.end().then(() => { clearTimeout(deadline); process.exitCode = 0; }); });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
server.on("error", error => { console.error("API startup failed:", error.message); db.end(); process.exitCode = 1; });
