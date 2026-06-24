"""
Barbro Smart Salon Locator — Streamlit + GeoPandas + Folium
Run: streamlit run app.py
Embed: location.html loads http://localhost:8503/?embed=1
"""
import json
import os
import sqlite3
from pathlib import Path
from urllib.parse import quote

import folium
import geopandas as gpd
import pandas as pd
import streamlit as st
from geopy.geocoders import Nominatim
from shapely.geometry import Point
from streamlit_folium import st_folium

# ── Page config ───────────────────────────────────────────────
st.set_page_config(
    page_title="Barbro — Smart Salon Locator",
    page_icon="✂️",
    layout="wide",
)

# ── Query params (from location.html iframe) ─────────────────
qp = st.query_params
EMBED = qp.get("embed", "0") in ("1", "true", "yes")
SERVICE_FILTER = qp.get("service", "").strip()
URL_LOCATION = qp.get("location", "").strip()
URL_RADIUS = qp.get("radius", "5")

try:
    URL_RADIUS_KM = max(1, min(20, int(URL_RADIUS)))
except ValueError:
    URL_RADIUS_KM = 5

# ── Barbro dark theme CSS ─────────────────────────────────────
st.markdown(
    """
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@300;400;500;600&display=swap');
  html, body, [class*="css"] {
    font-family: 'Montserrat', sans-serif;
    background-color: #000000;
    color: #F0F0F0;
  }
  .stApp { background-color: #000000; }
  .barbro-header {
    text-align: center;
    padding: 2rem 0 1rem;
    border-bottom: 1px solid rgba(201,168,76,0.2);
    margin-bottom: 2rem;
  }
  .barbro-logo {
    font-family: 'Playfair Display', serif;
    font-size: 2.5rem;
    font-weight: 700;
    letter-spacing: 0.4em;
    color: #C9A84C;
  }
  .barbro-tagline {
    font-size: 0.65rem;
    letter-spacing: 0.4em;
    text-transform: uppercase;
    color: #555555;
    margin-top: 0.3rem;
  }
  .gold-rule {
    width: 60px;
    height: 1px;
    background: linear-gradient(90deg, transparent, #C9A84C, transparent);
    margin: 0.8rem auto;
  }
  .page-title {
    font-family: 'Playfair Display', serif;
    font-size: 1.8rem;
    color: #FFFFFF;
    text-align: center;
    margin-bottom: 0.3rem;
  }
  .page-sub {
    font-size: 0.8rem;
    color: #AAAAAA;
    text-align: center;
    margin-bottom: 1.5rem;
  }
  [data-testid="stSidebar"] {
    background-color: #0D0D0D;
    border-right: 1px solid rgba(201,168,76,0.15);
  }
  .sidebar-logo {
    font-family: 'Playfair Display', serif;
    font-size: 1.2rem;
    letter-spacing: 0.35em;
    color: #C9A84C;
    padding: 1rem 0 0.5rem;
  }
  .sidebar-section {
    font-size: 0.6rem;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: #C9A84C;
    margin: 1.2rem 0 0.5rem;
  }
  .stTextInput input {
    background-color: #0D0D0D !important;
    border: 1px solid rgba(201,168,76,0.25) !important;
    color: #F0F0F0 !important;
    border-radius: 0 !important;
  }
  .stTextInput input:focus {
    border-color: #C9A84C !important;
    box-shadow: none !important;
  }
  .stButton > button {
    background: linear-gradient(135deg, #C9A84C, #E8C97A) !important;
    color: #000000 !important;
    border: none !important;
    border-radius: 0 !important;
    font-weight: 600 !important;
    letter-spacing: 0.2em !important;
    text-transform: uppercase !important;
    width: 100%;
  }
  .salon-card {
    background: #0D0D0D;
    border: 1px solid rgba(201,168,76,0.18);
    padding: 1rem 1.2rem;
    margin-bottom: 0.5rem;
  }
  .salon-card-name {
    font-family: 'Playfair Display', serif;
    font-size: 1rem;
    color: #FFFFFF;
  }
  .salon-card-dist {
    font-size: 0.7rem;
    color: #C9A84C;
    letter-spacing: 0.1em;
  }
  .partner-badge {
    font-size: 0.55rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #C9A84C;
    border: 1px solid rgba(201,168,76,0.4);
    padding: 0.15rem 0.5rem;
    display: inline-block;
    margin-bottom: 0.3rem;
  }
  #MainMenu, footer, header { visibility: hidden; }
</style>
""",
    unsafe_allow_html=True,
)

