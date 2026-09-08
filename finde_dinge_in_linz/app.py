from __future__ import annotations

import argparse
import csv
import json
import math
import os
import re
import threading
import time
import unicodedata
import urllib.parse
import urllib.request
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


ROOT = Path(__file__).resolve().parent
DEFAULT_DATA_DIR = Path(os.environ.get("FINDE_DINGE_DATA_DIR", ROOT.parent / "data"))
USER_AGENT = "finde-dinge-in-linz/1.0 (local app)"
DEFAULT_CENTER = {"lat": 48.3069, "lon": 14.2858}
DEFAULT_PORT = int(os.environ.get("FINDE_DINGE_PORT", "8000"))
DEFAULT_HOST = os.environ.get("FINDE_DINGE_HOST", "127.0.0.1")
GEOCODE_CACHE_FILE = ROOT / "geocode_cache.json"


def normalize_text(value: Any) -> str:
    text = "" if value is None else str(value)
    text = text.replace("ß", "ss")
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def split_terms(query: str) -> List[str]:
    if not query:
        return []
    parts = re.split(r"[,\n;/|]+", query)
    terms = [normalize_text(part) for part in parts]
    terms = [term for term in terms if term]
    if terms:
        return terms
    fallback = normalize_text(query)
    return [fallback] if fallback else []


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2.0) ** 2
    )
    return 2.0 * radius * math.asin(math.sqrt(a))


def distance_sort_key(item: Dict[str, Any]) -> Tuple[int, float, str]:
    distance = item.get("distance_m")
    return (
        0 if distance is not None else 1,
        float(distance if distance is not None else 10**12),
        item.get("title", ""),
    )


def make_search_blob(*parts: Any) -> Tuple[str, List[str]]:
    blob = normalize_text(" ".join("" if part is None else str(part) for part in parts))
    return blob, blob.split()


def safe_float(value: Any) -> Optional[float]:
    if value in (None, ""):
        return None
    try:
        return float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return None


def display_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    return "" if text in {"", "None"} else text


def centroid_from_geometry(geometry: Dict[str, Any]) -> Tuple[Optional[float], Optional[float]]:
    geom_type = (geometry or {}).get("type")
    coordinates = (geometry or {}).get("coordinates")
    points: List[Tuple[float, float]] = []

    def collect(coords: Any) -> None:
        if not coords:
            return
        if isinstance(coords[0], (int, float)) and len(coords) >= 2:
            lon = safe_float(coords[0])
            lat = safe_float(coords[1])
            if lon is not None and lat is not None:
                points.append((lon, lat))
            return
        for child in coords:
            collect(child)

    if geom_type in {"Polygon", "MultiPolygon"}:
        collect(coordinates)
    elif geom_type == "Point":
        lon = safe_float(coordinates[0]) if coordinates else None
        lat = safe_float(coordinates[1]) if coordinates else None
        if lon is not None and lat is not None:
            return lat, lon

    if not points:
        return None, None

    lon_avg = sum(point[0] for point in points) / len(points)
    lat_avg = sum(point[1] for point in points) / len(points)
    return lat_avg, lon_avg


def point_geometry(lat: Optional[float], lon: Optional[float]) -> Dict[str, Any]:
    return {"type": "Point", "coordinates": [lon, lat]} if lat is not None and lon is not None else {}


def build_item(
    *,
    item_id: str,
    kind: str,
    kind_label: str,
    source: str,
    title: str,
    subtitle: str,
    lat: Optional[float],
    lon: Optional[float],
    details: List[str],
    searchable_parts: Iterable[Any],
    geometry: Optional[Dict[str, Any]] = None,
    geocode_query: Optional[str] = None,
) -> Dict[str, Any]:
    blob_parts = [kind_label, source, title, subtitle, *details, *searchable_parts]
    if geocode_query:
        blob_parts.append(geocode_query)
    search_blob, search_words = make_search_blob(*blob_parts)
    item: Dict[str, Any] = {
        "id": item_id,
        "kind": kind,
        "kind_label": kind_label,
        "source": source,
        "title": title,
        "subtitle": subtitle,
        "lat": lat,
        "lon": lon,
        "geometry_type": (geometry or {}).get("type", "Point" if lat is not None and lon is not None else "Unknown"),
        "geometry": geometry if geometry else point_geometry(lat, lon),
        "details": details,
        "search_blob": search_blob,
        "search_words": search_words,
        "geocode_query": geocode_query,
        "route_lat": lat,
        "route_lon": lon,
    }
    if geometry and (lat is None or lon is None):
        center_lat, center_lon = centroid_from_geometry(geometry)
        item["lat"] = center_lat
        item["lon"] = center_lon
        item["route_lat"] = center_lat
        item["route_lon"] = center_lon
    return item


