const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const webPush = require('web-push');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// PostgreSQL connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'dickerchen',
  password: 'password',
  port: 5432,
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// Specific favicon route
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/favicon.ico'));
});

// Create tables
pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    daily_goal INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS pushups (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    count INTEGER NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`).catch(err => console.error('Error creating tables:', err));

// Web Push setup with persistent VAPID keys
const publicVapidKey = 'BKgHClYOTs_CiYQUS-L2yTNc3CBQOMLL0bd22oOz5oJ1J0kXZ0UPD5qkSH0IvBk4-BY6cAXAp2kA5bXz6yTP15w';
const privateVapidKey = 'IjBhG8cPneQUcUxr1yAM283gDsUxQwgaCNtnUwKXGyY';

webPush.setVapidDetails(
  'mailto:your-email@example.com',
  publicVapidKey,
  privateVapidKey
);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Routes
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name } = req.body;
    
    // Validate name
    if (!name || name.trim() === '' || name === 'undefined' || name === 'null') {
      return res.status(400).json({ error: 'Valid name is required' });
    }
    
    const trimmedName = name.trim();
    const result = await pool.query('INSERT INTO users (name) VALUES ($1) RETURNING *', [trimmedName]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pushups', async (req, res) => {
  try {
    const { userId, count } = req.body;
    const result = await pool.query('INSERT INTO pushups (user_id, count) VALUES ($1, $2) RETURNING *', [userId, count]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pushups/:userId', async (req, res) => {
  try {
    // Get today's date in local format
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + 
                    String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(today.getDate()).padStart(2, '0');
    
    const result = await pool.query(`
      SELECT * FROM pushups 
      WHERE user_id = $1 AND DATE(timestamp) = $2
    `, [req.params.userId, todayStr]);
    
    const total = result.rows.reduce((sum, p) => sum + p.count, 0);
    res.json({ total, pushups: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pushups/:userId/total', async (req, res) => {
  try {
    const result = await pool.query('SELECT SUM(count) as total FROM pushups WHERE user_id = $1', [req.params.userId]);
    res.json({ total: result.rows[0].total || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pushups/:userId/calendar', async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth();
    
    // Get the actual last day of the month
    const lastDay = new Date(year, month + 1, 0).getDate();
    const startDate = year + '-' + String(month + 1).padStart(2, '0') + '-01';
    const endDate = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0');
    
    const result = await pool.query(`
      SELECT DATE(timestamp) as date, SUM(count) as total
      FROM pushups 
      WHERE user_id = $1 AND DATE(timestamp) >= $2 AND DATE(timestamp) <= $3
      GROUP BY DATE(timestamp)
      ORDER BY DATE(timestamp)
    `, [req.params.userId, startDate, endDate]);
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Calendar API endpoint
app.get('/api/calendar/:userId/:year/:month', async (req, res) => {
  try {
    const { userId, year, month } = req.params;
    
    // Get the actual last day of the month
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const startDate = year + '-' + String(month).padStart(2, '0') + '-01';
    const endDate = year + '-' + String(month).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0');
    
    const result = await pool.query(`
      SELECT 
        to_char((timestamp AT TIME ZONE 'Europe/Berlin'), 'YYYY-MM-DD') as date, 
        SUM(count) as total
      FROM pushups 
      WHERE user_id = $1 
      AND to_char((timestamp AT TIME ZONE 'Europe/Berlin'), 'YYYY-MM-DD') >= $2 
      AND to_char((timestamp AT TIME ZONE 'Europe/Berlin'), 'YYYY-MM-DD') <= $3
      GROUP BY to_char((timestamp AT TIME ZONE 'Europe/Berlin'), 'YYYY-MM-DD')
      ORDER BY to_char((timestamp AT TIME ZONE 'Europe/Berlin'), 'YYYY-MM-DD')
    `, [userId, startDate, endDate]);
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Store subscriptions in memory (in production, use database)
const subscriptions = new Map();

app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: publicVapidKey });
});

app.post('/api/subscribe', async (req, res) => {
  const { userId, subscription } = req.body;
  subscriptions.set(userId, subscription);
  console.log('Subscription saved for user', userId);
  res.status(201).json({ success: true });
});

app.post('/api/send-notification', async (req, res) => {
  const { userId, title, body } = req.body;
  const subscription = subscriptions.get(userId);
  
  if (!subscription) {
    return res.status(404).json({ error: 'Subscription not found' });
  }

  const payload = JSON.stringify({
    title: title || 'Dickerchen',
    body: body || 'Zeit für deine Dicke! 💪'
  });

  try {
    await webPush.sendNotification(subscription, payload);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Send motivational notifications to all users
app.post('/api/motivate-all', async (req, res) => {
  const { title, body } = req.body;
  const payload = JSON.stringify({
    title: title || 'Dickerchen',
    body: body || 'Zeit für deine Dicke! 💪'
  });

  let sentCount = 0;
  for (const [userId, subscription] of subscriptions) {
    try {
      await webPush.sendNotification(subscription, payload);
      sentCount++;
    } catch (error) {
      console.error(`Failed to send notification to user ${userId}:`, error);
    }
  }

  res.json({ success: true, sent: sentCount, total: subscriptions.size });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
