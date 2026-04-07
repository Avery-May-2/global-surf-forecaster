const SURF_SPOTS = [
  {
    name: 'Long Beach, NJ',
    lat: 39.588,
    lng: -74.218,
    buoy: '44009',
    tideStation: '8531680',
    breakType: 'Beach Break',
    icon: '🌊',
    orientationDeg: 120,
    exposure: 'south'
  },
  {
    name: 'Belmar, NJ',
    lat: 40.18,
    lng: -74.016,
    buoy: '44009',
    tideStation: '8531680',
    breakType: 'Beach Break',
    icon: '🌊',
    orientationDeg: 110,
    exposure: 'south-east'
  },
  {
    name: 'Manasquan Inlet, NJ',
    lat: 40.107,
    lng: -74.037,
    buoy: '44009',
    tideStation: '8531680',
    breakType: 'Jetty/Reef',
    icon: '🔺',
    orientationDeg: 100,
    exposure: 'east'
  }
];

const CACHE_MINUTES = 60;
const spotSelect = document.getElementById('spotSelect');
const skillSelect = document.getElementById('skillSelect');
const snapshotPanel = document.getElementById('snapshotPanel');
const weeklyHeatmap = document.getElementById('weeklyHeatmap');
const alertsList = document.getElementById('alertsList');
const riskSlider = document.getElementById('riskSlider');

let charts = {};
let map;
let markers = [];
let latestMerged = [];

function metersToFeet(m) { return (m * 3.28084).toFixed(1); }
function toCompass(deg = 0) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}
function scoreBand(score10) {
  if (score10 >= 8) return { label: 'Good', css: 'score-good', color: '#22c55e' };
  if (score10 >= 5) return { label: 'Fair', css: 'score-fair', color: '#eab308' };
  return { label: 'Poor', css: 'score-poor', color: '#ef4444' };
}
function signedAngle(a, b) {
  const d = ((a - b + 540) % 360) - 180;
  return Math.abs(d);
}

function computeSurfScore(row, spot, skill = 'Intermediate', riskBias = 50) {
  const wave = row.waveHeight ?? 0.8;
  const swellPeriod = row.swellPeriod ?? row.wavePeriod ?? 8;
  const windSpeed = row.windSpeed ?? 6;
  const windDir = row.windDirection ?? 0;
  const swellDir = row.swellDirection ?? 0;
  const tideFt = row.tideFt ?? 2;

  const skillTargets = {
    Beginner: { waveIdeal: 1.2, periodIdeal: 9 },
    Intermediate: { waveIdeal: 2.2, periodIdeal: 11 },
    Advanced: { waveIdeal: 3.8, periodIdeal: 13 }
  };
  const target = skillTargets[skill] ?? skillTargets.Intermediate;

  const waveFactor = Math.max(0, 1 - Math.abs(wave - target.waveIdeal) / (target.waveIdeal + 0.2));
  const periodFactor = Math.min(Math.max((swellPeriod - 6) / (target.periodIdeal - 6), 0), 1);
  const offshoreAngle = signedAngle((windDir + 180) % 360, spot.orientationDeg);
  const windDirFactor = 1 - offshoreAngle / 180;
  const windSpeedFactor = Math.max(0, 1 - windSpeed / 18);
  const tideFactor = 1 - Math.min(Math.abs(tideFt - 2.8) / 2.8, 1);
  const exposurePenalty = spot.exposure.includes('south') && [315, 0, 45].some((d) => Math.abs(d - swellDir) < 25) ? 0.15 : 0;

  const base = (
    waveFactor * 0.25 +
    periodFactor * 0.25 +
    windDirFactor * 0.2 +
    windSpeedFactor * 0.1 +
    tideFactor * 0.2
  ) * 10;

  const personalization = ((riskBias - 50) / 50) * (skill === 'Advanced' ? 0.8 : -0.8);
  const score = Math.max(1, Math.min(10, base - exposurePenalty * 10 + personalization));

  return {
    score: Number(score.toFixed(1)),
    contributions: {
      wave: Number((waveFactor * 10).toFixed(1)),
      period: Number((periodFactor * 10).toFixed(1)),
      wind: Number((((windDirFactor + windSpeedFactor) / 2) * 10).toFixed(1)),
      tide: Number((tideFactor * 10).toFixed(1))
    }
  };
}

