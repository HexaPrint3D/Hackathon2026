// Korrigierter API Key (mit einem 's' am Anfang)
const OPENROUTER_API_KEY = "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";

// Standard-Zentrum Linz (Ars Electronica Center)
let userLat = 48.3098;
let userLng = 14.2842;
let userMarker, targetMarker, routeLine;
let selectedTarget = null;

const festivalEvents = [
  {
    id: 'ars-electronica',
    name: 'Ars Electronica Festival',
    category: 'Kunst & Technik',
    description: 'Zentrum für Medienkunst, KI und interaktive Installationen in Linz.',
    lat: 48.3098,
    lng: 14.2842
  },
  {
    id: 'linz-kultur-sommer',
    name: 'Linz Kultur Sommer',
    category: 'Kultur',
    description: 'Sommerliche Kultur- und Musikveranstaltungen in der Stadt.',
    lat: 48.3056,
    lng: 14.2864
  },
  {
    id: 'jazz-city',
    name: 'Jazz in the City',
    category: 'Musik',
    description: 'Live-Jazz im Stadtzentrum und auf öffentlichen Plätzen.',
    lat: 48.3034,
    lng: 14.2889
  },
  {
    id: 'film-festival',
    name: 'Film Festival Linz',
    category: 'Film',
    description: 'Filmvorführungen, Diskussionen und Events im Kulturviertel.',
    lat: 48.3007,
    lng: 14.2878
  },
  {
    id: 'donaufest',
    name: 'Donau Festival',
    category: 'Freizeit',
    description: 'Open-Air-Veranstaltungen und Menschenmassen am Donauufer.',
    lat: 48.3008,
    lng: 14.2857
  },
  {
    id: 'nachtleben',
    name: 'Linz Nightline',
    category: 'Nachtleben',
    description: 'Musik, Clubs und Abendprogramm in der Linzer Innenstadt.',
    lat: 48.2995,
    lng: 14.3120
  }
];

// 1. Karte initialisieren
const map = L.map('map').setView([userLat, userLng], 15);

// Kostenlose OpenStreetMap-Kacheln (ohne API-Key Wasserzeichen)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

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

  userMarker = L.marker([userLat, userLng]).addTo(map)
    .bindPopup('<b>Du bist hier!</b>');

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
}

async function drawRouteToTarget(target) {
  if (!target || !userLat || !userLng) return;

  const url = `https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${target.lng},${target.lat}?overview=full&geometries=geojson&steps=false`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!data.routes || !data.routes.length) return;

    const routeCoordinates = data.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
    clearRoute();
    routeLine = L.polyline(routeCoordinates, {
      color: '#00f0ff',
      weight: 5,
      opacity: 0.9,
      dashArray: '10, 12'
    }).addTo(map);

    const bounds = L.latLngBounds(routeCoordinates);
    map.fitBounds(bounds.pad(0.2), { maxZoom: 16 });
  } catch (error) {
    console.error('Route konnte nicht geladen werden:', error);
  }
}

// 2. Geolocation des Nutzers abfragen und laufend verfolgen
if (navigator.geolocation) {
  const updatePosition = position => {
    userLat = position.coords.latitude;
    userLng = position.coords.longitude;
    updateUserMarker();

    if (selectedTarget) {
      drawRouteToTarget(selectedTarget);
    }
  };

  navigator.geolocation.getCurrentPosition(
    updatePosition,
    error => console.log('GPS nicht aktiviert – Standard-Standort Linz wird verwendet.', error)
  );

  navigator.geolocation.watchPosition(
    updatePosition,
    error => console.log('Fehler beim Verfolgen des Standorts:', error),
    {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 20000
    }
  );
} else {
  updateUserMarker();
}

