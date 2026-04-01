# Global Surf Forecaster (Streamlit)

An interactive Streamlit dashboard for exploring wave forecasts at world-tour-level surf spots around the globe.

## Features

- Interactive map with 2026 Championship Tour surf spots.
- Forecast controls for surf spot, forecast window, and rider skill level.
- Daily wave-height forecast chart for the selected spot.
- New **time-of-day wave chart** for hourly wave height on a selected day.
- Summary card with event window, wave height stats, swell period, wind, and skill suitability.
- Right-side panel now filled with **live Championship Tour rankings** for both:
  - Men (MCT)
  - Women (WCT)

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
streamlit run streamlit_app.py
```

Then open the local URL Streamlit prints in your terminal (typically `http://localhost:8501`).

## Notes

- Wave forecast data is sourced live from Open-Meteo Marine API.
- Rankings are sourced from the World Surf League website pages for the selected tour/year.
