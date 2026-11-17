/*
  Store settings. Change these to match your business.
  Secrets (Cashfree keys, admin password) go in the .env file, never here.
*/
const env = process.env;

module.exports = {
  /* ---------- Your business details (shown on the site, in policies and in the footer) ---------- */
  brand: "Bettada Estate",
  phone: "+91 96064 37298",
  phoneTel: "+919606437298",             // used for the tap-to-call link
  whatsapp: "919606437298",              // digits only, with country code. Powers every WhatsApp button
  email: "bettadaestater@gmail.com",
  addressLines: ["Billenahalli, KR Pete", "Chikkamagalur, Karnataka 577133"],
  mapsQuery: "Billenahalli KR Pete Chikkamagalur 577133",
  fssai: "",                             // your FSSAI licence number, shown in the footer once filled in
  gstin: "",                             // optional, shown in the footer once filled in

  isProduction: env.NODE_ENV === "production",
  port: Number(env.PORT) || 3000,
  siteUrl: (env.SITE_URL || "").replace(/\/+$/, ""),   // for example https://www.bettadaestate.in

  cashfree: {
    appId: env.CASHFREE_APP_ID || "",
    secret: env.CASHFREE_SECRET_KEY || "",
    mode: env.CASHFREE_ENV === "production" ? "production" : "sandbox"
  },

  admin: { email: (env.ADMIN_EMAIL || "").toLowerCase(), password: env.ADMIN_PASSWORD || "" },

  /* ---------- Delivery rules ---------- */
  shipping: {
    freeAbove: 1500,          // order value in rupees at or above which delivery is free
    homeState: "Karnataka",
    rates: {                  // rupees per block of weight
      home: 40,               // inside your home state
      south: 70,              // neighbouring southern states and Maharashtra
      rest: 100,              // rest of India
      remote: 150             // North East, Jammu and Kashmir, Ladakh, islands
    },
    kgPerBlock: 2,            // the rate is charged once for every started block of this many kg
    southStates: ["Tamil Nadu", "Kerala", "Andhra Pradesh", "Telangana", "Goa", "Maharashtra", "Puducherry"],
    remoteStates: ["Arunachal Pradesh", "Assam", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Sikkim", "Tripura",
      "Jammu and Kashmir", "Ladakh", "Andaman and Nicobar Islands", "Lakshadweep"]
  },

  bulkMinKg: 100,             // shown as the minimum bulk order on grade pages
  maxQtyPerLine: 20,          // above this the customer is asked to use the bulk enquiry form
  sessionDays: 30
};
