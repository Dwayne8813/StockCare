import { AuditLog } from "../models/auditLogModel.js";

export async function logEvent(req, event, description, username) {
  try {
    await AuditLog.create({
      event,
      description,
      ipAddress: (req.ip || "").replace("::ffff:", ""),
      username: username || (req.session && req.session.username) || "anonymous"
    });
  } catch (e) {
    console.error("Audit log failed:", e.message);
  }
}