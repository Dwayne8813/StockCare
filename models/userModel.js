import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const User = sequelize.define("User", {
  username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  // Offline password reset: only a bcrypt hash of the one-time code is stored.
  resetTokenHash: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
  resetTokenExpiresAt: { type: DataTypes.DATE, allowNull: true, defaultValue: null }
});

export { sequelize };
