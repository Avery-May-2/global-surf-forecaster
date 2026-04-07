import { fetchWeatherApi } from 'https://esm.sh/openmeteo@1.1.4';

const surfSpots = [
  {
    id: 'bells',
    name: 'Stop No. 1 — Bells Beach, Victoria, Australia',
    lat: -38.372,
    lng: 144.28,
    wind: 'SW 16 kn',
    eventWindowStart: '2026-04-01',
    eventWindowEnd: '2026-04-11'
  },
  {
    id: 'margaret-river',
    name: 'Stop No. 2 — Margaret River, Western Australia, Australia',
    lat: -33.954,
    lng: 114.992,
    wind: 'S 18 kn',
    eventWindowStart: '2026-04-17',
    eventWindowEnd: '2026-04-27'
  },
  {
    id: 'snapper-rocks',
    name: 'Stop No. 3 — Snapper Rocks, Queensland, Australia',
    lat: -28.164,
    lng: 153.548,
    wind: 'SE 11 kn',
    eventWindowStart: '2026-05-02',
    eventWindowEnd: '2026-05-12'
  },
  {
    id: 'raglan',
    name: 'Stop No. 4 — Raglan, New Zealand',
    lat: -37.799,
    lng: 174.87,
    wind: 'W 14 kn',
    eventWindowStart: '2026-05-15',
    eventWindowEnd: '2026-05-25'
  },
  {
    id: 'punta-roca',
    name: 'Stop No. 5 — Punta Roca, El Salvador',
    lat: 13.489,
    lng: -89.392,
    wind: 'SSE 8 kn',
    eventWindowStart: '2026-06-05',
    eventWindowEnd: '2026-06-15'
  },
  {
    id: 'saquarema',
    name: 'Stop No. 6 — Saquarema, Rio de Janeiro, Brazil',
    lat: -22.934,
    lng: -42.502,
    wind: 'E 14 kn',
    eventWindowStart: '2026-06-19',
    eventWindowEnd: '2026-06-27'
  },
  {
    id: 'teahupoo',
    name: "Stop No. 7 — Teahupo'o, Tahiti, French Polynesia",
    lat: -17.833,
    lng: -149.267,
    wind: 'SE 9 kn',
    eventWindowStart: '2026-08-08',
    eventWindowEnd: '2026-08-18'
  },
  {
    id: 'cloudbreak',
    name: 'Stop No. 8 — Cloudbreak, Fiji',
    lat: -17.873,
    lng: 177.188,
    wind: 'ESE 13 kn',
    eventWindowStart: '2026-08-25',
    eventWindowEnd: '2026-09-04'
  },
  {
    id: 'lower-trestles',
    name: 'Stop No. 9 — Lower Trestles, San Clemente, Calif., USA',
    lat: 33.384,
    lng: -117.593,
    wind: 'W 9 kn',
    eventWindowStart: '2026-09-11',
    eventWindowEnd: '2026-09-20'
  },
  {
    id: 'surf-abu-dhabi',
    name: 'Stop No. 10 — Surf Abu Dhabi, Abu Dhabi, UAE',
    lat: 24.467,
    lng: 54.377,
    wind: 'NW 10 kn',
    eventWindowStart: '2026-10-14',
    eventWindowEnd: '2026-10-18'
  },
  {
    id: 'peniche',
    name: 'Stop No. 11 — Peniche, Portugal',
    lat: 39.355,
    lng: -9.381,
    wind: 'N 15 kn',
    eventWindowStart: '2026-10-22',
    eventWindowEnd: '2026-11-01'
  },
  {
    id: 'pipeline',
    name: 'Stop No. 12 — Banzai Pipeline, Hawaii, USA',
    lat: 21.664,
    lng: -158.051,
    wind: 'ENE 12 kn',
    eventWindowStart: '2026-12-08',
    eventWindowEnd: '2026-12-20'
  }
];

