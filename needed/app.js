// Barbro — app.js

/* ── NAV SCROLL ── */
window.addEventListener('scroll', () => {
  const nav = document.querySelector('.nav');
  if (window.scrollY > 50) nav.classList.add('scrolled');
  else nav.classList.remove('scrolled');
  updateActiveNav();
});

function updateActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const links = document.querySelectorAll('.nav-link');
  let current = '';
  sections.forEach(s => {
    if (window.scrollY >= s.offsetTop - 120) current = s.id;
  });
  links.forEach(l => {
    l.classList.remove('active');
    if (l.getAttribute('href') === '#' + current) l.classList.add('active');
  });
}

/* ── MULTI-STEP BOOKING ── */
let currentStep = 1;

function nextStep(from) {
  const cur = document.getElementById('step-' + from);
  const nxt = document.getElementById('step-' + (from + 1));
  if (!nxt) return;
  cur.classList.add('hidden');
  nxt.classList.remove('hidden');
  currentStep = from + 1;
  updateStepsBar();
}

function prevStep(from) {
  const cur = document.getElementById('step-' + from);
  const prv = document.getElementById('step-' + (from - 1));
  if (!prv) return;
  cur.classList.add('hidden');
  prv.classList.remove('hidden');
  currentStep = from - 1;
  updateStepsBar();
}

function confirmBooking() {
  document.getElementById('step-4').classList.add('hidden');
  document.getElementById('step-confirm').classList.remove('hidden');
  document.querySelectorAll('.step').forEach(s => s.classList.add('completed'));
}

function updateStepsBar() {
  document.querySelectorAll('.step').forEach(s => {
    const n = parseInt(s.dataset.step);
    s.classList.remove('active', 'completed');
    if (n < currentStep) s.classList.add('completed');
    else if (n === currentStep) s.classList.add('active');
  });
}

/* ── CALENDAR ── */
let calYear = 2026, calMonth = 4; // 0-indexed: 4 = May

function renderCalendar() {
  const grid = document.getElementById('cal-grid');
  const title = document.getElementById('cal-title');
  if (!grid || !title) return;
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  title.textContent = months[calMonth] + ' ' + calYear;
  grid.innerHTML = '';
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrev = new Date(calYear, calMonth, 0).getDate();
  const today = new Date();
  // Prev month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = document.createElement('div');
    d.className = 'cal-day other-month';
    d.textContent = daysInPrev - i;
    grid.appendChild(d);
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const el = document.createElement('div');
    el.className = 'cal-day';
    el.textContent = d;
    const thisDate = new Date(calYear, calMonth, d);
    if (thisDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      el.classList.add('disabled');
    }
    if (d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear()) {
      el.classList.add('today');
    }
    el.addEventListener('click', function() {
      document.querySelectorAll('.cal-day').forEach(x => x.classList.remove('selected'));
      this.classList.add('selected');
    });
    grid.appendChild(el);
  }
  // Next month padding
  const total = firstDay + daysInMonth;
  const remaining = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let i = 1; i <= remaining; i++) {
    const d = document.createElement('div');
    d.className = 'cal-day other-month';
    d.textContent = i;
    grid.appendChild(d);
  }
}

function changeMonth(dir) {
  calMonth += dir;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
}

/* ── TIME SLOT SELECTION ── */
function selectSlot(el) {
  document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
}

/* ── RADIO CHIP STYLING ── */
function initRadioChips() {
  document.querySelectorAll('.radio-chip input').forEach(input => {
    input.addEventListener('change', function() {
      const name = this.name;
      document.querySelectorAll('.radio-chip input[name=' + name + ']').forEach(i => {
        i.closest('.radio-chip').classList.remove('checked');
      });
      this.closest('.radio-chip').classList.add('checked');
    });
  });
}

/* ── CART BUTTON FEEDBACK ── */
function initCartButtons() {
  document.querySelectorAll('.btn-cart').forEach(btn => {
    btn.addEventListener('click', function() {
      const orig = this.textContent;
      this.textContent = 'Added \u2713';
      this.style.background = 'linear-gradient(135deg, #2a8a2a, #4aaa4a)';
      setTimeout(() => {
        this.textContent = orig;
        this.style.background = '';
      }, 1500);
    });
  });
}

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', () => {
  renderCalendar();
  initRadioChips();
  initCartButtons();
  updateStepsBar();
  initMap();
});



