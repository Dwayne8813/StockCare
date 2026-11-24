import fs from "fs";
import path from "path";
import multer from "multer";

const uploadDir = path.join(process.cwd(), "public", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
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

// Turns upload errors into a flash message instead of a crash
export function handleUpload(req, res, next) {
  upload.single("image")(req, res, (err) => {
    if (err) {
      req.session.flash = { type: "error", text: err.message };
      return res.redirect(req.get("Referrer") || "/inventory");
    }
    next();
  });
}