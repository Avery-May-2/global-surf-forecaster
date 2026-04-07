# Global Surf Forecaster (Web App)

A browser-based dashboard for exploring wave forecasts at world-tour-level surf spots around the globe.

## Features

- Interactive map with 2026 Championship Tour surf spots.
- Forecast controls for surf spot, forecast window, and rider skill level.
- Daily wave-height forecast chart for the selected spot.
- **Time-of-day wave chart** for hourly wave height on a selected day.
- By-day cards with wave snapshots throughout each day.
- Summary card with event window, wave height stats, swell period, wind, and skill suitability.

## Run locally

Because this app loads live APIs, use a simple local web server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Notes

- Wave forecast data is sourced live from Open-Meteo Marine API.
