const surfSpots = [
  {
    id: 'pipeline',
    name: 'Pipeline, Hawaiʻi, USA',
    lat: 21.664,
    lng: -158.051,
    baseWaveHeight: 2.2,
    basePeriod: 13,
    wind: 'ENE 12 kn',
    eventWindowStart: '2026-01-27',
    eventWindowEnd: '2026-02-08'
  },
  {
    id: 'sunset',
    name: 'Sunset Beach, Hawaiʻi, USA',
    lat: 21.679,
    lng: -158.043,
    baseWaveHeight: 2.0,
    basePeriod: 12,
    wind: 'NE 10 kn',
    eventWindowStart: '2026-02-10',
    eventWindowEnd: '2026-02-20'
  },
  {
    id: 'peniche',
    name: 'Supertubos, Peniche, Portugal',
    lat: 39.355,
    lng: -9.381,
    baseWaveHeight: 1.9,
    basePeriod: 11,
    wind: 'N 15 kn',
    eventWindowStart: '2026-03-15',
    eventWindowEnd: '2026-03-25'
  },
  {
    id: 'elsalvador',
    name: 'Punta Roca, El Salvador',
    lat: 13.489,
    lng: -89.392,
    baseWaveHeight: 1.8,
    basePeriod: 14,
    wind: 'SSE 8 kn',
    eventWindowStart: '2026-04-02',
    eventWindowEnd: '2026-04-12'
  },
  {
    id: 'bells',
    name: 'Bells Beach, Australia',
    lat: -38.368,
    lng: 144.283,
    baseWaveHeight: 2.4,
    basePeriod: 13,
    wind: 'SW 16 kn',
    eventWindowStart: '2026-04-18',
    eventWindowEnd: '2026-04-28'
  },
  {
    id: 'margaretriver',
    name: 'Margaret River, Australia',
    lat: -33.953,
    lng: 114.991,
    baseWaveHeight: 2.7,
    basePeriod: 14,
    wind: 'S 18 kn',
    eventWindowStart: '2026-05-04',
    eventWindowEnd: '2026-05-14'
  },
  {
    id: 'goldcoast',
    name: 'Snapper Rocks, Gold Coast, Australia',
    lat: -28.164,
    lng: 153.547,
    baseWaveHeight: 1.6,
    basePeriod: 10,
    wind: 'SE 11 kn',
    eventWindowStart: '2026-05-20',
    eventWindowEnd: '2026-05-30'
  },
  {
    id: 'saquarema',
    name: 'Saquarema, Brazil',
    lat: -22.934,
    lng: -42.502,
    baseWaveHeight: 2.3,
    basePeriod: 12,
    wind: 'E 14 kn',
    eventWindowStart: '2026-06-12',
    eventWindowEnd: '2026-06-22'
  },
  {
    id: 'jbay',
    name: 'Jeffreys Bay, South Africa',
    lat: -34.05,
    lng: 24.93,
    baseWaveHeight: 2.1,
    basePeriod: 12,
    wind: 'W 14 kn',
    eventWindowStart: '2026-07-08',
    eventWindowEnd: '2026-07-17'
  },
  {
    id: 'teahupoo',
    name: 'Teahupoʻo, Tahiti, French Polynesia',
    lat: -17.833,
    lng: -149.267,
    baseWaveHeight: 2.8,
    basePeriod: 15,
    wind: 'SE 9 kn',
    eventWindowStart: '2026-08-09',
    eventWindowEnd: '2026-08-18'
  },
  {
    id: 'fiji',
    name: 'Cloudbreak, Fiji',
    lat: -17.873,
    lng: 177.188,
    baseWaveHeight: 3.0,
    basePeriod: 16,
    wind: 'ESE 13 kn',
    eventWindowStart: '2026-09-01',
    eventWindowEnd: '2026-09-10'
  },
  {
    id: 'trestles',
    name: 'Lower Trestles, California, USA (Finals)',
    lat: 33.384,
    lng: -117.593,
    baseWaveHeight: 1.7,
    basePeriod: 11,
    wind: 'W 9 kn',
    eventWindowStart: '2026-09-18',
    eventWindowEnd: '2026-09-18'
  }
];

const map = L.map('map').setView([12, -20], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const selectSpot = document.getElementById('spot-select');
const windowRange = document.getElementById('window-range');
const windowValue = document.getElementById('window-value');
const skillLevel = document.getElementById('skill-level');
const summaryCard = document.getElementById('conditions-summary');
const byDayContainer = document.getElementById('by-day-forecast');

let activeSpotId = surfSpots[0].id;
let chart;

function getEventWindowDays(spot) {
  const start = new Date(`${spot.eventWindowStart}T00:00:00Z`);
  const end = new Date(`${spot.eventWindowEnd}T00:00:00Z`);
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
  return Math.max(1, diff + 1);
}

function formatDateLabel(dateStr) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
}