async function fetchCached(key, loader) {
  const cacheKey = `surf-cache-${key}`;
  const item = localStorage.getItem(cacheKey);
  if (item) {
    const parsed = JSON.parse(item);
    if (Date.now() - parsed.ts < CACHE_MINUTES * 60000) return parsed.data;
  }
  const data = await loader();
  localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data }));
  return data;
}

async function getNoaaBuoyData(buoyId) {
  return fetchCached(`buoy-${buoyId}`, async () => {
    const response = await fetch(`https://www.ndbc.noaa.gov/data/realtime2/${buoyId}.txt`);
    const text = await response.text();
    const lines = text.split('\n').slice(2, 50).filter(Boolean);
    return lines.map((line) => {
      const p = line.trim().split(/\s+/);
      const dt = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], +p[3], +p[4]));
      return {
        datetime: dt.toISOString(),
        waveHeight: p[8] === 'MM' ? null : Number(p[8]),
        wavePeriod: p[9] === 'MM' ? null : Number(p[9]),
        windSpeed: p[6] === 'MM' ? null : Number(p[6]),
        windDirection: p[5] === 'MM' ? null : Number(p[5])
      };
    });
  });
}

async function getNoaaTideData(station) {
  return fetchCached(`tide-${station}`, async () => {
    const begin = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    const end = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10).replaceAll('-', '');
    const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=SurfForecastApp&begin_date=${begin}&end_date=${end}&datum=MLLW&station=${station}&time_zone=gmt&units=english&interval=h&format=json`;
    const res = await fetch(url);
    const json = await res.json();
    return (json.predictions || []).map((r) => ({ datetime: new Date(r.t + 'Z').toISOString(), tideFt: Number(r.v) }));
  });
}

async function getForecastFallback(lat, lng) {
  return fetchCached(`forecast-${lat}-${lng}`, async () => {
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&hourly=wave_height,wave_period&start_date=${today}&end_date=${end}&timezone=UTC`;
    const res = await fetch(url);
    const data = await res.json();
    return data.hourly.time.map((t, idx) => ({
      datetime: new Date(t + 'Z').toISOString(),
      waveHeight: data.hourly.wave_height[idx],
      wavePeriod: data.hourly.wave_period[idx],
      swellPeriod: data.hourly.wave_period[idx],
      swellDirection: 130,
      windSpeed: 5 + (idx % 7),
      windDirection: 260 - (idx % 50)
    }));
  });
}

function mergeByNearest(forecast, tide) {
  return forecast.map((f) => {
    const ft = new Date(f.datetime).getTime();
    let nearest = tide[0];
    let best = Infinity;
    for (const t of tide) {
      const dist = Math.abs(new Date(t.datetime).getTime() - ft);
      if (dist < best) { best = dist; nearest = t; }
    }
    return { ...f, tideFt: nearest?.tideFt ?? 2.5 };
  });
}

function renderSnapshot(spot, nowRow, scoreObj) {
  const band = scoreBand(scoreObj.score);
  snapshotPanel.innerHTML = `
    <div class="snapshot-grid">
      <div class="metric-card ${band.css}"><div class="k">Surf Score (1-10)</div><div class="v">${scoreObj.score} · ${band.label}</div></div>
      <div class="metric-card"><div class="k">Wave Height</div><div class="v">${metersToFeet(nowRow.waveHeight || 0.8)} ft</div></div>
      <div class="metric-card"><div class="k">Swell</div><div class="v">${(nowRow.swellPeriod || nowRow.wavePeriod || 8).toFixed(1)}s @ ${toCompass(nowRow.swellDirection || 130)}</div></div>
      <div class="metric-card"><div class="k">Wind Vector</div><div class="v">${(nowRow.windSpeed || 0).toFixed(1)} m/s ${toCompass(nowRow.windDirection || 0)}</div></div>
      <div class="metric-card"><div class="k">Tide State</div><div class="v">${(nowRow.tideFt || 0).toFixed(1)} ft (mid-tide target 2.8)</div></div>
      <div class="metric-card"><div class="k">Spot Metadata</div><div class="v">${spot.breakType} · ${spot.exposure}</div></div>
    </div>`;
}

