// server.js — Barbro local dev server with auth and SQLite storage
// Run: npm install
// Then run: node server.js
// Open: http://localhost:3000

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sqlite3 = require("sqlite3").verbose();
const https = require("https");
const httpProxy = require("http-proxy");

const PORT = 3000;
const STREAMLIT_PORT = 8503;
const STREAMLIT_TARGET = `http://127.0.0.1:${STREAMLIT_PORT}`;
const ROOT = __dirname;
const CUSTOMER_DB = path.join(ROOT, "customers.db");
const OWNER_DB = path.join(ROOT, "shopowners.db");

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".wasm": "application/wasm",
};

const customerDb = new sqlite3.Database(CUSTOMER_DB);
const ownerDb = new sqlite3.Database(OWNER_DB);

const streamlitProxy = httpProxy.createProxyServer({
  target: STREAMLIT_TARGET,
  ws: true,
  changeOrigin: true,
});

streamlitProxy.on("error", (err, req, res) => {
  console.error("Streamlit proxy error:", err.message);
  if (res && !res.headersSent && res.writeHead) {
    res.writeHead(502, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      "<html><body style='font-family:sans-serif;background:#111;color:#ccc;padding:2rem'>" +
      "<h2 style='color:#C9A84C'>Salon locator offline</h2>" +
      "<p>Start Streamlit in the Barbro folder:</p>" +
      "<pre style='color:#E8C97A'>streamlit run app.py</pre>" +
      "<p>Then refresh this page.</p></body></html>"
    );
  }
});

function isStreamlitProxyPath(urlPath) {
  return urlPath === "/locator" || urlPath.startsWith("/locator/");
}

function proxyToStreamlit(req, res) {
  streamlitProxy.web(req, res, { target: STREAMLIT_TARGET });
}

function initDatabase() {
  customerDb.run(
    `CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`
  );

  ownerDb.run(
    `CREATE TABLE IF NOT EXISTS shopowners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_name TEXT NOT NULL,
      location TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`
  );

  ownerDb.all("PRAGMA table_info(shopowners)", (err, columns) => {
    if (err || !columns) return;
    const names = columns.map(c => c.name);
    if (!names.includes("latitude")) {
      ownerDb.run("ALTER TABLE shopowners ADD COLUMN latitude REAL");
    }
    if (!names.includes("longitude")) {
      ownerDb.run("ALTER TABLE shopowners ADD COLUMN longitude REAL");
    }
  });
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

/** COEP only on AR filter page (needs isolated context for WASM). */
function staticFileHeaders(resolvedPath) {
  const ext = path.extname(resolvedPath).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";
  const headers = { "Content-Type": mime };
  if (path.basename(resolvedPath) === "filter.html") {
    headers["Cross-Origin-Opener-Policy"] = "same-origin";
    headers["Cross-Origin-Embedder-Policy"] = "require-corp";
  }
  if (ext === ".html") {
    headers["Cache-Control"] = "no-cache";
  }
  return headers;
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function safeFilePath(urlPath) {
  const sanitized = urlPath.replace(/^\/+/, "").replace(/\.\.(\/|\\)/g, "");
  const resolved = path.join(ROOT, sanitized);
  if (!resolved.startsWith(ROOT)) return null;
  return resolved;
}

// ── Geocode location to lat/lon using Nominatim ──
function geocodeLocation(locationText) {
  return new Promise((resolve) => {
    const query = encodeURIComponent(locationText);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
    
    https.get(url, { headers: { "User-Agent": "Barbro/1.0" } }, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        try {
          const results = JSON.parse(data);
          if (results.length > 0) {
            const lat = parseFloat(results[0].lat);
            const lon = parseFloat(results[0].lon);
            resolve({ lat, lon, success: true });
          } else {
            resolve({ success: false, message: "Location not found" });
          }
        } catch (err) {
          resolve({ success: false, message: "Geocoding error" });
        }
      });
    }).on("error", () => {
      resolve({ success: false, message: "Network error" });
    });
  });
}