const FORECAST_DAYS = 6;
const hasLeaflet = typeof window.L !== 'undefined';
const hasChartJs = typeof window.Chart !== 'undefined';
let map = null;

if (hasLeaflet) {
  map = L.map('map').setView([8, -15], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
} else {
  document.getElementById('map').innerHTML = '<p style="padding:1rem;color:#cbd5e1;">Map library failed to load. Forecast controls and charts are still available.</p>';
}

const selectSpot = document.getElementById('spot-select');
const windowRange = document.getElementById('window-range');
const windowValue = document.getElementById('window-value');
const windowDates = document.getElementById('window-dates');
const skillLevel = document.getElementById('skill-level');
const summaryCard = document.getElementById('conditions-summary');
const byDayContainer = document.getElementById('by-day-forecast');
const hourlyDaySelect = document.getElementById('hourly-day-select');
const mctRankings = document.getElementById('mct-rankings');
const wctRankings = document.getElementById('wct-rankings');
const rankingsUpdatedAt = document.getElementById('rankings-updated-at');

let activeSpotId = surfSpots[0].id;
let dailyChart;
let hourlyChart;
let latestForecast = [];
const RANKINGS_REFRESH_MS = 15 * 60 * 1000;

function formatDateLabel(dateStr) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function dateIsoFromNow(offsetDays) {
  const utc = new Date();
  const d = new Date(Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate() + offsetDays));
  return d.toISOString().slice(0, 10);
}

function updateWindowDateLabel(days) {
  if (!windowDates) return;
  const spanDays = Math.max(days - 1, 0);
  if (spanDays === 0) {
    windowDates.textContent = '(today only)';
    return;
  }

  windowDates.textContent = `(${dateIsoFromNow(0)} to ${dateIsoFromNow(spanDays)})`;
}

function groupByDay(hourlyTimes, heights, periods) {
  const buckets = new Map();

  hourlyTimes.forEach((time, idx) => {
    const [date, hourStr] = time.split('T');
    const hour = Number(hourStr.split(':')[0]);

    if (!buckets.has(date)) {
      buckets.set(date, []);
    }

    buckets.get(date).push({
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      height: heights[idx],
      period: periods[idx]
    });
  });

  return Array.from(buckets.entries()).map(([date, sessions]) => {
    const daytimeSessions = sessions.filter((s) => s.hour >= 6 && s.hour <= 18);
    const sample = daytimeSessions.length ? daytimeSessions : sessions;
    const dayHeight = sample.reduce((sum, s) => sum + s.height, 0) / sample.length;
    const dayPeriod = sample.reduce((sum, s) => sum + s.period, 0) / sample.length;

    return {
      date,
      dayLabel: formatDateLabel(date),
      height: Number(dayHeight.toFixed(2)),
      period: Number(dayPeriod.toFixed(1)),
      sessions: sample.map((s) => ({ label: s.label, hour: s.hour, height: Number(s.height.toFixed(2)), period: Number(s.period.toFixed(1)) })),
      compactSessions: sample
        .filter((_, i) => i % 3 === 0)
        .slice(0, 6)
        .map((s) => ({ label: s.label, height: Number(s.height.toFixed(2)), period: Number(s.period.toFixed(1)) }))
    };
  });
}

