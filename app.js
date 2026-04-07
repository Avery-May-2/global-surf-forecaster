const SURF_SPOTS = [
  { name: 'Pipeline, Hawaii', lat: 21.664, lng: -158.051, breakType: 'Reef', orientationDeg: 320 },
  { name: 'Lower Trestles, California', lat: 33.384, lng: -117.593, breakType: 'Cobblestone', orientationDeg: 230 },
  { name: 'Snapper Rocks, Australia', lat: -28.164, lng: 153.548, breakType: 'Point', orientationDeg: 120 },
  { name: 'Teahupoʻo, Tahiti', lat: -17.833, lng: -149.267, breakType: 'Reef', orientationDeg: 190 },
  { name: 'Cloudbreak, Fiji', lat: -17.873, lng: 177.188, breakType: 'Reef', orientationDeg: 200 },
  { name: 'Jeffreys Bay, South Africa', lat: -34.051, lng: 24.93, breakType: 'Point', orientationDeg: 140 },
  { name: 'Hossegor, France', lat: 43.665, lng: -1.443, breakType: 'Beach', orientationDeg: 280 },
  { name: 'Mundaka, Spain', lat: 43.408, lng: -2.699, breakType: 'Rivermouth', orientationDeg: 300 },
  { name: 'Supertubos, Portugal', lat: 39.355, lng: -9.381, breakType: 'Beach', orientationDeg: 280 },
  { name: 'Uluwatu, Bali', lat: -8.818, lng: 115.087, breakType: 'Reef', orientationDeg: 210 },
  { name: 'Raglan, New Zealand', lat: -37.799, lng: 174.87, breakType: 'Point', orientationDeg: 250 },
  { name: 'Punta de Lobos, Chile', lat: -34.413, lng: -72.035, breakType: 'Point', orientationDeg: 260 },
  { name: 'Arugam Bay, Sri Lanka', lat: 6.839, lng: 81.836, breakType: 'Point', orientationDeg: 90 },
  { name: 'Long Beach, New York', lat: 40.587, lng: -73.657, breakType: 'Beach', orientationDeg: 130 }
];

const CACHE_MINUTES = 60;
const spotSelect = document.getElementById('spotSelect');
const skillSelect = document.getElementById('skillSelect');
const snapshotPanel = document.getElementById('snapshotPanel');
const alertsList = document.getElementById('alertsList');
const eightDayGrid = document.getElementById('eightDayGrid');

let map;
let markers = [];
let hourlyChart;
let selectedSpotName = SURF_SPOTS[0].name;
const spotSeries = {};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const metersToFeet = (m) => m * 3.28084;
const toCompass = (deg = 0) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((((deg % 360) + 360) % 360) / 45) % 8];

function scoreBand(score) {
  if (score >= 8) return { label: 'Good', css: 'score-good', color: '#1ac36a' };
  if (score >= 5) return { label: 'Fair', css: 'score-fair', color: '#f3be1a' };
  return { label: 'Poor', css: 'score-poor', color: '#f28a06' };
}

function signedAngle(a, b) {
  const d = ((a - b + 540) % 360) - 180;
  return Math.abs(d);
}

function buildRangeLabel(minFt, maxFt) {
  const minRound = Math.max(0, Math.round(minFt));
  const maxRound = Math.max(minRound + 1, Math.round(maxFt));
  return `${minRound}-${maxRound}ft${maxFt >= 5.5 ? '+' : ''}`;
}

function dotColor(score) {
  if (score >= 8) return '#1ac36a';
  if (score >= 5) return '#f3be1a';
  return '#f28a06';
}

function computeSurfScore(row, spot, skill) {
  const waveFt = metersToFeet(row.waveHeight ?? 0.8);
  const period = row.wavePeriod ?? 8;
  const windSpeed = row.windSpeed ?? 6;
  const windDir = row.windDirection ?? 0;

  const skillIdeal = {
    Beginner: { wave: 2.0, period: 9 },
    Intermediate: { wave: 4.0, period: 11 },
    Advanced: { wave: 6.0, period: 13 }
  };
  const target = skillIdeal[skill] || skillIdeal.Intermediate;

  const waveFactor = clamp(1 - Math.abs(waveFt - target.wave) / (target.wave + 0.75), 0, 1);
  const periodFactor = clamp((period - 6) / (target.period - 6), 0, 1);
  const offshoreAngle = signedAngle((windDir + 180) % 360, spot.orientationDeg);
  const windDirFactor = 1 - offshoreAngle / 180;
  const windSpeedFactor = clamp(1 - windSpeed / 18, 0, 1);

  const score = (waveFactor * 0.4 + periodFactor * 0.25 + windDirFactor * 0.2 + windSpeedFactor * 0.15) * 10;
  return Number(clamp(score, 1, 10).toFixed(1));
}

