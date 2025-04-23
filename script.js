let chartDiv;
let map, marker, trackLine;

$('#csvFile').on('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        const text = event.target.result;
        const data = d3.csvParse(text);
        renderSummary(data);
        renderChart(data);
        initMap(data);
    };
    reader.readAsText(file);
});

function renderSummary(data) {
    const start = data[0];
    const end = data[data.length - 1];
    const parseNumber = val => parseFloat(val) || 0;

    const distance = (parseNumber(end.totaldistance) - parseNumber(start.totaldistance)) / 1000;
    const startTime = moment(`${start.date} ${start.time}`);
    const endTime = moment(`${end.date} ${end.time}`);
    const duration = moment.duration(endTime.diff(startTime));
    const durationStr = `${duration.hours()} hour ${duration.minutes()} minutes ${duration.seconds()} seconds`;

    function getStats(field, suffix = '', factor = 1) {
        const values = data
            .map(d => parseNumber(d[field]) * factor)
            .filter(n => !isNaN(n))
            .sort((a, b) => a - b);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const median = values.length % 2
            ? values[Math.floor(values.length / 2)]
            : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
        return {
            max: Math.max(...values).toFixed(1) + suffix,
            min: Math.min(...values).toFixed(1) + suffix,
            avg: avg.toFixed(1) + suffix,
            median: median.toFixed(1) + suffix
        };
    }

    const summaryHtml = `
    <div class="summary-container">
      <p>${distance.toFixed(1)} km<br>in ${durationStr}</p>
    </div>
    <div class="stats-container">
      <div class="stat-block">
        <h3>START</h3>
        <p>DATE: ${startTime.format('D MMMM YYYY HH:mm')}</p>
        <p>MILEAGE: ${(parseNumber(start.totaldistance) / 1000).toFixed(1)} km</p>
      </div>
      <div class="stat-block">
        <h3>FINISH</h3>
        <p>DATE: ${endTime.format('D MMMM YYYY HH:mm')}</p>
        <p>MILEAGE: ${(parseNumber(end.totaldistance) / 1000).toFixed(1)} km</p>
      </div>
      <div class="stat-block">
        <h3>SPEED</h3>
        <p>Max: ${getStats('speed', ' km/h').max}</p>
        <p>Avg: ${getStats('speed', ' km/h').avg}</p>
        <p>Median: ${getStats('speed', ' km/h').median}</p>
      </div>
      <div class="stat-block">
        <h3>GPS SPEED</h3>
        <p>Max: ${getStats('gps_speed', ' km/h').max}</p>
        <p>Avg: ${getStats('gps_speed', ' km/h').avg}</p>
        <p>Median: ${getStats('gps_speed', ' km/h').median}</p>
      </div>
      <div class="stat-block">
        <h3>POWER</h3>
        <p>Max: ${getStats('power', ' W').max}</p>
        <p>Avg: ${getStats('power', ' W').avg}</p>
        <p>Median: ${getStats('power', ' W').median}</p>
      </div>
      <div class="stat-block">
        <h3>CURRENT</h3>
        <p>Max: ${getStats('current', ' A').max}</p>
        <p>Avg: ${getStats('current', ' A').avg}</p>
        <p>Median: ${getStats('current', ' A').median}</p>
      </div>
      <div class="stat-block">
        <h3>VOLTAGE</h3>
        <p>Max: ${getStats('voltage', ' V').max}</p>
        <p>Min: ${getStats('voltage', ' V').min}</p>
        <p>Avg: ${getStats('voltage', ' V').avg}</p>
        <p>Median: ${getStats('voltage', ' V').median}</p>
      </div>
      <div class="stat-block">
        <h3>BATTERY</h3>
        <p>Max: ${getStats('battery_level', ' %').max}</p>
        <p>Min: ${getStats('battery_level', ' %').min}</p>
        <p>Avg: ${getStats('battery_level', ' %').avg}</p>
        <p>Median: ${getStats('battery_level', ' %').median}</p>
      </div>
      <div class="stat-block">
        <h3>TEMPERATURE</h3>
        <p>Max: ${getStats('system_temp', ' °C').max}</p>
        <p>Min: ${getStats('system_temp', ' °C').min}</p>
        <p>Avg: ${getStats('system_temp', ' °C').avg}</p>
        <p>Median: ${getStats('system_temp', ' °C').median}</p>
      </div>
    </div>
  `;

    $('#summary').html(summaryHtml);
}

function renderChart(data) {
    const timeLabels = data.map(d => `${d.date} ${d.time}`);
    const parseField = field => data.map(d => parseFloat(d[field]) || 0);

    function normalize(arr) {
        const min = Math.min(...arr);
        const max = Math.max(...arr);
        return arr.map(v => (v - min) / (max - min));
    }

    const traces = [
        {field: 'speed', name: 'Speed (km/h)'},
        {field: 'gps_speed', name: 'GPS Speed (km/h)'},
        {field: 'power', name: 'Power (W)'},
        {field: 'current', name: 'Current (A)'},
        {field: 'voltage', name: 'Voltage (V)'},
        {field: 'battery_level', name: 'Battery (%)'},
        {field: 'system_temp', name: 'Temperature (°C)'}
    ].map(trace => {
        const raw = parseField(trace.field);
        return {
            x: timeLabels,
            y: normalize(raw),
            text: raw.map(v => `${v.toFixed(1)} ${trace.name.split(' ')[1]}`),
            hovertemplate: `${trace.name}: %{text}<extra></extra>`,
            type: 'scattergl',
            mode: 'lines',
            name: trace.name
        };
    });

    // Удаляем старый listener перед новой отрисовкой (чтобы не дублировать)
    if (chartDiv && chartDiv.removeAllListeners) {
        chartDiv.removeAllListeners('plotly_hover');
    }

    chartDiv = document.getElementById('chart');
    Plotly.newPlot(
        chartDiv,
        traces,
        {
            margin: {t: 30},
            xaxis: {title: 'Time', automargin: true},
            yaxis: {title: 'Normalized', automargin: true},
            legend: {orientation: 'h'},
            hovermode: 'x unified'
        },
        {responsive: true}
    );

    // Вешаем hover-событие для обновления маркера на карте
    chartDiv.on('plotly_hover', function (event) {
        const idx = event.points[0].pointIndex;
        updateMapMarker(data[idx].latitude, data[idx].longitude);
    });
}

function initMap(data) {
    if (!map) {
        map = L.map('map');
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        marker = L.marker([0, 0]).addTo(map);
        trackLine = L.polyline([], {color: 'blue'}).addTo(map);

        $('#toggleMap').on('change', function () {
            if (this.checked) {
                $('#main-container').addClass('split');
                $('#map').show();
                setTimeout(() => {
                    map.invalidateSize();
                    map.fitBounds(trackLine.getBounds());
                    Plotly.Plots.resize(chartDiv);
                }, 200);
            } else {
                $('#main-container').removeClass('split');
                $('#map').hide();
                setTimeout(() => {
                    Plotly.Plots.resize(chartDiv);
                }, 200);
            }
        });
    }

    const coords = data.map(d => [+d.latitude, +d.longitude]);
    trackLine.setLatLngs(coords);
    map.fitBounds(trackLine.getBounds());

    // Начальный маркер в точке старта
    marker.setLatLng(coords[0]);
    map.panTo(coords[0]);
}

function updateMapMarker(lat, lon) {
    if (!$('#toggleMap')[0].checked) return;
    marker.setLatLng([+lat, +lon]);
    map.panTo([+lat, +lon]);
}