async function fetchMarineForecast(spot, days, skill) {
  const skillAdjustments = { beginner: 0.7, intermediate: 1, advanced: 1.25 };
  const startDate = dateIsoFromNow(0);
  const endDate = dateIsoFromNow(days - 1);
  const responses = await fetchWeatherApi('https://marine-api.open-meteo.com/v1/marine', {
    latitude: spot.lat,
    longitude: spot.lng,
    hourly: ['wave_height', 'wave_period'],
    timezone: 'UTC',
    start_date: startDate,
    end_date: endDate
  });

  const response = responses[0];
  const hourly = response.hourly();
  if (!hourly) return [];

  const utcOffsetSeconds = response.utcOffsetSeconds();
  const count = (Number(hourly.timeEnd()) - Number(hourly.time())) / hourly.interval();
  const times = Array.from({ length: count }, (_, i) => {
    const epochSeconds = Number(hourly.time()) + i * hourly.interval() + utcOffsetSeconds;
    return new Date(epochSeconds * 1000).toISOString().slice(0, 16);
  });

  const waveHeights = Array.from(hourly.variables(0)?.valuesArray() ?? []).map((h) => (h ?? 0.5) * skillAdjustments[skill]);
  const wavePeriods = Array.from(hourly.variables(1)?.valuesArray() ?? []).map((p) => p ?? 8);

  return groupByDay(times, waveHeights, wavePeriods).slice(0, days);
}

function spotSuitability(avgHeight, skill) {
  if (skill === 'beginner') return avgHeight <= 1.6 ? 'Good for progression' : 'Challenging conditions';
  if (skill === 'intermediate') return avgHeight <= 2.7 ? 'Good balance of power and control' : 'Bring confidence';
  return avgHeight >= 2.5 ? 'Excellent heavy-water session' : 'Playful but smaller day';
}

function updateSummary(spot, forecast, skill) {
  const averageHeight = (forecast.reduce((sum, item) => sum + item.height, 0) / forecast.length).toFixed(2);
  const bestDay = forecast.reduce((best, current) => (current.height > best.height ? current : best));
  const rollingRangeDays = Math.max(forecast.length - 1, 0);
  const rollingRangeLabel = rollingRangeDays === 0 ? 'today only' : `today + ${rollingRangeDays} days`;

  summaryCard.innerHTML = `
    <h3>${spot.name}</h3>
    <p><strong>Championship window:</strong> ${formatDateLabel(spot.eventWindowStart)} - ${formatDateLabel(spot.eventWindowEnd)}</p>
    <p><strong>Real-time forecast range:</strong> ${forecast[0].date} to ${forecast[forecast.length - 1].date} (${rollingRangeLabel})</p>
    <p><strong>Avg wave height:</strong> ${averageHeight} m</p>
    <p><strong>Peak day:</strong> ${bestDay.dayLabel} (${bestDay.height} m)</p>
    <p><strong>Swell period:</strong> ${bestDay.period} s</p>
    <p><strong>Wind:</strong> ${spot.wind}</p>
    <p><strong>Suitability:</strong> ${spotSuitability(Number(averageHeight), skill)}</p>
  `;
}

function renderDailyChart(forecast, spotName) {
  if (!hasChartJs) {
    const chartEl = document.getElementById('forecast-chart');
    chartEl.replaceWith(Object.assign(document.createElement('p'), {
      textContent: 'Chart library failed to load. Daily heights are still listed below.'
    }));
    return;
  }

  const labels = forecast.map((entry) => entry.dayLabel);
  const heights = forecast.map((entry) => entry.height);

  if (dailyChart) dailyChart.destroy();

  const ctx = document.getElementById('forecast-chart');
  dailyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: `${spotName} - Wave Height (m)`,
        data: heights,
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.20)',
        borderWidth: 3,
        fill: true,
        tension: 0.28,
        pointRadius: 4
      }]
    },
    options: chartOptions('Meters')
  });
}

function renderHourlyChart(day) {
  if (!hasChartJs) return;

  const labels = day.sessions.map((session) => session.label);
  const heights = day.sessions.map((session) => session.height);

  if (hourlyChart) hourlyChart.destroy();

  const ctx = document.getElementById('hourly-chart');
  hourlyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: `${day.dayLabel} - Hourly Wave Height (m)`,
        data: heights,
        borderColor: '#22d3ee',
        backgroundColor: 'rgba(34, 211, 238, 0.18)',
        borderWidth: 2,
        fill: true,
        tension: 0.24,
        pointRadius: 3
      }]
    },
    options: chartOptions('Meters')
  });
}

