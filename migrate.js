// MySQL database setup for StockCare.
// Safe by default (keeps data). Use `npm run migrate -- --reset` to wipe tables.
import { Sequelize } from "sequelize";
import { sequelize, DB_CONFIG } from "./models/db.js";
import "./models/index.js";

const reset = process.argv.includes("--reset");
const admin = new Sequelize("", DB_CONFIG.username, DB_CONFIG.password, {
  host: DB_CONFIG.host,
  dialect: "mysql"
});

try {
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\`;`);
  console.log(`Database "${DB_CONFIG.database}" is ready.`);
  await admin.close();

  await sequelize.authenticate();
  await sequelize.sync({ force: reset });
  console.log(reset ? "Tables recreated (all data cleared)." : "Tables verified (existing data kept).");
} catch (err) {
  console.error(`Migration failed: ${err.message || err.parent?.message || err.name}`);
  process.exitCode = 1;
} finally {
  await admin.close().catch(() => {});
  await sequelize.close();
}
