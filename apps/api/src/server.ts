import "dotenv/config";
import { db } from "./db";
import { createApp } from "./app";

const port = Number(process.env.PORT ?? 3000);
createApp(db).listen(port, () => {
  console.log(`Heart of House API listening on port ${port}`);
});
