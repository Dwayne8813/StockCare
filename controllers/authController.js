import bcrypt from "bcrypt";
import { User } from "../models/userModel.js";
import { logEvent } from "../utils/audit.js";

export const loginPage = (req, res) => {
  if (req.session.userId) return res.redirect("/inventory");
  res.render("login", { title: "Login" });
};

export const registerPage = (req, res) => {
  if (req.session.userId) return res.redirect("/inventory");
  res.render("register", { title: "Register" });
};

export const forgotPasswordPage = (req, res) => res.render("forgotpassword", { title: "Forgot Password" });

export const dashboardPage = (req, res) => res.redirect("/inventory");

export const loginUser = async (req, res) => {
  const username = (req.body.username || "").trim();
  const password = req.body.password || "";
  try {
    const user = username ? await User.findOne({ where: { username } }) : null;
    const ok = user ? await bcrypt.compare(password, user.password) : false;

    if (!ok) {
      await logEvent(req, "LOGIN_FAILED", `Failed login attempt for "${username || "empty"}"`, username || "anonymous");
      return res.status(401).render("login", { title: "Login", error: "Invalid username or password.", username });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.save(async (err) => {
      if (err) {
        console.error(err);
        return res.status(500).render("login", { title: "Login", error: "Could not start your session. Try again." });
      }
      await logEvent(req, "LOGIN_SUCCESS", `${user.username} signed in`, user.username);
      res.redirect("/inventory");
    });
  } catch (e) {
    console.error(e);
    res.status(500).render("login", { title: "Login", error: "Server error. Check the terminal and try again.", username });
  }
};

export const registerUser = async (req, res) => {
  const username = (req.body.username || "").trim();
  const { password, confirm } = req.body;
  let error = null;
  try {
    if (!/^[A-Za-z0-9_.-]{3,30}$/.test(username)) error = "Username must be 3-30 characters (letters, numbers, . _ -).";
    else if (!password || password.length < 6) error = "Password must be at least 6 characters.";
    else if (password !== confirm) error = "Passwords do not match.";
    else if (await User.findOne({ where: { username } })) error = "That username is already taken.";

    if (error) return res.status(400).render("register", { title: "Register", error, username });

    const hashed = await bcrypt.hash(password, 10);
    await User.create({ username, password: hashed });
    await logEvent(req, "USER_REGISTERED", `New user registered: ${username}`, username);
    req.session.flash = { type: "success", text: "Account created. You can sign in now." };
    res.redirect("/login");
  } catch (e) {
    console.error(e);
    res.status(500).render("register", { title: "Register", error: "Server error. Check the terminal and try again.", username });
  }
};

export const logoutUser = async (req, res) => {
  const username = req.session.username;
  if (username) await logEvent(req, "LOGOUT", `${username} signed out`, username);
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
};