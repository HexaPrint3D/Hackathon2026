# Finde Dinge in Linz

Lokale Web-App zum Suchen von Bäumen, Defibrillatoren, Hundezonen und Hecken in Linz.

## Starten

```powershell
python .\finde_dinge_in_linz\app.py
```

Dann im Browser `http://127.0.0.1:8000` öffnen.

## Android verwenden

Die App ist als installierbare PWA vorbereitet. Für die Nutzung auf einem Android-Handy:

1. Starte den Server im lokalen Netzwerk:

```powershell
python .\finde_dinge_in_linz\app.py --host 0.0.0.0 --port 8000
```

2. Ermittle die WLAN-IP-Adresse des Computers mit `ipconfig` und öffne auf dem Handy `http://DEINE-PC-IP:8000`.
3. Im Chrome-Menü „App installieren“ oder „Zum Startbildschirm hinzufügen“ auswählen.
4. Den Standortzugriff erlauben.

Computer und Handy müssen im selben WLAN sein. Für eine echte, unabhängig laufende APK müsste die Anwendung zusätzlich in einen Android-Wrapper gepackt und die Daten-API online oder direkt in der App eingebaut werden.

## Was die App kann

- Suche mit Begriffen wie `birke`, `eiche`, `defi`, `defibrillator`, `himbeere` oder `hundezone`
- Anzeige der Treffer auf einer Karte
- automatische Route von deinem Standort zum ausgewählten Treffer
- Browser-Standort; wenn der Zugriff abgelehnt wird, bleibt die Suche möglich, aber ohne falsche Entfernungen

## Hinweise

- Die Karte nutzt OpenStreetMap-Kacheln.
- Die Route wird über den OSRM-Dienst berechnet.
- Für Hecken wird, falls nötig, eine Geocoding-Anfrage gemacht und lokal zwischengespeichert.
- Wenn die Karte beim Linzer Hauptplatz bleibt, wurde der Browser-Standort nicht freigegeben. Klicke auf „Standort neu holen“ und erlaube den Zugriff; ohne echten GPS-Standort wird bewusst keine falsche Route gezeichnet.
