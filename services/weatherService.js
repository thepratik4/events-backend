// services/weatherService.js
require('dotenv').config();
const axios = require('axios');

const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const BASE_URL = 'http://api.weatherapi.com/v1';

// Convert date to string "YYYY-MM-DD"
function formatDate(dateStr) {
  return dateStr; // assuming already in YYYY-MM-DD format
}

// Fetch weather forecast for a given date and location
async function getWeatherForDate(location, date) {
  try {
    // WeatherAPI's forecast endpoint supports forecast for today and next days
    // Max 10 days forecast in free plan
    
    const url = `${BASE_URL}/forecast.json`;

    const response = await axios.get(url, {
      params: {
        key: WEATHER_API_KEY,
        q: location,
        dt: date,
        days: 1,
        aqi: 'no',
        alerts: 'no',
      }
    });

    // The response structure:
    // response.data.forecast.forecastday[0] contains the data for requested day

    const dayData = response.data.forecast.forecastday[0].day;
    const condition = dayData.condition;

    return {
      temp: dayData.avgtemp_c,
      wind: dayData.maxwind_kph,  // wind speed in km/h
      weather: condition.text,     // e.g. "Partly cloudy"
      description: condition.text,
      date: date,
    };
  } catch (error) {
  console.error('🔥 Weather API error:', error.response?.data || error.message);
  throw new Error(error.response?.data?.error?.message || 'Error fetching weather');
}

}

module.exports = {
  getWeatherForDate
};
