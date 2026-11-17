const crypto = require("crypto");
const db = require("./db");
const cfg = require("./config");
const { fail } = require("./util");

const COOKIE = "be_sid";

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 64);
  return "s1$" + salt.toString("hex") + "$" + key.toString("hex");
}
function checkPassword(pw, stored) {
  const parts = String(stored).split("$");
  if (parts.length !== 3 || parts[0] !== "s1") return false;
  const salt = Buffer.from(parts[1], "hex");
  const want = Buffer.from(parts[2], "hex");
  const got = crypto.scryptSync(pw, salt, want.length);
  return crypto.timingSafeEqual(got, want);
}
const sha = (t) => crypto.createHash("sha256").update(t).digest("hex");

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || "").split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const maxAge = cfg.sessionDays * 86400;
  db.prepare("INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)").run(sha(token), userId, Date.now() + maxAge * 1000);
  res.append("Set-Cookie", COOKIE + "=" + token + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + maxAge + (cfg.isProduction ? "; Secure" : ""));
}
function endSession(req, res) {
  const t = parseCookies(req)[COOKIE];
  if (t) db.prepare("DELETE FROM sessions WHERE token_hash=?").run(sha(t));
  res.append("Set-Cookie", COOKIE + "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" + (cfg.isProduction ? "; Secure" : ""));
}

/* Attach req.user when a valid session cookie is present */
function loadUser(req, res, next) {
  req.user = null;
  const t = parseCookies(req)[COOKIE];
  if (t) {
    const row = db.prepare(
      "SELECT u.id,u.name,u.email,u.phone,u.is_admin,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?"
    ).get(sha(t));
    if (row && row.expires_at > Date.now()) req.user = { id: row.id, name: row.name, email: row.email, phone: row.phone, isAdmin: !!row.is_admin };
  }
  next();
}
const requireUser = (req, res, next) => (req.user ? next() : next(fail(401, "Please log in to continue.")));
const requireAdmin = (req, res, next) => (req.user && req.user.isAdmin ? next() : next(fail(403, "This page is for the store owner.")));

/* Simple in-memory rate limiter: max hits per window per key */
const buckets = new Map();
function limit(name, max, windowMs) {
  return (req, res, next) => {
    const key = name + ":" + req.ip;
    const now = Date.now();
    const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) return next(fail(429, "Too many attempts. Please wait a few minutes and try again."));
    arr.push(now);
    buckets.set(key, arr);
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  buckets.forEach((arr, k) => { if (!arr.some((t) => now - t < 3600000)) buckets.delete(k); });
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
}, 600000).unref();

/* Create or refresh the owner login from ADMIN_EMAIL / ADMIN_PASSWORD */
function seedAdmin() {
  const { email, password } = cfg.admin;
  if (!email || !password) return false;
  const row = db.prepare("SELECT id FROM users WHERE email=?").get(email);
  const h = hashPassword(password);
  if (row) db.prepare("UPDATE users SET pass_hash=?, is_admin=1 WHERE id=?").run(h, row.id);
  else db.prepare("INSERT INTO users (name,email,phone,pass_hash,is_admin) VALUES (?,?,?,?,1)").run("Store owner", email, "0000000000", h);
  return true;
}

module.exports = { hashPassword, checkPassword, startSession, endSession, loadUser, requireUser, requireAdmin, limit, seedAdmin };
