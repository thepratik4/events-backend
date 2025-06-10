// services/weatherService.js
require('dotenv').config();
const axios = require('axios');

const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const BASE_URL = 'http://api.weatherapi.com/v1';

// Simple in-memory cache object
const weatherCache = {}; // key: `${location}-${date}` → { data, timestamp }
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours


// Convert date to string "YYYY-MM-DD"
function formatDate(dateStr) {
  return dateStr; // assuming already in YYYY-MM-DD format
}

// Fetch weather forecast for a given date and location
async function getWeatherForDate(location, date) {
  const cacheKey = `${location}-${date}`;
  const now = Date.now();

  // Check cache
  if (weatherCache[cacheKey]) {
    const { data, timestamp } = weatherCache[cacheKey];
    if (now - timestamp < CACHE_DURATION_MS) {
      console.log('⚡ Returning cached weather for', cacheKey);
      return data;
    } else {
      console.log('⏳ Cache expired for', cacheKey);
    }
  }

  try {
    console.log('📡 Fetching new weather for', cacheKey);

    const res = await axios.get(`${BASE_URL}/forecast.json`, {
      params: {
        key: WEATHER_API_KEY,
        q: location,
        dt: date,
        days: 1,
        aqi: 'no',
        alerts: 'no',
      }
    });

    const dayData = res.data.forecast.forecastday[0].day;
    const condition = dayData.condition;

    const result = {
      temp: dayData.avgtemp_c,
      wind: dayData.maxwind_kph,
      weather: condition.text,
      description: condition.text,
      date: date,
    };

    // ✅ Save to cache
    weatherCache[cacheKey] = {
      data: result,
      timestamp: now,
    };

    return result;

  } catch (error) {
    console.error('❌ WeatherAPI Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || 'Error fetching weather');
  }
}


module.exports = {
   getWeatherForDate,
  __getCache: () => weatherCache
};