function chartOptions(yTitle) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { labels: { color: '#e2e8f0' } } },
    scales: {
      x: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(148, 163, 184, 0.2)' } },
      y: {
        beginAtZero: true,
        ticks: { color: '#cbd5e1' },
        title: { display: true, text: yTitle, color: '#e2e8f0' },
        grid: { color: 'rgba(148, 163, 184, 0.2)' }
      }
    }
  };
}

function renderByDay(forecast) {
  byDayContainer.innerHTML = forecast
    .map((day) => `
      <article class="day-card">
        <h3>${day.dayLabel}</h3>
        <p class="day-date">${day.date}</p>
        <ul>
          ${day.compactSessions
            .map((session) => `<li><span>${session.label}</span><strong>${session.height} m</strong><em>${session.period}s</em></li>`)
            .join('')}
        </ul>
      </article>
    `)
    .join('');
}

function renderHourlyDayPicker(forecast) {
  const previous = hourlyDaySelect.value;
  hourlyDaySelect.innerHTML = '';

  forecast.forEach((day, idx) => {
    const option = document.createElement('option');
    option.value = String(idx);
    option.textContent = `${day.dayLabel} (${day.date})`;
    hourlyDaySelect.appendChild(option);
  });

  const selected = previous && Number(previous) < forecast.length ? Number(previous) : 0;
  hourlyDaySelect.value = String(selected);
  renderHourlyChart(forecast[selected]);
}

function formatTimestamp(date = new Date()) {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function parseRankingsFromWslNextData(text) {
  const scriptMatch = text.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!scriptMatch) return [];

  const seen = new Set();
  const rows = [];

  function walk(value) {
    if (!value || rows.length >= 20) return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value !== 'object') return;

    const rank = Number(value.rank ?? value.liveRank ?? value.position);
    const points = Number(String(value.points ?? value.totalPoints ?? value.livePoints ?? '').replace(/,/g, ''));
    const name = String(value.fullName ?? value.name ?? [value.firstName, value.lastName].filter(Boolean).join(' ')).trim();

    if (Number.isFinite(rank) && rank > 0 && Number.isFinite(points) && name && !seen.has(name)) {
      rows.push({ rank, name, points: Math.round(points) });
      seen.add(name);
    }

    Object.values(value).forEach(walk);
  }

  try {
    walk(JSON.parse(scriptMatch[1]));
  } catch (error) {
    return [];
  }

  return rows.sort((a, b) => a.rank - b.rank).slice(0, 20);
}

function parseRankingsFromLooseJson(text) {
  const rows = [];
  const seen = new Set();
  const matcher = /"rank"\s*:\s*(\d+)[\s\S]*?"fullName"\s*:\s*"([^"]+)"[\s\S]*?"points"\s*:\s*([\d.]+)/g;
  let match;
  while ((match = matcher.exec(text)) && rows.length < 20) {
    const rank = Number(match[1]);
    const name = match[2].trim();
    const points = Math.round(Number(match[3]));
    if (!name || seen.has(name)) continue;
    rows.push({ rank, name, points });
    seen.add(name);
  }
  return rows.sort((a, b) => a.rank - b.rank).slice(0, 20);
}

