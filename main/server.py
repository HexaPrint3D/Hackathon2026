import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, urlencode, urlparse
from urllib.request import Request, urlopen

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PORT = 8000


def fetch_json(url, params):
    encoded = urlencode(params, quote_via=quote)
    request = Request(
        f"{url}?{encoded}",
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
        },
    )
    with urlopen(request, timeout=12) as response:
        body = response.read()

    text = body.decode("utf-8", "replace")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"raw": text[:2000]}


def normalize_stop_points(payload):
    if not isinstance(payload, dict):
        return []

    raw_points = payload.get("stopFinder", {}).get("points", [])
    if isinstance(raw_points, dict):
        raw_points = [raw_points]
    if not isinstance(raw_points, list):
        return []

    normalized = []
    for item in raw_points[:10]:
        if not isinstance(item, dict):
            continue

        point = item.get("point") if isinstance(item.get("point"), dict) else item
        point_name = (
            point.get("name")
            or point.get("mainName")
            or item.get("name")
            or "Unnamed stop"
        )
        stop_id = point.get("id") or point.get("ref") or item.get("id") or item.get("ref")

        coord = point.get("coords")
        if isinstance(coord, list) and len(coord) >= 2:
            lon, lat = float(coord[0]), float(coord[1])
        else:
            lat = point.get("lat") or point.get("latitude")
            lon = point.get("lon") or point.get("longitude")
            try:
                lon = float(lon)
                lat = float(lat)
            except (TypeError, ValueError):
                continue

        if not stop_id or not point_name:
            continue

        normalized.append({
            "id": str(stop_id),
            "name": str(point_name),
            "lat": float(lat),
            "lng": float(lon),
        })

    return normalized


def extract_departures(payload):
    if not isinstance(payload, dict):
        return []

    departures = payload.get("departureList", [])
    if isinstance(departures, dict):
        departures = [departures]
    if not isinstance(departures, list):
        return []

    out = []
    for item in departures[:8]:
        if not isinstance(item, dict):
            continue

        line_block = item.get("servingLine") or item.get("line") or {}
        line_name = (
            line_block.get("number")
            or line_block.get("name")
            or line_block.get("direction")
            or item.get("servingLine")
            or item.get("line")
            or "Line"
        )

        out.append({
            "line": str(line_name),
            "direction": str(item.get("direction") or item.get("destination") or "-"),
            "countdown": item.get("countdown") or item.get("countdownMin") or item.get("time") or "-",
            "dateTime": item.get("dateTime") or item.get("realDateTime") or item.get("time") or "-",
            "realTime": bool(item.get("realDateTime")),
        })

    return out


def build_transport_payload(query, lat, lng):
    q = (query or "").strip()
    if not q:
        return {"query": q, "stops": [], "departures": []}

    stopfinder_url = "https://www.linzag.at/static/XML_STOPFINDER_REQUEST"
    stop_params = {
        "locationServerActive": "1",
        "stateless": "1",
        "outputFormat": "JSON",
        "type_sf": "any",
        "name_sf": q,
        "coordOutputFormat": "WGS84[DD.ddddd]",
        "anyObjFilter_sf": "34",
    }

    try:
        stop_data = fetch_json(stopfinder_url, stop_params)
    except Exception:
        return {"query": q, "stops": [], "departures": [], "error": "Transport lookup failed"}

    stops = normalize_stop_points(stop_data)[:6]
    departures = []

    for stop in stops[:3]:
        dep_url = "https://www.linzag.at/static/XML_DM_REQUEST"
        dep_params = {
            "locationServerActive": "1",
            "stateless": "1",
            "outputFormat": "JSON",
            "type_dm": "any",
            "name_dm": str(stop["id"]),
            "itdDateTimeDepArr": "dep",
            "limit": "5",
            "mode": "direct",
            "useRealtime": "1",
            "coordOutputFormat": "WGS84[DD.ddddd]",
        }
        try:
            departure_data = fetch_json(dep_url, dep_params)
            stop_departures = extract_departures(departure_data)
            if stop_departures:
                departures.append({
                    "stop": stop["name"],
                    "stopId": stop["id"],
                    "lat": stop["lat"],
                    "lng": stop["lng"],
                    "departures": stop_departures,
                })
        except Exception:
            continue

    return {
        "query": q,
        "userLocation": {"lat": float(lat), "lng": float(lng)},
        "stops": stops,
        "departures": departures,
    }


class AppHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/transport":
            params = parse_qs(parsed.query)
            query = params.get("query", [""])[0]
            lat = params.get("lat", ["48.3069"])[0]
            lng = params.get("lng", ["14.2858"])[0]
            payload = build_transport_payload(query, lat, lng)

            body = json.dumps(payload).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)
            return

        if parsed.path in ("", "/"):
            self.path = "/try.html"

        return super().do_GET()

    def log_message(self, format, *args):
        return


if __name__ == "__main__":
    handler = lambda *args, **kwargs: AppHandler(*args, directory=BASE_DIR, **kwargs)
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), handler)
    print(f"Transport proxy server running on http://localhost:{PORT}")
    httpd.serve_forever()
