/*
 * Paris weather for the trip dates. Open-Meteo needs no API key.
 *
 * The forecast only reaches ~16 days out, and the app has to work offline, so
 * results are cached in localStorage and anything beyond the forecast window
 * falls back to late-September / early-October climate normals for Paris.
 */
(function () {
  const PT = (window.PT = window.PT || {});
  const util = PT.util;

  const PARIS = { lat: 48.8566, lon: 2.3522 };
  const CACHE_HOURS = 6;

  /* Paris normals, °C — used when the real forecast does not reach a date. */
  const NORMALS = {
    9: { max: 21, min: 12, precip: 30 },   // September
    10: { max: 17, min: 10, precip: 35 }   // October
  };

  function cached() {
    const weather = PT.store.weather();
    if (!weather || !Array.isArray(weather.days)) return null;
    return weather;
  }

  function isStale(weather) {
    if (!weather || !weather.fetchedAt) return true;
    return (Date.now() - weather.fetchedAt) > CACHE_HOURS * 3600 * 1000;
  }

  /* Forecast for one date, or the seasonal normal as a labelled fallback. */
  function forDate(iso) {
    const weather = cached();
    if (weather) {
      const hit = weather.days.filter(function (d) { return d.date === iso; })[0];
      if (hit) return Object.assign({ source: 'forecast' }, hit);
    }
    const month = Number(String(iso).split('-')[1]);
    const normal = NORMALS[month];
    return normal ? Object.assign({ date: iso, source: 'normal' }, normal) : null;
  }

  function fetchForecast() {
    const url = 'https://api.open-meteo.com/v1/forecast' +
      '?latitude=' + PARIS.lat + '&longitude=' + PARIS.lon +
      '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code' +
      '&timezone=Europe%2FParis&forecast_days=16';

    return fetch(url)
      .then(function (response) {
        if (!response.ok) throw new Error('Weather service returned ' + response.status);
        return response.json();
      })
      .then(function (payload) {
        const daily = payload && payload.daily;
        if (!daily || !Array.isArray(daily.time)) throw new Error('Unexpected weather response');
        const days = daily.time.map(function (date, index) {
          return {
            date: date,
            max: daily.temperature_2m_max[index],
            min: daily.temperature_2m_min[index],
            precip: daily.precipitation_probability_max ? daily.precipitation_probability_max[index] : null,
            code: daily.weather_code ? daily.weather_code[index] : null
          };
        });
        PT.store.setWeather({ fetchedAt: Date.now(), days: days });
        return days;
      });
  }

  /* Average across the trip, for the one-line strip in the masthead. */
  function tripSummary() {
    const dates = PT.store.tripDates();
    if (!dates.length) return null;
    let maxTotal = 0;
    let minTotal = 0;
    let rainyDays = 0;
    let known = 0;
    let anyForecast = false;

    dates.forEach(function (date) {
      const day = forDate(date);
      if (!day) return;
      known++;
      maxTotal += day.max;
      minTotal += day.min;
      if (day.precip != null && day.precip >= 40) rainyDays++;
      if (day.source === 'forecast') anyForecast = true;
    });

    if (!known) return null;
    return {
      max: Math.round(maxTotal / known),
      min: Math.round(minTotal / known),
      rainyDays: rainyDays,
      forecast: anyForecast
    };
  }

  function renderStrip() {
    const node = document.getElementById('weather-strip');
    if (!node) return;
    const summary = tripSummary();
    if (!summary) { node.innerHTML = ''; return; }

    const label = summary.forecast ? 'Forecast' : 'Seasonal average';
    node.innerHTML = '' +
      '<span>Paris</span>' +
      '<span class="weather-strip__temp">' + summary.max + '° / ' + summary.min + '°</span>' +
      (summary.rainyDays ? '<span class="weather-strip__rain">' + summary.rainyDays + ' wet days</span>' : '') +
      '<span>' + label + '</span>' +
      '<button type="button" data-refresh-weather>Refresh</button>';
  }

  function refresh(force) {
    const weather = cached();
    if (!force && weather && !isStale(weather)) { renderStrip(); return Promise.resolve(); }
    if (!navigator.onLine) {
      renderStrip();
      if (force) util.toast('Offline — showing the last forecast saved.');
      return Promise.resolve();
    }
    return fetchForecast()
      .then(function () {
        renderStrip();
        if (force) util.toast('Forecast updated.');
      })
      .catch(function (err) {
        console.warn('Weather unavailable', err);
        renderStrip();
        if (force) util.toast('Could not reach the weather service.');
      });
  }

  document.addEventListener('click', function (event) {
    if (event.target.closest('[data-refresh-weather]')) refresh(true);
  });

  PT.weather = {
    forDate: forDate,
    refresh: refresh,
    renderStrip: renderStrip
  };
})();