function handleRegister(body, res) {
  const role = body.role === "shopowner" ? "shopowner" : "customer";
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!email || !password) {
    return sendJson(res, 400, { success: false, message: "Email and password are required." });
  }

  const passwordHash = hashPassword(password);
  if (role === "customer") {
    const name = String(body.name || "").trim();
    const age = parseInt(body.age, 10);
    if (!name || !age) {
      return sendJson(res, 400, { success: false, message: "Username and age are required for customer registration." });
    }
    customerDb.get("SELECT id FROM customers WHERE email = ?", email, (err, row) => {
      if (err) return sendJson(res, 500, { success: false, message: "Database error." });
      if (row) return sendJson(res, 409, { success: false, message: "A customer account already exists with this email." });
      customerDb.run(
        "INSERT INTO customers (name, age, email, password_hash) VALUES (?, ?, ?, ?)",
        [name, age, email, passwordHash],
        function (insertErr) {
          if (insertErr) return sendJson(res, 500, { success: false, message: "Database error." });
          sendJson(res, 201, { success: true, message: "Customer account created successfully." });
        }
      );
    });
  } else {
    const shopName = String(body.shopName || "").trim();
    const location = String(body.location || "").trim();

    if (!shopName || !location) {
      return sendJson(res, 400, { success: false, message: "Shop name and map location are required for shop owner registration." });
    }

    const latitude = Number.isFinite(body.latitude) ? body.latitude : parseFloat(body.latitude);
    const longitude = Number.isFinite(body.longitude) ? body.longitude : parseFloat(body.longitude);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return sendJson(res, 400, { success: false, message: "Please select your shop location on the map." });
    }

    ownerDb.get("SELECT id FROM shopowners WHERE email = ?", email, (err, row) => {
      if (err) {
        console.error("DB error checking email:", err);
        return sendJson(res, 500, { success: false, message: "Database error." });
      }
      if (row) return sendJson(res, 409, { success: false, message: "A shop owner account already exists with this email." });

      const saveWithCoordinates = !Number.isNaN(latitude) && !Number.isNaN(longitude);
      const saveLocation = async () => {
        const lat = saveWithCoordinates ? latitude : null;
        const lon = saveWithCoordinates ? longitude : null;
        ownerDb.run(
          "INSERT INTO shopowners (shop_name, location, latitude, longitude, email, password_hash) VALUES (?, ?, ?, ?, ?, ?)",
          [shopName, location, lat, lon, email, passwordHash],
          function (insertErr) {
            if (insertErr) {
              console.error("DB insert error:", insertErr);
              return sendJson(res, 500, { success: false, message: "Database error." });
            }
            const geoMsg = lat && lon ? ` Location: ${lat.toFixed(4)}, ${lon.toFixed(4)}.` : "";
            sendJson(res, 201, { success: true, message: "Shop owner account created successfully." + geoMsg });
          }
        );
      };

      if (saveWithCoordinates) {
        saveLocation();
      } else {
        geocodeLocation(location).then(geoResult => {
          const lat = geoResult.lat || null;
          const lon = geoResult.lon || null;
          ownerDb.run(
            "INSERT INTO shopowners (shop_name, location, latitude, longitude, email, password_hash) VALUES (?, ?, ?, ?, ?, ?)",
            [shopName, location, lat, lon, email, passwordHash],
            function (insertErr) {
              if (insertErr) {
                console.error("DB insert error:", insertErr);
                return sendJson(res, 500, { success: false, message: "Database error." });
              }
              const geoMsg = lat && lon ? ` Location: ${lat.toFixed(4)}, ${lon.toFixed(4)}.` : "";
              sendJson(res, 201, { success: true, message: "Shop owner account created successfully." + geoMsg });
            }
          );
        }).catch(err => {
          console.error("Geocoding error:", err);
          saveLocation();
        });
      }
    });
  }
}

