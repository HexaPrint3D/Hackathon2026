const state = {
  center: { lat: 48.3069, lon: 14.2858 },
  location: null,
  locationSource: "none",
  localMode: false,
  localItems: [],
  results: [],
  selectedId: null,
  detailCache: new Map(),
  searchTimer: null,
  currentSearchToken: 0,
};

const elements = {
  searchForm: document.getElementById("search-form"),
  searchInput: document.getElementById("search-input"),
  results: document.getElementById("results"),
  resultTitle: document.getElementById("result-title"),
  resultCount: document.getElementById("result-count"),
  detailTitle: document.getElementById("detail-title"),
  detailContent: document.getElementById("detail-content"),
  routeSummary: document.getElementById("route-summary"),
  status: document.getElementById("status"),
  locationButton: document.getElementById("location-button"),
  chips: Array.from(document.querySelectorAll(".chip")),
};

const map = L.map("map", {
  zoomControl: true,
  preferCanvas: true,
}).setView([state.center.lat, state.center.lon], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
}).addTo(map);

const layers = {
  results: L.layerGroup().addTo(map),
  route: L.layerGroup().addTo(map),
  selection: L.layerGroup().addTo(map),
  user: L.layerGroup().addTo(map),
};

const icons = {
  tree: createDivIcon("tree"),
  defi: createDivIcon("defi"),
  dog_zone: createDivIcon("dog_zone"),
  hedge: createDivIcon("hedge"),
  user: createDivIcon("user"),
  selected: createDivIcon("selected"),
};

