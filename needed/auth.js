const authState = {
  role: "customer",
  mode: "login",
};

const $ = id => document.getElementById(id);

function updateUI() {
  const roleText = authState.role === "shopowner" ? "Shop Owner" : "Customer";
  const modeText = authState.mode === "register" ? "Create New Account" : "Login";
  $("auth-heading").textContent = `${roleText} ${modeText}`;
  $("auth-submit-btn").textContent = authState.mode === "register" ? "Create Account" : "Sign In";

  $("role-customer-btn").classList.toggle("active", authState.role === "customer");
  $("role-owner-btn").classList.toggle("active", authState.role === "shopowner");

  const showRegister = authState.mode === "register";
  document.querySelectorAll(".role-register-only").forEach(el => {
    el.classList.toggle("hidden", !showRegister);
  });
  document.querySelectorAll(".role-customer-only").forEach(el => {
    el.classList.toggle("hidden", !(showRegister && authState.role === "customer"));
  });
  document.querySelectorAll(".role-owner-only").forEach(el => {
    el.classList.toggle("hidden", !(showRegister && authState.role === "shopowner"));
  });

  const forgot = $("forgot-hint");
  if (forgot) forgot.style.display = authState.mode === "login" ? "" : "none";

  if (showRegister && authState.role === "shopowner") {
    scheduleShopMapInit();
  }

  const toggleText = authState.mode === "login"
    ? "No account yet?"
    : "Already have an account?";
  const buttonLabel = authState.mode === "login" ? "Create Account" : "Sign In";
  $("auth-switch-text").innerHTML =
    `${toggleText} <button type="button" class="gold-link btn-link" id="toggle-register">${buttonLabel}</button>`;
}

function handleToggleClick(event) {
  if (event.target && event.target.id === "toggle-register") {
    setMode(authState.mode === "login" ? "register" : "login");
  }
}

function setRole(role) {
  authState.role = role === "shopowner" ? "shopowner" : "customer";
  updateUI();
  showMessage("", "");
}

function setMode(mode) {
  authState.mode = mode === "register" ? "register" : "login";
  updateUI();
  showMessage("", "");
}

function showMessage(text, type = "") {
  const el = $("auth-message");
  if (!el) return;
  el.textContent = text;
  el.className = "auth-message" + (type ? ` ${type}` : "");
}

function getFormValue(id) {
  const el = $(id);
  return el ? el.value.trim() : "";
}

let shopMap;
let shopMarker;
let mapInitTimer;

function isMapPanelVisible() {
  const card = $("shop-map-card");
  return card && !card.classList.contains("hidden");
}

function scheduleShopMapInit() {
  clearTimeout(mapInitTimer);
  mapInitTimer = setTimeout(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => initShopOwnerMap(0));
    });
  }, 50);
}

function showMapLoadError(mapContainer, message) {
  mapContainer.innerHTML =
    `<p class="map-load-fallback">${message}</p>`;
}

