/*
  Starting catalogue: 4 categories and 11 products.
  Runs on every start but only fills in what is missing, so changes you make in the admin page are kept.
  Products with mode "quote" are bulk grades sold by price on request. Give one a pack size and price in the
  admin page (Prices and stock) and it becomes buyable online.
*/
const CATEGORIES = [
  { slug: "coffee-powders", name: "Coffee Powders", art: "powder", sort: 1,
    blurb: "Pure Arabica and Robusta coffee powder.",
    description: "Pure coffee powder from our Chikkamagaluru estate, with no chicory and no additives. Made for South Indian filter, French press and pour-over." },
  { slug: "arabica-coffee", name: "Arabica Coffee", art: "cherry", sort: 2,
    blurb: "Plantation A/B, Peaberry and Cherry grades.",
    description: "Arabica grades from our estate in Chikkamagalur, with a smooth body and rich aroma. Sun-dried and export quality, supplied in bulk across India." },
  { slug: "robusta-coffee", name: "Robusta Coffee", art: "bean", sort: 3,
    blurb: "Cherry AB and Kaapi Royale grades.",
    description: "Robusta grades from our estate with a strong body and bold taste. Sun-dried and export quality, supplied in bulk across India." },
  { slug: "black-pepper", name: "Black Pepper", art: "pepper", sort: 4,
    blurb: "Whole dried pepper, plus MG1, TGSEB and FAQ grades.",
    description: "Black pepper from the vines on our estate, with bold aroma and strong pungency. Buy a pack for your kitchen, or ask for a bulk quote on the MG1, TGSEB and FAQ grades." }
];

const ARABICA = "Smooth body, rich aroma", ROBUSTA = "Strong body, bold taste", PEPPER = "Bold aroma, strong pungency";
const BULK = "Bulk and export";

/* Retail products: the first two have prices and are sold online. Robusta powder shows "Price on request" until you add pack sizes in the admin page. */
const RETAIL = [
  { id: "arabica", slug: "arabica-coffee-powder", category: "coffee-powders", tag: "Ground coffee",
    name: "100% Pure Arabica Coffee Powder (Original)", tagline: "Smooth, Aromatic & Low Acidity",
    description: "Pure Arabica coffee powder, smooth and aromatic.\n• Hand-picked ripe Arabica cherries from high-altitude Chikkamagaluru estates.\n• Medium-dark roasted for chocolatey, nutty notes and a rich aroma.\n• 100% pure coffee, zero chicory, zero additives. Ideal for South Indian filter, French press and pour-over." },
  { id: "robusta-powder", slug: "robusta-coffee-powder", category: "coffee-powders", tag: "Ground coffee",
    name: "100% Pure Robusta Coffee Powder (Original)", tagline: "Bold, Strong & Full-Bodied",
    description: "Pure Robusta coffee powder, bold and strong.\n• Sourced from dense, low-elevation Malnad estates for a maximum caffeine kick.\n• Dark roasted for deep, earthy flavor and a thick, velvety crema.\n• Built for those who love an intense, wake-up-call black coffee or a strong milk decoction." },
  { id: "pepper", slug: "black-pepper-whole", category: "black-pepper", tag: "Whole dried peppercorns",
    name: "Sun-Dried Black Peppercorns (Kalumenasu)", tagline: "Bold, Pungent & Naturally Sun-Cured",
    description: "Kalumenasu, whole black pepper grown on our estate.\n• Harvested at peak maturity from vines climbing our shade trees.\n• Naturally sun-dried on clean estate yards to lock in aroma and natural essential oils.\n• Bold, unpolished peppercorns, ideal for spice grinders, rasam and everyday seasoning." }
];

