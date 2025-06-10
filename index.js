// index.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;

// Parse incoming JSON bodies
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));


// Basic “Hello world” endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Smart Event Planner API is live!'});
});

// Mount the /events router (we’ll create this next)
const eventsRouter = require('./routes/events');
app.use('/events', eventsRouter);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