function createDivIcon(kind) {
  return L.divIcon({
    className: "",
    html: `<span class="map-pin ${kind}"></span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function setStatus(message) {
  elements.status.textContent = message;
}

function formatDistance(distanceMeters) {
  if (distanceMeters == null || Number.isNaN(distanceMeters)) {
    return "Distanz unbekannt";
  }
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }
  const km = distanceMeters / 1000;
  return `${km >= 10 ? km.toFixed(0) : km.toFixed(1)} km`;
}

function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(seconds)) {
    return "unbekannt";
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function kindLabel(kind) {
  switch (kind) {
    case "tree":
      return "Baum";
    case "defi":
      return "Defibrillator";
    case "dog_zone":
      return "Hundezone";
    case "hedge":
      return "Hecke";
    default:
      return kind;
  }
}

function renderDetail(detail) {
  if (!detail) {
    elements.detailTitle.textContent = "Noch nichts gewählt";
    elements.detailContent.innerHTML =
      '<div class="detail-empty">Wähle einen Treffer aus, dann zeige ich Details, Karte und Route.</div>';
    return;
  }

  elements.detailTitle.textContent = detail.title;
  const rows = [];
  rows.push(detail.subtitle ? ["Ort", detail.subtitle] : null);
  rows.push(["Kategorie", kindLabel(detail.kind)]);
  rows.push(["Datensatz", detail.source]);
  if (detail.lat != null && detail.lon != null) {
    rows.push(["Koordinaten", `${detail.lat.toFixed(6)}, ${detail.lon.toFixed(6)}`]);
  } else if (detail.resolved_label) {
    rows.push(["Aufgelöst zu", detail.resolved_label]);
  }
  if (detail.details && detail.details.length) {
    for (const line of detail.details) {
      const parts = String(line).split(": ");
      if (parts.length >= 2) {
        rows.push([parts[0], parts.slice(1).join(": ")]);
      } else {
        rows.push(["Info", line]);
      }
    }
  }

  elements.detailContent.innerHTML = `
    <div class="result-badges">
      <span class="badge kind-${detail.kind}">${escapeHtml(kindLabel(detail.kind))}</span>
      <span class="badge">${escapeHtml(detail.source)}</span>
    </div>
    <div class="detail-grid">
      ${rows
        .filter(Boolean)
        .map(
          ([label, value]) => `
            <div class="detail-row">
              <strong>${escapeHtml(label)}</strong>
              <span>${escapeHtml(value)}</span>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function clearMapLayers() {
  layers.results.clearLayers();
  layers.route.clearLayers();
  layers.selection.clearLayers();
}

function createPopupContent(item) {
  return `
    <strong>${escapeHtml(item.title)}</strong><br />
    ${escapeHtml(item.subtitle || item.source)}<br />
    ${item.distance_m != null ? escapeHtml(formatDistance(item.distance_m)) : ""}
  `;
}

function renderGeometryPreview(item, isSelected = false) {
  if (
    item.geometry &&
    (item.geometry_type === "Polygon" || item.geometry_type === "MultiPolygon")
  ) {
    const layer = L.geoJSON(item.geometry, {
      style: {
        color: isSelected ? "#ff5c5c" : colorForKind(item.kind),
        weight: isSelected ? 4 : 2,
        fillColor: colorForKind(item.kind),
        fillOpacity: isSelected ? 0.3 : 0.18,
      },
    });
    layer.bindPopup(createPopupContent(item));
    return layer;
  }

  if (item.lat != null && item.lon != null) {
    const icon = isSelected ? icons.selected : icons[item.kind] || icons.tree;
    const marker = L.marker([item.lat, item.lon], { icon });
    marker.bindPopup(createPopupContent(item));
    return marker;
  }
  return null;
}

function colorForKind(kind) {
  switch (kind) {
    case "tree":
      return "#2c8c6f";
    case "defi":
      return "#f2a65a";
    case "dog_zone":
      return "#4b7bec";
    case "hedge":
      return "#78bd78";
    default:
      return "#2c8c6f";
  }
}

function renderResults(results, query) {
  state.results = results;
  elements.results.innerHTML = "";
  elements.resultCount.textContent = String(results.length);
  elements.resultTitle.textContent = query ? `Treffer für "${query}"` : "In deiner Nähe";

  clearMapLayers();
  if (state.location) {
    renderUserLocation();
  }

  if (!results.length) {
    elements.results.innerHTML =
      '<div class="detail-empty">Kein Treffer gefunden. Probiere zum Beispiel "birke", "eiche", "defi" oder "himbeere".</div>';
    elements.routeSummary.textContent = "Noch keine Route berechnet.";
    return;
  }

  let autoSelectId = null;
  for (const item of results) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "result-card";
    card.dataset.id = item.id;
    card.innerHTML = `
      <div class="result-top">
        <div>
          <h3 class="result-title">${escapeHtml(item.title)}</h3>
          <p class="result-subtitle">${escapeHtml(item.subtitle || item.source)}</p>
        </div>
        <span class="badge kind-${item.kind}">${escapeHtml(kindLabel(item.kind))}</span>
      </div>
      <div class="result-meta">
        <span>${escapeHtml(item.source)}</span>
        <span>•</span>
        <span>${item.distance_m != null ? escapeHtml(formatDistance(item.distance_m)) : "Entfernung unbekannt"}</span>
      </div>
    `;
    card.addEventListener("click", () => selectResult(item.id));
    elements.results.appendChild(card);

    const layer = renderGeometryPreview(item, false);
    if (layer) {
      layer.addTo(layers.results);
    }

    if (!autoSelectId && item.lat != null && item.lon != null) {
      autoSelectId = item.id;
    }
  }

  const topSelectable = results.find((item) => item.lat != null && item.lon != null) || results[0];
  if (topSelectable) {
    selectResult(topSelectable.id, { fromSearch: true });
  }
}

function highlightSelectedCard(id) {
  document.querySelectorAll(".result-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.id === id);
  });
}

function renderUserLocation() {
  layers.user.clearLayers();
  if (!state.location || state.locationSource !== "gps") {
    return;
  }
  const marker = L.marker([state.location.lat, state.location.lon], { icon: icons.user });
  marker.bindPopup("Dein Standort");
  marker.addTo(layers.user);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `HTTP ${response.status}`);
  }
  return response.json();
}

function localNormalize(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function localTerms(query) {
  return query
    .split(/[,\n;/|]+/)
    .map(localNormalize)
    .filter(Boolean);
}

function localScore(item, terms) {
  if (!terms.length) return 1;
  const blob = item.search_blob || "";
  const title = localNormalize(item.title);
  const subtitle = localNormalize(item.subtitle);
  let score = 0;
  for (const term of terms) {
    if (blob.includes(term)) {
      score += title.includes(term) ? 14 : subtitle.includes(term) ? 12 : 10;
    }
  }
  return score;
}

function localDistance(item) {
  if (state.locationSource !== "gps" || !state.location || item.lat == null || item.lon == null) {
    return null;
  }
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRadians(item.lat - state.location.lat);
  const dLon = toRadians(item.lon - state.location.lon);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(state.location.lat)) * Math.cos(toRadians(item.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

function localSearch(query) {
  const terms = localTerms(query);
  return state.localItems
    .map((item) => ({ ...item, score: localScore(item, terms), distance_m: localDistance(item) }))
    .filter((item) => !terms.length || item.score > 0)
    .sort((a, b) => b.score - a.score || (a.distance_m ?? Number.POSITIVE_INFINITY) - (b.distance_m ?? Number.POSITIVE_INFINITY) || a.title.localeCompare(b.title))
    .slice(0, 40);
}

async function performSearch(query) {
  const token = ++state.currentSearchToken;
  if (state.localMode) {
    const items = localSearch(query);
    setStatus(`${items.length} Treffer${query ? ` für "${query}"` : ""}`);
    renderResults(items, query);
    return;
  }
  setStatus(`Suche läuft ...`);
  const locationParams = state.locationSource === "gps" && state.location
    ? `&lat=${state.location.lat}&lon=${state.location.lon}`
    : "";
  const url = `/api/search?q=${encodeURIComponent(query)}${locationParams}&limit=40`;
  try {
    const payload = await fetchJson(url);
    if (token !== state.currentSearchToken) {
      return;
    }
    const countLabel = payload.items.length === 1 ? "1 Treffer" : `${payload.items.length} Treffer`;
    setStatus(query ? `${countLabel} für "${query}"` : `${countLabel} in deiner Nähe`);
    renderResults(payload.items, payload.query);
  } catch (error) {
    console.error(error);
    setStatus("Suche fehlgeschlagen.");
    elements.results.innerHTML =
      '<div class="detail-empty">Die Suche ist gerade nicht erreichbar. Bitte prüfe, ob der lokale Server laeuft.</div>';
  }
}

async function selectResult(id, options = {}) {
  state.selectedId = id;
  highlightSelectedCard(id);
  let detail = state.detailCache.get(id);
  if (!detail) {
    elements.detailContent.innerHTML = '<div class="detail-empty">Lade Details ...</div>';
    try {
      detail = state.localMode
        ? state.localItems.find((item) => item.id === id)
        : await fetchJson(`/api/item?id=${encodeURIComponent(id)}`);
      if (!detail) throw new Error("Eintrag nicht gefunden");
      state.detailCache.set(id, detail);
    } catch (error) {
      console.error(error);
      elements.detailContent.innerHTML =
        '<div class="detail-empty">Details konnten nicht geladen werden.</div>';
      return;
    }
  }

  renderDetail(detail);
  clearSelectedLayer();

  const selectedLayer = renderGeometryPreview(detail, true);
  if (selectedLayer) {
    selectedLayer.addTo(layers.selection);
  }

  if (detail.lat == null || detail.lon == null) {
    elements.routeSummary.textContent = "Dieser Eintrag wird gerade geocodiert. Bitte kurz warten.";
    const updated = await refreshDetail(id);
    if (updated && updated.lat != null && updated.lon != null) {
      await drawRouteTo(updated);
    } else if (options.fromSearch) {
      elements.routeSummary.textContent =
        "Der Standort konnte noch nicht aufgelöst werden. Ich versuche es im Hintergrund weiter.";
    }
    return;
  }

  await drawRouteTo(detail);
}

function clearSelectedLayer() {
  layers.selection.clearLayers();
}

async function refreshDetail(id) {
  try {
    const detail = await fetchJson(`/api/item?id=${encodeURIComponent(id)}`);
    state.detailCache.set(id, detail);
    renderDetail(detail);
    clearSelectedLayer();
    const layer = renderGeometryPreview(detail, true);
    if (layer) {
      layer.addTo(layers.selection);
    }
    return detail;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function drawRouteTo(detail) {
  if (!state.location || state.locationSource !== "gps" || detail.lat == null || detail.lon == null) {
    elements.routeSummary.textContent = "Route nicht verfügbar: Bitte zuerst deinen echten Standort freigeben.";
    return;
  }

  const routeUrl = state.localMode
    ? `https://router.project-osrm.org/route/v1/foot/${state.location.lon},${state.location.lat};${detail.lon},${detail.lat}?overview=full&geometries=geojson`
    : `/api/route?fromLat=${state.location.lat}&fromLon=${state.location.lon}&toLat=${detail.lat}&toLon=${detail.lon}`;
  try {
    const payload = await fetchJson(routeUrl);
    const route = state.localMode
      ? {
          distance_m: payload.routes?.[0]?.distance,
          duration_s: payload.routes?.[0]?.duration,
          geometry: payload.routes?.[0]?.geometry?.coordinates || [],
          source: "OSRM",
        }
      : payload.route;
    const coordinates = route.geometry || [];
    layers.route.clearLayers();

    if (coordinates.length) {
      const latLngs = coordinates.map(([lon, lat]) => [lat, lon]);
      const polyline = L.polyline(latLngs, {
        color: "#f2a65a",
        weight: 5,
        opacity: 0.95,
      });
      polyline.addTo(layers.route);
    }

    const bounds = [];
    bounds.push([state.location.lat, state.location.lon]);
    bounds.push([detail.lat, detail.lon]);
    if (coordinates.length) {
      const latLngs = coordinates.map(([lon, lat]) => [lat, lon]);
      map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40] });
    } else {
      map.fitBounds(bounds, { padding: [40, 40] });
    }

    elements.routeSummary.textContent = `${kindLabel(detail.kind)} ausgewählt. Route: ${formatDistance(route.distance_m)} · ${formatDuration(route.duration_s)} · ${route.source === "fallback" ? "Luftlinie geschätzt" : "OSRM"}`;
  } catch (error) {
    console.error(error);
    layers.route.clearLayers();
    const line = L.polyline(
      [
        [state.location.lat, state.location.lon],
        [detail.lat, detail.lon],
      ],
      { color: "#f2a65a", weight: 4, dashArray: "8 10" },
    );
    line.addTo(layers.route);
    map.fitBounds(
      [
        [state.location.lat, state.location.lon],
        [detail.lat, detail.lon],
      ],
      { padding: [40, 40] },
    );
    elements.routeSummary.textContent = "Route konnte nicht geladen werden, daher zeige ich eine direkte Linie.";
  }
}

function scheduleSearch() {
  window.clearTimeout(state.searchTimer);
  state.searchTimer = window.setTimeout(() => {
    performSearch(elements.searchInput.value.trim());
  }, 300);
}

async function requestLocation() {
  if (!navigator.geolocation) {
    state.location = null;
    state.locationSource = "none";
    setStatus("Dieser Browser unterstützt keinen Standort. Suche ohne Entfernungsberechnung.");
    renderUserLocation();
    await performSearch(elements.searchInput.value.trim());
    return;
  }

  setStatus("Standort wird angefragt ...");
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      state.location = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      };
      state.locationSource = "gps";
      setStatus("Standort gefunden.");
      renderUserLocation();
      await performSearch(elements.searchInput.value.trim());
    },
    async (error) => {
      state.location = null;
      state.locationSource = "none";
      const reason = error && error.code === 1 ? "Standortzugriff wurde nicht freigegeben" : "Standort konnte nicht ermittelt werden";
      setStatus(`${reason}. Suche ohne Entfernungsberechnung.`);
      renderUserLocation();
      await performSearch(elements.searchInput.value.trim());
    },
    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    },
  );
}

function wireEvents() {
  elements.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    performSearch(elements.searchInput.value.trim());
  });

  elements.searchInput.addEventListener("input", scheduleSearch);

  elements.locationButton.addEventListener("click", requestLocation);

  elements.chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const query = chip.dataset.query || "";
      elements.searchInput.value = query;
      performSearch(query);
    });
  });
}

async function boot() {
  wireEvents();
  renderDetail(null);
  elements.searchInput.value = "";
  try {
    const config = await fetchJson("/api/config");
    state.center = config.defaultCenter || state.center;
  } catch (error) {
    try {
      const localData = await fetchJson("./data.json");
      state.localMode = true;
      state.localItems = localData.items || [];
      state.center = localData.defaultCenter || state.center;
      setStatus("Lokale App-Daten geladen.");
    } catch (localError) {
      console.warn(localError);
    }
  }
  requestLocation();
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch((error) => {
    console.warn("Service Worker konnte nicht registriert werden.", error);
  });
}

boot();
