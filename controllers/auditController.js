import { AuditLog } from "../models/auditLogModel.js";

export const list = async (req, res) => {
  const logs = await AuditLog.findAll({ order: [["timestamp", "DESC"]], limit: 500, raw: true });
  res.render("audit-logs", { title: "Security Audit Logs", subtitle: "Authentication and system activity, newest first.", nav: { audit: true }, logs });
};