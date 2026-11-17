# Bettada Estate online shop

A complete multi-page online shop for your estate's coffee and black pepper. Customers browse collections, open a page for each product, create accounts, add packs to a cart, pay on the site through Cashfree (UPI, cards, netbanking) and see their orders. Businesses can send bulk enquiries. You manage orders, enquiries, messages, prices and stock from an admin page. There is no WhatsApp step in ordering. WhatsApp is only a quick way for visitors to chat with you.

## What is inside

| Part | What it does |
|---|---|
| Pages | Home, Shop (search and filters), Collections, one page per collection, one page per product, Bulk and export, Our grades, About, Questions and answers, Contact |
| Catalogue | 4 collections and 11 products (see below). Each product page has its own address, such as `/products/arabica-peaberry`, so it can be found on Google and shared |
| Buying | Cart, checkout, Cashfree payment, order status page. Orders become "paid" only after the server confirms the payment with Cashfree |
| Bulk and export | Bulk grades show "Price on request" with an enquiry form (business type, state, GST number, quantity). Enquiries arrive in the admin page |
| Accounts | Sign up, log in, saved addresses, order history, change password |
| Delivery | Flat zone rates, free above a set order value. Calculated by the server |
| Admin (`/admin.html`) | Paid orders, status and tracking, bulk enquiries, contact messages, prices and pack sizes for every product |
| Trust pages | Shipping, refunds, privacy and terms pages linked from the footer |
| Search engines | Each page has its own title, description, share image and structured data. `/sitemap.xml` and `/robots.txt` are generated automatically |
| Database | One SQLite file, `data/shop.db` |

## The catalogue

| Collection | Products | How they sell |
|---|---|---|
| Coffee Powders | 100% Pure Arabica Coffee Powder (Original) | Online. 500 g Rs 800, 1 kg Rs 1,500 |
| Coffee Powders | 100% Pure Robusta Coffee Powder (Original) | Price on request until you add pack sizes and prices in the admin page |
| Black Pepper | Sun-Dried Black Peppercorns (Kalumenasu) | Online. 500 g Rs 800, 1 kg Rs 1,500 |
| Black Pepper | MG1, TGSEB, FAQ | Bulk, price on request |
| Arabica Coffee | Plantation A/B, Peaberry, Cherry | Bulk, price on request |
| Robusta Coffee | Cherry AB, Kaapi Royale | Bulk, price on request |

Bulk grades start at 100 kg (change `bulkMinKg` in `server/config.js`). **I did not invent prices.** To sell any grade online, open `/admin.html`, then Prices and stock, and add a pack size and price under that product. The product page turns into a normal "add to cart" page straight away. Remove the last pack size and it goes back to "Price on request".

### Adding a new product or collection

Starting products live in `server/seed.js`. The seed only fills in what is missing, so your admin changes are never overwritten. To add a product, add a line to `NEW_PRODUCTS` (and a collection to `CATEGORIES` if needed), then restart the server. On a live server, restart after deploying.

### Photos

Drop JPG files into these places. No code changes are needed, just refresh the page.

| Photo | File name | Size |
|---|---|---|
| Home page banner picture (top of the home page, links to the shop) | `public/assets/banner-home.jpg` | about 2048 x 1118 |\n| Optional photo behind the green headline section | `public/assets/hero.jpg` | about 1600 x 900, dark or moody works best |
| Arabica powder pouch | `public/assets/products/arabica-coffee-powder.jpg` | about 1000 x 750 |
| Robusta powder pouch | `public/assets/products/robusta-coffee-powder.jpg` | about 1000 x 750 |
| Black pepper pouch | `public/assets/products/black-pepper-whole.jpg` | about 1000 x 750 |
| Any bulk grade | `public/assets/products/<its address>.jpg`, for example `arabica-peaberry.jpg` | about 1000 x 750 |

Until a photo exists the site shows a drawing (and the plain green banner on the home page).

### Product text

The names, taglines and bullet points of the three powder and pepper products are in `server/seed.js` (the `RETAIL` list). Edit the text there and restart the server. Prices are never changed by this; set them in the admin page.

## 1. Run it on your computer (test mode)

1. Install Node.js 22 LTS or newer from nodejs.org.
2. Open this folder in a terminal and run `npm install`.
3. Copy `.env.example` to a new file named `.env`. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
4. Run `npm start` and open http://localhost:3000.

While the Cashfree keys are empty, the shop runs in **test mode**: checkout opens a fake payment page with "successful" and "failed" buttons, and a banner says no money is taken. This only works on your computer. A live server (`NODE_ENV=production`) refuses orders until real Cashfree keys are set.

Log in with your admin email at `/login.html`, then open `/admin.html`.

## 2. Connect Cashfree

