// Offline, file-backed database for StockCare.
// No MySQL, no phpMyAdmin, no network connection required.
// All rows live in data/stockcare-db.json next to the app.
// This module exposes the small Sequelize-compatible surface the app actually uses.

import fs from "node:fs";
import { AsyncLocalStorage } from "node:async_hooks";
import { Op, DataTypes } from "sequelize";
import { DATA_DIR, DB_FILE } from "../utils/paths.js";

export const STORAGE_FILE = DB_FILE;

let state = { version: 1, nextId: {}, tables: {} };
let writes = Promise.resolve();

// Serialize read-modify-write work so concurrent requests cannot overwrite each other.
let lock = Promise.resolve();
const transactionScope = new AsyncLocalStorage();

function exclusive(fn) {
  const run = lock.then(fn, fn);
  lock = run.catch(() => {});
  return run;
}

async function withWriteLock(fn) {
  // A real transaction already holds the lock and flushes once at commit.
  if (transactionScope.getStore()) return fn();
  return exclusive(fn);
}

function maybePersist() {
  // A transaction flushes once, after the whole read-modify-write sequence finishes.
  return transactionScope.getStore() ? Promise.resolve() : persist();
}

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function load() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STORAGE_FILE, "utf8"));
    if (parsed && parsed.tables && parsed.nextId) state = { version: 1, ...parsed };
  } catch (err) {
    if (err.code !== "ENOENT") console.warn("Local database could not be read; starting empty:", err.message);
  }
}

function persist() {
  writes = writes.then(async () => {
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    const temp = `${STORAGE_FILE}.${process.pid}.tmp`;
    await fs.promises.writeFile(temp, JSON.stringify(state, null, 2), "utf8");
    await fs.promises.rename(temp, STORAGE_FILE);
  });
  return writes;
}

load();

function looseEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (a instanceof Date || b instanceof Date) return new Date(a).getTime() === new Date(b).getTime();
  return String(a) === String(b);
}

function likePattern(text) {
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return String(text)
    .split("%")
    .map((part) => part.split("_").map(escape).join("."))
    .join(".*");
}

function compareValue(actual, expected) {
  if (expected === null || typeof expected !== "object" || expected instanceof Date) {
    return looseEqual(actual, expected);
  }

  for (const op of [Op.eq, Op.ne, Op.in, Op.notIn, Op.gt, Op.gte, Op.lt, Op.lte, Op.like, Op.notLike]) {
    if (expected[op] === undefined) continue;
    const target = expected[op];
    switch (op) {
      case Op.eq: return looseEqual(actual, target);
      case Op.ne: return !looseEqual(actual, target);
      case Op.in: return Array.isArray(target) && target.some((v) => looseEqual(actual, v));
      case Op.notIn: return Array.isArray(target) && !target.some((v) => looseEqual(actual, v));
      case Op.gt: return Number(actual) > Number(target);
      case Op.gte: return Number(actual) >= Number(target);
      case Op.lt: return Number(actual) < Number(target);
      case Op.lte: return Number(actual) <= Number(target);
      case Op.like: return new RegExp(`^${likePattern(target)}$`, "i").test(String(actual ?? ""));
      case Op.notLike: return !new RegExp(`^${likePattern(target)}$`, "i").test(String(actual ?? ""));
      default: return false;
    }
  }

  return looseEqual(actual, expected);
}

function matches(row, where) {
  if (!where) return true;
  return Object.entries(where).every(([key, condition]) => compareValue(row[key], condition));
}

function looksLikeDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}([T ]|$)/.test(value);
}

function sortRows(rows, order) {
  if (!order || !order.length) return rows;
  const specs = Array.isArray(order[0]) ? order : [order];

  return [...rows].sort((a, b) => {
    for (const [field, direction] of specs) {
      const av = a[field];
      const bv = b[field];
      let result = 0;

      if (av == null && bv == null) result = 0;
      else if (av == null) result = -1;
      else if (bv == null) result = 1;
      else if (looksLikeDate(av) && looksLikeDate(bv)) result = Date.parse(av) - Date.parse(bv);
      else if (typeof av === "number" && typeof bv === "number") result = av - bv;
      else result = String(av).localeCompare(String(bv), undefined, { numeric: true });

      if (result !== 0) {
        return String(direction || "ASC").toUpperCase() === "DESC" ? -result : result;
      }
    }
    return 0;
  });
}

function tableNameFor(name) {
  if (/[^aeiou]y$/i.test(name)) return name.slice(0, -1) + "ies";
  return name + "s";
}

class LocalInstance {
  constructor(model, row) {
    Object.defineProperty(this, "_model", { value: model, enumerable: false });
    Object.defineProperty(this, "_row", { value: row, writable: true, enumerable: false });
    Object.assign(this, row);
  }

  get dataValues() {
    return { ...this._row };
  }

  toJSON() {
    return { ...this._row };
  }

  async update(changes = {}) {
    return withWriteLock(async () => {
      const next = { ...this._row, ...changes };
      if (this._model.options.timestamps !== false) next.updatedAt = new Date().toISOString();
      const saved = this._model._replace(this._row, next);
      if (!saved) throw new Error("Record no longer exists.");
      this._row = saved;
      Object.assign(this, saved);
      await maybePersist();
      return this;
    });
  }

  async destroy() {
    return withWriteLock(async () => {
      const index = this._model.rows.findIndex((row) => row === this._row);
      if (index !== -1) this._model.rows.splice(index, 1);
      await maybePersist();
      return 1;
    });
  }

