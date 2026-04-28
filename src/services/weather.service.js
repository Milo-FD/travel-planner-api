const axios = require('axios');
const AppError = require('../utils/AppError');

const getWeatherForTrip = async (location, startDate, endDate) => {
  const apiKey = process.env.OPENWEATHER_API_KEY;

  // Get coordinates for the location
  const geoResponse = await axios.get(
    `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${apiKey}`
  );

  if (!geoResponse.data.length) {
    throw new AppError('Location not found');
  }

  const { lat, lon, name, country } = geoResponse.data[0];

  // Fetch 5 day forecast
  const weatherResponse = await axios.get(
    `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`
  );

  const forecasts = weatherResponse.data.list;
  const dailyWeather = {};

  forecasts.forEach(forecast => {
    const date = forecast.dt_txt.split(' ')[0];
    if (!dailyWeather[date]) {
      dailyWeather[date] = { temps: [], conditions: [] };
    }
    dailyWeather[date].temps.push(forecast.main.temp);
    dailyWeather[date].conditions.push(forecast.weather[0].main);
  });

  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const data = dailyWeather[dateStr];
    days.push({
      date: dateStr,
      weather: data ? {
        condition: mostCommon(data.conditions),
        tempHigh: Math.round(Math.max(...data.temps)),
        tempLow: Math.round(Math.min(...data.temps)),
      } : {
        condition: 'Unknown',
        tempHigh: null,
        tempLow: null,
      }
    });
  }

  return days;
};

const mostCommon = (arr) => {
  return arr.sort((a, b) =>
    arr.filter(v => v === a).length - arr.filter(v => v === b).length
  ).pop();
};

module.exports = { getWeatherForTrip };