if not EMBED:
    st.markdown(
        """
<div class="barbro-header">
  <div class="barbro-logo">BARBRO</div>
  <div class="barbro-tagline">Precision · Craft · Ritual</div>
  <div class="gold-rule"></div>
</div>
<div class="page-title">Smart Salon Locator</div>
<div class="page-sub">GeoPandas radius search · Folium map · shop names from database</div>
""",
        unsafe_allow_html=True,
    )
else:
    st.markdown(
        '<div style="font-size:0.65rem;letter-spacing:0.25em;text-transform:uppercase;'
        'color:#C9A84C;padding:0.5rem 0 1rem;">Barbro Salon Locator</div>',
        unsafe_allow_html=True,
    )

if SERVICE_FILTER:
    st.caption(f"Service filter: **{SERVICE_FILTER}**")

# ── Navigation: locator → features → booking ─────────────────
SELECT_BTN_STYLE = (
    "display:inline-block;margin-top:10px;padding:10px 16px;"
    "background:linear-gradient(135deg,#C9A84C,#E8C97A);color:#000;"
    "text-decoration:none;font-size:12px;font-weight:700;"
    "letter-spacing:0.12em;text-transform:uppercase;"
)


def features_query_string(name, address="", lat=None, lng=None, shop_type="studio"):
    parts = [f"shop={quote(str(name))}"]
    if address:
        parts.append(f"address={quote(str(address))}")
    if lat is not None and str(lat) != "":
        parts.append(f"lat={lat}")
    if lng is not None and str(lng) != "":
        parts.append(f"lng={lng}")
    parts.append(f"type={quote(str(shop_type))}")
    if SERVICE_FILTER:
        parts.append(f"service={quote(SERVICE_FILTER)}")
    return "&".join(parts)


def features_page_url(name, address="", lat=None, lng=None, shop_type="studio"):
    return "/features.html?" + features_query_string(name, address, lat, lng, shop_type)


def go_features_bridge_url(name, address="", lat=None, lng=None, shop_type="studio"):
    """Bridge page on main site — reliable redirect out of Streamlit."""
    return "/go-features.html?" + features_query_string(name, address, lat, lng, shop_type)


def select_studio_anchor(shop, label="Select Studio →"):
    url = go_features_bridge_url(
        shop["name"],
        shop["address"],
        shop["lat"],
        shop["lng"],
        shop.get("type", "studio"),
    )
    return (
        f'<a href="{url}" target="_top" rel="noopener" '
        f'style="{SELECT_BTN_STYLE}">{label}</a>'
    )


def render_auto_redirect(shop):
    """Show link + auto-navigate to features (works when locator is full-page)."""
    url = go_features_bridge_url(
        shop["name"],
        shop["address"],
        shop["lat"],
        shop["lng"],
        shop.get("type", "studio"),
    )
    st.markdown(
        f'<p style="color:#C9A84C;font-size:0.85rem;margin-bottom:0.75rem;">'
        f"Opening Features &amp; Booking for <b>{shop['name']}</b>…</p>",
        unsafe_allow_html=True,
    )
    st.markdown(
        f'<a id="barbro-go-features" href="{url}" target="_top" rel="noopener" '
        f'style="{SELECT_BTN_STYLE}">Continue to Features &amp; Booking →</a>',
        unsafe_allow_html=True,
    )
    st.markdown(
        f"""
        <script>
        (function() {{
            var url = {json.dumps(url)};
            var a = document.getElementById("barbro-go-features");
            if (a) {{ setTimeout(function() {{ a.click(); }}, 150); }}
            setTimeout(function() {{ window.location.href = url; }}, 400);
        }})();
        </script>
        """,
        unsafe_allow_html=True,
    )


def coord_key(lat, lng) -> str:
    return f"{round(float(lat), 4)}_{round(float(lng), 4)}"


