(function () {
    const DEFAULT = { lat: 28.1235, lon: -15.4363, label: 'Las Palmas de GC' };
    const SYNODIC = 29.53058867;
    const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);

    const els = {
        sky: document.getElementById('weatherSky'),
        stars: document.getElementById('weatherStars'),
        celestial: document.getElementById('weatherCelestial'),
        sunDisc: document.getElementById('weatherSunDisc'),
        moonDisc: document.getElementById('weatherMoonDisc'),
        moonShadow: document.getElementById('weatherMoonShadow'),
        moonPhaseLabel: document.getElementById('weatherMoonPhaseLabel'),
        clock: document.getElementById('weatherClock'),
        location: document.getElementById('weatherLocation'),
        temp: document.getElementById('weatherTemp'),
        desc: document.getElementById('weatherDesc'),
        icon: document.getElementById('weatherIcon'),
        humidity: document.getElementById('weatherHumidity'),
        wind: document.getElementById('weatherWind'),
        feels: document.getElementById('weatherFeels'),
        hourly: document.getElementById('weatherHourly'),
        daily: document.getElementById('weatherDaily'),
        status: document.getElementById('weatherStatus'),
    };

    if (!els.sky) return;

    let weatherData = null;
    let locationLabel = DEFAULT.label;
    let coords = { ...DEFAULT };

    const WMO = {
        0: ['Despejado', 'fa-sun', 'fa-moon'],
        1: ['Mayormente despejado', 'fa-cloud-sun', 'fa-cloud-moon'],
        2: ['Parcialmente nublado', 'fa-cloud-sun', 'fa-cloud-moon'],
        3: ['Nublado', 'fa-cloud', 'fa-cloud'],
        45: ['Niebla', 'fa-smog', 'fa-smog'],
        48: ['Niebla helada', 'fa-smog', 'fa-smog'],
        51: ['Llovizna ligera', 'fa-cloud-rain', 'fa-cloud-rain'],
        53: ['Llovizna', 'fa-cloud-rain', 'fa-cloud-rain'],
        55: ['Llovizna intensa', 'fa-cloud-rain', 'fa-cloud-rain'],
        61: ['Lluvia ligera', 'fa-cloud-showers-heavy', 'fa-cloud-showers-heavy'],
        63: ['Lluvia', 'fa-cloud-showers-heavy', 'fa-cloud-showers-heavy'],
        65: ['Lluvia fuerte', 'fa-cloud-showers-heavy', 'fa-cloud-showers-heavy'],
        71: ['Nieve ligera', 'fa-snowflake', 'fa-snowflake'],
        73: ['Nieve', 'fa-snowflake', 'fa-snowflake'],
        75: ['Nieve intensa', 'fa-snowflake', 'fa-snowflake'],
        77: ['Granizo', 'fa-snowflake', 'fa-snowflake'],
        80: ['Chubascos ligeros', 'fa-cloud-bolt', 'fa-cloud-bolt'],
        81: ['Chubascos', 'fa-cloud-bolt', 'fa-cloud-bolt'],
        82: ['Chubascos fuertes', 'fa-cloud-bolt', 'fa-cloud-bolt'],
        95: ['Tormenta', 'fa-bolt', 'fa-bolt'],
        96: ['Tormenta con granizo', 'fa-bolt', 'fa-bolt'],
        99: ['Tormenta fuerte', 'fa-bolt', 'fa-bolt'],
    };

    function wmo(code, isDay) {
        const row = WMO[code] || ['Nublado', 'fa-cloud', 'fa-cloud'];
        const icon = isDay ? row[1] : row[2];
        return { label: row[0], icon };
    }

    function formatDay(iso) {
        return new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
    }

    function getMoonPhase(date) {
        const days = (date.getTime() - NEW_MOON) / 86400000;
        const phase = ((days % SYNODIC) + SYNODIC) % SYNODIC / SYNODIC;
        const illumination = Math.round((1 - Math.cos(phase * 2 * Math.PI)) / 2 * 100);
        return { phase, illumination };
    }

    function moonPhaseName(phase) {
        if (phase < 0.03 || phase > 0.97) return 'Luna nueva';
        if (phase < 0.22) return 'Luna creciente';
        if (phase < 0.28) return 'Cuarto creciente';
        if (phase < 0.47) return 'Gibosa creciente';
        if (phase < 0.53) return 'Luna llena';
        if (phase < 0.72) return 'Gibosa menguante';
        if (phase < 0.78) return 'Cuarto menguante';
        return 'Luna menguante';
    }

    function updateMoonVisual(date) {
        const { phase, illumination } = getMoonPhase(date);
        let shadowX;

        if (phase <= 0.5) {
            shadowX = -phase * 200;
        } else {
            shadowX = (1 - phase) * 200;
        }

        els.moonShadow.style.transform = `translateX(${shadowX}%)`;
        els.moonDisc.style.setProperty('--moon-glow', (illumination / 100).toFixed(2));
        els.moonPhaseLabel.textContent = `${moonPhaseName(phase)} · ${illumination}%`;
    }

    function skyPhase(now, sunrise, sunset) {
        const t = now.getTime();
        const sr = sunrise.getTime();
        const ss = sunset.getTime();
        const dawnStart = sr - 45 * 60000;
        const dawnEnd = sr + 45 * 60000;
        const duskStart = ss - 45 * 60000;
        const duskEnd = ss + 45 * 60000;

        if (t < dawnStart || t > duskEnd) return 'night';
        if (t < dawnEnd) return 'dawn';
        if (t > duskStart) return 'dusk';
        return 'day';
    }

    function getSunTimesForDay(daily, dayIndex) {
        return {
            sunrise: new Date(daily.sunrise[dayIndex]),
            sunset: new Date(daily.sunset[dayIndex]),
        };
    }

    function getNightWindow(now, daily) {
        const t = now.getTime();
        const today = getSunTimesForDay(daily, 0);
        const tomorrow = daily.sunrise[1]
            ? getSunTimesForDay(daily, 1)
            : { sunrise: new Date(today.sunrise.getTime() + 86400000), sunset: today.sunset };

        if (t >= today.sunset.getTime()) {
            return { sunset: today.sunset, sunrise: tomorrow.sunrise };
        }

        if (t < today.sunrise.getTime()) {
            const yesterdaySunset = new Date(today.sunset);
            yesterdaySunset.setDate(yesterdaySunset.getDate() - 1);
            return { sunset: yesterdaySunset, sunrise: today.sunrise };
        }

        return null;
    }

    function nightProgress(now, daily) {
        const window = getNightWindow(now, daily);
        if (!window) return 0;

        const span = window.sunrise.getTime() - window.sunset.getTime();
        if (span <= 0) return 0;

        return Math.min(1, Math.max(0, (now.getTime() - window.sunset.getTime()) / span));
    }

    function dayProgress(now, sunrise, sunset) {
        const t = now.getTime();
        const sr = sunrise.getTime();
        const ss = sunset.getTime();
        if (t < sr || t > ss) return null;
        return (t - sr) / (ss - sr);
    }

    function positionOnArc(progress, invert) {
        const angle = invert ? Math.PI * progress : Math.PI * (1 - progress);
        return {
            left: 50 + 38 * Math.cos(angle),
            top: 72 - 38 * Math.sin(angle),
        };
    }

    function setCelestialPosition(left, top) {
        els.celestial.style.left = left + '%';
        els.celestial.style.top = top + '%';
    }

    function updateSkyAnimation(now) {
        if (!weatherData?.daily) return;

        const daily = weatherData.daily;
        const { sunrise, sunset } = getSunTimesForDay(daily, 0);
        const phase = skyPhase(now, sunrise, sunset);
        const nightWindow = getNightWindow(now, daily);
        const isMoonPeriod = nightWindow !== null;

        els.sky.dataset.phase = phase;
        els.sky.classList.toggle('is-moon-track', isMoonPeriod);
        els.sky.classList.add('has-celestial-arc');
        els.stars.classList.toggle('is-visible', isMoonPeriod || phase === 'dawn' || phase === 'dusk');

        els.sunDisc.classList.toggle('is-active', !isMoonPeriod);
        els.moonDisc.classList.toggle('is-active', isMoonPeriod);

        els.moonPhaseLabel.hidden = !isMoonPeriod;

        let arcProgress;
        if (isMoonPeriod) {
            updateMoonVisual(now);
            arcProgress = nightProgress(now, daily);
            const pos = positionOnArc(arcProgress, false);
            setCelestialPosition(pos.left, pos.top);
        } else {
            arcProgress = dayProgress(now, sunrise, sunset);
            if (arcProgress === null) {
                arcProgress = phase === 'dusk' ? 1 : 0;
            }
            const pos = positionOnArc(arcProgress, false);
            setCelestialPosition(pos.left, pos.top);
        }
    }

    function updateClock() {
        const now = new Date();
        els.clock.textContent = now.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
        els.clock.dateTime = now.toISOString();
        updateSkyAnimation(now);
    }

    function findHourIndex(targetHour) {
        const { hourly } = weatherData;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        for (let dayOffset = 0; dayOffset <= 1; dayOffset += 1) {
            const day = new Date(today);
            day.setDate(day.getDate() + dayOffset);

            const idx = hourly.time.findIndex((time) => {
                const dt = new Date(time);
                return (
                    dt.getFullYear() === day.getFullYear()
                    && dt.getMonth() === day.getMonth()
                    && dt.getDate() === day.getDate()
                    && dt.getHours() === targetHour
                );
            });

            if (idx !== -1) return idx;
        }

        return hourly.time.findIndex((time) => new Date(time).getHours() === targetHour);
    }

    function renderHourly() {
        const { hourly } = weatherData;
        const targets = [9, 14, 18, 21];

        els.hourly.innerHTML = targets.map((targetHour) => {
            const idx = findHourIndex(targetHour);
            if (idx === -1) return '';

            const code = hourly.weather_code[idx];
            const isDay = hourly.is_day[idx];
            const { label, icon } = wmo(code, isDay);
            const temp = Math.round(hourly.temperature_2m[idx]);
            const labelTime = String(targetHour).padStart(2, '0') + ':00';

            return `
                <div class="weather-hour" title="${label}">
                    <span class="weather-hour__time">${labelTime}</span>
                    <i class="fas ${icon} weather-hour__icon" aria-hidden="true"></i>
                    <span class="weather-hour__temp">${temp}°</span>
                </div>
            `;
        }).join('');
    }

    function renderDaily() {
        const { daily } = weatherData;
        els.daily.innerHTML = daily.time.slice(0, 7).map((day, i) => {
            const code = daily.weather_code[i];
            const { label, icon } = wmo(code, true);
            const max = Math.round(daily.temperature_2m_max[i]);
            const min = Math.round(daily.temperature_2m_min[i]);
            const isToday = i === 0;
            return `
                <div class="weather-day ${isToday ? 'is-today' : ''}" title="${label}">
                    <span class="weather-day__name">${isToday ? 'Hoy' : formatDay(day)}</span>
                    <i class="fas ${icon} weather-day__icon" aria-hidden="true"></i>
                    <span class="weather-day__temps">
                        <span class="weather-day__max">${max}°</span>
                        <span class="weather-day__min">${min}°</span>
                    </span>
                </div>
            `;
        }).join('');
    }

    function renderCurrent() {
        const c = weatherData.current;
        const { label, icon } = wmo(c.weather_code, c.is_day);
        els.temp.textContent = Math.round(c.temperature_2m) + '°';
        els.desc.textContent = label;
        els.icon.className = 'fas ' + icon + ' weather-now__icon';
        els.humidity.textContent = c.relative_humidity_2m + '%';
        els.wind.textContent = Math.round(c.wind_speed_10m) + ' km/h';
        els.feels.textContent = Math.round(c.apparent_temperature) + '°';
        els.location.textContent = locationLabel;
        els.status.textContent = '';
        els.sky.closest('.weather-widget')?.classList.remove('is-loading');
    }

    function renderAll() {
        renderCurrent();
        renderHourly();
        renderDaily();
        updateClock();
    }

    async function loadWeatherFor(loc, label) {
        weatherData = await fetchWeather(loc.lat, loc.lon);
        coords = loc;
        locationLabel = label;
        renderAll();
    }

    async function resolveLocation() {
        if (!navigator.geolocation) {
            return { ...DEFAULT, fromGeo: false };
        }

        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                    fromGeo: true,
                }),
                () => resolve({ ...DEFAULT, fromGeo: false }),
                { timeout: 3500, maximumAge: 900000, enableHighAccuracy: false }
            );
        });
    }

    async function fetchLocationName(lat, lon) {
        try {
            const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=es&count=1`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.results?.[0]) {
                const r = data.results[0];
                return r.name + (r.admin1 ? ', ' + r.admin1 : '');
            }
        } catch (_) {}
        return null;
    }

    async function fetchWeather(lat, lon) {
        const params = new URLSearchParams({
            latitude: lat,
            longitude: lon,
            current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day',
            hourly: 'temperature_2m,weather_code,is_day',
            daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset',
            timezone: 'auto',
            forecast_days: '7',
        });
        const res = await fetch('https://api.open-meteo.com/v1/forecast?' + params);
        if (!res.ok) throw new Error('forecast');
        return res.json();
    }

    async function init() {
        try {
            els.status.textContent = 'Cargando tiempo…';

            const geoPromise = resolveLocation();
            await loadWeatherFor({ ...DEFAULT, fromGeo: false }, DEFAULT.label);

            const loc = await geoPromise;
            const moved = loc.fromGeo
                && (Math.abs(loc.lat - DEFAULT.lat) > 0.02 || Math.abs(loc.lon - DEFAULT.lon) > 0.02);

            if (moved) {
                const name = (await fetchLocationName(loc.lat, loc.lon)) || 'Tu ubicación';
                await loadWeatherFor(loc, name);
            }

            els.status.textContent = '';
        } catch (_) {
            els.status.textContent = 'No se pudo cargar el tiempo';
            els.sky.closest('.weather-widget')?.classList.remove('is-loading');
        }
    }

    updateClock();
    setInterval(updateClock, 1000);
    init();
})();