function initShopOwnerMap(retry) {
  const mapContainer = $("shop-location-map");
  if (!mapContainer || !isMapPanelVisible()) return;

  if (typeof L === "undefined") {
    if (retry < 25) {
      return setTimeout(() => initShopOwnerMap(retry + 1), 120);
    }
    return showMapLoadError(
      mapContainer,
      "Map library failed to load. Refresh the page or check your connection."
    );
  }

  const height = mapContainer.offsetHeight;
  if (height < 80 && retry < 20) {
    return setTimeout(() => initShopOwnerMap(retry + 1), 80);
  }

  if (!shopMap) {
    mapContainer.innerHTML = "";
    shopMap = L.map(mapContainer, {
      center: [20.5937, 78.9629],
      zoom: 5,
      scrollWheelZoom: true,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(shopMap);

    shopMap.on("click", onShopMapClick);
  }

  shopMap.invalidateSize(true);
  setTimeout(() => shopMap && shopMap.invalidateSize(true), 200);
  setTimeout(() => shopMap && shopMap.invalidateSize(true), 500);
}

function onShopMapClick(event) {
  const { lat, lng } = event.latlng;
  if (!shopMarker) {
    shopMarker = L.marker([lat, lng], { draggable: true }).addTo(shopMap);
    shopMarker.on("dragend", e => {
      const pos = e.target.getLatLng();
      updateShopLocation(pos.lat, pos.lng);
    });
  } else {
    shopMarker.setLatLng([lat, lng]);
  }
  updateShopLocation(lat, lng);
}

function updateShopMarkerPopup() {
  if (!shopMarker) return;
  const shopName = getFormValue("auth-shop-name") || "Your salon";
  shopMarker.bindPopup(`<strong>${escapeHtml(shopName)}</strong>`).openPopup();
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function updateShopLocation(lat, lon) {
  $("auth-shop-lat").value = lat.toFixed(6);
  $("auth-shop-lng").value = lon.toFixed(6);

  const locationInput = $("auth-shop-location");
  if (locationInput) {
    locationInput.value = `Loading address for ${lat.toFixed(4)}, ${lon.toFixed(4)}…`;
  }

  updateShopMarkerPopup();

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
    );
    const json = await response.json();
    const address = json.display_name || `Lat ${lat.toFixed(4)}, Lon ${lon.toFixed(4)}`;
    if (locationInput) locationInput.value = address;
  } catch {
    if (locationInput) locationInput.value = `Lat ${lat.toFixed(4)}, Lon ${lon.toFixed(4)}`;
  }
}

function resetShopMap() {
  if (shopMarker && shopMap) {
    shopMap.removeLayer(shopMarker);
    shopMarker = null;
  }
  $("auth-shop-lat").value = "";
  $("auth-shop-lng").value = "";
  const loc = $("auth-shop-location");
  if (loc) loc.value = "";
}

async function handleSubmit(event) {
  event.preventDefault();
  showMessage("", "");
  if (authState.mode === "login") {
    await loginUser();
  } else {
    await registerUser();
  }
}

async function loginUser() {
  const email = getFormValue("auth-email");
  const password = getFormValue("auth-password");
  if (!email || !password) {
    return showMessage("Please enter both email and password.", "error");
  }

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: authState.role, email, password }),
    });
    const result = await res.json();
    if (!result.success) {
      return showMessage(result.message || "Login failed.", "error");
    }
    showMessage(result.message || "Welcome back!", "success");
    setTimeout(() => { window.location.href = "services.html"; }, 900);
  } catch {
    showMessage("Unable to reach the server. Try again.", "error");
  }
}

async function registerUser() {
  const email = getFormValue("auth-email");
  const password = getFormValue("auth-password");
  if (!email || !password) {
    return showMessage("Email and password are required.", "error");
  }

  const payload = { role: authState.role, email, password };

  if (authState.role === "customer") {
    const username = getFormValue("auth-username");
    const age = parseInt(getFormValue("auth-age"), 10);
    if (!username) {
      return showMessage("Please enter your username.", "error");
    }
    if (!age || age < 13 || age > 120) {
      return showMessage("Please enter a valid age (13–120).", "error");
    }
    payload.name = username;
    payload.age = age;
  } else {
    const shopName = getFormValue("auth-shop-name");
    const location = getFormValue("auth-shop-location");
    const latitude = parseFloat(getFormValue("auth-shop-lat"));
    const longitude = parseFloat(getFormValue("auth-shop-lng"));
    if (!shopName) {
      return showMessage("Please enter your shop name.", "error");
    }
    if (!location || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return showMessage("Please select your shop location on the map before registering.", "error");
    }
    payload.shopName = shopName;
    payload.location = location;
    payload.latitude = latitude;
    payload.longitude = longitude;
  }

  $("auth-submit-btn").disabled = true;
  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!result.success) {
      return showMessage(result.message || "Registration failed.", "error");
    }

    if (authState.role === "shopowner") {
      const shopName = getFormValue("auth-shop-name");
      const lat = parseFloat(getFormValue("auth-shop-lat"));
      const lng = parseFloat(getFormValue("auth-shop-lng"));
      const shops = JSON.parse(localStorage.getItem("barbro_shops") || "[]");
      shops.push({
        id: Date.now(),
        name: shopName,
        address: getFormValue("auth-shop-location"),
        email,
        lat,
        lng,
        verified: false,
        addedAt: new Date().toISOString(),
      });
      localStorage.setItem("barbro_shops", JSON.stringify(shops));
    }

    showMessage(result.message || "Account created successfully.", "success");
    $("auth-form").reset();
    resetShopMap();
    setTimeout(() => { window.location.href = "services.html"; }, 1000);
  } catch {
    showMessage("Unable to reach the server. Try again.", "error");
  } finally {
    $("auth-submit-btn").disabled = false;
  }
}

function showForgot() {
  showMessage("Password reset link sent to your email.", "success");
}

function initAuth() {
  $("role-customer-btn").addEventListener("click", () => setRole("customer"));
  $("role-owner-btn").addEventListener("click", () => setRole("shopowner"));
  $("auth-form").addEventListener("submit", handleSubmit);
  $("auth-switch-text").addEventListener("click", handleToggleClick);

  const shopNameInput = $("auth-shop-name");
  if (shopNameInput) {
    shopNameInput.addEventListener("input", updateShopMarkerPopup);
  }

  updateUI();
}

document.addEventListener("DOMContentLoaded", initAuth);