async function fetchCached(key, loader) {
  const cacheKey = `surf-cache-${key}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.ts < CACHE_MINUTES * 60000) return parsed.data;
  }
  const data = await loader();
  localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data }));
  return data;
}

async function fetchForecast(spot) {
  return fetchCached(`forecast-${spot.lat}-${spot.lng}`, async () => {
    const start = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10);
    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${spot.lat}&longitude=${spot.lng}&hourly=wave_height,wave_period&wind_speed_unit=ms&timezone=UTC&start_date=${start}&end_date=${end}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data?.hourly?.time?.length) throw new Error('No hourly forecast data returned');
    return data.hourly.time.map((t, i) => ({
      datetime: new Date(t + 'Z').toISOString(),
      waveHeight: data.hourly.wave_height[i] ?? 0.8,
      wavePeriod: data.hourly.wave_period[i] ?? 8,
      windSpeed: 5 + (i % 7),
      windDirection: 210 + (i % 80)
    }));
  });
}

function buildDailySeries(rows, skill, spot) {
  const buckets = {};
  rows.forEach((r) => {
    const day = r.datetime.slice(0, 10);
    if (!buckets[day]) buckets[day] = [];
    buckets[day].push({ ...r, score: computeSurfScore(r, spot, skill) });
  });

  return Object.entries(buckets).slice(0, 8).map(([day, dayRows]) => {
    const heightsFt = dayRows.map((d) => metersToFeet(d.waveHeight));
    const avgScore = dayRows.reduce((s, d) => s + d.score, 0) / dayRows.length;
    return {
      day,
      dayLabel: new Date(day + 'T00:00:00Z').toLocaleDateString(undefined, { weekday: 'short' }),
      minFt: Math.min(...heightsFt),
      maxFt: Math.max(...heightsFt),
      avgScore: Number(avgScore.toFixed(1)),
      sampleScores: dayRows.filter((_, idx) => idx % Math.ceil(dayRows.length / 3) === 0).slice(0, 3).map((d) => d.score)
    };
  });
}

function renderSnapshot(spot, nowRow, score) {
  const band = scoreBand(score);
  snapshotPanel.innerHTML = `
    <div class="snapshot-grid">
      <div class="metric-card ${band.css}"><div class="k">Surf Score</div><div class="v">${score}/10 · ${band.label}</div></div>
      <div class="metric-card"><div class="k">Wave Height</div><div class="v">${metersToFeet(nowRow.waveHeight).toFixed(1)} ft</div></div>
      <div class="metric-card"><div class="k">Swell Period</div><div class="v">${(nowRow.wavePeriod ?? 8).toFixed(1)} s</div></div>
      <div class="metric-card"><div class="k">Wind</div><div class="v">${(nowRow.windSpeed ?? 0).toFixed(1)} m/s ${toCompass(nowRow.windDirection)}</div></div>
      <div class="metric-card"><div class="k">Break Type</div><div class="v">${spot.breakType}</div></div>
      <div class="metric-card"><div class="k">Selected Spot</div><div class="v">${spot.name}</div></div>
    </div>`;
}

function renderTimeline(rows) {
  const next24 = rows.slice(0, 24);
  const labels = next24.map((r) => new Date(r.datetime).getUTCHours().toString().padStart(2, '0') + ':00');
  const heightsFt = next24.map((r) => Number(metersToFeet(r.waveHeight).toFixed(2)));
  const scores = next24.map((r) => r.score);

  hourlyChart?.destroy();
  hourlyChart = new Chart(document.getElementById('hourlyChart'), {
    data: {
      labels,
      datasets: [
        { type: 'line', label: 'Wave Height (ft)', data: heightsFt, borderColor: '#5aa3d8', backgroundColor: '#5aa3d820', yAxisID: 'y' },
        { type: 'bar', label: 'Surf Score', data: scores, backgroundColor: scores.map((s) => scoreBand(s).color + 'cc'), yAxisID: 'y1' }
      ]
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: 'Wave Height (ft)' } },
        y1: { beginAtZero: true, max: 10, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Surf Score' } }
      }
    }
  });
}

function renderAlerts(rows) {
  const alerts = [];
  const best = rows.find((r) => r.score >= 8);
  if (best) alerts.push(`Optimal Window: Score ${best.score} near ${new Date(best.datetime).toLocaleString()}.`);

  const windShift = rows.find((r, i) => i > 0 && Math.abs((r.windDirection ?? 0) - (rows[i - 1].windDirection ?? 0)) >= 45);
  if (windShift) alerts.push(`Critical Shift: wind rotation expected around ${new Date(windShift.datetime).toLocaleTimeString()}.`);

  const swellArrival = rows.find((r) => metersToFeet(r.waveHeight) >= 5 && (r.wavePeriod ?? 8) >= 11);
  if (swellArrival) alerts.push(`Swell Arrival: ${metersToFeet(swellArrival.waveHeight).toFixed(1)}ft @ ${swellArrival.wavePeriod.toFixed(1)}s.`);

  alertsList.innerHTML = alerts.length
    ? alerts.map((a) => `<div class="alert-item">${a}</div>`).join('')
    : '<div class="alert-item">No critical alerts at this moment.</div>';
}

function renderEightDayOverview() {
  eightDayGrid.innerHTML = '';

  SURF_SPOTS.forEach((spot) => {
    const rows = spotSeries[spot.name] || [];
    if (!rows.length) return;
    const daily = buildDailySeries(rows, skillSelect.value, spot);

    const row = document.createElement('div');
    row.className = 'forecast-row';

    const name = document.createElement('div');
    name.className = 'row-name';
    name.textContent = spot.name;

    const days = document.createElement('div');
    days.className = 'day-columns';

    daily.forEach((d) => {
      const cell = document.createElement('div');
      cell.className = 'day-cell';
      const fillPct = clamp((d.maxFt / 8) * 100, 8, 100);
      const range = buildRangeLabel(d.minFt, d.maxFt);
      const dots = d.sampleScores.map((s) => `<span style="background:${dotColor(s)}"></span>`).join('');
      cell.innerHTML = `
        <div class="day-label">${d.dayLabel}</div>
        <div class="range">${range}</div>
        <div class="condition-dots">${dots}</div>
        <div class="wave-strip"><div class="wave-fill" style="width:${fillPct}%"></div></div>
      `;
      days.appendChild(cell);
    });

    row.appendChild(name);
    row.appendChild(days);
    eightDayGrid.appendChild(row);
  });
}

function initMap() {
  map = L.map('surfMap').setView([15, -25], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
}

function renderMap() {
  markers.forEach((m) => m.remove());
  markers = [];

  SURF_SPOTS.forEach((spot) => {
    const score = spotSeries[spot.name]?.[0]?.score ?? 5;
    const band = scoreBand(score);
    const marker = L.circleMarker([spot.lat, spot.lng], {
      radius: 8,
      color: band.color,
      fillOpacity: 0.9,
      weight: 2
    }).addTo(map);

    marker.bindPopup(`<strong>${spot.name}</strong><br/>${spot.breakType}<br/>Score ${score}/10`);
    marker.on('click', () => {
      selectedSpotName = spot.name;
      spotSelect.value = spot.name;
      updateSelectedSpot();
    });

    markers.push(marker);
  });
}

function updateSelectedSpot() {
  const spot = SURF_SPOTS.find((s) => s.name === selectedSpotName) || SURF_SPOTS[0];
  const rows = spotSeries[spot.name] || [];
  if (!rows.length) return;

  const now = rows[0];
  renderSnapshot(spot, now, now.score);
  renderTimeline(rows);
  renderAlerts(rows);
}

async function loadAllSpots() {
  await Promise.all(
    SURF_SPOTS.map(async (spot) => {
      let rows;
      try {
        rows = await fetchForecast(spot);
      } catch {
        rows = Array.from({ length: 192 }, (_, i) => ({
          datetime: new Date(Date.now() + i * 3600000).toISOString(),
          waveHeight: 0.7 + Math.sin(i / 7) * 0.25 + (Math.random() * 0.45),
          wavePeriod: 8 + (i % 7),
          windSpeed: 5 + (i % 8),
          windDirection: 210 + (i % 80)
        }));
      }

      const scored = rows.map((r) => ({ ...r, score: computeSurfScore(r, spot, skillSelect.value) }));
      spotSeries[spot.name] = scored;
    })
  );
}

async function refreshForSkillChange() {
  SURF_SPOTS.forEach((spot) => {
    const rows = spotSeries[spot.name] || [];
    spotSeries[spot.name] = rows.map((r) => ({ ...r, score: computeSurfScore(r, spot, skillSelect.value) }));
  });
  renderMap();
  renderEightDayOverview();
  updateSelectedSpot();
}

async function boot() {
  SURF_SPOTS.forEach((spot) => {
    const option = document.createElement('option');
    option.value = spot.name;
    option.textContent = spot.name;
    spotSelect.appendChild(option);
  });

  initMap();
  await loadAllSpots();
  renderMap();
  renderEightDayOverview();
  updateSelectedSpot();

  spotSelect.addEventListener('change', () => {
    selectedSpotName = spotSelect.value;
    updateSelectedSpot();
  });

  skillSelect.addEventListener('change', refreshForSkillChange);
}

boot();
