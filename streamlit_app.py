from __future__ import annotations

import datetime as dt
import json
import re
from dataclasses import dataclass
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import streamlit as st


@dataclass(frozen=True)
class SurfSpot:
    id: str
    name: str
    lat: float
    lng: float
    wind: str
    event_window_start: str
    event_window_end: str


SURF_SPOTS = [
    SurfSpot('bells', 'Stop No. 1 — Bells Beach, Victoria, Australia', -38.372, 144.28, 'SW 16 kn', '2026-04-01', '2026-04-11'),
    SurfSpot('margaret-river', 'Stop No. 2 — Margaret River, Western Australia, Australia', -33.954, 114.992, 'S 18 kn', '2026-04-17', '2026-04-27'),
    SurfSpot('snapper-rocks', 'Stop No. 3 — Snapper Rocks, Queensland, Australia', -28.164, 153.548, 'SE 11 kn', '2026-05-02', '2026-05-12'),
    SurfSpot('raglan', 'Stop No. 4 — Raglan, New Zealand', -37.799, 174.87, 'W 14 kn', '2026-05-15', '2026-05-25'),
    SurfSpot('punta-roca', 'Stop No. 5 — Punta Roca, El Salvador', 13.489, -89.392, 'SSE 8 kn', '2026-06-05', '2026-06-15'),
    SurfSpot('saquarema', 'Stop No. 6 — Saquarema, Rio de Janeiro, Brazil', -22.934, -42.502, 'E 14 kn', '2026-06-19', '2026-06-27'),
    SurfSpot('teahupoo', "Stop No. 7 — Teahupo'o, Tahiti, French Polynesia", -17.833, -149.267, 'SE 9 kn', '2026-08-08', '2026-08-18'),
    SurfSpot('cloudbreak', 'Stop No. 8 — Cloudbreak, Fiji', -17.873, 177.188, 'ESE 13 kn', '2026-08-25', '2026-09-04'),
    SurfSpot('lower-trestles', 'Stop No. 9 — Lower Trestles, San Clemente, Calif., USA', 33.384, -117.593, 'W 9 kn', '2026-09-11', '2026-09-20'),
    SurfSpot('surf-abu-dhabi', 'Stop No. 10 — Surf Abu Dhabi, Abu Dhabi, UAE', 24.467, 54.377, 'NW 10 kn', '2026-10-14', '2026-10-18'),
    SurfSpot('peniche', 'Stop No. 11 — Peniche, Portugal', 39.355, -9.381, 'N 15 kn', '2026-10-22', '2026-11-01'),
    SurfSpot('pipeline', 'Stop No. 12 — Banzai Pipeline, Hawaii, USA', 21.664, -158.051, 'ENE 12 kn', '2026-12-08', '2026-12-20'),
]

SKILL_ADJUSTMENTS = {'Beginner': 0.7, 'Intermediate': 1.0, 'Advanced': 1.25}


class RankingRowParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_row = False
        self.in_cell = False
        self.current_row: list[str] = []
        self.rows: list[list[str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == 'tr':
            self.in_row = True
            self.current_row = []
        elif self.in_row and tag in {'td', 'th'}:
            self.in_cell = True
            self.current_row.append('')

    def handle_data(self, data: str) -> None:
        if self.in_row and self.in_cell and self.current_row:
            self.current_row[-1] += data.strip()

    def handle_endtag(self, tag: str) -> None:
        if tag in {'td', 'th'}:
            self.in_cell = False
        elif tag == 'tr' and self.in_row:
            self.in_row = False
            normalized = [re.sub(r'\s+', ' ', cell).strip() for cell in self.current_row if cell.strip()]
            if len(normalized) >= 3 and normalized[0].isdigit():
                self.rows.append(normalized)


def json_get(url: str) -> dict[str, Any]:
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urlopen(req, timeout=25) as response:
        return json.loads(response.read().decode('utf-8'))


def text_get(url: str) -> str:
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urlopen(req, timeout=25) as response:
        return response.read().decode('utf-8', 'ignore')


@st.cache_data(ttl=30 * 60)
def fetch_marine_forecast(spot: SurfSpot, days: int, skill: str) -> list[dict[str, Any]]:
    start = dt.date.today()
    end = start + dt.timedelta(days=days - 1)
    query = urlencode(
        {
            'latitude': spot.lat,
            'longitude': spot.lng,
            'hourly': 'wave_height,wave_period',
            'timezone': 'UTC',
            'start_date': start.isoformat(),
            'end_date': end.isoformat(),
        }
    )
    url = f'https://marine-api.open-meteo.com/v1/marine?{query}'
    data = json_get(url)

    times = data.get('hourly', {}).get('time', [])
    heights = data.get('hourly', {}).get('wave_height', [])
    periods = data.get('hourly', {}).get('wave_period', [])

    buckets: dict[str, list[dict[str, Any]]] = {}
    for idx, iso_time in enumerate(times):
        date_part, hour_part = iso_time.split('T')
        hour = int(hour_part.split(':')[0])
        height = (heights[idx] if idx < len(heights) and heights[idx] is not None else 0.5) * SKILL_ADJUSTMENTS[skill]
        period = periods[idx] if idx < len(periods) and periods[idx] is not None else 8
        buckets.setdefault(date_part, []).append({'hour': hour, 'height': round(height, 2), 'period': round(period, 1), 'iso': iso_time})

    output: list[dict[str, Any]] = []
    for date_key, sessions in sorted(buckets.items()):
        daytime = [s for s in sessions if 6 <= s['hour'] <= 18] or sessions
        avg_height = round(sum(s['height'] for s in daytime) / max(len(daytime), 1), 2)
        avg_period = round(sum(s['period'] for s in daytime) / max(len(daytime), 1), 1)
        output.append(
            {
                'date': date_key,
                'day_label': dt.datetime.strptime(date_key, '%Y-%m-%d').strftime('%b %-d'),
                'height': avg_height,
                'period': avg_period,
                'sessions': daytime,
            }
        )
    return output[:days]


def spot_suitability(avg_height: float, skill: str) -> str:
    if skill == 'Beginner':
        return 'Good for progression' if avg_height <= 1.6 else 'Challenging conditions'
    if skill == 'Intermediate':
        return 'Good balance of power and control' if avg_height <= 2.7 else 'Bring confidence'
    return 'Excellent heavy-water session' if avg_height >= 2.5 else 'Playful but smaller day'


@st.cache_data(ttl=30 * 60)
def fetch_wsl_rankings(tour: str, year: int = 2026) -> list[dict[str, str]]:
    tour_url = f'https://www.worldsurfleague.com/athletes/tour/{tour}?year={year}'
    html = text_get(tour_url)

    script_match = re.search(r'<script[^>]+id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, flags=re.DOTALL)
    if script_match:
        try:
            next_data = json.loads(script_match.group(1))
            payload = json.dumps(next_data)
            rows = re.findall(r'"rank"\s*:\s*(\d+).*?"fullName"\s*:\s*"([^"]+)".*?"points"\s*:\s*([\d.]+)', payload)
            if rows:
                return [{'Rank': r, 'Surfer': name, 'Points': str(int(float(points)))} for r, name, points in rows[:20]]
        except json.JSONDecodeError:
            pass

    parser = RankingRowParser()
    parser.feed(html)
    parsed_rows = parser.rows[:20]
    if parsed_rows:
        table_rows = []
        for row in parsed_rows:
            # Common WSL row ordering: rank, athlete, nationality, events, points
            points = row[-1] if row[-1].replace('.', '', 1).isdigit() else row[min(4, len(row) - 1)]
            table_rows.append({'Rank': row[0], 'Surfer': row[1], 'Points': points})
        return table_rows

    return []


def hourly_chart_data(day: dict[str, Any]) -> dict[str, Any]:
    rows = []
    for row in day['sessions']:
        hour_label = f"{row['hour']:02d}:00"
        rows.append({'hour': hour_label, 'height': row['height']})
    return {
        'mark': {'type': 'line', 'point': True, 'color': '#38bdf8'},
        'encoding': {
            'x': {'field': 'hour', 'type': 'ordinal', 'title': 'Hour (UTC)'},
            'y': {'field': 'height', 'type': 'quantitative', 'title': 'Wave Height (m)'},
            'tooltip': [
                {'field': 'hour', 'type': 'ordinal', 'title': 'Hour'},
                {'field': 'height', 'type': 'quantitative', 'title': 'Height (m)'},
            ],
        },
        'data': {'values': rows},
    }


def daily_chart_data(forecast: list[dict[str, Any]], spot_name: str) -> dict[str, Any]:
    rows = [{'day': day['day_label'], 'height': day['height']} for day in forecast]
    return {
        'title': f'{spot_name} — Wave Height (m)',
        'mark': {'type': 'line', 'point': True, 'color': '#22d3ee'},
        'encoding': {
            'x': {'field': 'day', 'type': 'ordinal', 'title': 'Date'},
            'y': {'field': 'height', 'type': 'quantitative', 'title': 'Average Daytime Wave Height (m)'},
            'tooltip': [
                {'field': 'day', 'type': 'ordinal', 'title': 'Day'},
                {'field': 'height', 'type': 'quantitative', 'title': 'Height (m)'},
            ],
        },
        'data': {'values': rows},
    }


def render_rankings(title: str, rows: list[dict[str, str]]) -> None:
    st.subheader(title)
    if not rows:
        st.warning('Unable to load live rankings right now from World Surf League.')
        return
    st.dataframe(rows, use_container_width=True, hide_index=True, height=420)


def main() -> None:
    st.set_page_config(page_title='Global Surf Forecast Dashboard', layout='wide')
    st.markdown(
        """
        <style>
        .stApp {
            color: #e2e8f0;
            background: radial-gradient(circle at top, #10203a 0%, #0b1220 30%, #020617 100%);
        }
        .main .block-container {
            padding-top: 1.2rem;
            padding-bottom: 1rem;
            max-width: 1200px;
        }
        .panel {
            background: linear-gradient(180deg, #0f172a 0%, #0b1220 100%);
            border: 1px solid #1e293b;
            border-radius: 12px;
            padding: 0.85rem;
            box-shadow: 0 12px 28px rgba(2, 6, 23, 0.65);
            margin-bottom: 1rem;
        }
        .panel h3 {
            margin: 0 0 0.5rem 0;
            color: #e2e8f0;
        }
        .muted {
            color: #94a3b8;
        }
        .card {
            margin-top: 0.45rem;
            border: 1px solid #334155;
            border-radius: 10px;
            background: linear-gradient(180deg, rgba(14, 165, 233, 0.15), rgba(30, 64, 175, 0.12));
            padding: 0.75rem;
            color: #dbeafe;
        }
        .day-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
            gap: 0.75rem;
        }
        .day-card {
            border: 1px solid #334155;
            border-radius: 10px;
            padding: 0.6rem;
            background: linear-gradient(180deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9));
        }
        .day-card h4 { margin: 0; font-size: 0.95rem; color: #e2e8f0; }
        .day-date { margin: 0.15rem 0 0.45rem; color: #94a3b8; font-size: 0.78rem; }
        .day-card ul { list-style: none; margin: 0; padding: 0; }
        .day-card li {
            display: grid;
            grid-template-columns: 1fr auto auto;
            gap: 0.45rem;
            font-size: 0.82rem;
            margin: 0.2rem 0;
        }
        .day-card li strong { color: #38bdf8; }
        .day-card li em { color: #94a3b8; font-style: normal; }
        </style>
        """,
        unsafe_allow_html=True,
    )
    st.title('🌊 Global Surf Forecast Dashboard')
    st.caption('Explore 2026 Championship Tour spots, real-time rolling wave forecasts, and hourly timing.')

    left, right = st.columns([2, 1], gap='large')

    with right:
        st.markdown('<div class="panel"><h3>Forecast Controls</h3></div>', unsafe_allow_html=True)
        spot = st.selectbox('Surf Spot', SURF_SPOTS, format_func=lambda s: s.name, label_visibility='visible')
        days = st.slider('Forecast Window (days)', min_value=1, max_value=6, value=6)
        skill = st.selectbox('Rider Skill', list(SKILL_ADJUSTMENTS.keys()), index=1)

    try:
        forecast = fetch_marine_forecast(spot, days, skill)
    except Exception as exc:
        st.error(f'Unable to load live forecast right now: {exc}')
        return

    with left:
        st.markdown('<div class="panel"><h3>Map</h3></div>', unsafe_allow_html=True)
        map_points = [{'lat': s.lat, 'lon': s.lng} for s in SURF_SPOTS]
        st.map(map_points, size=18)

        st.markdown('<div class="panel"><h3>Wave Height Forecast (meters)</h3></div>', unsafe_allow_html=True)
        st.vega_lite_chart(daily_chart_data(forecast, spot.name), use_container_width=True)

        by_day_cards: list[str] = []
        for day in forecast:
            sessions = day['sessions'][::3][:6]
            items = ''.join(
                f"<li><span>{dt.datetime.strptime(s['iso'], '%Y-%m-%dT%H:%M').strftime('%-I:%M %p')}</span>"
                f"<strong>{s['height']:.2f}m</strong><em>{s['period']:.1f}s</em></li>"
                for s in sessions
            )
            by_day_cards.append(
                f"""
                <div class="day-card">
                    <h4>{day['day_label']}</h4>
                    <p class="day-date">{day['date']}</p>
                    <ul>{items}</ul>
                </div>
                """
            )
        st.markdown('<div class="panel"><h3>By-day &amp; Time-of-day Wave Outlook</h3></div>', unsafe_allow_html=True)
        st.markdown(f'<div class="day-grid">{"".join(by_day_cards)}</div>', unsafe_allow_html=True)

    with right:
        avg_height = round(sum(day['height'] for day in forecast) / max(len(forecast), 1), 2)
        best_day = max(forecast, key=lambda row: row['height'])
        rolling_range_days = max(len(forecast) - 1, 0)
        rolling_range_label = 'today only' if rolling_range_days == 0 else f'today + {rolling_range_days} days'
        st.markdown(
            f"""
            <div class="card">
              <h3>{spot.name}</h3>
              <p><strong>Championship window:</strong> {spot.event_window_start} - {spot.event_window_end}</p>
              <p><strong>Real-time forecast range:</strong> {forecast[0]['date']} to {forecast[-1]['date']} ({rolling_range_label})</p>
              <p><strong>Avg wave height:</strong> {avg_height} m</p>
              <p><strong>Peak day:</strong> {best_day['day_label']} ({best_day['height']} m)</p>
              <p><strong>Swell period:</strong> {best_day['period']} s</p>
              <p><strong>Wind:</strong> {spot.wind}</p>
              <p><strong>Suitability:</strong> {spot_suitability(avg_height, skill)}</p>
            </div>
            """,
            unsafe_allow_html=True,
        )


if __name__ == '__main__':
    main()
