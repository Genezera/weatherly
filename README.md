# Weatherly

Weather dashboard with city search and a 7-day forecast using the **Open‑Meteo** API (no key). Includes a local cache to reduce requests and a recents list for quick navigation.

## Features

- City search with suggestions (Open‑Meteo geocoding)
- Current weather + 7-day forecast
- LocalStorage cache (TTL) to improve performance
- Recent searches list
- “Use my location” option (Geolocation API)

## Tech

- HTML + CSS
- JavaScript (no libraries)
- Fetch API + LocalStorage
- Open‑Meteo (Geocoding + Forecast)

## Run

Recommended to run with a local server (some browsers restrict `fetch` when opened via `file://`):

```bash
python -m http.server 5173
```

Open: `http://localhost:5173/`

## APIs used

- Geocoding: `https://geocoding-api.open-meteo.com/v1/search`
- Forecast: `https://api.open-meteo.com/v1/forecast`
