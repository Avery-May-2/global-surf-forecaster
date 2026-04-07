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
const RANKINGS_REFRESH_MS = 15 * 60 * 1000;
const RANKINGS_DEBUG = new URLSearchParams(window.location.search).get('debugRankings') === '1';
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

let activeSpotId = surfSpots[0].id;
let dailyChart;
let hourlyChart;
let latestForecast = [];

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

const countryCodeByName = {
  australia: 'AU',
  brazil: 'BR',
  france: 'FR',
  japan: 'JP',
  indonesia: 'ID',
  portugal: 'PT',
  usa: 'US',
  'united states': 'US',
  hawaii: 'US',
  tahiti: 'PF',
  'french polynesia': 'PF',
  peru: 'PE',
  spain: 'ES',
  italy: 'IT',
  morocco: 'MA',
  germany: 'DE',
  argentina: 'AR',
  chile: 'CL',
  ecuador: 'EC',
  newzealand: 'NZ',
  'new zealand': 'NZ',
  'south africa': 'ZA',
  'costa rica': 'CR',
  canada: 'CA',
  ireland: 'IE',
  england: 'GB'
};

function countryToIso2(country = '') {
  const normalized = country.toLowerCase().replace(/\s+/g, ' ').trim();
  return countryCodeByName[normalized] || countryCodeByName[normalized.replace(/\s/g, '')] || '';
}

function iso2ToFlag(iso2 = '') {
  if (!/^[A-Z]{2}$/.test(iso2)) return '🏳️';
  return String.fromCodePoint(...[...iso2].map((c) => 127397 + c.charCodeAt(0)));
}

function movementMeta(raw) {
  const clean = String(raw ?? '-').trim();
  if (clean === '-' || clean === '0' || clean === '–') return { cls: 'flat', icon: '•', label: 'No change' };
  const n = Number(clean.replace(/[+−-]/g, ''));
  if (clean.startsWith('-') || clean.startsWith('−')) return { cls: 'down', icon: '▼', label: `Down ${n || 1}` };
  if (clean.startsWith('+')) return { cls: 'up', icon: '▲', label: `Up ${n || 1}` };
  return { cls: 'up', icon: '▲', label: `Up ${n || 1}` };
}

function parseCountryFromName(nameAndCountry = '') {
  const trimmed = nameAndCountry.trim();
  const match = trimmed.match(/^(.+?)([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)$/);
  if (!match) return { surfer: trimmed, country: '' };
  return { surfer: match[1].trim(), country: match[2].trim() };
}

function parseRankingsFromMarkdown(text) {
  const rows = [];
  const lines = text.split('\n').filter((line) => line.includes('|'));

  function toNumericString(value = '') {
    const cleaned = String(value).replace(/,/g, '').replace(/[^\d.-]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? String(Math.round(n)) : '0';
  }

  for (const line of lines) {
    if (!/^\d+\s*\|/.test(line.trim())) continue;
    const cols = line.split('|').map((c) => c.trim()).filter(Boolean);
    if (cols.length < 4) continue;

    const rank = cols[0];
    const movement = cols[1] || '-';
    const points = toNumericString(cols[cols.length - 1]);
    const nameCols = cols.slice(2, -1);
    const nameAndCountry = nameCols.join(' ').replace(/\s+/g, ' ').trim();
    const { surfer, country } = parseCountryFromName(nameAndCountry);

    rows.push({
      rank,
      movement,
      surfer,
      country,
      countryCode: countryToIso2(country),
      points,
      photo: ''
    });

    if (rows.length >= 20) break;
  }

  return rows;
}

function parseRankingsFromJsonText(text) {
  const byAthlete = new Map();

  function toNumber(value) {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return Number.NaN;
    const normalized = value.replace(/,/g, '').replace(/[^\d.+-]/g, '');
    return Number(normalized);
  }

  function tryAddRankRow(candidate = {}) {
    const rankValue = toNumber(candidate.rank ?? candidate.liveRank ?? candidate.position ?? candidate.currentRank ?? NaN);
    const pointsValue = toNumber(candidate.points ?? candidate.totalPoints ?? candidate.livePoints ?? candidate.currentPoints ?? NaN);
    const surfer = String(
      candidate.fullName
      || candidate.name
      || candidate.displayName
      || candidate.surferName
      || [candidate.firstName, candidate.lastName].filter(Boolean).join(' ')
      || [candidate.givenName, candidate.familyName].filter(Boolean).join(' ')
      || ''
    ).trim();

    if (!Number.isFinite(rankValue) || rankValue <= 0 || !Number.isFinite(pointsValue) || !surfer) return;
    if (byAthlete.has(surfer)) return;

    const country = candidate.country || candidate.nation || candidate.nationality || '';
    const countryCode = (candidate.countryCode || candidate.iso2 || '').toUpperCase() || countryToIso2(country);
    const movement = String(candidate.rankChange ?? candidate.liveMovement ?? candidate.movement ?? candidate.change ?? '-');
    const photo = candidate.imageUrl || candidate.headshot || candidate.photoUrl || candidate.avatarUrl || '';

    byAthlete.set(surfer, {
      rank: String(rankValue),
      surfer,
      points: String(Math.round(pointsValue)),
      movement,
      country,
      countryCode,
      photo
    });
  }

  function walk(value) {
    if (byAthlete.size >= 40 || value == null) return;

    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    if (typeof value !== 'object') return;

    tryAddRankRow(value);
    Object.values(value).forEach(walk);
  }

  const nextDataMatch = text.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch) {
    try {
      walk(JSON.parse(nextDataMatch[1]));
    } catch (error) {
      // Fall through to plain-text parsing.
    }
  }

  if (!byAthlete.size) {
    const looseRegex = /\{[^{}]*"rank"\s*:\s*(\d+)[^{}]*"(?:fullName|name)"\s*:\s*"([^"]+)"[^{}]*"points"\s*:\s*([\d.]+)[^{}]*\}/g;
    let match;
    while ((match = looseRegex.exec(text)) && byAthlete.size < 40) {
      tryAddRankRow({ rank: match[1], fullName: match[2], points: match[3] });
    }
  }

  return Array.from(byAthlete.values()).sort((a, b) => Number(a.rank) - Number(b.rank)).slice(0, 20);
}

