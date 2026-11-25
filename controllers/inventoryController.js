import fs from "node:fs";
import path from "node:path";
import { Op } from "sequelize";
import { sequelize } from "../models/db.js";
import { Inventory } from "../models/inventoryModel.js";
import { AuditLog } from "../models/auditLogModel.js";
import { logEvent } from "../utils/audit.js";
import { ymd } from "../utils/setup.js";
import { PUBLIC_DIR } from "../utils/paths.js";

const LOW_STOCK_THRESHOLD = 5; // quantity at or below this = "Low Stock"
const CATEGORIES = ["Produce", "Meat & Poultry", "Seafood", "Dairy & Eggs", "Dry Goods", "Beverages", "Condiments & Sauces", "Frozen", "Bakery", "Other"];
const UNITS = ["pcs", "pack", "box", "can", "bottle", "kg"];
const AMOUNT_UNITS = ["mL", "L", "g", "kg", "pcs"];
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const validDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};

function statusOf(item) {
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD (local)
  const exp = ymd(item.expiryDate);
  if (exp && exp < today) return { key: "expired", label: "Expired" };
  if (item.quantity <= 0) return { key: "out", label: "Out of Stock" };
  if (item.quantity <= LOW_STOCK_THRESHOLD) return { key: "low", label: "Low Stock" };
  return { key: "ok", label: "In Stock" };
}

function removeImage(img) {
  if (!img || !img.startsWith("/uploads/")) return;
  fs.unlink(path.join(PUBLIC_DIR, img), () => {});
}

function parseBody(b) {
  const data = {
    itemName: (b.itemName || "").trim(),
    category: b.category || "Other",
    quantity: parseFloat(b.quantity),
    unit: b.unit || "pcs",
    amountPerUnit: b.amountPerUnit === "" || b.amountPerUnit == null ? null : parseFloat(b.amountPerUnit),
    amountUnit: b.amountUnit || null,
    expiryDate: b.expiryDate || null,
    unitCost: parseFloat(b.unitCost)
  };
  let error = null;
  if (!data.itemName) error = "Product name is required.";
  else if (isNaN(data.quantity) || data.quantity < 0) error = "Quantity must be zero or more.";
  else if (isNaN(data.unitCost) || data.unitCost < 0) error = "Unit cost must be zero or more.";
  else if (!CATEGORIES.includes(data.category)) error = "Choose a valid category.";
  else if (!UNITS.includes(data.unit)) error = "Choose a valid unit.";
  else if (data.amountPerUnit != null && (isNaN(data.amountPerUnit) || data.amountPerUnit <= 0)) error = "Amount per unit must be greater than zero.";
  else if (data.amountPerUnit != null && !data.amountUnit) error = "Choose an amount unit (mL, L, g, kg or pcs).";
  else if (data.amountUnit && !AMOUNT_UNITS.includes(data.amountUnit)) error = "Choose a valid amount unit.";
  else if (data.expiryDate && !validDate(data.expiryDate)) error = "Expiry date must be a real date in YYYY-MM-DD format.";
  return { data, error };
}

function showForm(res, opts) {
  res.render("inventory-form", {
    categories: CATEGORIES,
    units: UNITS,
    amountUnits: AMOUNT_UNITS,
    nav: { add: !opts.isEdit, dashboard: !!opts.isEdit },
    ...opts
  });
}

export const dashboard = async (req, res) => {
  const rows = await Inventory.findAll({ order: [["itemName", "ASC"]], raw: true });
  const items = rows.map((i) => ({ ...i, expiryDate: ymd(i.expiryDate), status: statusOf(i) }));
  const metrics = {
    totalValue: round2(items.reduce((s, i) => s + i.totalValue, 0)),
    tracked: items.length,
    lowOut: items.filter((i) => i.status.key === "low" || i.status.key === "out").length,
    expired: items.filter((i) => i.status.key === "expired").length
  };
  res.render("dashboard", { title: "Dashboard", nav: { dashboard: true }, items, metrics });
};

