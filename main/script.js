// Korrigierter API Key (mit einem 's' am Anfang)
const OPENROUTER_API_KEY = "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";

// Standard-Zentrum Linz (Ars Electronica Center)
const LINZ_CENTER = { lat: 48.3069, lng: 14.2858 };
const LINZ_BOUNDS = L.latLngBounds([
  [48.25, 14.20],
  [48.38, 14.40]
]);

let userLat = LINZ_CENTER.lat;
let userLng = LINZ_CENTER.lng;
let userMarker, targetMarker, routeLine;
let routeSegments = [];
let selectedTarget = null;
let lastUserPosition = { lat: LINZ_CENTER.lat, lng: LINZ_CENTER.lng };
let photoSpotMarkers = [];
let emergencyMarkers = [];
let wifiHotspotMarkers = [];
let photoSpotsVisible = false;

const festivalEvents = window.festivalEvents || [];

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function parseWifiHotspotsCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]).map(item => item.trim().toLowerCase());
  const indexes = {
    name: header.indexOf('name'),
    lat: header.indexOf('lat'),
    lon: header.indexOf('lon'),
    address: header.indexOf('adresse')
  };

  if (indexes.name === -1 || indexes.lat === -1 || indexes.lon === -1) {
    return [];
  }

  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    const name = values[indexes.name] || 'Wi‑Fi hotspot';
    const lat = Number(values[indexes.lat]);
    const lon = Number(values[indexes.lon]);
    const address = values[indexes.address] || '';

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }

    return {
      name,
      type: 'Wi‑Fi hotspot',
      lat,
      lng: lon,
      description: address ? `Public Wi‑Fi hotspot in Linz at ${address}.` : 'Public Wi‑Fi hotspot in Linz.'
    };
  }).filter(Boolean);
}

async function loadWifiHotspots() {
  try {
    const response = await fetch('data/Hotspot-Standorte.csv');
    if (!response.ok) {
      throw new Error(`CSV fetch failed: ${response.status}`);
    }

    const csvText = await response.text();
    const hotspots = parseWifiHotspotsCsv(csvText);
    if (hotspots.length) {
      return hotspots;
    }
  } catch (error) {
    console.warn('Could not load Wi‑Fi hotspots CSV:', error);
  }

  return festivalLocations.filter(item => /wifi|hotspot|internet|library|public wifi|connectivity/i.test(`${item.name} ${item.type} ${item.description}`)).slice(0, 8);
}

async function showWifiHotspots() {
  const hotspots = await loadWifiHotspots();

  if (wifiHotspotMarkers.length) {
    wifiHotspotMarkers.forEach(marker => map.removeLayer(marker));
    wifiHotspotMarkers = [];
  }

  if (!hotspots.length) {
    return false;
  }

  hotspots.forEach(item => {
    const marker = L.marker([Number(item.lat), Number(item.lng)], {
      icon: L.divIcon({
        className: 'custom-wifi-pin',
        html: '<div style="background:#38bdf8;border:3px solid white;border-radius:50%;width:14px;height:14px;box-shadow:0 0 0 4px rgba(56,189,248,0.2);"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      })
    }).addTo(map).bindPopup(`<b>${item.name}</b><br>${item.description || item.type || 'Public Wi‑Fi hotspot'}`);

    wifiHotspotMarkers.push(marker);
  });

  const bounds = L.latLngBounds(hotspots.map(item => [Number(item.lat), Number(item.lng)]));
  map.fitBounds(bounds.pad(0.2), { maxZoom: 14 });
  return true;
}

function playUiSound(type = 'click') {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const audioContext = new AudioCtx();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = type === 'success' ? 'triangle' : 'sine';
    oscillator.frequency.value = type === 'success' ? 660 : 420;
    gainNode.gain.value = 0.02;

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.18);
    oscillator.stop(audioContext.currentTime + 0.18);
  } catch (error) {
    console.warn('Audio unavailable:', error);
  }
}

// 1. Initialize map
const map = L.map('map', {
  minZoom: 12,
  maxZoom: 18,
  maxBounds: LINZ_BOUNDS,
  maxBoundsViscosity: 1.0
}).setView([LINZ_CENTER.lat, LINZ_CENTER.lng], 13);

function refreshMapLayout() {
  requestAnimationFrame(() => {
    map.invalidateSize();
  });
}

// Free OpenStreetMap tiles (no API key watermark)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

window.addEventListener('load', () => {
  refreshMapLayout();
});
window.addEventListener('resize', () => {
  refreshMapLayout();
});

function renderFestivalCards() {
  const list = document.getElementById('festival-list');
  if (!list) return;

  list.innerHTML = festivalEvents.map(event => `
    <button class="festival-card" type="button" data-id="${event.id}">
      <span class="tag">${event.category}</span>
      <h2>${event.name}</h2>
      <p>${event.description}</p>
    </button>
  `).join('');

  list.querySelectorAll('.festival-card').forEach(card => {
    card.addEventListener('click', () => {
      const choice = festivalEvents.find(item => item.id === card.dataset.id);
      if (!choice) return;

      const mainScreen = document.getElementById('main-screen');
      const festivalScreen = document.getElementById('festival-screen');
      if (mainScreen) mainScreen.classList.remove('hidden');
      if (festivalScreen) festivalScreen.classList.add('hidden');

      setTimeout(() => {
        refreshMapLayout();
      }, 100);

      playUiSound('success');
      showOnMap({
        name: choice.name,
        lat: choice.lat,
        lng: choice.lng,
        description: choice.description
      });
    });
  });
}

