// Load the zones GeoJSON and then do the location check
fetch("zones.geojson")
  .then((res) => res.json())
  .then((zonesData) => {
    // Initialize the map
    const map = L.map("map");

    // Add a tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    // Add zones to the map
    const zonesLayer = L.geoJSON(zonesData).addTo(map);

    // Try to get user location
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userLat = pos.coords.latitude;
          const userLng = pos.coords.longitude;

          // Add marker for user location
          const userMarker = L.marker([userLat, userLng]).addTo(map);
          userMarker.bindPopup("You are here").openPopup();

          // Fit map to user location with zones
          const group = L.featureGroup([zonesLayer, userMarker]);
          map.fitBounds(group.getBounds(), { padding: [50, 50] });

          // Check if the user location is inside any zone
          let insideZone = false;
          zonesLayer.eachLayer((layer) => {
            if (layer.getBounds && layer.getBounds().contains([userLat, userLng])) {
              insideZone = true;
            }
          });

          const resultDiv = document.getElementById("result");
          if (insideZone) {
            resultDiv.textContent =
              "✅ You ARE inside a zone where billboards are permitted.";
          } else {
            resultDiv.textContent =
              "❌ You are NOT inside a zone where billboards are permitted.";
          }
        },
        (err) => {
          document.getElementById("result").textContent =
            "Location access was denied or unavailable.";
          map.setView([36.1627, -86.7816], 12); // fallback center
        }
      );
    } else {
      document.getElementById("result").textContent =
        "Geolocation is not supported by your browser.";
      map.setView([36.1627, -86.7816], 12); // fallback center
    }
  })
  .catch((err) => {
    console.error("Error loading zones.geojson:", err);
    document.getElementById("result").textContent =
      "Couldn't load zone data.";
  });
