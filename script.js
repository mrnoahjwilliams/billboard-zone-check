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

// Detect Safari (on iOS or macOS)
function isSafari() {
  const ua = navigator.userAgent;
  return ua.includes("Safari") && !ua.includes("Chrome") && !ua.includes("Chromium");
}

// Load GeoJSON zones and map
fetch("zones.geojson")
  .then((res) => res.json())
  .then((zonesData) => {
    const map = L.map("map");
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    const zonesLayer = L.geoJSON(zonesData).addTo(map);

    const group = L.featureGroup([zonesLayer]);
    map.fitBounds(group.getBounds(), { padding: [50,50] });

    // Main function to check location
    const checkLocation = () => {
      if (!("geolocation" in navigator)) {
        document.getElementById("result").textContent = "Geolocation not supported.";
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userLat = pos.coords.latitude;
          const userLng = pos.coords.longitude;

          // Add marker
          const userMarker = L.marker([userLat, userLng]).addTo(map);
          userMarker.bindPopup("You are here").openPopup();
          map.fitBounds(L.featureGroup([zonesLayer, userMarker]).getBounds(), {padding:[50,50]});

          // Check if inside any zone
          let insideZone = false;
          zonesLayer.eachLayer(layer => {
            if (layer.getBounds().contains([userLat, userLng])) insideZone = true;
          });

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

          if(closestPoint){
            const distMiles = minDistance / 1609.344;
            const bearing = bearingTo(userLat, userLng, closestPoint.lat, closestPoint.lon);
            const direction = bearingToDirection(bearing);

            let displayDist = distMiles < 0.5 ? `${Math.round(minDistance*3.28084).toLocaleString()} ft` : `${distMiles.toFixed(2)} miles`;
            resultDiv.textContent = `❌ You are NOT inside a permitted zone. Nearest zone is ${displayDist} to the ${direction}.`;
          } else {
            resultDiv.textContent = "❌ You are NOT inside a permitted zone (no geometry found).";
          }

        },
        () => {
          document.getElementById("result").textContent = "Location access denied or unavailable.";
        }
      );
    };

    // Safari gets button, others run immediately
    if(isSafari()){
      const btn = document.getElementById("checkLocation");
      btn.style.display = "inline-block";
      btn.addEventListener("click", checkLocation);
      document.getElementById("result").textContent = "Click the button to check your location.";
    } else {
      checkLocation();
    }

  })
  .catch(err => {
    console.error("Error loading zones.geojson:", err);
    document.getElementById("result").textContent = "Couldn't load zone data.";
  });