def load_csv_items(path: Path, loader_name: str) -> List[Dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"Datei nicht gefunden: {path}")
    return []


def load_tree_items(data_dir: Path) -> List[Dict[str, Any]]:
    path = data_dir / "Baumkataster.csv"
    items: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            lat = safe_float(row.get("lat"))
            lon = safe_float(row.get("lon"))
            if lat is None or lon is None:
                continue
            gattung = (row.get("Gattung") or "").strip()
            art = (row.get("Art") or "").strip()
            sorte = (row.get("Sorte") or "").strip()
            name = (row.get("NameDeutsch") or "").strip()
            title = name or " ".join(part for part in [gattung, art] if part).strip() or "Baum"
            subtitle = " ".join(part for part in [gattung, art, sorte] if part).strip()
            details = [
                f"Gattung: {gattung}" if gattung else "",
                f"Art: {art}" if art else "",
                f"Sorte: {sorte}" if sorte else "",
                f"Hoehe: {row.get('Hoehe', '').strip()} m" if row.get("Hoehe") else "",
                f"Schirmdurchmesser: {row.get('Schirmdurchmesser', '').strip()} m" if row.get("Schirmdurchmesser") else "",
                f"Stammumfang: {row.get('Stammumfang', '').strip()} cm" if row.get("Stammumfang") else "",
                f"Typ: {row.get('Typ', '').strip()}" if row.get("Typ") else "",
            ]
            details = [detail for detail in details if detail]
            searchable_parts = [
                "baum",
                "tree",
                row.get("id", ""),
                gattung,
                art,
                sorte,
                name,
                row.get("Typ", ""),
                row.get("BaumNr", ""),
            ]
            items.append(
                build_item(
                    item_id=row.get("id") or f"tree-{len(items)}",
                    kind="tree",
                    kind_label="Baum",
                    source="Baumkataster",
                    title=title,
                    subtitle=subtitle or "Baum",
                    lat=lat,
                    lon=lon,
                    details=details,
                    searchable_parts=searchable_parts,
                )
            )
    return items


def load_defibrillator_items(data_dir: Path) -> List[Dict[str, Any]]:
    path = data_dir / "Defibrillatoren.csv"
    items: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            lat = safe_float(row.get("lat")) or safe_float(row.get("quell_lat"))
            lon = safe_float(row.get("lon")) or safe_float(row.get("quell_lon"))
            if lat is None or lon is None:
                continue
            firma = (row.get("FIRMA") or "").strip()
            adresse = (row.get("Adresse") or "").strip()
            standort = (row.get("Standort") or "").strip()
            marke = (row.get("Marke/Hersteller") or "").strip()
            title = f"Defibrillator - {firma}" if firma else "Defibrillator"
            subtitle = " · ".join(part for part in [adresse, standort] if part)
            details = [
                f"Firma: {firma}" if firma else "",
                f"Adresse: {adresse}" if adresse else "",
                f"Standort: {standort}" if standort else "",
                f"Marke/Hersteller: {marke}" if marke else "",
                f"PLZ/Stadt: {row.get('PLZ', '').strip()} {row.get('Stadt', '').strip()}".strip(),
                f"Koordinatenstatus: {row.get('koordinatenstatus', '').strip()}" if row.get("koordinatenstatus") else "",
            ]
            details = [detail for detail in details if detail]
            searchable_parts = [
                "defi",
                "defibrillator",
                "aed",
                row.get("id", ""),
                firma,
                adresse,
                standort,
                marke,
                row.get("Stadt", ""),
                row.get("Marke/Hersteller", ""),
            ]
            items.append(
                build_item(
                    item_id=row.get("id") or f"defi-{len(items)}",
                    kind="defi",
                    kind_label="Defibrillator",
                    source="Defibrillatoren",
                    title=title,
                    subtitle=subtitle or "Defibrillator",
                    lat=lat,
                    lon=lon,
                    details=details,
                    searchable_parts=searchable_parts,
                )
            )
    return items


