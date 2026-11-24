// StockCare runs fully offline: no MySQL server, no phpMyAdmin, no internet.
// Data is persisted to data/stockcare-db.json by the local store.
export { sequelize, DB_CONFIG, Op, DataTypes } from "./localDb.js";