  async reload() {
    const current = this._model.rows.find((row) => row.id === this._row.id);
    if (!current) throw new Error("Record no longer exists.");
    this._row = current;
    Object.assign(this, current);
    return this;
  }
}

class LocalModel {
  constructor(name, attributes = {}, options = {}) {
    this.name = name;
    this.tableName = options.tableName || tableNameFor(name);
    this.attributes = attributes;
    this.options = options;
    this._ensureTable();
  }

  get rows() {
    return state.tables[this.tableName];
  }

  _ensureTable() {
    if (!state.tables[this.tableName]) state.tables[this.tableName] = [];
    if (state.nextId[this.tableName] == null) state.nextId[this.tableName] = 1;
  }

  _rowWithDefaults() {
    const row = {};
    for (const [key, definition] of Object.entries(this.attributes)) {
      if (!definition || !Object.prototype.hasOwnProperty.call(definition, "defaultValue")) {
        row[key] = null;
        continue;
      }
      const value = definition.defaultValue;
      if (value === DataTypes.NOW) row[key] = new Date().toISOString();
      else if (typeof value === "function") row[key] = value();
      else row[key] = clone(value) ?? null;
    }
    if (this.options.timestamps !== false) {
      const now = new Date().toISOString();
      row.createdAt = now;
      row.updatedAt = now;
    }
    return row;
  }

  _replace(oldRow, nextRow) {
    const index = this.rows.findIndex((row) => row === oldRow || row.id === oldRow.id);
    if (index === -1) return null;
    this.rows[index] = nextRow;
    return nextRow;
  }

  async create(values = {}) {
    return withWriteLock(async () => {
      const row = { ...this._rowWithDefaults(), ...values };
      delete row.id;

      for (const [key, definition] of Object.entries(this.attributes)) {
        if (!definition || !definition.unique) continue;
        if (this.rows.some((existing) => looseEqual(existing[key], row[key]))) {
          const error = new Error(`${key} must be unique.`);
          error.name = "SequelizeUniqueConstraintError";
          throw error;
        }
      }

      if (this.options.timestamps !== false) {
        const now = new Date().toISOString();
        row.createdAt = now;
        row.updatedAt = now;
      }
      row.id = state.nextId[this.tableName]++;
      this.rows.push(row);
      await maybePersist();
      return new LocalInstance(this, row);
    });
  }

  async findOne(options = {}) {
    const row = this.rows.find((candidate) => matches(candidate, options.where));
    if (!row) return null;
    return options.raw ? clone(row) : new LocalInstance(this, row);
  }

  async findByPk(id, options = {}) {
    return this.findOne({ ...options, where: { id } });
  }

  async findAll(options = {}) {
    let rows = this.rows.filter((row) => matches(row, options.where));
    rows = sortRows(rows, options.order);
    if (options.offset) rows = rows.slice(options.offset);
    if (options.limit != null) rows = rows.slice(0, options.limit);
    return options.raw ? rows.map((row) => clone(row)) : rows.map((row) => new LocalInstance(this, row));
  }

  async count(options = {}) {
    return this.rows.filter((row) => matches(row, options.where)).length;
  }

  async sum(field, options = {}) {
    return this.rows
      .filter((row) => matches(row, options.where))
      .reduce((total, row) => total + (Number(row[field]) || 0), 0);
  }

  async destroy(options = {}) {
    return withWriteLock(async () => {
      const kept = this.rows.filter((row) => !matches(row, options.where));
      const removed = this.rows.length - kept.length;
      state.tables[this.tableName] = kept;
      if (removed) await maybePersist();
      return removed;
    });
  }

  async update(values = {}, options = {}) {
    return withWriteLock(async () => {
      let changed = 0;
      for (const row of this.rows) {
        if (!matches(row, options.where)) continue;
        Object.assign(row, values);
        if (this.options.timestamps !== false) row.updatedAt = new Date().toISOString();
        changed++;
      }
      if (changed) await maybePersist();
      return [changed];
    });
  }
}

class LocalSequelize {
  constructor() {
    this.models = {};
  }

  define(name, attributes, options) {
    const model = new LocalModel(name, attributes, options);
    this.models[name] = model;
    return model;
  }

  async authenticate() {
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    return this;
  }

  async sync({ force = false } = {}) {
    return exclusive(async () => {
      await transactionScope.run({ active: true }, async () => {
        if (force) {
          state = { version: 1, nextId: {}, tables: {} };
          for (const model of Object.values(this.models)) {
            state.tables[model.tableName] = [];
            state.nextId[model.tableName] = 1;
          }
        } else {
          for (const model of Object.values(this.models)) model._ensureTable();
        }
      });
      await persist();
      return this;
    });
  }

  async transaction(callback) {
    // Nested transactions just join the outer one.
    if (transactionScope.getStore()) return callback({ isTransaction: true });

    // Serialize the whole read-modify-write sequence against other writers.
    return exclusive(async () => {
      const snapshot = clone(state);
      try {
        const result = await transactionScope.run({ active: true }, () => callback({ isTransaction: true }));
        await persist();
        return result;
      } catch (err) {
        state = snapshot;
        await persist();
        throw err;
      }
    });
  }

  async close() {
    await writes;
  }
}

export const sequelize = new LocalSequelize();
export const DB_CONFIG = { dialect: "local-json", storage: STORAGE_FILE };
export { Op, DataTypes };
