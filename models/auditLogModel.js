import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const AuditLog = sequelize.define("AuditLog", {
  event: { type: DataTypes.STRING(50), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  ipAddress: { type: DataTypes.STRING(64), allowNull: true },
  username: { type: DataTypes.STRING(100), allowNull: true },
  timestamp: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, { timestamps: false });