def shop_entry(name, address, lat, lng, shop_type="studio"):
    return {
        "name": name,
        "address": address or "",
        "lat": float(lat),
        "lng": float(lng),
        "type": shop_type,
    }


def add_shop_to_index(index, name, address, lat, lng, shop_type="studio"):
    index[coord_key(lat, lng)] = shop_entry(name, address, lat, lng, shop_type)


def build_shop_index(studios_gdf=None, partner_gdf=None):
    index = {}
    if studios_gdf is not None:
        for _, row in studios_gdf.iterrows():
            add_shop_to_index(
                index,
                row["name"],
                f"{row['Hours']} · {row['Status']}",
                row["Latitude"],
                row["Longitude"],
                "studio",
            )
    if partner_gdf is not None and not partner_gdf.empty:
        for _, row in partner_gdf.iterrows():
            add_shop_to_index(
                index,
                row["name"],
                row.get("address", ""),
                row["Latitude"],
                row["Longitude"],
                "partner",
            )
    return index


def find_shop_by_click(shop_index, lat, lng):
    key = coord_key(lat, lng)
    if key in shop_index:
        return shop_index[key]
    best = None
    best_dist = 0.02
    for shop in shop_index.values():
        dist = abs(shop["lat"] - float(lat)) + abs(shop["lng"] - float(lng))
        if dist < best_dist:
            best_dist = dist
            best = shop
    return best


def popup_label(name, address, extra_html=""):
    body = extra_html or ""
    return (
        f"<div style='font-family:sans-serif;min-width:150px;font-size:13px'>"
        f"<b>{name}</b><br>{body}"
        f"<span style='color:#666;font-size:11px'>"
        f"Click pin → then <b>Continue to Features &amp; Booking</b> below</span>"
        f"</div>"
    )


def make_popup(html: str, max_width: int = 260):
    try:
        return folium.Popup(html, max_width=max_width, parse_html=False)
    except TypeError:
        return folium.Popup(html, max_width=max_width)


def go_to_features(shop):
    st.session_state["barbro_redirect"] = shop
    st.rerun()


def display_map_with_selection(fmap, shop_index, height=560):
    map_data = st_folium(
        fmap,
        width=None,
        height=height,
        returned_objects=["last_object_clicked"],
        key="barbro_salon_map",
    )
    clicked = map_data.get("last_object_clicked") if map_data else None
    if clicked and clicked.get("lat") is not None:
        shop = find_shop_by_click(shop_index, clicked["lat"], clicked["lng"])
        if shop:
            st.session_state["selected_shop"] = shop

    shop = st.session_state.get("selected_shop")
    if shop:
        st.success(f"Selected studio: **{shop['name']}**")
        if shop.get("address"):
            st.caption(shop["address"])
        st.markdown(
            select_studio_anchor(shop, "Continue to Features & Booking →"),
            unsafe_allow_html=True,
        )
        if st.button(
            "Go now (if link above did not open)",
            type="primary",
            use_container_width=True,
            key="continue_features_booking",
        ):
            go_to_features(shop)
    else:
        st.info(
            "Click a **salon pin** on the map, then press **Continue to Features & Booking** — "
            "or use **Select Studio** in the list on the right."
        )


# ── Paths & database ──────────────────────────────────────────
DB_DIR = Path(__file__).parent
OWNER_DB = DB_DIR / "shopowners.db"
CUSTOMER_DB = DB_DIR / "customers.db"
SHOPS_FILE = DB_DIR / "barbro_shops.json"


@st.cache_resource
def get_owner_db_connection():
    if OWNER_DB.exists():
        return sqlite3.connect(str(OWNER_DB), check_same_thread=False)
    return None


@st.cache_resource
def get_customer_db_connection():
    if CUSTOMER_DB.exists():
        return sqlite3.connect(str(CUSTOMER_DB), check_same_thread=False)
    return None


