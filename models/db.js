// MySQL/Sequelize connection for StockCare.
import { Sequelize } from "sequelize";

const database = process.env.STOCKCARE_DB_NAME || "StockCare";
const username = process.env.STOCKCARE_DB_USER || "root";
const password = process.env.STOCKCARE_DB_PASSWORD || "";
const host = process.env.STOCKCARE_DB_HOST || "localhost";

export const DB_CONFIG = { dialect: "mysql", database, username, password, host };

export const sequelize = new Sequelize(database, username, password, {
  host,
  dialect: "mysql"
});

export { Op, DataTypes } from "sequelize";