function fallbackPhoto(name = '') {
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() || 'WSL';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=0f172a&color=e2e8f0&size=64`;
}

async function fetchWslRankings(tour) {
  const currentYear = new Date().getUTCFullYear();
  const years = [currentYear, currentYear - 1];
  const sources = years.flatMap((year) => {
    const pageUrl = `https://www.worldsurfleague.com/athletes/tour/${tour}?year=${year}`;
    return [
      pageUrl,
      `https://origin.worldsurfleague.com/athletes/tour/${tour}?year=${year}`,
      `https://r.jina.ai/http://${pageUrl.replace('https://', '')}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(pageUrl)}`
    ];
  });

  let lastError = new Error('Unknown rankings fetch failure');
  const attempts = [];

  for (const url of sources) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        attempts.push({ url, ok: false, status: response.status, parsedRows: 0 });
        continue;
      }
      const text = await response.text();
      const parsedJson = parseRankingsFromJsonText(text);
      const parsed = parsedJson.length ? parsedJson : parseRankingsFromMarkdown(text);
      if (!parsed.length) {
        attempts.push({ url, ok: true, status: response.status, parsedRows: 0 });
        continue;
      }
      const rows = parsed.map((row) => ({ ...row, photo: row.photo || fallbackPhoto(row.surfer) }));
      attempts.push({ url, ok: true, status: response.status, parsedRows: rows.length });
      return { rows, attempts };
    } catch (error) {
      lastError = error;
      attempts.push({ url, ok: false, status: 'error', parsedRows: 0, message: String(error?.message || error) });
    }
  }

  lastError.attempts = attempts;
  throw lastError;
}

function renderRankingTable(el, rows, attempts = []) {
  if (!rows.length) {
    const debugBlock = RANKINGS_DEBUG && attempts.length
      ? `<pre class="muted" style="white-space:pre-wrap;margin-top:0.6rem;">${attempts.map((a) => `${a.status} • ${a.parsedRows} rows • ${a.url}`).join('\n')}</pre>`
      : '';
    el.innerHTML = `<p class="muted">Unable to load rankings right now.</p>${debugBlock}`;
    return;
  }

  const html = `
    <table class="ranking-table">
      <thead><tr><th>Rank</th><th>Surfer</th><th>Live</th><th>Points</th></tr></thead>
      <tbody>
        ${rows.map((row) => {
          const movement = movementMeta(row.movement);
          const iso2 = row.countryCode || countryToIso2(row.country);
          const flag = iso2ToFlag((iso2 || '').toUpperCase());
          const countryLabel = row.country || iso2 || 'Unknown country';
          return `<tr>
            <td>${row.rank}</td>
            <td>
              <div class="surfer-cell">
                <img class="surfer-photo" src="${row.photo}" alt="${row.surfer} profile photo" loading="lazy" referrerpolicy="no-referrer" />
                <div>
                  <strong>${row.surfer}</strong>
                  <span class="surfer-country" title="${countryLabel}">${flag} ${countryLabel}</span>
                </div>
              </div>
            </td>
            <td><span class="movement ${movement.cls}" title="${movement.label}">${movement.icon} ${row.movement}</span></td>
            <td>${row.points}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
  el.innerHTML = html;
}

async function loadRankings() {
  mctRankings.innerHTML = '<p class="muted">Loading rankings…</p>';
  wctRankings.innerHTML = '<p class="muted">Loading rankings…</p>';

  const [menResult, womenResult] = await Promise.allSettled([fetchWslRankings('mct'), fetchWslRankings('wct')]);

  const menRows = menResult.status === 'fulfilled' ? menResult.value.rows : [];
  const womenRows = womenResult.status === 'fulfilled' ? womenResult.value.rows : [];
  const menAttempts = menResult.status === 'fulfilled' ? menResult.value.attempts : (menResult.reason?.attempts || []);
  const womenAttempts = womenResult.status === 'fulfilled' ? womenResult.value.attempts : (womenResult.reason?.attempts || []);

  renderRankingTable(mctRankings, menRows, menAttempts);
  renderRankingTable(wctRankings, womenRows, womenAttempts);
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
loadRankings();
setInterval(loadRankings, RANKINGS_REFRESH_MS);
