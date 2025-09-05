const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const webPush = require('web-push');
const { Pool } = require('pg');
const path = require('path');
const https = require('https');
const fs = require('fs');

const app = express();
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces
const PORT = process.env.PORT || 3001;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const NODE_ENV = process.env.NODE_ENV || 'development';

// PostgreSQL connection - Environment-based
const pool = new Pool(
  process.env.DATABASE_URL ? {
    connectionString: process.env.DATABASE_URL,
    ssl: false // Disable SSL for fly.io internal connections
  } : {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'dickerchen',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
  }
);

// Initialize database tables
async function initializeDatabase() {
  try {
    console.log('🔧 Initializing database tables...');
    
    // Create users table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        total INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table ready');
    
    // Create pushups table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pushups (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        count INTEGER NOT NULL,
        date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Pushups table ready');
    
    // Check if push_subscriptions table exists first
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'push_subscriptions'
      )
    `);
    
    if (!tableExists.rows[0].exists) {
      // Create push_subscriptions table only if it doesn't exist
      await pool.query(`
        CREATE TABLE push_subscriptions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          endpoint TEXT NOT NULL,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id)
        )
      `);
      console.log('✅ Push subscriptions table created');
    } else {
      console.log('✅ Push subscriptions table already exists');
    }
    
    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    // Don't fail the server startup, just log the error
  }
}

// Initialize database on startup
initializeDatabase();

// Middleware
const corsOptions = {
  origin: NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL || 'https://dickerchen.fly.dev'] 
    : [
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        'http://192.168.178.196:3001',
        'https://localhost:3443',
        'https://127.0.0.1:3443',
        'https://192.168.178.196:3443'
      ],
  credentials: true
};
app.use(cors(corsOptions));
app.use(bodyParser.json());
// Adjust path for Docker deployment vs local development
const publicPath = process.env.NODE_ENV === 'production' 
  ? path.join(__dirname, 'public') 
  : path.join(__dirname, '../public');
app.use(express.static(publicPath));

// Specific favicon route
app.get('/favicon.ico', (req, res) => {
  const faviconPath = process.env.NODE_ENV === 'production' 
    ? path.join(__dirname, 'public/favicon.ico') 
    : path.join(__dirname, '../public/favicon.ico');
  res.sendFile(faviconPath);
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
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id),
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`).catch(err => console.error('Error creating tables:', err));

// Web Push setup with environment-based VAPID keys
const publicVapidKey = process.env.VAPID_PUBLIC_KEY || 'BKgHClYOTs_CiYQUS-L2yTNc3CBQOMLL0bd22oOz5oJ1J0kXZ0UPD5qkSH0IvBk4-BY6cAXAp2kA5bXz6yTP15w';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || 'IjBhG8cPneQUcUxr1yAM283gDsUxQwgaCNtnUwKXGyY';
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:behr.lennart@gmail.com';

console.log('🔑 VAPID Public Key:', publicVapidKey.substring(0, 20) + '...');

webPush.setVapidDetails(
  vapidEmail,
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

// Leaderboard endpoint with goal achievement logic
app.get('/api/leaderboard', async (req, res) => {
  try {
    const dailyGoal = 100;
    const today = new Date().toISOString().split('T')[0];
    
    // Get all users
    const usersResult = await pool.query('SELECT * FROM users');
    const users = usersResult.rows;
    
    // Calculate leaderboard data for each user
    const leaderboardData = await Promise.all(users.map(async (user) => {
      // Get today's pushups for this user, ordered by timestamp
      const pushupsResult = await pool.query(
        'SELECT count, timestamp FROM pushups WHERE user_id = $1 AND DATE(timestamp) = $2 ORDER BY timestamp ASC',
        [user.id, today]
      );
      
      const pushups = pushupsResult.rows;
      let total = 0;
      let goalReachedAt = null;
      
      // Calculate running total and find when goal was reached
      for (const pushup of pushups) {
        total += pushup.count;
        if (total >= dailyGoal && goalReachedAt === null) {
          goalReachedAt = pushup.timestamp;
        }
      }
      
      return {
        id: user.id,
        name: user.name,
        total: total,
        hasReachedGoal: total >= dailyGoal,
        goalReachedAt: goalReachedAt
      };
    }));
    
    // Smart sorting: goal achievers by time, others by total
    leaderboardData.sort((a, b) => {
      // Both reached goal: sort by time (earliest first)
      if (a.hasReachedGoal && b.hasReachedGoal) {
        return new Date(a.goalReachedAt) - new Date(b.goalReachedAt);
      }
      
      // Only one reached goal: goal winner goes first
      if (a.hasReachedGoal && !b.hasReachedGoal) return -1;
      if (!a.hasReachedGoal && b.hasReachedGoal) return 1;
      
      // Neither reached goal: sort by total (highest first)
      return b.total - a.total;
    });
    
    res.json(leaderboardData);
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

// VAPID public key endpoint
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: publicVapidKey });
});

