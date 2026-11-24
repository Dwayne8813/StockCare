import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const WasteLog = sequelize.define("WasteLog", {
  itemName: { type: DataTypes.STRING, allowNull: false },
  quantity: { type: DataTypes.FLOAT, allowNull: false },
  unit: { type: DataTypes.STRING(20), allowNull: false },
  reason: { type: DataTypes.STRING(60), allowNull: false },
  lossValue: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  username: { type: DataTypes.STRING(100), allowNull: true },
  timestamp: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, { timestamps: false });