def load_geojson_items(data_dir: Path) -> List[Dict[str, Any]]:
    path = data_dir / "Hundezonen.csv"
    with path.open("r", encoding="utf-8-sig") as handle:
        geojson = json.load(handle)
    items: List[Dict[str, Any]] = []
    for index, feature in enumerate(geojson.get("features", [])):
        geometry = feature.get("geometry") or {}
        properties = feature.get("properties") or {}
        name = (properties.get("NAME") or "").strip() or f"Hundezone {index + 1}"
        flart = (properties.get("FLART") or "").strip()
        zusatz = (properties.get("ZUSATZ") or "").strip()
        zust = (properties.get("ZUST") or "").strip()
        anmerkung = (properties.get("ANMERKUNG") or "").strip()
        title = name
        subtitle = " · ".join(part for part in [flart, zust] if part) or "Hundezone"
        details = [
            f"Fläche: {display_text(properties.get('FLAECHE'))}" if display_text(properties.get("FLAECHE")) else "",
            f"Art: {flart}" if flart else "",
            f"Zusatz: {zusatz}" if zusatz else "",
            f"Zustand: {zust}" if zust else "",
            f"Anmerkung: {anmerkung}" if anmerkung else "",
        ]
        details = [detail for detail in details if detail]
        center_lat, center_lon = centroid_from_geometry(geometry)
        searchable_parts = [
            "hundezone",
            "hund",
            "verbotszone",
            "freilaufzone",
            name,
            flart,
            zusatz,
            zust,
            anmerkung,
        ]
        items.append(
            build_item(
                item_id=properties.get("GDOID") or f"zone-{index + 1}",
                kind="dog_zone",
                kind_label="Hundezone",
                source="Hundezonen",
                title=title,
                subtitle=subtitle,
                lat=center_lat,
                lon=center_lon,
                details=details,
                searchable_parts=searchable_parts,
                geometry=geometry,
            )
        )
    return items


def load_hedge_items(data_dir: Path) -> List[Dict[str, Any]]:
    path = data_dir / "Hecken-die-schmecken.csv"
    items: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            standort = (row.get("standort") or "").strip()
            beschreibung = (row.get("beschreibung") or "").strip()
            art = (row.get("art") or "").strip()
            title = standort or art or "Hecke"
            subtitle = art or "Hecke"
            details = [
                f"Standort: {standort}" if standort else "",
                f"Beschreibung: {beschreibung}" if beschreibung else "",
                f"Art: {art}" if art else "",
            ]
            details = [detail for detail in details if detail]
            geocode_query = f"{standort}, Linz, Oberoesterreich" if standort else None
            searchable_parts = [
                "hecke",
                "beeren",
                row.get("id", ""),
                standort,
                beschreibung,
                art,
            ]
            items.append(
                build_item(
                    item_id=row.get("id") or f"hedge-{len(items)}",
                    kind="hedge",
                    kind_label="Hecke",
                    source="Hecken-die-schmecken",
                    title=title,
                    subtitle=subtitle,
                    lat=None,
                    lon=None,
                    details=details,
                    searchable_parts=searchable_parts,
                    geocode_query=geocode_query,
                )
            )
    return items


def load_items(data_dir: Path) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    items.extend(load_tree_items(data_dir))
    items.extend(load_defibrillator_items(data_dir))
    items.extend(load_geojson_items(data_dir))
    items.extend(load_hedge_items(data_dir))
    return items


