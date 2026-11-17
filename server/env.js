// Tiny .env loader (no extra dependency). Real environment variables always win.
const fs = require("fs");
const path = require("path");
try {
  const file = path.join(__dirname, "..", ".env");
  if (fs.existsSync(file)) {
    fs.readFileSync(file, "utf8").split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m || line.trim().startsWith("#")) return;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    });
  }
} catch (e) { /* ignore */ }
