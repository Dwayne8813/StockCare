import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { UPLOAD_DIR } from "../utils/paths.js";

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1e6) + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)) return cb(null, true);
    cb(new Error("Only JPG, PNG, GIF or WEBP images are allowed."));
  }
});

// Never redirect to a client-supplied URL. Stay on the form that was posted.
function safeReturnPath(req) {
  const requested = req.path || "";
  return /^\/inventory(?:\/|$)/.test(requested) ? requested : "/inventory";
}

// Turns upload errors into a flash message instead of a crash
export function handleUpload(req, res, next) {
  upload.single("image")(req, res, (err) => {
    if (err) {
      req.session.flash = { type: "error", text: err.message };
      return res.redirect(safeReturnPath(req));
    }
    next();
  });
}
