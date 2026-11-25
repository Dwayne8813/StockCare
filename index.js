/*
    MIT License

    Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
    Mindoro State University - Philippines

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
    */

import express from "express";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import session from "express-session";
import hbs from "hbs";
import router from "./routes/index.js";
import { setupApp, errorHandler } from "./utils/setup.js";
import {
  PUBLIC_DIR, VIEWS_DIR, PARTIALS_DIR, DATA_DIR, SESSION_SECRET_FILE, SERVER_URL_FILE
} from "./utils/paths.js";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

function sessionSecret() {
  if (process.env.STOCKCARE_SESSION_SECRET) return process.env.STOCKCARE_SESSION_SECRET;

  try {
    const saved = fs.readFileSync(SESSION_SECRET_FILE, "utf8").trim();
    if (saved) return saved;
  } catch (err) {
    if (err.code !== "ENOENT") console.warn("Could not read session secret:", err.message);
  }

  const generated = crypto.randomBytes(32).toString("hex");
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SESSION_SECRET_FILE, generated, { mode: 0o600 });
  } catch (err) {
    console.warn("Could not save session secret:", err.message);
  }
  return generated;
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

app.use(session({
  secret: sessionSecret(),
  resave: false,
  saveUninitialized: false
}));

app.engine("xian", (filePath, options, callback) => {
  const originalPartialsDir = hbs.partialsDir;
  hbs.partialsDir = VIEWS_DIR;
  hbs.__express(filePath, options, (err, html) => {
    hbs.partialsDir = originalPartialsDir;
    callback(err, html);
  });
});

app.set("views", VIEWS_DIR);
app.set("view engine", "xian");

// Register partials synchronously, before the server can accept requests.
for (const file of fs.readdirSync(PARTIALS_DIR)) {
  if (!file.endsWith(".xian")) continue;
  const name = file.replace(/\.xian$/, "");
  hbs.registerPartial(name, fs.readFileSync(path.join(PARTIALS_DIR, file), "utf8"));
}

setupApp(app, hbs);

// Pass session username globally
app.use((req, res, next) => {
  res.locals.username = req.session.username || "Chef";
  next();
});

app.use("/", router);
app.use(errorHandler);

export default app;

let resolveReady;
let rejectReady;
export const serverReady = new Promise((resolve, reject) => {
  resolveReady = resolve;
  rejectReady = reject;
});
// Standalone runs have no consumer for this promise; avoid an unhandled rejection.
// Electron's own `await` still receives the rejection.
serverReady.catch(() => {});

function listen(port) {
  const server = app.listen(port, () => {
    const url = `http://localhost:${server.address().port}`;
    console.log(`StockCare running at ${url}`);
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(SERVER_URL_FILE, url, "utf8");
    } catch (err) {
      console.warn("Could not record server URL:", err.message);
    }
    resolveReady(url);
  });

  server.once("error", (err) => {
    if (err.code === "EADDRINUSE" && port < PORT + 20) {
      console.log(`Port ${port} is busy - trying ${port + 1}...`);
      listen(port + 1);
      return;
    }
    const failure = err.code === "EADDRINUSE"
      ? new Error(`No free port found between ${PORT} and ${PORT + 20}.`)
      : err;
    console.error("Could not start StockCare:", failure.message);
    rejectReady(failure);
    process.exitCode = 1;
  });
}

// Always start the local server; both the browser and Electron use it.
listen(PORT);