1. Create an account at merchant.cashfree.com and complete the business verification. Live payments are switched on only after Cashfree approves it, which can take a few days.
2. In the dashboard open Developers, then API Keys. Use the **Test** keys first.
3. Put them in `.env`:
   ```
   CASHFREE_APP_ID=your app id
   CASHFREE_SECRET_KEY=your secret key
   CASHFREE_ENV=sandbox
   ```
4. Restart the server. The banner disappears and checkout opens Cashfree's own payment page.
5. **Webhook:** in Cashfree, Developers, Webhooks, add `https://YOUR-DOMAIN/api/cashfree/webhook` and turn on the payment events.
6. To go live, put your **Production** keys in `.env` and set `CASHFREE_ENV=production`. Place one small real order and refund it from the Cashfree dashboard.

The payment code follows Cashfree's 2023-08-01 Orders API and the webhook signature check was tested separately, but it has **not been run against Cashfree's servers**, because that needs your keys. Do the sandbox test in step 4 before you take real money.

## 3. Put it on the internet

The shop needs a server that runs Node.js and keeps a small disk for the database. Free static hosts such as Netlify do not work.

**Render (simple)**
1. Put this folder in a GitHub repository. The `.gitignore` keeps `.env` and `data` out.
2. On render.com create a **Web Service**. Build command `npm install`, start command `npm start`.
3. Node version 22 (the `.node-version` file does this). Add a **Disk** (1 GB is plenty) mounted at `/var/data`.
4. In Environment add the values from `.env.example` and also: `NODE_ENV=production`, `DATA_DIR=/var/data`, `TRUST_PROXY=1`, `SITE_URL=https://your-domain`.
5. Add your domain under Custom Domains. HTTPS is automatic.

`SITE_URL` matters: it is used in the sitemap, share links and search-engine tags. Product photos you add to `public/assets/products/` must be committed to the repository to appear on the live site.

Railway, Fly.io and a plain VPS work the same way. The disk holding `DATA_DIR` must persist between restarts or you lose customers and orders. Back up `shop.db` regularly by copying the file.

## 4. Before you launch

- **FSSAI:** put your registration or licence number in `fssai` in `server/config.js`. It then shows in the footer. Selling packed food without it is not allowed. Add your GST number in `gstin` too if you have one.
- **Check every claim on the site is true for you.** The home and About pages say that batches are tested for moisture, bean size and purity, that coffee is roasted in small batches, that the coffee has no chicory or additives, and that you also source from partner planters in Chikkamagaluru. These come from the copy you supplied. Remove or change any line that is not accurate, because food claims can create legal problems.
- **Grade descriptions:** `/grades` explains Plantation A/B, Peaberry, Cherry, Cherry AB, Kaapi Royale, MG1, TGSEB and FAQ in general terms. Read it and correct anything that does not match how you grade and sell. Add exact specifications (moisture, bean size, density) if you want to publish them.
- **Harvest calendar:** the months on `/about` are typical guesses (Arabica Nov to Jan, Robusta Jan to Mar, pepper Dec to Mar). Edit `HARVEST` in `public/js/pages.js`.
- **Policies:** read the shipping, refund, privacy and terms pages once. They are standard starting texts that promise dispatch in 2 to 4 working days, delivery in 3 to 7 working days, and damage reports within 48 hours. Change any promise you cannot keep, and have a lawyer review them. Cashfree checks that these pages exist when it verifies your business.
- Check delivery rates in `server/config.js` against what your courier really charges.
- Add real photos for every product.

## Security notes

- Prices and delivery are always calculated on the server. Changing numbers in the browser has no effect.
- Passwords are stored hashed (scrypt). Login, checkout, enquiries and contact forms are rate limited.
- Card details never touch your server. They go straight to Cashfree.
- The admin page only opens for the account matching `ADMIN_EMAIL`. Use a long password.
- Not included yet: emailed order confirmations and alerts, and password reset by email. Both need an email service such as Brevo or Amazon SES. Check the admin page daily for new enquiries and messages.

## Your business details

Open `server/config.js`. At the top you can change the shop name, phone, WhatsApp number (digits only, with country code), email, address and the Google Maps search text. Everything on the site updates from there. Current values: phone and WhatsApp +91 96064 37298, email bettadaestater@gmail.com, address Billenahalli, KR Pete, Chikkamagalur, Karnataka 577133.

## Files

- `server.js`: web server, page routes, API routes, sitemap
- `server/config.js`: business details, delivery rules, settings
- `server/seed.js`: starting collections and products
- `server/db.js`, `auth.js`, `cashfree.js`, `util.js`, `env.js`: database, accounts, payments, validation
- `public/`: pages (`index.html`, `shop.html`, `collections.html`, `collection.html`, `product.html`, `bulk.html`, `grades.html`, `about.html`, `faq.html`, `contact.html`, checkout, account, order, admin, login and policy pages), `css/styles.css`, `js/` (`shared.js` is the header, footer, cart and helpers; `pages.js` runs the storefront pages) and `assets/`
- `.env.example`: copy to `.env` and fill in