export const addForm = (req, res) => {
  showForm(res, { title: "Add Product", isEdit: false, action: "/inventory/add", item: { category: "Produce", unit: "kg" } });
};

export const create = async (req, res) => {
  const { data, error } = parseBody(req.body);
  if (error) {
    if (req.file) removeImage("/uploads/" + req.file.filename);
    return showForm(res, { title: "Add Product", isEdit: false, action: "/inventory/add", item: req.body, error });
  }
  const item = await Inventory.create({
    ...data,
    totalValue: round2(data.quantity * data.unitCost),
    image: req.file ? "/uploads/" + req.file.filename : null
  });
  await logEvent(req, "INVENTORY_ADDED", `Added ${item.itemName} (${item.quantity} ${item.unit})`);
  req.session.flash = { type: "success", text: `${item.itemName} added to inventory.` };
  res.redirect("/inventory");
};

export const editForm = async (req, res) => {
  const item = await Inventory.findByPk(req.params.id, { raw: true });
  if (!item) {
    req.session.flash = { type: "error", text: "Product not found." };
    return res.redirect("/inventory");
  }
  item.expiryDate = ymd(item.expiryDate);
  showForm(res, { title: "Edit Product", isEdit: true, action: "/inventory/edit/" + item.id, item });
};

export const update = async (req, res) => {
  const item = await Inventory.findByPk(req.params.id);
  if (!item) {
    req.session.flash = { type: "error", text: "Product not found." };
    return res.redirect("/inventory");
  }
  const { data, error } = parseBody(req.body);
  if (error) {
    if (req.file) removeImage("/uploads/" + req.file.filename);
    return showForm(res, { title: "Edit Product", isEdit: true, action: "/inventory/edit/" + item.id, item: { ...req.body, id: item.id, image: item.image }, error });
  }
  const changes = { ...data, totalValue: round2(data.quantity * data.unitCost) };
  if (req.file) {
    removeImage(item.image);
    changes.image = "/uploads/" + req.file.filename;
  }
  await item.update(changes);
  await logEvent(req, "INVENTORY_UPDATED", `Updated ${item.itemName} (now ${item.quantity} ${item.unit})`);
  req.session.flash = { type: "success", text: `${item.itemName} updated.` };
  res.redirect("/inventory");
};

export const adjust = async (req, res) => {
  const delta = parseFloat(req.body.delta);
  if (isNaN(delta)) return res.redirect("/inventory");

  const result = await sequelize.transaction(async () => {
    const item = await Inventory.findByPk(req.params.id);
    if (!item) return null;
    const qty = Math.max(0, Math.round((item.quantity + delta) * 1000) / 1000);
    await item.update({ quantity: qty, totalValue: round2(qty * item.unitCost) });
    return { name: item.itemName, unit: item.unit, qty };
  });
  if (!result) return res.redirect("/inventory");

  await logEvent(req, "INVENTORY_ADJUSTED", `Adjusted ${result.name} by ${delta > 0 ? "+" : ""}${delta} ${result.unit} (now ${result.qty})`);
  res.redirect("/inventory");
};

export const remove = async (req, res) => {
  const item = await Inventory.findByPk(req.params.id);
  if (item) {
    removeImage(item.image);
    await item.destroy();
    await logEvent(req, "INVENTORY_DELETED", `Deleted ${item.itemName}`);
    req.session.flash = { type: "success", text: `${item.itemName} deleted.` };
  }
  res.redirect("/inventory");
};

export const history = async (req, res) => {
  const logs = await AuditLog.findAll({
    where: { event: { [Op.in]: ["INVENTORY_ADDED", "INVENTORY_UPDATED", "INVENTORY_ADJUSTED", "INVENTORY_DELETED", "WASTE_LOGGED"] } },
    order: [["timestamp", "DESC"]],
    limit: 300,
    raw: true
  });
  res.render("audit-logs", { title: "History", subtitle: "Every stock change and waste entry, newest first.", nav: { history: true }, logs });
};