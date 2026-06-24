# ✂️ Barbro: Smart Style Filter & Geospatial Salon Locator

Barbro is an end-to-end web application engineered to eliminate friction in the personal care and grooming industry. By merging computer vision-driven styling filters with high-performance geospatial data science, Barbro allows users to experiment with haircuts and beard styles virtually, then instantly maps out the closest premium salons equipped to make that look a reality.

---

## 🚀 Key Features

* **Virtual Style Suite:** Interactive camera overlays and photo filters that allow users to preview different haircuts, beard configurations, and grooming features directly on their screen.
* **Geospatial Proximity Search:** Integrated geocoding system translating text queries (neighborhoods, zip codes) into precise geographic coordinates.
* **Smart Boundary Calculation:** Implements a localized Coordinate Reference System (CRS) to construct accurate metric distance buffers around the user, ignoring arbitrary boundaries to show true proximity.
* **Interactive Mapping Layers:** Dynamically maps real-time spatial joins to cleanly isolate, count, and display available service providers falling inside the user's custom search radius.

---

## 🛠️ Tech Stack

* **Frontend UI / Framework:** Streamlit (Python-driven interactive web framework)
* **Geospatial Processing:** GeoPandas, Shapely, Pyogrio (Fast C-based vectorized engine)
* **Interactive Mapping:** Folium / Streamlit-Folium
* **Geocoding API:** Geopy (Nominatim OpenStreetMap engine)
* **Styling Tools / Computer Vision:** *[Add your CV/Image filtering library here, e.g., OpenCV, Mediapipe, or custom CSS overlays]*

---

## 📦 Installation & Setup

Follow these steps to run Barbro locally on your machine:

1. **Clone the Repository:**
   ```bash
   git clone [https://github.com/YOUR_USERNAME/Barbro.git](https://github.com/YOUR_USERNAME/Barbro.git)
   cd Barbro
