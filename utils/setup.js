// Template helpers, per-request template locals, and the error handler.
const CURRENCY = "$"; // change to your local currency symbol

const ymd = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d ? String(d).slice(0, 10) : "");

export function setupApp(app, hbs) {
  hbs.registerHelper("eq", (a, b) => a === b);
  hbs.registerHelper("money", (n) =>
    CURRENCY + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  hbs.registerHelper("fmtDate", (d) => ymd(d) || "-");
  hbs.registerHelper("fmtDateTime", (d) => (d ? new Date(d).toLocaleString() : "-"));
  hbs.registerHelper("stockUnit", (item) => {
    if (!item) return "";
    const amount = item.amountPerUnit;
    if (amount == null || amount === "" || isNaN(Number(amount))) return item.unit || "";
    return `${item.unit || "pcs"} (${amount} ${item.amountUnit || ""} each)`.trim();
  });
  hbs.registerHelper("auditClass", (event) => {
    if (/FAILED/.test(event)) return "badge-red";
    if (event === "LOGIN_SUCCESS" || event === "USER_REGISTERED") return "badge-green";
    if (event === "LOGOUT") return "badge-gray";
    return "badge-blue";
  });

  // One-time flash messages + current user for every view
  app.use((req, res, next) => {
    res.locals.flash = req.session.flash || null;
    delete req.session.flash;
    res.locals.currentUser = req.session.username || null;
    next();
  });
}

export function errorHandler(err, req, res, next) {
  console.error(err);
  res.status(500).send("Something went wrong. Check the terminal for details, then try again.");
}

export { ymd };