const NEW_PRODUCTS = [
  { id: "arabica-plantation-ab", slug: "arabica-plantation-ab", name: "Arabica Plantation A/B", category: "arabica-coffee", art: "cherry", tag: BULK, tagline: ARABICA, sort: 10,
    description: "Arabica Plantation A/B grades from our estate. Smooth body and rich aroma. Sun-dried and export quality, supplied in bulk across India." },
  { id: "arabica-peaberry", slug: "arabica-peaberry", name: "Arabica Peaberry", category: "arabica-coffee", art: "cherry", tag: BULK, tagline: ARABICA, sort: 11,
    description: "Arabica Peaberry from our estate, the round single-bean grade. Smooth body and rich aroma. Sun-dried and export quality." },
  { id: "arabica-cherry", slug: "arabica-cherry", name: "Arabica Cherry", category: "arabica-coffee", art: "cherry", tag: BULK, tagline: ARABICA, sort: 12,
    description: "Arabica Cherry from our estate. Smooth body and rich aroma. Sun-dried and export quality, supplied in bulk across India." },
  { id: "robusta-cherry-ab", slug: "robusta-cherry-ab", name: "Robusta Cherry AB", category: "robusta-coffee", art: "bean", tag: BULK, tagline: ROBUSTA, sort: 20,
    description: "Robusta Cherry AB from our estate. Strong body and bold taste. Sun-dried and export quality, supplied in bulk across India." },
  { id: "robusta-kaapi-royale", slug: "robusta-kaapi-royale", name: "Robusta Kaapi Royale", category: "robusta-coffee", art: "bean", tag: BULK, tagline: ROBUSTA, sort: 21,
    description: "Kaapi Royale Robusta from our estate. Strong body and bold taste. Sun-dried and export quality, supplied in bulk across India." },
  { id: "pepper-mg1", slug: "black-pepper-mg1", name: "Black Pepper MG1", category: "black-pepper", art: "pepper", tag: BULK, tagline: PEPPER, sort: 30,
    description: "Malabar Garbled 1 (MG1) black pepper from our estate. Bold aroma and strong pungency. Sun-dried and export quality." },
  { id: "pepper-tgseb", slug: "black-pepper-tgseb", name: "Black Pepper TGSEB", category: "black-pepper", art: "pepper", tag: BULK, tagline: PEPPER, sort: 31,
    description: "Tellicherry Garbled Special Extra Bold (TGSEB) black pepper from our estate. Bold aroma and strong pungency. Sun-dried and export quality." },
  { id: "pepper-faq", slug: "black-pepper-faq", name: "Black Pepper FAQ", category: "black-pepper", art: "pepper", tag: BULK, tagline: PEPPER, sort: 32,
    description: "Fair Average Quality (FAQ) black pepper from our estate. Bold aroma and strong pungency. Sun-dried and export quality." }
];

module.exports = function seed(db) {
  db.transaction(() => {
    const addC = db.prepare("INSERT OR IGNORE INTO categories (slug,name,art,blurb,description,sort) VALUES (?,?,?,?,?,?)");
    CATEGORIES.forEach((c) => addC.run(c.slug, c.name, c.art, c.blurb, c.description, c.sort));

    /* Retail products. Their text is managed here, so it is refreshed on every start (prices are not touched). */
    db.prepare("INSERT OR IGNORE INTO products (id,name,tag,art,description,sort,image,slug,category,mode,tagline,moq_kg) VALUES ('robusta-powder','','Ground coffee','bean','',3,'','robusta-coffee-powder','coffee-powders','quote','',5)").run();
    const setP = db.prepare("UPDATE products SET slug=?, category=?, name=?, tagline=?, description=?, tag=? WHERE id=?");
    RETAIL.forEach((r) => setP.run(r.slug, r.category, r.name, r.tagline, r.description, r.tag, r.id));
    const setC = db.prepare("UPDATE categories SET blurb=?, description=? WHERE slug=?");
    CATEGORIES.forEach((c) => setC.run(c.blurb, c.description, c.slug));

    const addP = db.prepare("INSERT OR IGNORE INTO products (id,name,tag,art,description,sort,image,slug,category,mode,tagline,moq_kg) VALUES (?,?,?,?,?,?,'',?,?,'quote',?,100)");
    NEW_PRODUCTS.forEach((p) => addP.run(p.id, p.name, p.tag, p.art, p.description, p.sort, p.slug, p.category, p.tagline));
  })();
};