function updateUserMarker() {
  if (userMarker) {
    map.removeLayer(userMarker);
  }

  userMarker = L.marker([userLat, userLng], {
    icon: L.divIcon({
      className: 'custom-user-pin',
      html: '<div style="background:#22c55e;border:3px solid white;border-radius:50%;width:16px;height:16px;box-shadow:0 0 0 4px rgba(34,197,94,0.2);"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    })
  }).addTo(map)
    .bindPopup('<b>You are here!</b>');

  if (!selectedTarget) {
    userMarker.openPopup();
    map.setView([userLat, userLng], 16);
  }
}

function clearRoute() {
  if (routeLine) {
    map.removeLayer(routeLine);
    routeLine = null;
  }

  if (routeSegments.length) {
    routeSegments.forEach(segment => {
      if (segment && map.hasLayer(segment)) map.removeLayer(segment);
    });
    routeSegments = [];
  }
}

function isValidLatLngObject(target) {
  return !!target && Number.isFinite(Number(target.lat)) && Number.isFinite(Number(target.lng));
}

async function drawRouteToTarget(target, routeColor = '#00f0ff') {
  if (!isValidLatLngObject(target) || !Number.isFinite(userLat) || !Number.isFinite(userLng)) return;

  const lat = Number(target.lat);
  const lng = Number(target.lng);
  const url = `https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${lng},${lat}?overview=full&geometries=geojson&steps=false`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    let routeCoordinates = [
      [userLat, userLng],
      [target.lat, target.lng]
    ];

    if (response.ok && data?.routes?.length) {
      const geometry = data.routes[0]?.geometry;
      if (geometry?.coordinates?.length) {
        routeCoordinates = geometry.coordinates.map(([lon, lat]) => [lat, lon]);
      }
    }

    clearRoute();
    routeLine = L.polyline(routeCoordinates, {
      color: routeColor,
      weight: 5,
      opacity: 0.9,
      dashArray: '10, 12'
    }).addTo(map);

    const fromPoint = L.latLng(userLat, userLng);
    const toPoint = L.latLng(target.lat, target.lng);
    const combined = L.latLngBounds([fromPoint, toPoint]);
    map.fitBounds(combined.pad(0.25), { maxZoom: 16 });
  } catch (error) {
    console.error('Route could not be loaded:', error);
    clearRoute();
    routeLine = L.polyline([
      [userLat, userLng],
      [target.lat, target.lng]
    ], {
      color: routeColor,
      weight: 5,
      opacity: 0.9,
      dashArray: '10, 12'
    }).addTo(map);
  }
}

function getBestDepartureInfo(transportData) {
  if (!transportData || !Array.isArray(transportData.departures)) return null;

  for (const entry of transportData.departures) {
    if (!entry || !Array.isArray(entry.departures) || entry.departures.length === 0) continue;

    const nextDeparture = entry.departures[0];
    if (!nextDeparture || !nextDeparture.line) continue;

    return {
      stop: entry.stop,
      stopId: entry.stopId,
      lat: Number(entry.lat),
      lng: Number(entry.lng),
      line: String(nextDeparture.line),
      direction: String(nextDeparture.direction || 'Linz route'),
      countdown: String(nextDeparture.countdown || nextDeparture.dateTime || 'now')
    };
  }

  return null;
}

function drawTransitRouteToTarget(target) {
  if (!target || !target.nearestTransitStop) return;

  const stop = target.nearestTransitStop;
  const stopLat = Number(stop.lat);
  const stopLng = Number(stop.lng);
  const destinationLat = Number(target.lat);
  const destinationLng = Number(target.lng);

  clearRoute();

  const walkSegment = L.polyline([
    [userLat, userLng],
    [stopLat, stopLng]
  ], {
    color: '#f59e0b',
    weight: 5,
    opacity: 0.9,
    dashArray: '8, 10'
  }).addTo(map)
    .bindPopup('<strong>Walk to stop</strong><br>' + (stop.name || 'Transit stop'));

  const transitSegment = L.polyline([
    [stopLat, stopLng],
    [destinationLat, destinationLng]
  ], {
    color: '#34d399',
    weight: 5,
    opacity: 0.9,
    dashArray: '4, 10'
  }).addTo(map)
    .bindPopup('<strong>' + (target.transitLine || 'Transit route') + '</strong><br>' + (target.nearestTransitStop?.name || 'Transit stop'));

  routeSegments = [walkSegment, transitSegment];

  const stopMarker = L.marker([stopLat, stopLng], {
    icon: L.divIcon({
      className: 'custom-transit-stop',
      html: '<div style="background:#fbbf24;border:3px solid white;border-radius:50%;width:16px;height:16px;box-shadow:0 0 0 4px rgba(251,191,36,0.2);"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    })
  }).addTo(map)
    .bindPopup('<b>' + (target.transitLine || 'Transit') + '</b><br>' + (stop.name || 'Transit stop'));

  routeSegments.push(stopMarker);

  const bounds = L.latLngBounds([
    [userLat, userLng],
    [stopLat, stopLng],
    [destinationLat, destinationLng]
  ]);
  map.fitBounds(bounds.pad(0.25), { maxZoom: 15 });
}

// 2. Request and track the user's geolocation
if (navigator.geolocation) {
  const updatePosition = position => {
    const newLat = position.coords.latitude;
    const newLng = position.coords.longitude;
    const distance = lastUserPosition
      ? Math.hypot(newLat - lastUserPosition.lat, newLng - lastUserPosition.lng) * 111000
      : Infinity;

    if (distance > 5 || !lastUserPosition) {
      userLat = newLat;
      userLng = newLng;
      lastUserPosition = { lat: newLat, lng: newLng };
      updateUserMarker();

      if (selectedTarget) {
        drawRouteToTarget(selectedTarget);
      }
    }
  };

  navigator.geolocation.getCurrentPosition(
    updatePosition,
    error => console.log('GPS not enabled — default Linz location is being used.', error)
  );

  navigator.geolocation.watchPosition(
    updatePosition,
    error => console.log('Error tracking your location:', error),
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000
    }
  );
} else {
  updateUserMarker();
}

// 3. Local database of points of interest across Linz
const festivalLocations = window.festivalLocations || [];

// 4. Send AI request to OpenRouter
async function getCssContext() {
  const cssHrefs = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .map(link => link.href)
    .filter(Boolean);

  const fallbackCss = ['styles.css'];
  const uniqueCss = [...new Set([...cssHrefs, ...fallbackCss.map(file => new URL(file, window.location.href).href)])];

  const cssBlocks = [];

  for (const cssUrl of uniqueCss) {
    try {
      const response = await fetch(cssUrl, { cache: 'no-store' });
      if (!response.ok) continue;

      const cssText = await response.text();
      if (cssText && cssText.trim()) {
        cssBlocks.push(`/* ${cssUrl} */\n${cssText}`);
      }
    } catch (error) {
      console.warn('Could not load CSS file for AI context:', cssUrl, error);
    }
  }

  return cssBlocks.join('\n\n');
}

async function triggerSearchButtonAnimation() {
  const button = document.querySelector('.search-button');
  const arrow = document.querySelector('.search-arrow');
  if (!button || !arrow) return;

  button.classList.remove('is-launching');
  arrow.style.opacity = '1';
  arrow.style.transform = 'translateY(0) rotate(0deg) scale(1)';
  button.classList.add('is-launching');

  setTimeout(() => {
    arrow.style.opacity = '0.5';
    arrow.style.transform = 'translateY(4px) rotate(0deg) scale(0.9)';
  }, 140);

  setTimeout(() => {
    arrow.style.opacity = '1';
    arrow.style.transform = 'translateY(0) rotate(0deg) scale(1)';
    button.classList.remove('is-launching');
  }, 900);
}

async function searchTransportStops(query) {
  try {
    const apiBase = window.location.origin || 'http://localhost:8000';
    const response = await fetch(`${apiBase}/api/transport?query=${encodeURIComponent(query)}&lat=${userLat}&lng=${userLng}`);
    if (!response.ok) return null;

    const json = await response.json();
    if (!json || !json.stops || json.stops.length === 0) return null;

    return json;
  } catch (error) {
    console.warn('Transport lookup unavailable:', error);
    return null;
  }
}

function findLocationByText(text) {
  const target = (text || '').trim();
  if (!target) return null;

  const normalized = target.toLowerCase();
  const matched = festivalLocations.find(item => {
    const haystack = `${item.name || ''} ${item.type || ''} ${item.description || ''}`.toLowerCase();
    return haystack.includes(normalized);
  });

  return matched || null;
}

function clearPhotoSpots() {
  if (photoSpotMarkers.length) {
    photoSpotMarkers.forEach(marker => map.removeLayer(marker));
    photoSpotMarkers = [];
  }
  photoSpotsVisible = false;
}

function clearEmergencyPoints() {
  if (emergencyMarkers.length) {
    emergencyMarkers.forEach(marker => map.removeLayer(marker));
    emergencyMarkers = [];
  }
}

function spawnPacmanPulse() {
  const pacman = document.getElementById('pacman-indicator');
  if (!pacman) return;

  pacman.classList.remove('hidden');
  pacman.classList.add('is-eating');
  setTimeout(() => {
    pacman.classList.remove('is-eating');
    pacman.classList.add('hidden');
  }, 700);
}

function showPhotoSpots() {
  clearPhotoSpots();

  const interestingSpots = festivalLocations.filter(item => {
    const text = `${item.name || ''} ${item.type || ''} ${item.description || ''}`.toLowerCase();
    return /view|panorama|castle|museum|park|old town|heritage|landmark|bridge|lookout|square|plaza|river|church/i.test(text);
  }).slice(0, 6);

  if (!interestingSpots.length) return false;

  interestingSpots.forEach(item => {
    const marker = L.marker([Number(item.lat), Number(item.lng)], {
      icon: L.divIcon({
        className: 'custom-photo-pin',
        html: '<div style="background:#fbbf24;border:3px solid white;border-radius:50%;width:16px;height:16px;box-shadow:0 0 0 4px rgba(251,191,36,0.2);"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      })
    }).addTo(map)
      .bindPopup(`<b>${item.name}</b><br>${item.description || item.type || 'Photo spot in Linz'}`);

    photoSpotMarkers.push(marker);
  });

  photoSpotsVisible = true;
  const bounds = L.latLngBounds(interestingSpots.map(item => [Number(item.lat), Number(item.lng)]));
  map.fitBounds(bounds.pad(0.25), { maxZoom: 14 });
  return true;
}

function resetMapState() {
  clearPhotoSpots();
  clearEmergencyPoints();
  clearRoute();

  if (targetMarker) {
    map.removeLayer(targetMarker);
    targetMarker = null;
  }

  selectedTarget = null;
  const resultTitle = document.getElementById('result-title');
  const resultDesc = document.getElementById('result-desc');
  if (resultTitle) resultTitle.innerText = 'Found destination';
  if (resultDesc) resultDesc.innerText = '';

  map.setView([LINZ_CENTER.lat, LINZ_CENTER.lng], 13);
}

function getDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = value => (value * Math.PI) / 180;
  const earthRadius = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findCategoryMatches(categoryKey, keywordText = '') {
  const keywordLower = (keywordText || '').trim().toLowerCase();
  const categoryMaps = {
    coffee: ['coffee', 'cafe', 'bakery', 'espresso', 'breakfast', 'restaurant', 'pizza', 'food'],
    nightlife: ['nightlife', 'club', 'concert', 'music', 'late night', 'events', 'bar'],
    wifi: ['wifi', 'free wifi', 'internet', 'connectivity', 'wifi hotspot', 'library', 'public wifi'],
    park: ['park', 'garden', 'green space', 'nature', 'walking', 'playground', 'riverfront'],
    family: ['family', 'playground', 'kids', 'child', 'park', 'museum', 'green space', 'fun'],
    events: ['festival', 'event', 'culture', 'music', 'concert', 'summer', 'nightline'],
    museum: ['museum', 'art', 'exhibition', 'culture', 'heritage', 'gallery']
  };

  const terms = categoryMaps[categoryKey] || [];
  const matches = festivalLocations.filter(item => {
    const haystack = `${item.name || ''} ${item.type || ''} ${item.description || ''}`.toLowerCase();
    const matchesCategory = terms.some(term => haystack.includes(term));
    const matchesKeyword = !keywordLower || haystack.includes(keywordLower);
    return matchesCategory && matchesKeyword;
  });

  return matches.slice(0, 5);
}

async function handleSlashCommand(query, statusEl) {
  const command = query.trim();
  spawnPacmanPulse();

  if (command === '/reset' || command === '/clear') {
    resetMapState();
    statusEl.innerText = 'Map reset to the default Linz overview.';
    return true;
  }

  if (command === '/info' || command === '/about') {
    statusEl.innerText = 'Linz Compass helps you discover festivals, nearby places, routes, and transport in Linz.';
    return true;
  }

  if (command === '/wifi' || command.startsWith('/wifi ')) {
    const wifiVisible = await showWifiHotspots();
    statusEl.innerText = wifiVisible ? 'All public Wi‑Fi hotspots in Linz are visible on the map.' : 'No Wi‑Fi hotspots were found in the Linz dataset.';
    return true;
  }

  if (command === '/nearby' || command.startsWith('/nearby ')) {
    const keyword = command.replace(/^\/nearby\s*/i, '').trim();
    const nearby = festivalLocations
      .filter(item => item && Number(item.lat) && Number(item.lng))
      .map(item => ({
        ...item,
        distanceKm: getDistanceKm(userLat, userLng, Number(item.lat), Number(item.lng))
      }))
      .filter(item => item.distanceKm <= 3)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const filtered = keyword
      ? nearby.filter(item => `${item.name} ${item.type} ${item.description}`.toLowerCase().includes(keyword.toLowerCase()))
      : nearby;

    if (!filtered.length) {
      statusEl.innerText = 'No nearby places were found within 3 km of you.';
      return true;
    }

    const target = filtered[0];
    showOnMap({ ...target, routeMode: 'drive', description: `Nearby spot in Linz: ${target.description || target.type || 'Local attraction'}` });
    statusEl.innerText = `Found ${filtered.length} nearby place${filtered.length > 1 ? 's' : ''} around your location.`;
    return true;
  }

  const categoryCommands = [
    {
      names: ['/coffee', '/cafe'],
      label: 'Coffee',
      key: 'coffee',
      description: 'Coffee and food stop in Linz.'
    },
    {
      names: ['/nightlife', '/club', '/bar'],
      label: 'Nightlife',
      key: 'nightlife',
      description: 'Nightlife and evening spots in Linz.'
    },
    {
      names: ['/wifi', '/internet'],
      label: 'Wi‑Fi',
      key: 'wifi',
      description: 'Places with internet access and digital help.'
    },
    {
      names: ['/park', '/green', '/nature'],
      label: 'Park',
      key: 'park',
      description: 'A green park or nature place in Linz.'
    },
    {
      names: ['/family', '/kids'],
      label: 'Family',
      key: 'family',
      description: 'Family-friendly place in Linz.'
    },
    {
      names: ['/events', '/festival', '/culture'],
      label: 'Events',
      key: 'events',
      description: 'Upcoming event or cultural venue in Linz.'
    },
    {
      names: ['/museum', '/gallery', '/art'],
      label: 'Museum',
      key: 'museum',
      description: 'Museum or cultural exhibition in Linz.'
    }
  ];

  for (const category of categoryCommands) {
    const matchedName = category.names.find(name => command === name || command.startsWith(`${name} `));
    if (!matchedName) continue;

    const keyword = command.replace(new RegExp(`^${matchedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i'), '').trim();
    const matches = findCategoryMatches(category.key, keyword);

    if (!matches.length) {
      statusEl.innerText = `No ${category.label.toLowerCase()} options were found in Linz.`;
      return true;
    }

    const target = matches[0];
    showOnMap({
      ...target,
      routeMode: 'drive',
      description: `${category.description} ${target.description || ''}`
    });
    statusEl.innerText = `${category.label} spot found in Linz.`;
    return true;
  }

  if (command === '/unspot' || command === '/unphotospot') {
    clearPhotoSpots();
    statusEl.innerText = 'Photo spots hidden.';
    return true;
  }

  if (command === '/unemergency') {
    clearEmergencyPoints();
    statusEl.innerText = 'Emergency markers hidden.';
    return true;
  }

  if (command === '/photospot' || command.startsWith('/photospot ')) {
    if (showPhotoSpots()) {
      statusEl.innerText = 'Showing photo spots across Linz.';
    } else {
      statusEl.innerText = 'No photo spots were found.';
    }
    return true;
  }

  if (command === '/emergency' || command.startsWith('/emergency ')) {
    clearEmergencyPoints();
    const matches = festivalLocations.filter(item => /hospital|clinic|ambulance|emergency|aed|defibrillator|health|medical/i.test(`${item.name} ${item.type} ${item.description}`)).slice(0, 8);
    if (!matches.length) {
      statusEl.innerText = 'No emergency locations found.';
      return true;
    }

    matches.forEach(item => {
      const marker = L.marker([Number(item.lat), Number(item.lng)], {
        icon: L.divIcon({
          className: 'custom-emergency-pin',
          html: '<div style="background:#ef4444;border:3px solid white;border-radius:50%;width:16px;height:16px;box-shadow:0 0 0 4px rgba(239,68,68,0.2);"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        })
      }).addTo(map).bindPopup(`<b>${item.name}</b><br>${item.description || item.type || 'Emergency point'}`);

      emergencyMarkers.push(marker);
    });

    map.fitBounds(L.latLngBounds(matches.map(item => [Number(item.lat), Number(item.lng)])), { maxZoom: 14 });
    statusEl.innerText = 'Emergency locations are visible.';
    return true;
  }

  if (command.startsWith('/bus')) {
    const busTarget = command.replace(/^\/bus\s*/i, '').trim();
    const endTarget = findLocationByText(busTarget) || selectedTarget || festivalLocations.find(item => /ars electronica|main square|main plaza|center/i.test(`${item.name} ${item.type}`)) || festivalLocations[0];

    if (!endTarget) {
      statusEl.innerText = 'I could not find a route target for the bus command.';
      return true;
    }

    const target = { ...endTarget, description: `Bus route towards ${endTarget.name}.`, routeMode: 'transit' };
    const transportContext = await searchTransportStops(endTarget.name || 'bus');
    if (transportContext && transportContext.stops?.length) {
      target.nearestTransitStop = transportContext.stops[0];
      target.transitLine = getBestDepartureInfo(transportContext)?.line || 'Bus';
    }
    showOnMap(target);
    statusEl.innerText = 'Bus route planned with live stop data.';
    return true;
  }

  if (command.startsWith('/sightseeing') || command.startsWith('/sighhtseeing')) {
    const suffix = command.replace(/^\/sighhtseeing|^\/sightseeing/i, '').trim();
    const searchTerms = suffix ? suffix.split(/\s+/).slice(0, 6).join(' ') : 'viewpoint,castle,park';
    const matches = festivalLocations.filter(item => {
      const haystack = `${item.name || ''} ${item.type || ''} ${item.description || ''}`.toLowerCase();
      return haystack.includes(searchTerms.toLowerCase()) || /view|castle|museum|park|old town|heritage|landmark|lookout|square/i.test(haystack);
    }).slice(0, 4);

    if (!matches.length) {
      statusEl.innerText = 'No sightseeing route could be created.';
      return true;
    }

    const routePoints = [[userLat, userLng], ...matches.map(item => [Number(item.lat), Number(item.lng)])];
    clearRoute();
    routeLine = L.polyline(routePoints, {
      color: '#a78bfa',
      weight: 5,
      opacity: 0.9,
      dashArray: '5, 10'
    }).addTo(map);

    map.fitBounds(L.latLngBounds(routePoints), { maxZoom: 14 });
    statusEl.innerText = 'Sightseeing route planned.';
    return true;
  }

  if (command.startsWith('/planroute')) {
    const suffix = command.replace(/^\/planroute/i, '').trim();
    const routeParts = suffix.split(/\s*(?:,|->| to )\s*/i).map(part => part.trim()).filter(Boolean);
    const fromText = routeParts[0] && routeParts[0].toLowerCase() !== 'where you are' ? routeParts[0] : 'your location';
    const toText = routeParts[1] || routeParts[0] || 'ars electronica';

    const startTarget = fromText === 'your location' ? { lat: userLat, lng: userLng } : findLocationByText(fromText) || { lat: userLat, lng: userLng };
    const endTarget = findLocationByText(toText) || selectedTarget || festivalLocations[0];

    if (!endTarget) {
      statusEl.innerText = 'I could not find a destination for that route.';
      return true;
    }

    const target = {
      ...endTarget,
      name: endTarget.name,
      description: `Route from ${fromText} to ${endTarget.name}.`,
      routeMode: 'route-plan'
    };

    showOnMap(target);
    statusEl.innerText = 'Route planned with red line.';
    return true;
  }

  return false;
}

async function searchWithAI() {
  const query = document.getElementById('userInput').value.trim();
  const statusEl = document.getElementById('status');

  if (!query) return;

  triggerSearchButtonAnimation();

  if (query.startsWith('/')) {
    const isHandled = await handleSlashCommand(query, statusEl);
    if (isHandled) return;
  }

  statusEl.innerText = 'The AI is processing your request...';

  const cssContext = await getCssContext();
  const transportContext = await searchTransportStops(query);

  const promptText = `
    You are a local guide for Linz, Austria.

    App styling and UI context (all linked CSS files):
    ${cssContext || 'No CSS content available.'}

    Public transport context from the LINZ AG EFA API:
    ${transportContext ? JSON.stringify(transportContext) : 'No transport stops found for this query.'}

    Available places across Linz:
    ${JSON.stringify(festivalLocations)}

    Extra food and dining options in Linz:
    [
      {"name":"La Piazza Trattoria","type":"Italian restaurant","lat":48.3062,"lng":14.2839,"description":"Italian restaurant close to central Linz with pasta and pizza."},
      {"name":"Ciao Bella Linz","type":"Italian restaurant","lat":48.3039,"lng":14.2897,"description":"Popular pizza and pasta place in the city center."},
      {"name":"Balkan Grill Linz","type":"Turkish / Balkan food","lat":48.3041,"lng":14.2876,"description":"Good kebab and grilled options in central Linz."},
      {"name":"Sushi Club Linz","type":"Japanese / sushi","lat":48.3082,"lng":14.2901,"description":"Japanese restaurant with sushi and bowls in the downtown area."},
      {"name":"Mamma Mia Pizza","type":"Italian restaurant","lat":48.3001,"lng":14.2920,"description":"Casual pizza and pasta option in Linz suitable for a quick meal."},
      {"name":"Veggie Vibe","type":"Vegan / vegetarian","lat":48.3067,"lng":14.2882,"description":"Vegetarian and vegan dining near the main city center."},
      {"name":"Mittelmeer Kitchen","type":"Mediterranean food","lat":48.3026,"lng":14.2913,"description":"Mediterranean options and fresh dishes in central Linz."}
    ]

    Current user GPS location: Latitude ${userLat}, Longitude ${userLng}
    User request: "${query}"

    Search across the whole city of Linz and choose exactly ONE suitable place from the list.
    If the user asks for buses, trains, trams, public transport, stations, stops, departure times, or mobility, you may select a relevant public transport stop from the transport context and set the route to transit mode.
    If the request is for sightseeing, city tour, walk, landmarks, or a cultural route, choose a central route with multiple nearby points and return a sightseeing trip plan.
    If the request is about food, include more food options than just the food court—Italian, vegan, Turkish, sushi, Mediterranean, and pizza are valid options.
    The location must not only be at the Ars Electronica Center; search throughout central Linz and the surrounding area.
    If the request is about food, toilets, culture, technology, nightlife, or sights, choose the most relevant place in Linz.
    Use the CSS context to understand the app design language and keep suggestions aligned with the interface styling.
    Return ONLY valid JSON (no Markdown, no \`\`\`json):
    {"name": "Place name", "lat": 48.xxx, "lng": 14.xxx, "description": "Explanation for the user in English", "routeMode": "drive" or "transit" or "sightseeing"}
  `;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-medium-3-5',
        messages: [{ role: 'user', content: promptText }]
      })
    });

    const data = await response.json();

    if (data.error) {
      statusEl.innerText = 'OpenRouter error: ' + data.error.message;
      return;
    }

    let rawResponse = data.choices[0].message.content;

    // Clean JSON
    rawResponse = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const locationResult = JSON.parse(rawResponse);

    if (transportContext?.stops?.length && locationResult.routeMode === 'transit') {
      locationResult.nearestTransitStop = transportContext.stops[0];
    }

    showOnMap(locationResult);
    statusEl.innerText = '';
  } catch (err) {
    console.error(err);
    statusEl.innerText = 'Error with the AI request. Press F12 for the browser console.';
  }
}

// 5. Mark results on the map
function showOnMap(target) {
  if (!isValidLatLngObject(target)) {
    console.warn('Invalid target coordinates ignored:', target);
    return;
  }

  selectedTarget = target;

  document.getElementById('result-box').style.display = 'block';
  document.getElementById('result-title').innerText = target.name;
  document.getElementById('result-desc').innerText = target.description;

  const safeLat = Number(target.lat);
  const safeLng = Number(target.lng);

  if (targetMarker) map.removeLayer(targetMarker);

  targetMarker = L.marker([safeLat, safeLng], {
    icon: L.divIcon({
      className: 'custom-target-pin',
      html: '<div style="background:#f97316;border:3px solid white;border-radius:50%;width:18px;height:18px;box-shadow:0 0 0 4px rgba(249,115,22,0.2);"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    })
  }).addTo(map)
    .bindPopup(`<b>${target.name}</b><br>${target.description}`).openPopup();

  setTimeout(() => {
    refreshMapLayout();
  }, 150);

  map.flyTo([safeLat, safeLng], 15, { animate: true, duration: 1.2 });

  if (target.routeMode === 'transit' && target.nearestTransitStop) {
    drawTransitRouteToTarget(target);
    return;
  }

  if (target.routeMode === 'route-plan') {
    drawRouteToTarget(target, '#ef4444');
    return;
  }

  if (target.routeMode === 'sightseeing') {
    const suggestedStops = festivalLocations.filter(item => item.lat && item.lng).slice(0, 3);
    if (suggestedStops.length > 1) {
      const sightseeingRoute = [
        [userLat, userLng],
        ...suggestedStops.map(point => [Number(point.lat), Number(point.lng)])
      ];
      clearRoute();
      routeLine = L.polyline(sightseeingRoute, {
        color: '#a78bfa',
        weight: 5,
        opacity: 0.9,
        dashArray: '5, 10'
      }).addTo(map);
    }
  }

  drawRouteToTarget(target);
}

document.getElementById('back-to-festival').addEventListener('click', () => {
  const festivalScreen = document.getElementById('festival-screen');
  const mainScreen = document.getElementById('main-screen');
  if (festivalScreen) festivalScreen.classList.remove('hidden');
  if (mainScreen) mainScreen.classList.add('hidden');
  clearRoute();
  if (selectedTarget && targetMarker) {
    map.removeLayer(targetMarker);
    targetMarker = null;
  }
  selectedTarget = null;
  setTimeout(() => {
    refreshMapLayout();
  }, 100);
});

const transportPanel = document.getElementById('transport-panel');
const transportStart = document.getElementById('transport-start');
const transportEnd = document.getElementById('transport-end');
const transportDate = document.getElementById('transport-date');
const transportTime = document.getElementById('transport-time');
const transportResults = document.getElementById('transport-results');

function setDefaultTransportForm() {
  if (!transportDate) return;
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  transportDate.value = `${yyyy}-${mm}-${dd}`;
  transportTime.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (selectedTarget && transportEnd) {
    transportEnd.value = selectedTarget.name;
  }
  if (transportStart) {
    transportStart.value = 'Your location';
  }
}

function renderTransportOptions(items) {
  if (!transportResults) return;
  if (!items || items.length === 0) {
    transportResults.innerHTML = '<p class="empty-state">No connection suggestions yet.</p>';
    return;
  }

  transportResults.innerHTML = items.map((option, index) => `
    <div class="route-option" data-index="${index}">
      <strong>${option.line}</strong>
      <small>${option.route}</small>
      <small>${option.time}</small>
    </div>
  `).join('');
}

function drawRouteFromTransportData(fromTransport, toTransport, target) {
  const fromDeparture = getBestDepartureInfo(fromTransport);
  const toDeparture = getBestDepartureInfo(toTransport);
  const primaryStop = toDeparture || fromDeparture || (toTransport && toTransport.stops?.[0]);

  if (!primaryStop || !target || !isValidLatLngObject(target)) {
    return;
  }

  const stopName = primaryStop.stop || (primaryStop.name || 'Transit stop');
  const stopLat = Number(primaryStop.lat || target.lat);
  const stopLng = Number(primaryStop.lng || target.lng);
  const lineLabel = (primaryStop.line || 'Transit route').toString();

  const walkSegment = L.polyline([
    [userLat, userLng],
    [stopLat, stopLng]
  ], {
    color: '#f59e0b',
    weight: 5,
    opacity: 0.9,
    dashArray: '8, 10'
  }).addTo(map)
    .bindPopup('<strong>Walk to stop</strong><br>' + stopName + '<br><small>' + lineLabel + '</small>');

  const destinationRoute = L.polyline([
    [stopLat, stopLng],
    [Number(target.lat), Number(target.lng)]
  ], {
    color: '#34d399',
    weight: 5,
    opacity: 0.9,
    dashArray: '4, 10'
  }).addTo(map)
    .bindPopup('<strong>' + lineLabel + '</strong><br>' + stopName + ' → ' + target.name);

  const stopMarker = L.marker([stopLat, stopLng], {
    icon: L.divIcon({
      className: 'custom-transit-stop',
      html: '<div style="background:#22c55e;border:3px solid white;border-radius:50%;width:16px;height:16px;box-shadow:0 0 0 4px rgba(34,197,94,0.2);"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    })
  }).addTo(map)
    .bindPopup('<b>' + lineLabel + '</b><br>' + stopName + '<br>' + (primaryStop.direction || 'Connection'));

  routeSegments = [walkSegment, destinationRoute, stopMarker];

  const bounds = L.latLngBounds([
    [userLat, userLng],
    [stopLat, stopLng],
    [Number(target.lat), Number(target.lng)]
  ]);
  map.fitBounds(bounds.pad(0.25), { maxZoom: 15 });
}

async function refreshTransportSuggestions() {
  const startQuery = transportStart?.value || 'Your location';
  const endQuery = transportEnd?.value || (selectedTarget ? selectedTarget.name : 'Ars Electronica Festival');
  const fromTransport = await searchTransportStops(startQuery);
  const toTransport = await searchTransportStops(endQuery);

  const routeOptions = [];
  const fromDeparture = getBestDepartureInfo(fromTransport);
  const toDeparture = getBestDepartureInfo(toTransport);

  if (fromDeparture) {
    routeOptions.push({
      line: `Line ${fromDeparture.line}`,
      route: `${fromDeparture.stop} → ${endQuery}`,
      time: `${fromDeparture.direction} • next ${fromDeparture.countdown}`
    });
  } else if (fromTransport && fromTransport.stops?.length) {
    routeOptions.push({
      line: 'Bus / Tram',
      route: `${fromTransport.stops[0].name} → ${endQuery}`,
      time: `${transportDate?.value || 'Today'} • ${transportTime?.value || 'now'}`
    });
  }

  if (toDeparture) {
    routeOptions.push({
      line: `Stop ${toDeparture.line}`,
      route: `${toDeparture.stop}`,
      time: `${toDeparture.direction} • ${toDeparture.countdown}`
    });
  } else if (toTransport && toTransport.stops?.length) {
    routeOptions.push({
      line: 'Best stop',
      route: `${toTransport.stops[0].name}`,
      time: `Arrival near ${endQuery}`
    });
  }

  if (selectedTarget && (toTransport || fromTransport)) {
    const target = selectedTarget;
    const transitStop = (toDeparture || fromDeparture || toTransport?.stops?.[0] || fromTransport?.stops?.[0]);
    if (transitStop) {
      target.nearestTransitStop = {
        name: transitStop.stop || transitStop.name || 'Transit stop',
        lat: Number(transitStop.lat || target.lat),
        lng: Number(transitStop.lng || target.lng)
      };
      target.transitLine = (toDeparture && toDeparture.line) || (fromDeparture && fromDeparture.line) || 'Transit';
      drawRouteFromTransportData(fromTransport, toTransport, target);
    }
  }

  if (routeOptions.length === 0) {
    routeOptions.push({
      line: 'Local route suggestion',
      route: `${startQuery} → ${endQuery}`,
      time: 'Approx. 10–25 min by local transit'
    });
  }

  renderTransportOptions(routeOptions.slice(0, 4));
}

const travelPlannerToggle = document.getElementById('travel-planner-toggle');
const closeTransportPanel = document.getElementById('close-transport-panel');
const transportSearchButton = document.getElementById('transport-search-button');
const eatButton = document.getElementById('eat-button');
const dogEater = document.getElementById('dog-eater');

if (travelPlannerToggle) {
  travelPlannerToggle.addEventListener('click', () => {
    if (transportPanel) {
      transportPanel.classList.toggle('hidden');
      setDefaultTransportForm();
      playUiSound('click');
    }
  });
}

if (closeTransportPanel) {
  closeTransportPanel.addEventListener('click', () => {
    if (transportPanel) transportPanel.classList.add('hidden');
    playUiSound('click');
  });
}

if (transportSearchButton) {
  transportSearchButton.addEventListener('click', async () => {
    playUiSound('success');
    await refreshTransportSuggestions();
  });
}

if (eatButton) {
  eatButton.addEventListener('click', () => {
    if (dogEater) {
      dogEater.classList.add('is-eating');
      if (transportPanel) transportPanel.classList.add('hidden');
      setTimeout(() => dogEater.classList.remove('is-eating'), 900);
    }
    playUiSound('success');
  });
}

const userInput = document.getElementById('userInput');
if (userInput) {
  userInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      playUiSound('click');
      searchWithAI();
    }
  });
}

renderFestivalCards();
setDefaultTransportForm();
window.searchWithAI = searchWithAI;
