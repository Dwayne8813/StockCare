import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const Inventory = sequelize.define("Inventory", {
  itemName: { type: DataTypes.STRING, allowNull: false },
  category: { type: DataTypes.STRING, allowNull: false, defaultValue: "Other" },
  quantity: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  unit: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "pcs" },
  amountPerUnit: { type: DataTypes.FLOAT, allowNull: true },
  amountUnit: { type: DataTypes.STRING(10), allowNull: true },
  expiryDate: { type: DataTypes.DATEONLY, allowNull: true },
  unitCost: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  totalValue: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  image: { type: DataTypes.STRING, allowNull: true }
});