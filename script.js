document.addEventListener("DOMContentLoaded", function () {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get("mode");
    const latParam = urlParams.get("lat");
    const lngParam = urlParams.get("lng");

    // Initialize Map
    var map = L.map('map').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    let zonePolygons = [];

    // Load Zones
    fetch('zones.geojson')
        .then(response => response.json())
        .then(data => {
            L.geoJSON(data, {
                style: { color: 'red', weight: 2, fillOpacity: 0.1 },
                onEachFeature: (feature, layer) => zonePolygons.push(layer)
            }).addTo(map);

            if (mode === "silent" && latParam && lngParam) {
                runSilentMode(parseFloat(latParam), parseFloat(lngParam));
                return;
            }

            if (!isSafari) {
                requestLocation(); // Auto-run everywhere except Safari
            } else {
                showSafariButton();
            }
        })
        .catch(() => {
            showError("Failed to load zones.geojson. Ensure the file exists in the repository.");
        });

    function requestLocation() {
        if (!navigator.geolocation) {
            showError("Geolocation is not supported by your browser.");
            return;
        }

        navigator.geolocation.getCurrentPosition(showPosition, showError, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        });
    }

    function showSafariButton() {
        const button = document.createElement('button');
        button.textContent = "Check My Location";
        button.style.marginTop = "10px";
        button.style.padding = "12px 18px";
        button.style.fontSize = "16px";
        button.style.background = "#007bff";
        button.style.color = "white";
        button.style.border = "none";
        button.style.borderRadius = "5px";
        button.style.cursor = "pointer";

        const container = document.getElementById("status");
        container.innerHTML = ""; // Clear any text
        container.appendChild(button);

        button.addEventListener("click", () => {
            button.disabled = true;
            button.textContent = "Requesting Location...";

            requestLocation(); // ✅ First geolocation call happens strictly from tap — Safari must show prompt
        });
    }

    function showPosition(position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        map.setView([lat, lng], 15);

        const userMarker = L.marker([lat, lng]).addTo(map);
        userMarker.bindPopup("Your Location").openPopup();

        const insideZone = zonePolygons.some(polygon => leafletPip.pointInLayer([lng, lat], polygon).length > 0);

        if (insideZone) {
            updateMessage("✅ You ARE inside a zone where billboards are permitted.");
        } else {
            calculateNearestZone(lat, lng);
        }
    }

    function calculateNearestZone(lat, lng) {
        let minDistance = Infinity;
        let nearestDirection = null;

        zonePolygons.forEach(polygon => {
            polygon.getLatLngs()[0].forEach(point => {
                const distance = map.distance([lat, lng], point);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestDirection = getCardinalDirection(lat, lng, point.lat, point.lng);
                }
            });
        });

        const miles = minDistance / 1609.34;
        const displayDistance = miles < 0.5 ? `${(miles * 5280).toFixed(0)} ft` : `${miles.toFixed(2)} miles`;

        updateMessage(`❌ You are NOT inside a permitted zone. Nearest zone is ${displayDistance} to the ${nearestDirection}.`);
    }

    function getCardinalDirection(lat1, lng1, lat2, lng2) {
        const angle = Math.atan2(lat2 - lat1, lng2 - lng1) * (180 / Math.PI);
        if (angle < 0) angle += 360;
        if (angle >= 337.5 || angle < 22.5) return "E";
        if (angle >= 22.5 && angle < 67.5) return "NE";
        if (angle >= 67.5 && angle < 112.5) return "N";
        if (angle >= 112.5 && angle < 157.5) return "NW";
        if (angle >= 157.5 && angle < 202.5) return "W";
        if (angle >= 202.5 && angle < 247.5) return "SW";
        if (angle >= 247.5 && angle < 292.5) return "S";
        return "SE";
    }

    function updateMessage(text) {
        document.getElementById("status").textContent = text;
    }

    function showError(error) {
        document.getElementById("status").textContent = `⚠️ Error: ${error.message || error}`;
    }

    function runSilentMode(lat, lng) {
        const insideZone = zonePolygons.some(polygon => leafletPip.pointInLayer([lng, lat], polygon).length > 0);
        document.body.innerHTML = insideZone ? "inside" : "outside";
    }
});