function renderWeeklyHeatmap(rows) {
  weeklyHeatmap.innerHTML = '';
  const days = [];
  for (let i = 0; i < 7; i++) {
    const dayRows = rows.filter((r) => new Date(r.datetime).getUTCDate() === new Date(Date.now() + i * 86400000).getUTCDate());
    if (!dayRows.length) continue;
    const avg = dayRows.reduce((s, r) => s + r.score, 0) / dayRows.length;
    days.push({
      label: new Date(dayRows[0].datetime).toLocaleDateString(undefined, { weekday: 'short' }),
      score: Number(avg.toFixed(1)),
      tideRange: `${Math.min(...dayRows.map((d) => d.tideFt)).toFixed(1)}-${Math.max(...dayRows.map((d) => d.tideFt)).toFixed(1)}ft`
    });
  }
  days.forEach((d) => {
    const band = scoreBand(d.score);
    const el = document.createElement('div');
    el.className = 'heat-cell';
    el.style.background = band.color + '40';
    el.title = `${d.label}: ${d.score}/10`;
    el.innerHTML = `<strong>${d.label}</strong><br/>Score ${d.score}<br/><small>${d.tideRange}</small>`;
    weeklyHeatmap.appendChild(el);
  });
}

function renderMetricBreakdown(contrib, row) {
  document.getElementById('metricBreakdown').innerHTML = `
    <ul>
      <li>Wave contribution: <strong>${contrib.wave}/10</strong></li>
      <li>Swell-period contribution: <strong>${contrib.period}/10</strong></li>
      <li>Wind contribution: <strong>${contrib.wind}/10</strong> (${toCompass(row.windDirection)} vector alignment)</li>
      <li>Tide contribution: <strong>${contrib.tide}/10</strong></li>
    </ul>
    <p>Interpretation: wind is currently ${contrib.wind < 4 ? 'hurting' : 'helping'} the score.</p>`;
}

function renderAlerts(rows) {
  const alerts = [];
  const nextGood = rows.find((r) => r.score >= 8);
  if (nextGood) alerts.push(`Optimal Window: Surf Score ${nextGood.score}+ predicted around ${new Date(nextGood.datetime).toLocaleString()}.`);
  const shift = rows.find((r, i) => i > 0 && Math.abs((r.windDirection ?? 0) - (rows[i - 1].windDirection ?? 0)) > 40);
  if (shift) alerts.push(`Critical Shift: Significant wind direction shift expected at ${new Date(shift.datetime).toLocaleTimeString()}.`);
  const swellArrive = rows.find((r) => (r.waveHeight ?? 0) >= 1.8 && (r.swellPeriod ?? 0) >= 11);
  if (swellArrive) alerts.push(`Swell Arrival: Threshold reached (${metersToFeet(swellArrive.waveHeight)}ft @ ${(swellArrive.swellPeriod).toFixed(1)}s).`);
  alertsList.innerHTML = alerts.map((a) => `<div class="alert-item">${a}</div>`).join('') || '<p>No alerts at this time.</p>';
}

