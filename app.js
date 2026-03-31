const surfSpots = [
  {
    id: 'pipeline',
    name: 'Pipeline, Hawaii',
    lat: 21.664,
    lng: -158.051,
    baseWaveHeight: 2.2,
    basePeriod: 13,
    wind: 'ENE 12 kn'
  },
  {
    id: 'teahupoo',
    name: 'Teahupoʻo, Tahiti',
    lat: -17.833,
    lng: -149.267,
    baseWaveHeight: 2.8,
    basePeriod: 15,
    wind: 'SE 9 kn'
  },
  {
    id: 'nazare',
    name: 'Nazaré, Portugal',
    lat: 39.602,
    lng: -9.07,
    baseWaveHeight: 3.4,
    basePeriod: 16,
    wind: 'NW 18 kn'
  },
  {
    id: 'jbay',
    name: 'Jeffreys Bay, South Africa',
    lat: -34.05,
    lng: 24.93,
    baseWaveHeight: 2.1,
    basePeriod: 12,
    wind: 'W 14 kn'
  },
  {
    id: 'mavericks',
    name: 'Mavericks, California',
    lat: 37.496,
    lng: -122.496,
    baseWaveHeight: 3,
    basePeriod: 15,
    wind: 'N 20 kn'
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

let activeSpotId = surfSpots[0].id;
let chart;

function forecastForSpot(spot, days, skill) {
  const skillAdjustments = {
    beginner: 0.7,
    intermediate: 1,
    advanced: 1.3
  };

  return Array.from({ length: days }, (_, index) => {
    const dailyCycle = Math.sin((index + 1) * 0.9) * 0.5;
    const windBump = index % 2 === 0 ? 0.2 : -0.15;
    const adjustedHeight =
      (spot.baseWaveHeight + dailyCycle + windBump) * skillAdjustments[skill];

    return {
      dayLabel: `Day ${index + 1}`,
      height: Number(Math.max(0.5, adjustedHeight).toFixed(2)),
      period: spot.basePeriod + ((index % 3) - 1)
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

function refreshDashboard() {
  const spot = surfSpots.find((s) => s.id === activeSpotId);
  const days = Number(windowRange.value);
  const skill = skillLevel.value;

  windowValue.textContent = String(days);
  const forecast = forecastForSpot(spot, days, skill);

  updateSummary(spot, forecast, skill);
  renderChart(forecast, spot.name);
}

const markers = new Map();

surfSpots.forEach((spot) => {
  const option = document.createElement('option');
  option.value = spot.id;
  option.textContent = spot.name;
  selectSpot.appendChild(option);

  const marker = L.marker([spot.lat, spot.lng])
    .addTo(map)
    .bindPopup(`<strong>${spot.name}</strong><br/>Click to load forecast`);

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