/* ── GOOGLE MAPS ── */
const BARBRO_DARK_STYLE = [
  { elementType: "geometry",        stylers: [{ color: "#0d0d0d" }] },
  { elementType: "labels.text.fill",stylers: [{ color: "#555555" }] },
  { elementType: "labels.text.stroke",stylers:[{ color: "#000000" }] },
  { featureType: "road",            elementType: "geometry",       stylers: [{ color: "#1a1a1a" }] },
  { featureType: "road",            elementType: "geometry.stroke",stylers: [{ color: "#000000" }] },
  { featureType: "road",            elementType: "labels.text.fill",stylers:[{ color: "#444444" }] },
  { featureType: "road.highway",    elementType: "geometry",       stylers: [{ color: "#242424" }] },
  { featureType: "road.highway",    elementType: "geometry.stroke",stylers: [{ color: "#111111" }] },
  { featureType: "water",           elementType: "geometry",       stylers: [{ color: "#080808" }] },
  { featureType: "water",           elementType: "labels.text.fill",stylers:[{ color: "#1a1a1a" }] },
  { featureType: "poi",             elementType: "geometry",       stylers: [{ color: "#111111" }] },
  { featureType: "poi.park",        elementType: "geometry",       stylers: [{ color: "#0d1a0d" }] },
  { featureType: "transit",         elementType: "geometry",       stylers: [{ color: "#111111" }] },
  { featureType: "administrative",  elementType: "geometry.stroke",stylers: [{ color: "#2a2a2a" }] },
  { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#333333" }] }
];

let gMap, gService, gInfoWindow;

function initMap() {
  const mapEl = document.getElementById("barbro-map");
  if (!mapEl || typeof google === "undefined") return;

  const defaultLoc = { lat: 9.9312, lng: 76.2673 }; // Kochi

  gMap = new google.maps.Map(mapEl, {
    center: defaultLoc,
    zoom: 13,
    styles: BARBRO_DARK_STYLE,
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false
  });

  gInfoWindow = new google.maps.InfoWindow();

  const input = document.getElementById("locality-input");
  if (!input) return;

  const autocomplete = new google.maps.places.Autocomplete(input, { fields: ["geometry", "name"] });

  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    if (!place.geometry) {
      setMapHint("Location not found. Please select from the dropdown.");
      return;
    }
    gMap.setCenter(place.geometry.location);
    gMap.setZoom(14);
    setMapHint('Searching for salons near "' + place.name + '"...');
    searchSalons(place.geometry.location);
  });

  // Load registered Barbro shops from localStorage
  loadRegisteredShops();
}

window.barbroPartnerMarkers = window.barbroPartnerMarkers || [];

function clearPartnerMarkers() {
  (window.barbroPartnerMarkers || []).forEach(m => m.setMap(null));
  window.barbroPartnerMarkers = [];
}

function partnerMarkerIcon() {
  const starSvg = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">' +
    '<polygon points="14,2 17.5,10.5 27,11.5 20.5,17.5 22.5,27 14,22 5.5,27 7.5,17.5 1,11.5 10.5,10.5" ' +
    'fill="#C9A84C" stroke="#E8C97A" stroke-width="1.5"/>' +
    '</svg>'
  );
  return { url: starSvg, scaledSize: new google.maps.Size(28, 28), anchor: new google.maps.Point(14, 14) };
}

function pinRegisteredShops(shops) {
  if (!gMap || !shops.length) return;

  clearPartnerMarkers();

  shops.forEach(shop => {
    if (shop.lat == null || shop.lng == null) return;
    const pos = { lat: Number(shop.lat), lng: Number(shop.lng) };
    const marker = new google.maps.Marker({
      map: gMap,
      position: pos,
      title: shop.name,
      icon: partnerMarkerIcon(),
      zIndex: 10,
    });

    const content =
      '<div style="font-family:Montserrat,sans-serif;padding:4px 2px;min-width:180px;">' +
      '<div style="font-size:0.55rem;letter-spacing:0.2em;text-transform:uppercase;color:#C9A84C;margin-bottom:4px;">&#9733; Barbro Partner</div>' +
      '<div style="font-family:\'Playfair Display\',serif;font-size:1rem;color:#111;margin-bottom:4px;">' + shop.name + '</div>' +
      '<div style="font-size:0.72rem;color:#555;margin-bottom:4px;">' + (shop.address || '') + '</div>' +
      '<a href="features.html" style="font-size:0.62rem;color:#C9A84C;letter-spacing:0.12em;text-transform:uppercase;">Book Here &#8594;</a>' +
      '</div>';

    marker.addListener('click', () => {
      gInfoWindow.setContent(content);
      gInfoWindow.open(gMap, marker);
    });
    window.barbroPartnerMarkers.push(marker);
  });

  setMapHint(shops.length + ' registered Barbro studio' + (shops.length > 1 ? 's' : '') + ' on the map.');
}