function renderCharts(rows, contrib) {
  const labels = rows.slice(0, 24).map((r) => new Date(r.datetime).getUTCHours().toString().padStart(2, '0') + ':00');
  const hourlyScores = rows.slice(0, 24).map((r) => r.score);
  const heightsFt = rows.slice(0, 24).map((r) => Number(metersToFeet(r.waveHeight || 0.8)));

  charts.hourly?.destroy();
  charts.hourly = new Chart(document.getElementById('hourlyChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { type: 'line', label: 'Wave Height (ft)', data: heightsFt, borderColor: '#38bdf8', yAxisID: 'y' },
        { type: 'bar', label: 'Surf Score', data: hourlyScores, backgroundColor: hourlyScores.map((s) => scoreBand(s).color + 'aa'), yAxisID: 'y1' }
      ]
    },
    options: { scales: { y: { beginAtZero: true }, y1: { beginAtZero: true, max: 10, position: 'right' } } }
  });

  charts.radar?.destroy();
  charts.radar = new Chart(document.getElementById('radarChart'), {
    type: 'radar',
    data: {
      labels: ['Wave', 'Swell', 'Wind', 'Tide'],
      datasets: [{ label: 'Component Strength', data: [contrib.wave, contrib.period, contrib.wind, contrib.tide], backgroundColor: '#22d3ee40', borderColor: '#22d3ee' }]
    },
    options: { scales: { r: { min: 0, max: 10 } } }
  });

  charts.scatter?.destroy();
  charts.scatter = new Chart(document.getElementById('scatterChart'), {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Period vs Score',
        data: rows.slice(0, 72).map((r) => ({ x: r.swellPeriod || r.wavePeriod || 8, y: r.score })),
        backgroundColor: '#60a5fa'
      }]
    },
    options: { scales: { x: { title: { text: 'Swell Period (s)', display: true } }, y: { title: { text: 'Surf Score', display: true }, min: 0, max: 10 } } }
  });
}

function initMap() {
  map = L.map('surfMap').setView([39.95, -74.1], 8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
}

function refreshMap(selectedName) {
  markers.forEach((m) => m.remove());
  markers = [];
  SURF_SPOTS.forEach((spot) => {
    const rows = latestMerged[spot.name] || [];
    const top = rows[0]?.score ?? 5;
    const band = scoreBand(top);
    const marker = L.circleMarker([spot.lat, spot.lng], { radius: 9, color: band.color, fillOpacity: 0.9 }).addTo(map);
    marker.bindPopup(`<strong>${spot.icon} ${spot.name}</strong><br/>${spot.breakType}<br/>Score: ${top}/10`);
    if (spot.name === selectedName) marker.openPopup();
    markers.push(marker);
  });
}

async function loadSpotData(spot) {
  let forecast;
  try {
    forecast = await getForecastFallback(spot.lat, spot.lng);
  } catch {
    forecast = Array.from({ length: 168 }, (_, i) => ({
      datetime: new Date(Date.now() + i * 3600000).toISOString(),
      waveHeight: 0.8 + Math.sin(i / 5) * 0.4 + 0.5,
      wavePeriod: 8 + (i % 6),
      swellPeriod: 9 + (i % 5),
      swellDirection: 130,
      windSpeed: 4 + (i % 8),
      windDirection: 250 - (i % 60)
    }));
  }
  let tide = await getNoaaTideData(spot.tideStation).catch(() => []);
  if (!tide.length) tide = forecast.map((f, i) => ({ datetime: f.datetime, tideFt: 2.5 + Math.sin(i / 3) }));

  const merged = mergeByNearest(forecast, tide);
  latestMerged[spot.name] = merged;
}

async function refreshDashboard() {
  const spot = SURF_SPOTS.find((s) => s.name === spotSelect.value) || SURF_SPOTS[0];
  const skill = skillSelect.value;
  const riskBias = Number(riskSlider.value);

  if (!latestMerged[spot.name]) await loadSpotData(spot);
  const rows = latestMerged[spot.name].map((r) => {
    const scoreObj = computeSurfScore(r, spot, skill, riskBias);
    return { ...r, score: scoreObj.score, contributions: scoreObj.contributions };
  });

  const nowRow = rows[0];
  renderSnapshot(spot, nowRow, { score: nowRow.score });
  renderWeeklyHeatmap(rows);
  renderMetricBreakdown(nowRow.contributions, nowRow);
  renderAlerts(rows);
  renderCharts(rows, nowRow.contributions);
  refreshMap(spot.name);
}

async function boot() {
  SURF_SPOTS.forEach((s) => {
    const opt = document.createElement('option');
    opt.textContent = s.name;
    spotSelect.appendChild(opt);
  });
  spotSelect.value = SURF_SPOTS[0].name;

  initMap();
  await Promise.all(SURF_SPOTS.map((s) => loadSpotData(s)));
  await refreshDashboard();

  spotSelect.addEventListener('change', refreshDashboard);
  skillSelect.addEventListener('change', refreshDashboard);
  riskSlider.addEventListener('input', refreshDashboard);
}

boot();
