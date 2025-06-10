// routes/events.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const weatherService = require('../services/weatherService');
const EVENTS_FILE = path.join(__dirname, '../data/events.json');

// --- Helpers to read/write JSON file ---
function readEventsFromFile() {
  const data = fs.readFileSync(EVENTS_FILE, 'utf-8');
  return JSON.parse(data);
}
function writeEventsToFile(events) {
  fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2));
}

// --- CRUD Endpoints (unchanged from before) ---

// 1) CREATE event
router.post('/', (req, res) => {
  const allEvents = readEventsFromFile();
  console.log('📦 Received body:', req.body);

  const { name, location, date, eventType } = req.body;
  if (!name || !location || !date || !eventType) {
    return res.status(400).json({ error: 'name, location, date, and eventType are required.' });
  }
  const newEvent = {
    id: Date.now().toString(),
    name,
    location,
    date,
    eventType
  };
  allEvents.push(newEvent);
  writeEventsToFile(allEvents);
  res.status(201).json(newEvent);
});

// 2) GET all events
router.get('/', (req, res) => {
  const allEvents = readEventsFromFile();
  res.json(allEvents);
});

// 3) UPDATE event
router.put('/:id', (req, res) => {
  const allEvents = readEventsFromFile();
  const { id } = req.params;
  const { name, location, date, eventType } = req.body;
  const idx = allEvents.findIndex(ev => ev.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Event not found.' });

  if (name) allEvents[idx].name = name;
  if (location) allEvents[idx].location = location;
  if (date) allEvents[idx].date = date;
  if (eventType) allEvents[idx].eventType = eventType;
  writeEventsToFile(allEvents);
  res.json(allEvents[idx]);
});

// 4) GET one event
router.get('/:id', (req, res) => {
  const allEvents = readEventsFromFile();
  const ev = allEvents.find(e => e.id === req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found.' });
  res.json(ev);
});

// --- NEW: Weather-Check Endpoint ---
// POST /events/:id/weather-check
// Returns raw weather for event’s location & date
router.post('/:id/weather-check', async (req, res) => {
  try {
    const allEvents = readEventsFromFile();
    const ev = allEvents.find(e => e.id === req.params.id);
    if (!ev) return res.status(404).json({ error: 'Event not found.' });

    const weather = await weatherService.getWeatherForDate(ev.location, ev.date);
    // You can expand this later to store weather data alongside event if you like
    res.json({ event: ev, weather });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- NEW: Suitability Score Endpoint ---
// GET /events/:id/suitability
router.get('/:id/suitability', async (req, res) => {
  try {
    const allEvents = readEventsFromFile();
    const ev = allEvents.find(e => e.id === req.params.id);
    if (!ev) return res.status(404).json({ error: 'Event not found.' });

    const weather = await weatherService.getWeatherForDate(ev.location, ev.date);
    // Basic scoring logic (example):
    // You can adjust thresholds based on ev.eventType.
    //
    // For demonstration, let's assume two types:
    //   1) “Outdoor Sports”: temp 15–30°C, rain <20%, wind <20 km/h → Good
    //   2) “Wedding/Formal Events”: temp 18–28°C, rain <10%, wind <15 km/h → Good
    //
    // We’ll check “weather” (clear/rainy, etc.) + “temp” + “wind”. OWM returns “weather” text, but not precipitation% directly.
    // We’ll approximate “precipitation” by looking at `weather` keyword (“rain” or “snow” → assume precip ≥ 50% chance).
    // (A more accurate approach would use the “rain” field in OWM response, but for now we’ll keep it simple.)

    let score = 0;
    let reasons = [];

    // Temperature scoring
    const t = weather.temp;
    if (ev.eventType.toLowerCase().includes('sports')) {
      if (t >= 15 && t <= 30) {
        score += 30;
      } else {
        reasons.push('Temperature not ideal for sports');
      }
    } else {
      // wedding/formal or other
      if (t >= 18 && t <= 28) {
        score += 30;
      } else {
        reasons.push('Temperature not ideal for formal event');
      }
    }

    // Precipitation (approximate)
    const desc = weather.description.toLowerCase();
    const isRain = desc.includes('rain') || desc.includes('drizzle') || desc.includes('thunderstorm');
    if (ev.eventType.toLowerCase().includes('sports')) {
      if (!isRain) {
        score += 25;
      } else {
        reasons.push('Rainy conditions');
      }
    } else {
      if (!isRain) {
        score += 30;
      } else {
        reasons.push('Rainy conditions');
      }
    }

    // Wind scoring
    const w = weather.wind; // km/h or m/s? OWM gives wind.speed in m/s by default, but since we set units=metric, it’s m/s.
    // Convert m/s → km/h: multiply by 3.6
    const windKmh = w * 3.6;
    if (ev.eventType.toLowerCase().includes('sports')) {
      if (windKmh < 20) {
        score += 20;
      } else {
        reasons.push('Windy conditions for sports');
      }
    } else {
      if (windKmh < 15) {
        score += 25;
      } else {
        reasons.push('Windy conditions for formal event');
      }
    }

    // Aesthetic weather (clear/cloudy): OWM “weather.main”
    const mainWeather = weather.weather.toLowerCase(); // e.g., “Clear”, “Clouds”, “Rain”...
    if (ev.eventType.toLowerCase().includes('sports')) {
      if (mainWeather === 'clear' || mainWeather === 'clouds') {
        score += 25;
      } else {
        reasons.push('Not a clear/cloudy day');
      }
    } else {
      if (mainWeather === 'clear') {
        score += 15;
      } else {
        reasons.push('Not a clear day');
      }
    }

    // Final verdict
    let verdict = 'Poor';
    if (score >= 80) verdict = 'Good';
    else if (score >= 50) verdict = 'Okay';

    res.json({
      event: ev,
      weather,
      score,
      verdict,
      reasons
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- NEW: Alternative Dates Endpoint ---
// GET /events/:id/alternatives
// Suggest ±3 days within same week that might have better weather.
router.get('/:id/alternatives', async (req, res) => {
  try {
    const allEvents = readEventsFromFile();
    const ev = allEvents.find(e => e.id === req.params.id);
    if (!ev) return res.status(404).json({ error: 'Event not found.' });

    const origDate = new Date(ev.date);
    const suggestions = [];

    // Helper to format Date → "YYYY-MM-DD"
    function formatDate(d) {
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const yy = d.getFullYear();
      return `${yy}-${mm}-${dd}`;
    }

    // Check ±3 days from original
    for (let offset = -3; offset <= 3; offset++) {
      if (offset === 0) continue; // skip the original date
      const checkDateObj = new Date(origDate);
      checkDateObj.setDate(origDate.getDate() + offset);
      const checkDateStr = formatDate(checkDateObj);

      // Only consider dates within the next 5 days (since forecast only covers 5 days)
      const today = new Date();
      const diffMs = checkDateObj - today;
      if (diffMs < 0 || diffMs > 5 * 24 * 3600 * 1000) continue;

      // Fetch weather and score quickly
      try {
        const weather = await weatherService.getWeatherForDate(ev.location, checkDateStr);
        // Re-use same scoring logic as above but simplified: Good if no rain and temp is in range
        const t = weather.temp;
        const desc = weather.description.toLowerCase();
        const isRain = desc.includes('rain') || desc.includes('drizzle');

        if (!isRain) {
          // If spaghetti code is fine for now, just push dates that have no rain and moderate temp
          if (t >= 15 && t <= 30) {
            suggestions.push({ date: checkDateStr, temp: t, weather: weather.weather });
          }
        }
      } catch (_) {
        // skip if no forecast available or error
      }
    }

    if (suggestions.length === 0) {
      return res.json({ message: 'No better alternatives found within ±3 days.' });
    }

    res.json({ alternatives: suggestions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
