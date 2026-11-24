import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { handleUpload } from "../middleware/upload.js";
import {
  loginPage, registerPage, forgotPasswordPage, dashboardPage,
  loginUser, registerUser, logoutUser
} from "../controllers/authController.js";
import * as inventory from "../controllers/inventoryController.js";
import * as waste from "../controllers/wasteController.js";
import * as audit from "../controllers/auditController.js";

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get("/", (req, res) => res.redirect(req.session.userId ? "/inventory" : "/login"));

// Auth
router.get("/login", loginPage);
router.post("/login", loginUser);
router.get("/register", registerPage);
router.post("/register", registerUser);
router.get("/forgot-password", forgotPasswordPage);
router.get("/logout", wrap(logoutUser));
router.post("/logout", wrap(logoutUser));
router.get("/dashboard", requireAuth, dashboardPage);

// Inventory
router.get("/inventory", requireAuth, wrap(inventory.dashboard));
router.get("/inventory/add", requireAuth, inventory.addForm);
router.post("/inventory/add", requireAuth, handleUpload, wrap(inventory.create));
router.get("/inventory/edit/:id", requireAuth, wrap(inventory.editForm));
router.post("/inventory/edit/:id", requireAuth, handleUpload, wrap(inventory.update));
router.post("/inventory/adjust/:id", requireAuth, wrap(inventory.adjust));
router.post("/inventory/delete/:id", requireAuth, wrap(inventory.remove));
router.get("/history", requireAuth, wrap(inventory.history));

// Waste + audit
router.get("/waste", requireAuth, wrap(waste.page));
router.post("/waste", requireAuth, wrap(waste.create));
router.get("/audit-logs", requireAuth, wrap(audit.list));

export default router;