function forecastForSpot(spot, days, skill) {
  const skillAdjustments = {
    beginner: 0.7,
    intermediate: 1,
    advanced: 1.3
  };

  const dayParts = [
    { key: 'early', label: 'Early AM', factor: 0.95 },
    { key: 'midday', label: 'Midday', factor: 0.85 },
    { key: 'afternoon', label: 'Afternoon', factor: 1.05 },
    { key: 'evening', label: 'Evening', factor: 0.92 }
  ];

  const start = new Date(`${spot.eventWindowStart}T00:00:00Z`);

  return Array.from({ length: days }, (_, index) => {
    const forecastDate = new Date(start.getTime() + index * 86400000);
    const forecastDateIso = forecastDate.toISOString().slice(0, 10);
    const dailyCycle = Math.sin((index + 1) * 0.9) * 0.5;
    const windBump = index % 2 === 0 ? 0.2 : -0.15;
    const adjustedHeight =
      (spot.baseWaveHeight + dailyCycle + windBump) * skillAdjustments[skill];
    const dailyHeight = Number(Math.max(0.5, adjustedHeight).toFixed(2));

    const sessions = dayParts.map((part) => ({
      label: part.label,
      height: Number((dailyHeight * part.factor).toFixed(2)),
      period: Math.max(7, spot.basePeriod + ((index % 3) - 1) + (part.factor > 1 ? 1 : 0))
    }));

    return {
      dayLabel: formatDateLabel(forecastDateIso),
      date: forecastDateIso,
      height: dailyHeight,
      period: spot.basePeriod + ((index % 3) - 1),
      sessions
    };
  });
}

function spotSuitability(avgHeight, skill) {
  if (skill === 'beginner') {
    return avgHeight <= 1.6 ? 'Good for progression' : 'Challenging conditions';
  }

  if (skill === 'intermediate') {
    return avgHeight <= 2.7 ? 'Good balance of power and control' : 'Bring confidence';
  }

  return avgHeight >= 2.5 ? 'Excellent heavy-water session' : 'Playful but smaller day';
}

function updateSummary(spot, forecast, skill) {
  const averageHeight = (
    forecast.reduce((sum, item) => sum + item.height, 0) / forecast.length
  ).toFixed(2);

  const bestDay = forecast.reduce((best, current) =>
    current.height > best.height ? current : best
  );

  summaryCard.innerHTML = `
    <h3>${spot.name}</h3>
    <p><strong>Event window:</strong> ${formatDateLabel(spot.eventWindowStart)} - ${formatDateLabel(
      spot.eventWindowEnd
    )}</p>
    <p><strong>Avg wave height:</strong> ${averageHeight} m</p>
    <p><strong>Peak day:</strong> ${bestDay.dayLabel} (${bestDay.height} m)</p>
    <p><strong>Swell period:</strong> ${bestDay.period} s</p>
    <p><strong>Wind:</strong> ${spot.wind}</p>
    <p><strong>Suitability:</strong> ${spotSuitability(Number(averageHeight), skill)}</p>
  `;
}

function renderChart(forecast, spotName) {
  const labels = forecast.map((entry) => entry.dayLabel);
  const heights = forecast.map((entry) => entry.height);

  if (chart) {
    chart.destroy();
  }

  const ctx = document.getElementById('forecast-chart');

  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: `${spotName} - Wave Height (m)`,
          data: heights,
          borderColor: '#0077b6',
          backgroundColor: 'rgba(0, 180, 216, 0.24)',
          borderWidth: 3,
          fill: true,
          tension: 0.3,
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Meters'
          }
        }
      }
    }
  });
}

function renderByDay(forecast) {
  byDayContainer.innerHTML = forecast
    .map(
      (day) => `
      <article class="day-card">
        <h3>${day.dayLabel}</h3>
        <p class="day-date">${day.date}</p>
        <ul>
          ${day.sessions
            .map(
              (session) =>
                `<li><span>${session.label}</span><strong>${session.height} m</strong><em>${session.period}s</em></li>`
            )
            .join('')}
        </ul>
      </article>
    `
    )
    .join('');
}

function refreshDashboard() {
  const spot = surfSpots.find((s) => s.id === activeSpotId);
  const maxDays = getEventWindowDays(spot);
  windowRange.max = String(maxDays);

  const selectedDays = Math.min(Number(windowRange.value), maxDays);
  if (selectedDays !== Number(windowRange.value)) {
    windowRange.value = String(selectedDays);
  }

  const skill = skillLevel.value;

  windowValue.textContent = String(selectedDays);
  const forecast = forecastForSpot(spot, selectedDays, skill);

  updateSummary(spot, forecast, skill);
  renderChart(forecast, spot.name);
  renderByDay(forecast);
}

const markers = new Map();

surfSpots.forEach((spot) => {
  const option = document.createElement('option');
  option.value = spot.id;
  option.textContent = spot.name;
  selectSpot.appendChild(option);

  const marker = L.marker([spot.lat, spot.lng])
    .addTo(map)
    .bindPopup(`<strong>${spot.name}</strong><br/>Window: ${formatDateLabel(spot.eventWindowStart)} - ${formatDateLabel(
      spot.eventWindowEnd
    )}`);

  marker.on('click', () => {
    activeSpotId = spot.id;
    selectSpot.value = spot.id;
    refreshDashboard();
  });

  markers.set(spot.id, marker);
});

selectSpot.addEventListener('change', (event) => {
  activeSpotId = event.target.value;
  const spot = surfSpots.find((s) => s.id === activeSpotId);
  map.flyTo([spot.lat, spot.lng], 5, { duration: 1 });
  markers.get(spot.id).openPopup();
  refreshDashboard();
});

windowRange.addEventListener('input', refreshDashboard);
skillLevel.addEventListener('change', refreshDashboard);

selectSpot.value = activeSpotId;
refreshDashboard();
