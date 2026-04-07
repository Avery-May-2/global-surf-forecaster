# Surfability Intelligence Dashboard

A fully redesigned surf forecasting dashboard focused on the core question: **"Is it surfable right now?"**

## What is new

- **Instant Snapshot header panel** with Surf Score (1–10), wave height, swell, wind vector, tide state, and spot metadata.
- **24-hour interactive timeline** combining wave height + color-coded Surf Score bars.
- **7-day trend heatmap** for quick planning.
- **Interactive map** with per-spot color-coded score pins and break-type popups.
- **Detailed metrics** with radar-chart contribution breakdown (wave, swell, wind, tide).
- **Alert cards** for optimal windows, wind shifts, and swell arrivals.
- **Personalization control** to shift scoring by risk tolerance and surfer skill level.

## Data architecture implemented

- NOAA CO-OPS tides via API.
- NOAA NDBC buoy parser utility included.
- Forecast ingestion via marine API fallback (Open-Meteo) with a uniform internal schema.
- Client-side cache (`localStorage`) with **60-minute TTL** to limit repeated API calls.

## Run locally

```bash
python -m http.server 8000
```

Then open: `http://localhost:8000`

## Notes

- The app is intentionally modular to allow Stormglass/OpenWeatherMap/WaveWatch adapters later without frontend rewrites.
- Scoring logic remains internal on a 1–10 scale and maps to Good/Fair/Poor visual states.
