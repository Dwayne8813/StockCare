// StockCare local database setup: creates/verifies data/stockcare-db.json.
// Safe by default (keeps data). Use `npm run migrate -- --reset` to wipe everything.
import { sequelize, DB_CONFIG } from "./models/db.js";
import "./models/index.js";

const reset = process.argv.includes("--reset");

try {
  await sequelize.authenticate();
  await sequelize.sync({ force: reset });
  console.log(`Local database ready at ${DB_CONFIG.storage}`);
  console.log(reset ? "All local data cleared." : "Tables verified (existing data kept).");
} catch (err) {
  console.error("Local database setup failed:", err.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
