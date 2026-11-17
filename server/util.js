const cfg = require("./config");

const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => new HttpError(status, message);

function str(v, max) { return String(v == null ? "" : v).trim().slice(0, max || 200); }
function cleanPhone(p) {
  let d = String(p || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}
function cleanEmail(e) {
  const v = str(e, 120).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? v : null;
}

function validAddress(a) {
  a = a || {};
  const out = {
    name: str(a.name, 80), phone: cleanPhone(a.phone),
    line1: str(a.line1, 150), line2: str(a.line2, 150),
    city: str(a.city, 60), state: str(a.state, 60), pincode: str(a.pincode, 6)
  };
  if (out.name.length < 2) throw fail(400, "Enter the name of the person receiving the order.");
  if (!out.phone) throw fail(400, "Enter a valid 10 digit mobile number.");
  if (out.line1.length < 5) throw fail(400, "Enter the house number and street.");
  if (out.city.length < 2) throw fail(400, "Enter the city or town.");
  if (STATES.indexOf(out.state) < 0) throw fail(400, "Choose your state.");
  if (!/^[1-9]\d{5}$/.test(out.pincode)) throw fail(400, "Enter a valid 6 digit pincode.");
  return out;
}

/* Delivery: free above the threshold, otherwise a zone rate for every started block of weight. */
function shippingFor(state, subtotal, grams) {
  const s = cfg.shipping;
  if (subtotal >= s.freeAbove) return 0;
  let rate = s.rates.rest;
  if (state === s.homeState) rate = s.rates.home;
  else if (s.southStates.indexOf(state) > -1) rate = s.rates.south;
  else if (s.remoteStates.indexOf(state) > -1) rate = s.rates.remote;
  const blocks = Math.max(1, Math.ceil(grams / (s.kgPerBlock * 1000)));
  return rate * blocks;
}

function orderId() {
  const crypto = require("crypto");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = crypto.randomBytes(6);
  let id = "";
  for (let i = 0; i < 6; i++) id += alphabet[b[i] % alphabet.length];
  return "BE-" + id;
}

module.exports = { STATES, HttpError, fail, str, cleanPhone, cleanEmail, validAddress, shippingFor, orderId };