/* ── Load & pin registered shops ── */
async function loadRegisteredShops() {
  let shops = [];
  try {
    const res = await fetch('/api/shops');
    const data = await res.json();
    if (data.success && Array.isArray(data.shops)) {
      shops = data.shops;
    }
  } catch {
    shops = JSON.parse(localStorage.getItem('barbro_shops') || '[]');
  }

  if (!shops.length) {
    setMapHint('No registered salons yet. Shop owners can register on the login page.');
    return;
  }

  pinRegisteredShops(shops);

  const bounds = new google.maps.LatLngBounds();
  shops.forEach(shop => {
    if (shop.lat != null && shop.lng != null) {
      bounds.extend({ lat: Number(shop.lat), lng: Number(shop.lng) });
    }
  });
  if (!bounds.isEmpty()) {
    gMap.fitBounds(bounds, 48);
  }
}

function searchSalons(location) {
  const request = {
    location: location,
    radius: 5000,
    type: "hair_care"
  };

  gService = new google.maps.places.PlacesService(gMap);
  gService.nearbySearch(request, (results, status) => {
    if (status === google.maps.places.PlacesServiceStatus.OK && results.length) {
      results.forEach(place => addSalonMarker(place));
      setMapHint(results.length + " salon" + (results.length > 1 ? "s" : "") + " found near this location.");
    } else {
      setMapHint("No salons found in this area. Try a different location.");
    }
  });
}

function addSalonMarker(place) {
  const goldSvg = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">' +
    '<circle cx="10" cy="10" r="8" fill="#C9A84C" stroke="#E8C97A" stroke-width="2"/>' +
    '</svg>'
  );

  const marker = new google.maps.Marker({
    map: gMap,
    position: place.geometry.location,
    title: place.name,
    icon: { url: goldSvg, scaledSize: new google.maps.Size(20, 20), anchor: new google.maps.Point(10, 10) }
  });

  const rating = place.rating ? '<span style="color:#C9A84C">&#9733; ' + place.rating + '</span>' : '';
  const content =
    '<div style="font-family:Montserrat,sans-serif;padding:4px 2px;min-width:160px;">' +
    '<div style="font-family:\'Playfair Display\',serif;font-size:1rem;color:#fff;margin-bottom:4px;">' + place.name + '</div>' +
    (place.vicinity ? '<div style="font-size:0.72rem;color:#aaa;margin-bottom:4px;">' + place.vicinity + '</div>' : '') +
    (rating ? '<div style="font-size:0.72rem;margin-bottom:4px;">' + rating + '</div>' : '') +
    '<div style="font-size:0.6rem;letter-spacing:0.18em;text-transform:uppercase;color:#C9A84C;">&#10003; Barbro Verified</div>' +
    '</div>';

  marker.addListener("click", () => {
    gInfoWindow.setContent(content);
    gInfoWindow.open(gMap, marker);
  });
}

function setMapHint(msg) {
  const el = document.getElementById("map-search-hint");
  if (el) el.textContent = msg;
}


/* ── AUTH: Role + Tab logic ── */
let currentRole = 'customer';  // 'customer' | 'owner'
let currentTab  = 'login';     // 'login'    | 'register'

function setRole(role) {
  currentRole = role;
  // Highlight pills
  document.getElementById('role-customer-btn').classList.toggle('active', role === 'customer');
  document.getElementById('role-owner-btn').classList.toggle('active', role === 'owner');
  updateFormFields();
}

function setTab(tab) {
  currentTab = tab;
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  // Update button and switch text
  document.getElementById('auth-submit-btn').textContent  = tab === 'login' ? 'Sign In' : 'Create Account';
  document.getElementById('auth-switch-text').textContent = tab === 'login' ? "Don't have an account?" : 'Already have an account?';
  document.getElementById('auth-switch-btn').textContent  = tab === 'login' ? 'Register here' : 'Sign in';
  document.getElementById('forgot-hint').style.display    = tab === 'login' ? 'block' : 'none';
  document.getElementById('auth-message').textContent = '';
  updateFormFields();
}