def score_item(item: Dict[str, Any], terms: List[str]) -> int:
    if not terms:
        return 1
    blob = item.get("search_blob", "")
    words = item.get("search_words", [])
    title = normalize_text(item.get("title", ""))
    subtitle = normalize_text(item.get("subtitle", ""))
    score = 0
    matched_any = False
    for term in terms:
        if not term:
            continue
        best = 0
        if term in blob:
            best = max(best, 10)
            if term in title:
                best = max(best, 14)
            if term in subtitle:
                best = max(best, 12)
        else:
            for word in words:
                if word == term:
                    best = max(best, 10)
                    break
                if word.startswith(term) or term.startswith(word):
                    best = max(best, 7)
        if best:
            matched_any = True
            score += best
    return score if matched_any else 0


GEOCODE_CACHE_LOCK = threading.Lock()
GEOCODE_CACHE: Dict[str, Dict[str, Any]] = {}
LAST_GEOCODE_REQUEST_AT = 0.0


def load_geocode_cache() -> None:
    global GEOCODE_CACHE
    if GEOCODE_CACHE_FILE.exists():
        try:
            GEOCODE_CACHE = json.loads(GEOCODE_CACHE_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            GEOCODE_CACHE = {}


def save_geocode_cache() -> None:
    tmp_path = GEOCODE_CACHE_FILE.with_suffix(".tmp")
    tmp_path.write_text(json.dumps(GEOCODE_CACHE, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp_path.replace(GEOCODE_CACHE_FILE)


def request_json(url: str, timeout: int = 15) -> Any:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        data = response.read().decode("utf-8")
    return json.loads(data)


def geocode_query(query: str) -> Optional[Dict[str, Any]]:
    normalized = normalize_text(query)
    if not normalized:
        return None
    cached = GEOCODE_CACHE.get(normalized)
    if cached:
        return cached

    candidates = [query, f"{query}, Linz, Oberoesterreich, Austria"]
    for candidate in candidates:
        params = urllib.parse.urlencode(
            {
                "q": candidate,
                "format": "jsonv2",
                "limit": "1",
                "countrycodes": "at",
            }
        )
        url = f"https://nominatim.openstreetmap.org/search?{params}"
        try:
            global LAST_GEOCODE_REQUEST_AT
            with GEOCODE_CACHE_LOCK:
                elapsed = time.time() - LAST_GEOCODE_REQUEST_AT
                if elapsed < 1.1:
                    time.sleep(1.1 - elapsed)
                LAST_GEOCODE_REQUEST_AT = time.time()
            payload = request_json(url, timeout=15)
        except Exception:
            continue
        if isinstance(payload, list) and payload:
            best = payload[0]
            lat = safe_float(best.get("lat"))
            lon = safe_float(best.get("lon"))
            if lat is None or lon is None:
                continue
            result = {
                "lat": lat,
                "lon": lon,
                "display_name": best.get("display_name", candidate),
                "source": "nominatim",
            }
            GEOCODE_CACHE[normalized] = result
            try:
                save_geocode_cache()
            except Exception:
                pass
            return result
    return None


def ensure_item_coordinates(item: Dict[str, Any]) -> Optional[Tuple[float, float]]:
    lat = item.get("lat")
    lon = item.get("lon")
    if lat is not None and lon is not None:
        return lat, lon
    geocode_target = item.get("geocode_query")
    if not geocode_target:
        return None
    resolved = geocode_query(geocode_target)
    if not resolved:
        return None
    item["lat"] = resolved["lat"]
    item["lon"] = resolved["lon"]
    item["route_lat"] = resolved["lat"]
    item["route_lon"] = resolved["lon"]
    item["resolved_label"] = resolved["display_name"]
    return resolved["lat"], resolved["lon"]


def search_items(
    query: str,
    user_lat: Optional[float] = None,
    user_lon: Optional[float] = None,
    limit: int = 40,
) -> List[Dict[str, Any]]:
    terms = split_terms(query)
    results: List[Dict[str, Any]] = []
    for item in ITEMS:
        score = score_item(item, terms)
        if terms and score == 0:
            continue
        lat = item.get("lat")
        lon = item.get("lon")
        distance_m = None
        if user_lat is not None and user_lon is not None and lat is not None and lon is not None:
            distance_m = haversine_m(user_lat, user_lon, lat, lon)
        elif not terms:
            continue
        result = {
            "id": item["id"],
            "kind": item["kind"],
            "kind_label": item["kind_label"],
            "source": item["source"],
            "title": item["title"],
            "subtitle": item["subtitle"],
            "lat": lat,
            "lon": lon,
            "distance_m": distance_m,
            "score": score,
            "needs_geocode": item.get("lat") is None or item.get("lon") is None,
            "geometry_type": item.get("geometry_type", "Point"),
        }
        results.append(result)

    results.sort(key=lambda candidate: (-candidate["score"], candidate["distance_m"] is None, candidate["distance_m"] or 10**12, candidate["title"]))
    return results[:limit]


def serialize_item(item: Dict[str, Any]) -> Dict[str, Any]:
    resolved = ensure_item_coordinates(item)
    geometry = item.get("geometry") or {}
    payload = {
        "id": item["id"],
        "kind": item["kind"],
        "kind_label": item["kind_label"],
        "source": item["source"],
        "title": item["title"],
        "subtitle": item["subtitle"],
        "lat": item.get("lat"),
        "lon": item.get("lon"),
        "route_lat": item.get("route_lat"),
        "route_lon": item.get("route_lon"),
        "geometry_type": item.get("geometry_type", "Point"),
        "geometry": geometry if geometry else point_geometry(item.get("lat"), item.get("lon")),
        "details": item.get("details", []),
        "resolved_label": item.get("resolved_label"),
        "needs_geocode": resolved is None and (item.get("lat") is None or item.get("lon") is None),
    }
    return payload


def fetch_route(from_lat: float, from_lon: float, to_lat: float, to_lon: float) -> Dict[str, Any]:
    url = (
        "https://router.project-osrm.org/route/v1/foot/"
        f"{from_lon:.6f},{from_lat:.6f};{to_lon:.6f},{to_lat:.6f}"
        "?overview=full&geometries=geojson&steps=false&alternatives=false"
    )
    try:
        payload = request_json(url, timeout=20)
        routes = payload.get("routes") if isinstance(payload, dict) else None
        if routes:
            route = routes[0]
            return {
                "source": "osrm",
                "distance_m": route.get("distance"),
                "duration_s": route.get("duration"),
                "geometry": route.get("geometry", {}).get("coordinates", []),
            }
    except Exception:
        pass

    distance_m = haversine_m(from_lat, from_lon, to_lat, to_lon) * 1.25
    return {
        "source": "fallback",
        "distance_m": distance_m,
        "duration_s": distance_m / 1.4,
        "geometry": [[from_lon, from_lat], [to_lon, to_lat]],
    }


def warm_geocode_hedges() -> None:
    hedge_items = [item for item in ITEMS if item["kind"] == "hedge" and item.get("geocode_query")]
    for index, item in enumerate(hedge_items, start=1):
        if item.get("lat") is not None and item.get("lon") is not None:
            continue
        try:
            ensure_item_coordinates(item)
        except Exception:
            pass
        if index < len(hedge_items):
            time.sleep(0.8)


def json_response(handler: BaseHTTPRequestHandler, payload: Any, status: int = 200) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


def text_response(handler: BaseHTTPRequestHandler, text: str, content_type: str = "text/plain; charset=utf-8", status: int = 200) -> None:
    body = text.encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", content_type)
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


def serve_static_file(handler: BaseHTTPRequestHandler, file_path: Path, content_type: str) -> None:
    if not file_path.exists():
        text_response(handler, "Not found", status=404)
        return
    data = file_path.read_bytes()
    handler.send_response(200)
    handler.send_header("Content-Type", content_type)
    handler.send_header("Content-Length", str(len(data)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(data)


class AppHandler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
        return

    def do_GET(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path in {"/", "/index.html"}:
            serve_static_file(self, ROOT / "index.html", "text/html; charset=utf-8")
            return
        if path == "/styles.css":
            serve_static_file(self, ROOT / "styles.css", "text/css; charset=utf-8")
            return
        if path == "/app.js":
            serve_static_file(self, ROOT / "app.js", "application/javascript; charset=utf-8")
            return
        if path == "/manifest.webmanifest":
            serve_static_file(self, ROOT / "manifest.webmanifest", "application/manifest+json; charset=utf-8")
            return
        if path == "/service-worker.js":
            serve_static_file(self, ROOT / "service-worker.js", "application/javascript; charset=utf-8")
            return
        if path == "/data.json":
            serve_static_file(self, ROOT / "data.json", "application/json; charset=utf-8")
            return
        if path == "/icons/icon.svg":
            serve_static_file(self, ROOT / "icons" / "icon.svg", "image/svg+xml")
            return

        if path == "/api/search":
            q = query.get("q", [""])[0]
            lat = safe_float(query.get("lat", [""])[0])
            lon = safe_float(query.get("lon", [""])[0])
            limit = int(query.get("limit", ["40"])[0] or "40")
            payload = {
                "query": q,
                "center": {"lat": lat, "lon": lon} if lat is not None and lon is not None else DEFAULT_CENTER,
                "items": search_items(q, lat, lon, limit=limit),
            }
            json_response(self, payload)
            return

        if path == "/api/item":
            item_id = query.get("id", [""])[0]
            item = ITEM_INDEX.get(item_id)
            if not item:
                json_response(self, {"error": "Unbekannter Eintrag."}, status=404)
                return
            json_response(self, serialize_item(item))
            return

        if path == "/api/route":
            from_lat = safe_float(query.get("fromLat", [""])[0])
            from_lon = safe_float(query.get("fromLon", [""])[0])
            to_lat = safe_float(query.get("toLat", [""])[0])
            to_lon = safe_float(query.get("toLon", [""])[0])
            if None in {from_lat, from_lon, to_lat, to_lon}:
                json_response(self, {"error": "Ungültige Route-Koordinaten."}, status=400)
                return
            route = fetch_route(from_lat, from_lon, to_lat, to_lon)
            json_response(
                self,
                {
                    "from": {"lat": from_lat, "lon": from_lon},
                    "to": {"lat": to_lat, "lon": to_lon},
                    "route": route,
                },
            )
            return

        if path == "/api/config":
            json_response(
                self,
                {
                    "defaultCenter": DEFAULT_CENTER,
                    "itemCount": len(ITEMS),
                },
            )
            return

        text_response(self, "Not found", status=404)


def load_app_data() -> Tuple[List[Dict[str, Any]], Dict[str, Dict[str, Any]]]:
    if not DEFAULT_DATA_DIR.exists():
        raise FileNotFoundError(f"Data-Ordner nicht gefunden: {DEFAULT_DATA_DIR}")
    items = load_items(DEFAULT_DATA_DIR)
    item_index = {item["id"]: item for item in items}
    return items, item_index


def print_startup_banner(host: str, port: int, data_dir: Path) -> None:
    print(f"Finde Dinge in Linz laeuft auf http://{host}:{port}")
    print(f"Data: {data_dir}")
    print("Suche z.B. nach: birke, eiche, defi, defibrillator, himbeere, hundezone")


def main() -> None:
    global DEFAULT_DATA_DIR, ITEMS, ITEM_INDEX

    parser = argparse.ArgumentParser(description="Finde Dinge in Linz")
    parser.add_argument("--host", default=DEFAULT_HOST, help="Host, auf dem der Server lauscht.")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Port des Servers.")
    parser.add_argument(
        "--data-dir",
        default=str(DEFAULT_DATA_DIR),
        help="Pfad zum data-Ordner.",
    )
    args = parser.parse_args()
    DEFAULT_DATA_DIR = Path(args.data_dir)

    load_geocode_cache()
    ITEMS, ITEM_INDEX = load_app_data()

    print_startup_banner(args.host, args.port, DEFAULT_DATA_DIR)

    geocode_thread = threading.Thread(target=warm_geocode_hedges, daemon=True)
    geocode_thread.start()

    server = ThreadingHTTPServer((args.host, args.port), AppHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer beendet.")
    finally:
        server.server_close()


ITEMS: List[Dict[str, Any]] = []
ITEM_INDEX: Dict[str, Dict[str, Any]] = {}


if __name__ == "__main__":
    main()