function handleGetShops(res) {
  ownerDb.all(
    `SELECT shop_name, location, latitude, longitude, email, created_at
     FROM shopowners
     WHERE latitude IS NOT NULL AND longitude IS NOT NULL
     ORDER BY created_at DESC`,
    (err, rows) => {
      if (err) {
        console.error("DB error loading shops:", err);
        return sendJson(res, 500, { success: false, message: "Database error." });
      }
      const shops = (rows || []).map(row => ({
        name: row.shop_name,
        address: row.location,
        lat: row.latitude,
        lng: row.longitude,
        email: row.email,
        verified: true,
      }));
      sendJson(res, 200, { success: true, shops });
    }
  );
}

function handleLogin(body, res) {
  const role = body.role === "shopowner" ? "shopowner" : "customer";
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!email || !password) {
    return sendJson(res, 400, { success: false, message: "Email and password are required." });
  }

  const passwordHash = hashPassword(password);
  const db = role === "shopowner" ? ownerDb : customerDb;
  const table = role === "shopowner" ? "shopowners" : "customers";

  db.get(`SELECT * FROM ${table} WHERE email = ?`, email, (err, row) => {
    if (err) return sendJson(res, 500, { success: false, message: "Database error." });
    if (!row) return sendJson(res, 401, { success: false, message: "Invalid email or password." });
    if (row.password_hash !== passwordHash) {
      return sendJson(res, 401, { success: false, message: "Invalid email or password." });
    }
    const label = role === "shopowner" ? row.shop_name : row.name;
    const displayName = label || (role === "shopowner" ? "shop owner" : "customer");
    sendJson(res, 200, {
      success: true,
      message: `Welcome back, ${displayName}!`,
    });
  });
}

const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split("?")[0];

  if (isStreamlitProxyPath(urlPath)) {
    return proxyToStreamlit(req, res);
  }

  if (urlPath.startsWith("/api/")) {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      return res.end();
    }

    try {
      if (urlPath === "/api/shops" && req.method === "GET") {
        return handleGetShops(res);
      }

      const body = await parseJsonBody(req);
      if (urlPath === "/api/register" && req.method === "POST") {
        return handleRegister(body, res);
      }
      if (urlPath === "/api/register_shop" && req.method === "POST") {
        const shopsFile = path.join(ROOT, "barbro_shops.json");
        let shops = [];
        try {
          if (fs.existsSync(shopsFile)) {
            shops = JSON.parse(fs.readFileSync(shopsFile, "utf8"));
          }
        } catch (err) {}
        shops.push(body);
        fs.writeFileSync(shopsFile, JSON.stringify(shops, null, 2));
        return sendJson(res, 201, { success: true });
      }
      if (urlPath === "/api/login" && req.method === "POST") {
        return handleLogin(body, res);
      }
      return sendJson(res, 404, { success: false, message: "API route not found." });
    } catch (err) {
      return sendJson(res, 400, { success: false, message: "Invalid JSON body." });
    }
  }

  let filePath = urlPath === "/" || urlPath === "" ? "/index.html" : urlPath;
  const resolvedPath = safeFilePath(filePath);
  if (!resolvedPath) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    return res.end("400 Bad Request");
  }

  fs.readFile(resolvedPath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("404 Not Found: " + filePath);
    }

    res.writeHead(200, staticFileHeaders(resolvedPath));
    res.end(data);
  });
});

initDatabase();

server.on("upgrade", (req, socket, head) => {
  const urlPath = (req.url || "").split("?")[0];
  if (isStreamlitProxyPath(urlPath)) {
    streamlitProxy.ws(req, socket, head, { target: STREAMLIT_TARGET });
  }
});

server.listen(PORT, () => {
  console.log("\n  ╔══════════════════════════════════════╗");
  console.log("  ║   BARBRO local server running        ║");
  console.log("  ║   http://localhost:" + PORT + "              ║");
  console.log("  ║                                      ║");
  console.log("  ║   Salon map (required):              ║");
  console.log("  ║   streamlit run app.py               ║");
  console.log("  ║   → embedded at /locator/            ║");
  console.log("  ║   Press Ctrl+C to stop.              ║");
  console.log("  ╚══════════════════════════════════════╝\n");
});