async function scrapeWslRankings(tour) {
  const targetUrl = `https://www.worldsurfleague.com/athletes/tour/${tour}?year=2026`;
  const sources = [
    `https://r.jina.ai/http://www.worldsurfleague.com/athletes/tour/${tour}?year=2026`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`
  ];

  for (const source of sources) {
    try {
      const response = await fetch(source);
      if (!response.ok) continue;
      const text = await response.text();
      const rows = parseRankingsFromWslNextData(text);
      const fallbackRows = rows.length ? rows : parseRankingsFromLooseJson(text);
      if (fallbackRows.length) return fallbackRows;
    } catch (error) {
      // Try next source.
    }
  }

  throw new Error(`Unable to scrape ${tour.toUpperCase()} rankings`);
}

function renderRankingTable(container, rows) {
  if (!rows.length) {
    container.innerHTML = '<p class="muted">Unable to load rankings right now.</p>';
    return;
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr><th>Rank</th><th>Surfer</th><th>Points</th></tr>
      </thead>
      <tbody>
        ${rows.map((row) => `<tr><td>${row.rank}</td><td>${row.name}</td><td>${row.points.toLocaleString()}</td></tr>`).join('')}
      </tbody>
    </table>
  `;
}

async function loadRankings() {
  mctRankings.innerHTML = '<p class="muted">Loading rankings…</p>';
  wctRankings.innerHTML = '<p class="muted">Loading rankings…</p>';

  const [men, women] = await Promise.allSettled([scrapeWslRankings('mct'), scrapeWslRankings('wct')]);
  renderRankingTable(mctRankings, men.status === 'fulfilled' ? men.value : []);
  renderRankingTable(wctRankings, women.status === 'fulfilled' ? women.value : []);
  rankingsUpdatedAt.textContent = `Updated ${formatTimestamp(new Date())}`;
}

async function refreshDashboard() {
  const spot = surfSpots.find((s) => s.id === activeSpotId);
  const selectedDays = Math.min(Number(windowRange.value), FORECAST_DAYS);
  windowValue.textContent = String(selectedDays);
  updateWindowDateLabel(selectedDays);

  summaryCard.innerHTML = '<p>Loading latest marine forecast…</p>';

  try {
    const forecast = await fetchMarineForecast(spot, selectedDays, skillLevel.value);
    latestForecast = forecast;
    updateSummary(spot, forecast, skillLevel.value);
    renderDailyChart(forecast, spot.name);
    renderHourlyDayPicker(forecast);
    renderByDay(forecast);
  } catch (error) {
    summaryCard.innerHTML = `<p>Unable to load live forecast right now. ${error.message}</p>`;
    byDayContainer.innerHTML = '';
    hourlyDaySelect.innerHTML = '';
    if (dailyChart) dailyChart.destroy();
    if (hourlyChart) hourlyChart.destroy();
  }
}

const markers = new Map();

surfSpots.forEach((spot) => {
  const option = document.createElement('option');
  option.value = spot.id;
  option.textContent = spot.name;
  selectSpot.appendChild(option);

  if (!hasLeaflet) return;

  const marker = L.marker([spot.lat, spot.lng])
    .addTo(map)
    .bindPopup(`<strong>${spot.name}</strong><br/>Window: ${formatDateLabel(spot.eventWindowStart)} - ${formatDateLabel(spot.eventWindowEnd)}`);

  marker.on('click', () => {
    activeSpotId = spot.id;
    selectSpot.value = spot.id;
    refreshDashboard();
  });

  markers.set(spot.id, marker);
});

windowRange.max = String(FORECAST_DAYS);
windowRange.value = String(FORECAST_DAYS);
windowValue.textContent = String(FORECAST_DAYS);
updateWindowDateLabel(FORECAST_DAYS);

selectSpot.addEventListener('change', (event) => {
  activeSpotId = event.target.value;
  const spot = surfSpots.find((s) => s.id === activeSpotId);
  if (hasLeaflet && map) {
    map.flyTo([spot.lat, spot.lng], 5, { duration: 1 });
    markers.get(spot.id)?.openPopup();
  }
  refreshDashboard();
});

windowRange.addEventListener('input', refreshDashboard);
skillLevel.addEventListener('change', refreshDashboard);
hourlyDaySelect.addEventListener('change', (event) => {
  const idx = Number(event.target.value);
  if (latestForecast[idx]) {
    renderHourlyChart(latestForecast[idx]);
  }
});

selectSpot.value = activeSpotId;
refreshDashboard();