@st.cache_data(ttl=15)
def load_registered_shops():
    """Partner shops from SQLite (shop owner registration)."""
    shops = []
    try:
        conn = get_owner_db_connection()
        if conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, shop_name, location, latitude, longitude, email
                FROM shopowners
                WHERE latitude IS NOT NULL AND longitude IS NOT NULL
                """
            )
            for row in cursor.fetchall():
                shops.append(
                    {
                        "id": row[0],
                        "name": row[1],
                        "address": row[2] or "—",
                        "lat": float(row[3]),
                        "lng": float(row[4]),
                        "email": row[5],
                        "type": "barbro_partner",
                    }
                )
    except Exception as exc:
        st.sidebar.warning(f"DB: {exc}")

    if not shops and SHOPS_FILE.exists():
        with open(SHOPS_FILE, encoding="utf-8") as f:
            raw = json.load(f)
            for item in raw:
                if item.get("lat") is not None and item.get("lng") is not None:
                    shops.append(
                        {
                            "id": item.get("id"),
                            "name": item.get("name", "Salon"),
                            "address": item.get("address", "—"),
                            "lat": float(item["lat"]),
                            "lng": float(item["lng"]),
                            "email": item.get("email", ""),
                            "type": "barbro_partner",
                        }
                    )
    return shops


@st.cache_data
def load_barbro_studios_gdf():
    data = {
        "name": [
            "Barbro — Financial District",
            "Barbro — Nob Hill",
            "Barbro — Hayes Valley",
            "Barbro — Mission District",
            "Barbro — Pacific Heights",
        ],
        "Latitude": [37.7946, 37.7930, 37.7762, 37.7599, 37.7887],
        "Longitude": [-122.4025, -122.4133, -122.4245, -122.4148, -122.4368],
        "Hours": [
            "Mon–Sat 9am–8pm",
            "Mon–Sat 10am–7pm",
            "Tue–Sun 10am–8pm",
            "Mon–Sun 9am–9pm",
            "Wed–Mon 10am–7pm",
        ],
        "Status": ["Open", "Open", "Closed", "Open", "Open"],
    }
    df = pd.DataFrame(data)
    return gpd.GeoDataFrame(
        df,
        geometry=gpd.points_from_xy(df.Longitude, df.Latitude),
        crs="EPSG:4326",
    )


def partners_to_gdf(shops):
    if not shops:
        return gpd.GeoDataFrame(
            columns=["name", "address", "Latitude", "Longitude", "type"],
            geometry=[],
            crs="EPSG:4326",
        )
    rows = [
        {
            "name": s["name"],
            "address": s["address"],
            "Latitude": s["lat"],
            "Longitude": s["lng"],
            "type": "partner",
        }
        for s in shops
    ]
    return gpd.GeoDataFrame(
        rows,
        geometry=[Point(r["Longitude"], r["Latitude"]) for r in rows],
        crs="EPSG:4326",
    )


def add_dark_tiles(fmap):
    folium.TileLayer(
        tiles="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        attr="CartoDB",
        name="Dark",
        max_zoom=19,
    ).add_to(fmap)


def build_search_map(search_lat, search_lon, radius_km, studios_gdf, partner_gdf):
    m = folium.Map(location=[search_lat, search_lon], zoom_start=13, tiles=None)
    add_dark_tiles(m)

    folium.Marker(
        [search_lat, search_lon],
        popup="Your search location",
        tooltip="Search point",
        icon=folium.Icon(color="red", icon="info-sign"),
    ).add_to(m)

    folium.Circle(
        location=[search_lat, search_lon],
        radius=radius_km * 1000,
        color="#C9A84C",
        weight=1.5,
        fill=True,
        fill_color="#C9A84C",
        fill_opacity=0.06,
        tooltip=f"{radius_km} km radius",
    ).add_to(m)

    search_point = gpd.GeoDataFrame(
        geometry=[Point(search_lon, search_lat)],
        crs="EPSG:4326",
    ).to_crs(epsg=3857)
    buffer = search_point.geometry.iloc[0].buffer(radius_km * 1000)

    studios_proj = studios_gdf.to_crs(epsg=3857)
    nearby = studios_proj[studios_proj.geometry.within(buffer)].to_crs(epsg=4326)

    for _, row in nearby.iterrows():
        extra = f"<span style='font-size:0.8rem'>{row['Hours']}<br>{row['Status']}</span><br>"
        folium.CircleMarker(
            location=[row["Latitude"], row["Longitude"]],
            radius=8,
            color="#C9A84C",
            fill=True,
            fill_color="#C9A84C",
            fill_opacity=0.9,
            popup=make_popup(
                popup_label(row["name"], f"{row['Hours']} · {row['Status']}", extra)
            ),
            tooltip=row["name"] + " — click to select",
        ).add_to(m)

    nearby_partners = gpd.GeoDataFrame(
        columns=["name", "address", "Latitude", "Longitude", "type"],
        geometry=[],
        crs="EPSG:4326",
    )
    if not partner_gdf.empty:
        partners_proj = partner_gdf.to_crs(epsg=3857)
        nearby_partners = partners_proj[partners_proj.geometry.within(buffer)].to_crs(
            epsg=4326
        )
        for _, row in nearby_partners.iterrows():
            folium.Marker(
                [row["Latitude"], row["Longitude"]],
                popup=make_popup(
                    popup_label(
                        row["name"],
                        row["address"],
                        "<span style='color:#C9A84C'>★ Barbro Partner</span><br>",
                    )
                ),
                tooltip=f"★ {row['name']} — click to select",
                icon=folium.Icon(color="orange", icon="star"),
            ).add_to(m)

    shop_index = {}
    for _, row in nearby.iterrows():
        add_shop_to_index(
            shop_index,
            row["name"],
            f"{row['Hours']} · {row['Status']}",
            row["Latitude"],
            row["Longitude"],
            "studio",
        )
    for _, row in nearby_partners.iterrows():
        add_shop_to_index(
            shop_index,
            row["name"],
            row["address"],
            row["Latitude"],
            row["Longitude"],
            "partner",
        )
    return m, nearby, nearby_partners, shop_index


def build_default_map(studios_gdf, partner_gdf):
    if not partner_gdf.empty:
        center_lat = partner_gdf["Latitude"].mean()
        center_lon = partner_gdf["Longitude"].mean()
        zoom = 10 if len(partner_gdf) > 1 else 13
    else:
        center_lat, center_lon, zoom = 20.5937, 78.9629, 5

    m = folium.Map(location=[center_lat, center_lon], zoom_start=zoom, tiles=None)
    add_dark_tiles(m)

    for _, row in studios_gdf.iterrows():
        folium.CircleMarker(
            location=[row["Latitude"], row["Longitude"]],
            radius=7,
            color="#C9A84C",
            fill=True,
            fill_color="#C9A84C",
            fill_opacity=0.85,
            popup=make_popup(
                popup_label(row["name"], f"{row['Hours']} · {row['Status']}")
            ),
            tooltip=row["name"] + " — click to select",
        ).add_to(m)

    for _, row in partner_gdf.iterrows():
        folium.Marker(
            [row["Latitude"], row["Longitude"]],
            popup=make_popup(
                popup_label(
                    row["name"],
                    row["address"],
                    "<span style='color:#C9A84C'>★ Barbro Partner</span><br>",
                )
            ),
            tooltip=f"★ {row['name']} — click to select",
            icon=folium.Icon(color="orange", icon="star"),
        ).add_to(m)

    shop_index = build_shop_index(studios_gdf, partner_gdf)
    return m, shop_index


def render_results(nearby_studios, nearby_partners, radius_km):
    n_studios = len(nearby_studios)
    n_partners = 0 if nearby_partners is None else len(nearby_partners)
    total = n_studios + n_partners

    st.markdown(
        f'<div style="font-size:0.6rem;letter-spacing:0.3em;text-transform:uppercase;'
        f'color:#C9A84C;margin-bottom:1rem;">'
        f'{total} location{"s" if total != 1 else ""} within {radius_km} km — '
        f'select a studio to continue to booking</div>',
        unsafe_allow_html=True,
    )

    if nearby_partners is not None and len(nearby_partners):
        for idx, (_, row) in enumerate(nearby_partners.iterrows()):
            shop = shop_entry(
                row["name"],
                row["address"],
                row["Latitude"],
                row["Longitude"],
                "partner",
            )
            st.markdown(
                f'<div class="salon-card">'
                f'<div class="partner-badge">★ Barbro Partner</div>'
                f'<div class="salon-card-name">{row["name"]}</div>'
                f'<div class="salon-card-dist">{row["address"]}</div>'
                f'{select_studio_anchor(shop)}</div>',
                unsafe_allow_html=True,
            )

    for idx, (_, row) in enumerate(nearby_studios.iterrows()):
        badge = "🟢 Open" if row["Status"] == "Open" else "⚫ Closed"
        shop = shop_entry(
            row["name"],
            f"{row['Hours']} · {row['Status']}",
            row["Latitude"],
            row["Longitude"],
            "studio",
        )
        st.markdown(
            f'<div class="salon-card">'
            f'<div class="salon-card-name">{row["name"]}</div>'
            f'<div class="salon-card-dist">{row["Hours"]} · {badge}</div>'
            f'{select_studio_anchor(shop)}</div>',
            unsafe_allow_html=True,
        )

    if total == 0:
        st.warning("No salons in this radius. Try a wider search or different location.")


studios_gdf = load_barbro_studios_gdf()
partner_shops = load_registered_shops()
partner_gdf = partners_to_gdf(partner_shops)

if "barbro_redirect" in st.session_state:
    render_auto_redirect(st.session_state.pop("barbro_redirect"))
    st.stop()

# ── Sidebar ───────────────────────────────────────────────────
with st.sidebar:
    st.markdown('<div class="sidebar-logo">BARBRO</div>', unsafe_allow_html=True)
    if EMBED:
        st.markdown(
            "[← Back to Barbro site](http://localhost:3000/services.html)",
            unsafe_allow_html=True,
        )
    st.markdown('<div class="sidebar-section">Search</div>', unsafe_allow_html=True)

    default_location = URL_LOCATION or ""
    search_query = st.text_input(
        "Location",
        value=default_location,
        placeholder="e.g. Kozhikode, Kochi, Brooklyn",
        label_visibility="collapsed",
    )

    st.markdown('<div class="sidebar-section">Radius</div>', unsafe_allow_html=True)
    search_radius_km = st.slider(
        "Radius (km)",
        min_value=1,
        max_value=20,
        value=URL_RADIUS_KM,
        label_visibility="collapsed",
    )

    search_btn = st.button("Find Salons", type="primary")
    auto_search = bool(URL_LOCATION) and not search_btn

    st.markdown("---")
    st.markdown('<div class="sidebar-section">Legend</div>', unsafe_allow_html=True)
    st.markdown("🔴 Search location")
    st.markdown("⭐ Registered partner (shop name on pin)")
    st.markdown("🟡 Barbro studio")

    st.markdown("---")
    st.markdown('<div class="sidebar-section">Registered</div>', unsafe_allow_html=True)
    st.metric("Partner salons on map", len(partner_shops))

    try:
        conn = get_owner_db_connection()
        if conn:
            st.metric("Shop owners (DB)", conn.execute("SELECT COUNT(*) FROM shopowners").fetchone()[0])
    except Exception:
        pass

# ── Run search or default map ─────────────────────────────────
run_search = (search_btn or auto_search) and search_query.strip()

if run_search:
    try:
        geolocator = Nominatim(user_agent="barbro_salon_locator_v2")
        location = geolocator.geocode(search_query.strip(), timeout=12)

        if not location:
            st.error("Location not found. Try a city or neighbourhood name.")
        else:
            search_lat = location.latitude
            search_lon = location.longitude
            st.success(f"📍 {location.address}")

            fmap, nearby, nearby_partners, shop_index = build_search_map(
                search_lat, search_lon, search_radius_km, studios_gdf, partner_gdf
            )

            col_map, col_results = st.columns([2, 1])
            with col_map:
                display_map_with_selection(fmap, shop_index, height=560)
            with col_results:
                render_results(nearby, nearby_partners, search_radius_km)

    except Exception as exc:
        st.error(f"Search failed: {exc}")

else:
    partner_count = len(partner_shops)
    if partner_count:
        st.info(f"**{partner_count}** registered partner salon{'s' if partner_count != 1 else ''} shown on the map. Use the sidebar to search by area.")
    else:
        st.caption("Enter a location in the sidebar and click **Find Salons**. Partner shops appear after shop-owner registration.")

    default_map, shop_index = build_default_map(studios_gdf, partner_gdf)
    display_map_with_selection(default_map, shop_index, height=560)
