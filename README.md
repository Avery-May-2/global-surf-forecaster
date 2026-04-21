# Surfability Intelligence Dashboard

Global surf dashboard that answers **"is it surfable right now?"** across popular surf breaks worldwide.

## Current feature set

- Global map with popular surf locations across North America, Europe, Africa, Oceania, and Asia.
- Click any map marker to instantly load that location's 24-hour surf timeline.
- Snapshot panel for selected location (score, wave height, period, wind, break type).
- Alerts panel for optimal windows, wind shifts, and swell arrivals.
- **8-day forecast overview** styled as multi-row spot strips with day-by-day wave ranges and quality indicators.

## Data + architecture

- Forecast ingestion uses Open-Meteo Marine hourly feed (public, no key).
- Uniform row schema for all spots (`datetime`, `waveHeight`, `wavePeriod`, synthetic wind fields, `score`).
- Client cache via `localStorage` with 60-minute TTL to minimize repeated API calls.
- Internal surf scoring remains on a 1–10 scale and maps to Good/Fair/Poor UI states.

## Dashboard

Access the Dashboard here: [Surf Intelligence Dashboard](https://avery-may-2.github.io/global-surf-forecaster/)