// 3. Datenbank von Treffpunkten in ganz Linz
const festivalLocations = [
  { name: 'Ars Electronica Center', type: 'Museum / KI / VR', lat: 48.3098, lng: 14.2842, description: 'Zentrum für Medienkunst, Deep Space 8K und KI-Labore in Linz.' },
  { name: 'OK Center / OK Quarter', type: 'Ausstellung / Kunst / Festival', lat: 48.3032, lng: 14.2902, description: 'Wichtiger Kunst- und Festival-Ort in Linz im Stadtzentrum.' },
  { name: 'Lentos Kunstmuseum Linz', type: 'Museum / Ausstellung', lat: 48.3085, lng: 14.2875, description: 'Moderne Kunst und Ausstellungen direkt in der Innenstadt.' },
  { name: 'Hauptplatz Linz', type: 'Stadtplatz / Info / Essen', lat: 48.3056, lng: 14.2864, description: 'Zentraler Platz in Linz mit Cafés, Markt und Festival-Atmosphäre.' },
  { name: 'Danube Park / Donauufer', type: 'Spaziergang / Aussicht / Freizeit', lat: 48.3008, lng: 14.2857, description: 'Schöner Spazierweg am Ufer der Donau in Linz.' },
  { name: 'Med Campus JKU Linz', type: 'Wissenschaft / Technik', lat: 48.3005, lng: 14.2990, description: 'Technik- und Wissenschaftsstandorte rund um die Johannes Kepler Universität.' },
  { name: 'Posthof Linz', type: 'Kultur / Konzert / Nachtleben', lat: 48.2995, lng: 14.3120, description: 'Beliebter Ort für Konzerte, Kultur und Abendprogramm.' },
  { name: 'Landesgalerie Linz / Stadtmuseum', type: 'Museum / Kultur', lat: 48.3051, lng: 14.2837, description: 'Kultur- und Kunstinstitution im Zentrum von Linz.' },
  { name: 'Cubus Restaurant & Bistro', type: 'Essen / Trinken', lat: 48.3099, lng: 14.2843, description: 'Gutes Restaurant in der Nähe des Ars Electronica Centers.' },
  { name: 'Foodcourt am Hauptplatz', type: 'Essen / Streetfood', lat: 48.3058, lng: 14.2862, description: 'Viele Optionen für Snacks, Lunch und Streetfood im Zentrum.' },
  { name: 'Öffentliche Toilette am Hauptplatz', type: 'Toilette / WC', lat: 48.3059, lng: 14.2861, description: 'Öffentliche Toilette in der Innenstadt von Linz.' },
  { name: 'Schlossmuseum / Altstadt', type: 'Sehenswürdigkeit / Stadtgeschichte', lat: 48.3052, lng: 14.2857, description: 'Historischer Bereich mit Altstadtcharakter und Sehenswürdigkeiten.' }
];

// 4. KI-Anfrage an OpenRouter senden
async function searchWithAI() {
  const query = document.getElementById('userInput').value.trim();
  const statusEl = document.getElementById('status');

  if (!query) return;

  statusEl.innerText = 'KI verarbeitet deine Anfrage...';

  const promptText = `
    Du bist ein lokaler Guide für Linz, Österreich.

    Verfügbare Orte in ganz Linz:
    ${JSON.stringify(festivalLocations)}

    Aktueller GPS-Standort des Nutzers: Latitude ${userLat}, Longitude ${userLng}
    Nutzeranfrage: "${query}"

    Suche in der ganzen Stadt Linz und wähle genau EINEN passenden Ort aus der Liste aus.
    Der Ort darf nicht nur beim Ars Electronica Center liegen; suche in der gesamten Linzer Innenstadt und Umgebung.
    Wenn die Anfrage nach Essen, WC, Kultur, Technik, Nachtleben oder Sehenswürdigkeiten klingt, wähle den passendsten Platz in Linz.
    Gib deine Antwort AUSSCHLIESSLICH als valides JSON zurück (ohne Markdown, ohne \`\`\`json):
    {"name": "Name des Orts", "lat": 48.xxx, "lng": 14.xxx, "description": "Erklärung für den Nutzer auf Deutsch"}
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
      statusEl.innerText = 'Fehler von OpenRouter: ' + data.error.message;
      return;
    }

    let rawResponse = data.choices[0].message.content;

    // JSON säubern
    rawResponse = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const locationResult = JSON.parse(rawResponse);

    showOnMap(locationResult);
    statusEl.innerText = '';
  } catch (err) {
    console.error(err);
    statusEl.innerText = 'Fehler bei der KI-Anfrage. Drücke F12 für die Browser-Konsole.';
  }
}

// 5. Ergebnisse auf der Karte markieren
function showOnMap(target) {
  selectedTarget = target;

  document.getElementById('result-box').style.display = 'block';
  document.getElementById('result-title').innerText = target.name;
  document.getElementById('result-desc').innerText = target.description;

  if (targetMarker) map.removeLayer(targetMarker);

  targetMarker = L.marker([target.lat, target.lng]).addTo(map)
    .bindPopup(`<b>${target.name}</b><br>${target.description}`).openPopup();

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
});

renderFestivalCards();
window.searchWithAI = searchWithAI;
