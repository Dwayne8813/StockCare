// Project-relative paths. Nothing here depends on the directory the app was launched from.
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = path.resolve(here, "..");
export const VIEWS_DIR = path.join(PROJECT_ROOT, "views");
export const PARTIALS_DIR = path.join(VIEWS_DIR, "partials");
export const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");
export const UPLOAD_DIR = path.join(PUBLIC_DIR, "uploads");

// Allows a packaged desktop build to keep data in a writable location.
export const DATA_DIR = path.resolve(process.env.STOCKCARE_DATA_DIR || path.join(PROJECT_ROOT, "data"));
export const SESSION_SECRET_FILE = path.join(DATA_DIR, "session-secret.txt");
export const SERVER_URL_FILE = path.join(DATA_DIR, "server-url.txt");
