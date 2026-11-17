/*
  Cashfree Payment Gateway (Orders API, version 2023-08-01).
  Flow: server creates an order and gets a payment_session_id, the browser opens Cashfree checkout with it,
  and the server confirms the result by asking Cashfree directly (never by trusting the browser).
*/
const crypto = require("crypto");
const cfg = require("./config");

const configured = () => !!(cfg.cashfree.appId && cfg.cashfree.secret);
/* Test mode with a fake payment page. Impossible in production. */
const isMock = () => !configured() && !cfg.isProduction;

const base = () => (cfg.cashfree.mode === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg");
const headers = () => ({
  "Content-Type": "application/json",
  "x-api-version": "2023-08-01",
  "x-client-id": cfg.cashfree.appId,
  "x-client-secret": cfg.cashfree.secret
});

async function call(method, path, body) {
  const res = await fetch(base() + path, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) {
    const err = new Error((data && data.message) || "Cashfree error " + res.status);
    err.status = res.status; err.detail = data;
    throw err;
  }
  return data;
}

function createOrder(o) {
  const body = {
    order_id: o.cfRef,
    order_amount: o.amount,
    order_currency: "INR",
    customer_details: { customer_id: o.customerId, customer_name: o.name, customer_email: o.email, customer_phone: o.phone },
    order_meta: { return_url: o.returnUrl },
    order_note: "Order " + o.orderId
  };
  if (o.notifyUrl) body.order_meta.notify_url = o.notifyUrl;
  return call("POST", "/orders", body);
}
const getOrder = (cfRef) => call("GET", "/orders/" + encodeURIComponent(cfRef));
const getPayments = (cfRef) => call("GET", "/orders/" + encodeURIComponent(cfRef) + "/payments");

/* Webhook signature: base64(HMAC_SHA256(timestamp + rawBody, secret)) */
function verifyWebhook(rawBody, signature, timestamp) {
  if (!configured() || !signature || !timestamp) return false;
  const expected = crypto.createHmac("sha256", cfg.cashfree.secret).update(String(timestamp) + rawBody).digest("base64");
  const a = Buffer.from(expected), b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { configured, isMock, createOrder, getOrder, getPayments, verifyWebhook };
