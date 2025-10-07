// --- Helper Functions ---

// Haversine distance in meters
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Bearing in degrees
function bearingTo(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const toDeg = (v) => (v * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  let brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

// Convert bearing to compass direction
function bearingToDirection(bearing) {
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  return dirs[Math.round(bearing / 45) % 8];
}

// Detect Safari
function isSafari() {
  const ua = navigator.userAgent;
  return ua.includes("Safari") && !ua.includes("Chrome") && !ua.includes("Chromium");
}

// --- New: Silent Mode Check ---
const urlParams = new URLSearchParams(window.location.search);
const isSilent = urlParams.get("mode") === "silent";
const silentLat = parseFloat(urlParams.get("lat"));
const silentLng = parseFloat(urlParams.get("lng"));
const hasSilentCoords = !isNaN(silentLat) && !isNaN(silentLng);

// Main location check
function checkLocation(zonesLayer, map, overrideLat = null, overrideLng = null, silentOutput = false) {
  const handlePosition = (userLat, userLng) => {
    // Check if inside any zone
    let insideZone = false;
    zonesLayer.eachLayer(layer => {
      if (layer.getBounds().contains([userLat, userLng])) insideZone = true;
    });

    if (silentOutput) {
      document.write(insideZone ? "inside" : "outside");
      return;
    }

    const resultDiv = document.getElementById("result");
    if (insideZone) {
      resultDiv.textContent = "✅ You ARE inside a zone where billboards are permitted.";
      return;
    }

    // Compute nearest edge
    let minDistance = Infinity;
    let closestPoint = null;
    zonesLayer.eachLayer(layer => {
      const coords = layer.feature.geometry.coordinates;
      const polygons = layer.feature.geometry.type === "MultiPolygon" ? coords.flat(1) : coords;

      polygons.forEach(ring => {
        for (let i=0; i<ring.length-1; i++){
          const [lon1, lat1] = ring[i];
          const [lon2, lat2] = ring[i+1];
          for (let t=0; t<=1; t+=0.1){
            const lat = lat1 + (lat2 - lat1)*t;
            const lon = lon1 + (lon2 - lon1)*t;
            const dist = haversineDistance(userLat, userLng, lat, lon);
            if(dist < minDistance){
              minDistance = dist;
              closestPoint = {lat, lon};
            }
          }
        }
      });
    });

    if (closestPoint) {
      const distMiles = minDistance / 1609.344;
      const bearing = bearingTo(userLat, userLng, closestPoint.lat, closestPoint.lon);
      const direction = bearingToDirection(bearing);

      let displayDist = distMiles < 0.5 ? `${Math.round(minDistance*3.28084).toLocaleString()} ft` : `${distMiles.toFixed(2)} miles`;
      resultDiv.textContent = `❌ You are NOT inside a permitted zone. Nearest zone is ${displayDist} to the ${direction}.`;
    } else {
      resultDiv.textContent = "❌ You are NOT inside a permitted zone (no geometry found).";
    }
  };

  if (overrideLat !== null && overrideLng !== null) {
    handlePosition(overrideLat, overrideLng);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const userLat = pos.coords.latitude;
      const userLng = pos.coords.longitude;

      if (!silentOutput) {
        const userMarker = L.marker([userLat, userLng]).addTo(map);
        userMarker.bindPopup("You are here").openPopup();
        map.fitBounds(L.featureGroup([zonesLayer, userMarker]).getBounds(), {padding:[50,50]});
      }
      handlePosition(userLat, userLng);

    },
    (err) => {
      if (silentOutput) {
        document.write("outside");
      } else {
        document.getElementById("result").textContent = "Location access denied or unavailable.";
      }
      console.error("Geolocation error:", err);
    },
    {enableHighAccuracy:true, timeout:10000, maximumAge:0}
  );
}

// --- Init ---

document.addEventListener("DOMContentLoaded", () => {
  fetch("zones.geojson")
    .then(res => res.json())
    .then(zonesData => {
      if (isSilent && hasSilentCoords) {
        const tempLayer = L.geoJSON(zonesData);
        checkLocation(tempLayer, null, silentLat, silentLng, true);
        return;
      }

      const map = L.map("map");
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);
      const zonesLayer = L.geoJSON(zonesData).addTo(map);

      const group = L.featureGroup([zonesLayer]);
      map.fitBounds(group.getBounds(), {padding:[50,50]});

      if(isSafari()){
        const btn = document.getElementById("checkLocation");
        btn.style.display = "inline-block";
        btn.textContent = "Check My Location";
        btn.addEventListener("click", () => checkLocation(zonesLayer, map));
        document.getElementById("result").textContent = "Tap the button to check your location.";
      } else {
        checkLocation(zonesLayer, map);
      }

    })
    .catch(err => {
      console.error("Error loading zones.geojson:", err);
      if (isSilent) {
        document.write("outside");
      } else {
        document.getElementById("result").textContent = "Couldn't load zone data.";
      }
    });
});
