// routes/events.js
const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const weatherService = require('../services/weatherService');

// CREATE event
router.post('/', async (req, res) => {
  try {
    const { name, location, date, eventType } = req.body;
    if (!name || !location || !date || !eventType) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    const newEvent = new Event({ name, location, date, eventType });
    const saved = await newEvent.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create event.' });
  }
});

// GET all events
router.get('/', async (req, res) => {
  const events = await Event.find();
  res.json(events);
});

// GET one event
router.get('/:id', async (req, res) => {
  try {
    const ev = await Event.findById(req.params.id);
    if (!ev) return res.status(404).json({ error: 'Event not found.' });
    res.json(ev);
  } catch {
    res.status(404).json({ error: 'Event not found.' });
  }
});

// UPDATE event
router.put('/:id', async (req, res) => {
  try {
    const updated = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Event not found.' });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Update failed.' });
  }
});

// WEATHER CHECK
router.post('/:id/weather-check', async (req, res) => {
  try {
    const ev = await Event.findById(req.params.id);
    if (!ev) return res.status(404).json({ error: 'Event not found.' });
    const weather = await weatherService.getWeatherForDate(ev.location, ev.date);
    res.json({ event: ev, weather });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SUITABILITY
router.get('/:id/suitability', async (req, res) => {
  try {
    const ev = await Event.findById(req.params.id);
    if (!ev) return res.status(404).json({ error: 'Event not found.' });
    const weather = await weatherService.getWeatherForDate(ev.location, ev.date);

    let score = 0;
    let reasons = [];

    const t = weather.temp;
    const desc = weather.description.toLowerCase();
    const isRain = desc.includes('rain') || desc.includes('drizzle') || desc.includes('thunderstorm');
    const windKmh = weather.wind * 3.6;
    const mainWeather = weather.weather.toLowerCase();

    if (ev.eventType.toLowerCase().includes('sports')) {
      if (t >= 15 && t <= 30) score += 30; else reasons.push('Temperature not ideal for sports');
      if (!isRain) score += 25; else reasons.push('Rainy conditions');
      if (windKmh < 20) score += 20; else reasons.push('Windy conditions for sports');
      if (['clear', 'clouds'].includes(mainWeather)) score += 25; else reasons.push('Not a clear/cloudy day');
    } else {
      if (t >= 18 && t <= 28) score += 30; else reasons.push('Temperature not ideal for formal event');
      if (!isRain) score += 30; else reasons.push('Rainy conditions');
      if (windKmh < 15) score += 25; else reasons.push('Windy conditions for formal event');
      if (mainWeather === 'clear') score += 15; else reasons.push('Not a clear day');
    }

    let verdict = 'Poor';
    if (score >= 80) verdict = 'Good';
    else if (score >= 50) verdict = 'Okay';

    res.json({ event: ev, weather, score, verdict, reasons });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ALTERNATIVES
router.get('/:id/alternatives', async (req, res) => {
  try {
    const ev = await Event.findById(req.params.id);
    if (!ev) return res.status(404).json({ error: 'Event not found.' });

    const origDate = new Date(ev.date);
    const suggestions = [];

    function formatDate(d) {
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const yy = d.getFullYear();
      return `${yy}-${mm}-${dd}`;
    }

    for (let offset = -3; offset <= 3; offset++) {
      if (offset === 0) continue;
      const checkDateObj = new Date(origDate);
      checkDateObj.setDate(origDate.getDate() + offset);
      const checkDateStr = formatDate(checkDateObj);
      const today = new Date();
      const diffMs = checkDateObj - today;
      if (diffMs < 0 || diffMs > 5 * 24 * 3600 * 1000) continue;

      try {
        const weather = await weatherService.getWeatherForDate(ev.location, checkDateStr);
        const t = weather.temp;
        const desc = weather.description.toLowerCase();
        const isRain = desc.includes('rain') || desc.includes('drizzle');
        if (!isRain && t >= 15 && t <= 30) {
          suggestions.push({ date: checkDateStr, temp: t, weather: weather.weather });
        }
      } catch (_) {}
    }

    if (suggestions.length === 0) {
      return res.json({ message: 'No better alternatives found within ±3 days.' });
    }

    res.json({ alternatives: suggestions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cache debug
router.get('/__cache', (req, res) => {
  res.json(weatherService.__getCache?.() || {});
});

module.exports = router;
