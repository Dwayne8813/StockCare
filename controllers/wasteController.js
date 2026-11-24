import { Op } from "sequelize";
import { sequelize } from "../models/db.js";
import { Inventory } from "../models/inventoryModel.js";
import { WasteLog } from "../models/wasteLogModel.js";
import { logEvent } from "../utils/audit.js";

const REASONS = ["Expired", "Spoiled", "Spilled / Dropped", "Damaged", "Overproduction", "Customer Return", "Other"];
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const round3 = (n) => Math.round(n * 1000) / 1000;

export const page = async (req, res) => {
  const items = await Inventory.findAll({ where: { quantity: { [Op.gt]: 0 } }, order: [["itemName", "ASC"]], raw: true });
  const logs = await WasteLog.findAll({ order: [["timestamp", "DESC"]], limit: 200, raw: true });
  const totalLoss = round2((await WasteLog.sum("lossValue")) || 0);
  const incidents = await WasteLog.count();
  res.render("waste", { title: "Waste Log", nav: { waste: true }, items, logs, reasons: REASONS, totalLoss, incidents });
};

export const create = async (req, res) => {
  const qty = parseFloat(req.body.quantity);
  const reason = req.body.reason;
  const fail = (text) => {
    req.session.flash = { type: "error", text };
    return res.redirect("/waste");
  };
  if (!REASONS.includes(reason)) return fail("Please select a valid reason.");
  if (isNaN(qty) || qty <= 0) return fail("Quantity must be greater than zero.");

  const username = req.session.username;
  const result = await sequelize.transaction(async (t) => {
    const item = await Inventory.findByPk(req.body.itemId, { transaction: t });
    if (!item) return { error: "Product not found." };
    if (qty > item.quantity) return { error: `Only ${item.quantity} ${item.unit} of ${item.itemName} in stock.` };

    const lossValue = round2(qty * item.unitCost);
    const newQty = round3(item.quantity - qty);
    await item.update({ quantity: newQty, totalValue: round2(newQty * item.unitCost) }, { transaction: t });
    const entry = await WasteLog.create(
      { itemName: item.itemName, quantity: qty, unit: item.unit, reason, lossValue, username },
      { transaction: t }
    );
    return { entry };
  });

  if (result.error) return fail(result.error);
  const e = result.entry;
  await logEvent(req, "WASTE_LOGGED", `Wasted ${e.quantity} ${e.unit} of ${e.itemName} (${e.reason}), loss ${Number(e.lossValue).toFixed(2)}`);
  req.session.flash = { type: "success", text: `Waste logged. Stock for ${e.itemName} updated.` };
  res.redirect("/waste");
};