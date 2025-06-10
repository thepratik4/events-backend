// models/Event.js
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  date: { type: String, required: true },
  eventType: { type: String, required: true },
});

module.exports = mongoose.model('Event', eventSchema);