// Subscribe endpoint - save to database
app.post('/api/subscribe', async (req, res) => {
  try {
    const { userId, subscription } = req.body;
    
    // Add to debug logs
    const logEntry = {
      timestamp: new Date().toISOString(),
      userId: userId,
      userIdType: typeof userId,
      hasSubscription: !!subscription,
      hasEndpoint: !!subscription?.endpoint,
      hasKeys: !!subscription?.keys,
      endpoint: subscription?.endpoint?.substring(0, 50) + '...'
    };
    
    global.debugLogs = global.debugLogs || [];
    global.debugLogs.push(logEntry);
    // Keep only last 10 entries
    if (global.debugLogs.length > 10) {
      global.debugLogs = global.debugLogs.slice(-10);
    }
    
    console.log('📥 Subscription request received:');
    console.log('   User ID:', userId, '(type:', typeof userId, ')');
    console.log('   Subscription endpoint:', subscription?.endpoint?.substring(0, 50) + '...');
    console.log('   Subscription keys:', subscription?.keys ? 'present' : 'missing');
    
    // Validate input
    if (!userId || !subscription) {
      console.error('❌ Missing userId or subscription in request');
      logEntry.error = 'Missing userId or subscription';
      return res.status(400).json({ error: 'Missing userId or subscription' });
    }
    
    if (!subscription.endpoint || !subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
      console.error('❌ Invalid subscription format');
      logEntry.error = 'Invalid subscription format';
      return res.status(400).json({ error: 'Invalid subscription format' });
    }
    
    // Store subscription in database with UPSERT
    await pool.query(`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, updated_at) 
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        endpoint = EXCLUDED.endpoint,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        updated_at = CURRENT_TIMESTAMP
    `, [
      parseInt(userId), 
      subscription.endpoint, 
      subscription.keys.p256dh, 
      subscription.keys.auth
    ]);
    
    console.log('✅ Subscription saved to database for user', userId);
    res.status(201).json({ success: true, message: 'Subscription saved successfully' });
  } catch (error) {
    console.error('❌ Error saving subscription:', error);
    res.status(500).json({ error: 'Failed to save subscription: ' + error.message });
  }
});

// Send notification endpoint - load from database
app.post('/api/send-notification', async (req, res) => {
  try {
    const { userId, title, body, fromUserId } = req.body;
    console.log('Sending notification to user:', userId, 'From:', fromUserId, 'Title:', title, 'Body:', body);
    
    // Get subscription from database
    const result = await pool.query(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1', 
      [parseInt(userId)]
    );
    
    if (result.rows.length === 0) {
      console.log('No subscription found for user:', userId);
      return res.status(404).json({ error: 'Subscription not found. User needs to enable notifications first.' });
    }
    
    const { endpoint, p256dh, auth } = result.rows[0];
    const subscription = {
      endpoint,
      keys: { p256dh, auth }
    };
    
    console.log('✅ Subscription loaded from database for user:', userId);

    // Get sender name if fromUserId is provided
    let senderName = null;
    if (fromUserId) {
      const senderResult = await pool.query('SELECT name FROM users WHERE id = $1', [parseInt(fromUserId)]);
      if (senderResult.rows.length > 0) {
        senderName = senderResult.rows[0].name;
        console.log('✅ Sender name found:', senderName);
      }
    }

    const payload = JSON.stringify({
      title: title || 'Dickerchen',
      body: body || 'Zeit für deine Dicke! 💪',
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      data: { 
        userId,
        fromUserId,
        fromUserName: senderName
      }
    });

    console.log('Sending push notification with payload:', payload);
    await webPush.sendNotification(subscription, payload);
    console.log('✅ Push notification sent successfully');
    
    res.status(200).json({ success: true, message: 'Notification sent successfully' });
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification: ' + error.message });
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

// Debug endpoint - list all subscriptions
app.get('/api/debug/subscriptions', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT user_id, endpoint, created_at FROM push_subscriptions ORDER BY user_id'
    );
    
    const subscriptions = result.rows.map(row => ({
      userId: row.user_id,
      endpoint: row.endpoint?.substring(0, 50) + '...',
      createdAt: row.created_at
    }));
    
    res.json({ 
      total: result.rows.length,
      subscriptions: subscriptions,
      lastLogs: global.debugLogs || []
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// Initialize debug logs array
global.debugLogs = [];

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working!', 
    timestamp: new Date().toISOString(),
    publicPath: publicPath 
  });
});

// HTTP Server
app.listen(PORT, HOST, () => {
  console.log(`HTTP Server running on http://${HOST}:${PORT}`);
  console.log(`Local access: http://localhost:${PORT}`);
  console.log(`LAN access: http://192.168.178.196:${PORT}`);
});

// HTTPS Server (für PWA) - nur wenn Zertifikate vorhanden
const certPath = path.join(__dirname, 'cert.pem');
const keyPath = path.join(__dirname, 'key.pem');

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  try {
    const httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };

    https.createServer(httpsOptions, app).listen(HTTPS_PORT, HOST, () => {
      console.log(`🔒 HTTPS Server running on https://${HOST}:${HTTPS_PORT}`);
      console.log(`🔒 Local HTTPS access: https://localhost:${HTTPS_PORT}`);
      console.log(`🔒 LAN HTTPS access: https://192.168.178.196:${HTTPS_PORT}`);
      console.log(`📱 For PWA: Use HTTPS URL on mobile device`);
    });
  } catch (error) {
    console.log('⚠️  Could not start HTTPS server:', error.message);
  }
} else {
  console.log('📝 No SSL certificates found - running HTTP only');
  console.log('💡 HTTPS handled by Fly.io in production');
}
