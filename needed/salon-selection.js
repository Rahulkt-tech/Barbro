/** Shared selected-salon state (locator → features → booking) */
const BARBRO_SALON_KEY = "barbro_selected_salon";

function saveSelectedSalon(shop) {
  if (!shop || !shop.name) return;
  localStorage.setItem(BARBRO_SALON_KEY, JSON.stringify(shop));
}

function loadSelectedSalonFromParams() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get("shop");
  if (!name) return null;
  const shop = {
    name: name,
    address: params.get("address") || "",
    lat: params.get("lat") || "",
    lng: params.get("lng") || "",
    type: params.get("type") || "studio",
    service: params.get("service") || "",
  };
  saveSelectedSalon(shop);
  return shop;
}

function getSelectedSalon() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("shop")) {
    return loadSelectedSalonFromParams();
  }
  try {
    const raw = localStorage.getItem(BARBRO_SALON_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function buildBookingUrl(shop) {
  const s = shop || getSelectedSalon();
  if (!s || !s.name) return "booking.html";
  const p = new URLSearchParams({
    shop: s.name,
    address: s.address || "",
  });
  if (s.lat) p.set("lat", s.lat);
  if (s.lng) p.set("lng", s.lng);
  if (s.type) p.set("type", s.type);
  if (s.service) p.set("service", s.service);
  return "booking.html?" + p.toString();
}

function applySelectedSalonBanner(bannerId, nameId, addressId) {
  const shop = getSelectedSalon();
  const banner = document.getElementById(bannerId);
  if (!shop || !banner) return shop;
  banner.style.display = "flex";
  const nameEl = document.getElementById(nameId);
  const addrEl = document.getElementById(addressId);
  if (nameEl) nameEl.textContent = shop.name;
  if (addrEl) addrEl.textContent = shop.address || "Barbro partner studio";
  return shop;
}