function toggleTab() {
  setTab(currentTab === 'login' ? 'register' : 'login');
}

function updateFormFields() {
  const isRegister = currentTab === 'register';
  const isCustomer = currentRole === 'customer';

  // Customer-only register fields
  document.getElementById('f-username').style.display = (isRegister && isCustomer)  ? 'flex' : 'none';
  document.getElementById('f-age').style.display      = (isRegister && isCustomer)  ? 'flex' : 'none';
  // Owner-only register fields
  document.getElementById('f-shopname').style.display = (isRegister && !isCustomer) ? 'flex' : 'none';
  document.getElementById('f-location').style.display = (isRegister && !isCustomer) ? 'flex' : 'none';
}

function showForgot() {
  document.getElementById('auth-message').textContent = 'Password reset link sent to your email.';
}

function handleAuth(e) {
  e.preventDefault();
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const msg      = document.getElementById('auth-message');

  if (currentTab === 'register') {
    if (currentRole === 'customer') {
      const username = document.getElementById('auth-username').value.trim();
      const age      = document.getElementById('auth-age').value;
      if (!username || !age) { msg.textContent = 'Please fill in all fields.'; return; }
      
      // Register customer to database
      fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'customer',
          name: username,
          age: parseInt(age),
          email: email,
          password: password
        })
      }).then(r => r.json())
        .then(data => {
          if (data.success) {
            msg.textContent = 'Account created! Redirecting…';
            setTimeout(() => { window.location.href = 'services.html'; }, 900);
          } else {
            msg.textContent = data.message || 'Registration failed.';
          }
        })
        .catch(() => { msg.textContent = 'Network error. Please try again.'; });

    } else {
      // Shop Owner registration — geocode the location and save to database
      const shopname = document.getElementById('auth-shopname').value.trim();
      const location = document.getElementById('auth-location').value.trim();
      if (!shopname || !location) { msg.textContent = 'Please fill in all fields.'; return; }

      msg.textContent = 'Geocoding your location…';
      document.getElementById('auth-submit-btn').disabled = true;

      // Use Nominatim to geocode the shop location
      fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(location))
        .then(r => r.json())
        .then(data => {
          if (!data.length) {
            document.getElementById('auth-submit-btn').disabled = false;
            msg.textContent = 'Location not found. Please enter a more specific address.';
            return;
          }

          // Register shop owner to database
          fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role: 'shopowner',
              shopName: shopname,
              location: location,
              email: email,
              password: password
            })
          }).then(r => r.json())
            .then(regData => {
              document.getElementById('auth-submit-btn').disabled = false;
              if (regData.success) {
                // Also save to localStorage and register_shop for backward compatibility
                const lat = parseFloat(data[0].lat);
                const lng = parseFloat(data[0].lon);
                
                const newShop = {
                  id       : Date.now(),
                  name     : shopname,
                  address  : location,
                  email    : email,
                  lat      : lat,
                  lng      : lng,
                  verified : false,
                  addedAt  : new Date().toISOString()
                };

                // Save shop to localStorage
                const shops = JSON.parse(localStorage.getItem('barbro_shops') || '[]');
                shops.push(newShop);
                localStorage.setItem('barbro_shops', JSON.stringify(shops));

                msg.textContent = shopname + ' registered at ' + location + '! Redirecting…';
                setTimeout(() => { window.location.href = 'services.html'; }, 1200);
              } else {
                msg.textContent = regData.message || 'Registration failed.';
              }
            })
            .catch(() => {
              document.getElementById('auth-submit-btn').disabled = false;
              msg.textContent = 'Could not save shop to database. Please try again.';
            });
        })
        .catch(() => {
          document.getElementById('auth-submit-btn').disabled = false;
          msg.textContent = 'Could not verify location. Please try again.';
        });
    }
  } else {
    // Login
    fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: currentRole,
        email: email,
        password: password
      })
    }).then(r => r.json())
      .then(data => {
        if (data.success) {
          const label = currentRole === 'customer' ? 'Welcome back!' : 'Shop Owner signed in.';
          msg.textContent = label + ' Redirecting…';
          setTimeout(() => { window.location.href = 'services.html'; }, 900);
        } else {
          msg.textContent = data.message || 'Login failed.';
        }
      })
      .catch(() => { msg.textContent = 'Network error. Please try again.'; });
  }
}

// Init on load
document.addEventListener('DOMContentLoaded', () => {
  updateFormFields();
});
