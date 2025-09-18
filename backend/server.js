// Load environment variables from .env file in project root
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const webPush = require('web-push');
const { Pool } = require('pg');
const https = require('https');
const fs = require('fs');
const NotificationManager = require('./notification-manager');

const app = express();
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces
const PORT = process.env.PORT || 3001;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize notification manager
const notificationManager = new NotificationManager();

// Fallback notification timer (runs every 2 hours when server is active)
setInterval(async () => {
  try {
    // Only run if it's a reasonable time
    if (notificationManager.isGoodTimeForNotification()) {
      const currentHour = notificationManager.getCurrentBerlinHour();

      let timeSlot = 'afternoon'; // default
      if (currentHour >= 9 && currentHour <= 12) timeSlot = 'morning';
      else if (currentHour >= 17 && currentHour <= 19) timeSlot = 'evening';

      console.log(`⏰ Fallback notification check - Time slot: ${timeSlot}`);

      // Only send if we haven't sent recently (basic rate limiting)
      await notificationManager.sendDailyReminders(timeSlot);
    }
  } catch (error) {
    console.log('Fallback notification check failed (non-critical):', error.message);
  }
}, 2 * 60 * 60 * 1000); // Every 2 hours

// Helper function for consistent timezone handling
function getBerlinDateString(date = new Date()) {
  // Use Intl.DateTimeFormat for consistent timezone conversion
  const formatter = new Intl.DateTimeFormat('sv-SE', { // 'sv-SE' gives YYYY-MM-DD format
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(date);
}

// Helper functions for multi-exercise support
function getExerciseTable(exerciseType) {
  const tables = {
    'pushups': 'pushups',
    'squats': 'squats', 
    'situps': 'situps'
  };
  return tables[exerciseType] || null;
}

function validateExerciseType(exerciseType) {
  return ['pushups', 'squats', 'situps'].includes(exerciseType);
}

function getExerciseConfig() {
  return {
    combined: { name: 'Combined', emoji: '🎯', defaultGoal: 100 },
    pushups: { name: 'Push-ups', emoji: '💪', defaultGoal: 40 },
    squats: { name: 'Squats', emoji: '🦵', defaultGoal: 30 },
    situps: { name: 'Sit-ups', emoji: '🏋️', defaultGoal: 30 }
  };
}

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
      
      // Migration: Ensure correct column structure
      await pool.query(`
        DO $$
        BEGIN
          -- Add missing columns if they don't exist
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'push_subscriptions' AND column_name = 'endpoint') THEN
            ALTER TABLE push_subscriptions ADD COLUMN endpoint TEXT;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'push_subscriptions' AND column_name = 'p256dh') THEN
            ALTER TABLE push_subscriptions ADD COLUMN p256dh TEXT;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'push_subscriptions' AND column_name = 'auth') THEN
            ALTER TABLE push_subscriptions ADD COLUMN auth TEXT;
          END IF;
          
          -- Remove old subscription column if it exists
          IF EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'push_subscriptions' AND column_name = 'subscription') THEN
            ALTER TABLE push_subscriptions DROP COLUMN subscription;
          END IF;
        END $$
      `);
      console.log('✅ Push subscriptions table migrated');
    }
    
    // Create squats table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS squats (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        count INTEGER NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Squats table ready');
    
    // Create situps table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS situps (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        count INTEGER NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Sit-ups table ready');
    
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

// Safe database migration - runs only once
async function runDatabaseMigrations() {
  try {
    console.log('🔍 Checking for required database migrations...');

    // Check if obsolete columns exist in pushups table
    const obsoleteColumns = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'pushups'
      AND column_name IN ('date', 'created_at')
    `);

    if (obsoleteColumns.rows.length > 0) {
      console.log('🛠️ Running database migration to remove obsolete columns...');

      // Remove obsolete columns safely
      for (const row of obsoleteColumns.rows) {
        const columnName = row.column_name;
        await pool.query(`ALTER TABLE pushups DROP COLUMN IF EXISTS ${columnName}`);
        console.log(`✅ Removed obsolete column: ${columnName}`);
      }

      console.log('✅ Database migration completed successfully');
    } else {
      console.log('ℹ️ No migrations needed - database is up to date');
    }

    // Check and migrate push_subscriptions table structure
    const subscriptionColumns = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'push_subscriptions'
    `);

    const hasOldStructure = subscriptionColumns.rows.some(row =>
      row.column_name === 'subscription'
    );
    const hasNewStructure = subscriptionColumns.rows.some(row =>
      ['endpoint', 'p256dh', 'auth'].includes(row.column_name)
    );

    if (hasOldStructure && !hasNewStructure) {
      console.log('🛠️ Migrating push_subscriptions table structure...');

      // Add new columns
      await pool.query(`
        ALTER TABLE push_subscriptions
        ADD COLUMN IF NOT EXISTS endpoint TEXT,
        ADD COLUMN IF NOT EXISTS p256dh TEXT,
        ADD COLUMN IF NOT EXISTS auth TEXT
      `);

      // TODO: Migrate data from old subscription column to new structure
      // This would require parsing the JSON subscription data

      console.log('✅ Push subscriptions table migrated');
    } else if (!hasOldStructure && !hasNewStructure) {
      console.log('ℹ️ Push subscriptions table needs to be created');
    } else {
      console.log('ℹ️ Push subscriptions table structure is correct');
    }

  } catch (error) {
    console.error('❌ Database migration error:', error);
    // Don't fail the server startup, just log the error
  }
}

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

// Run migrations after table creation
runDatabaseMigrations();

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
    // Use consistent Berlin timezone helper
    const todayStr = getBerlinDateString();

    console.log(`🏆 Getting leaderboard for Berlin date: ${todayStr}`);

    // Get all users
    const usersResult = await pool.query('SELECT * FROM users');
    const users = usersResult.rows;

    // Calculate leaderboard data for each user
    const leaderboardData = await Promise.all(users.map(async (user) => {
      // Get today's pushups for this user, ordered by timestamp (Berlin timezone)
      const pushupsResult = await pool.query(
        'SELECT count, to_char(timestamp, \'YYYY-MM-DD"T"HH24:MI:SS"Z"\') as timestamp FROM pushups WHERE user_id = $1 AND to_char(timestamp, \'YYYY-MM-DD\') = $2 ORDER BY timestamp ASC',
        [user.id, todayStr]
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
    
    // Store Berlin timezone timestamp (consistent with display)
    const result = await pool.query(
      'INSERT INTO pushups (user_id, count, timestamp) VALUES ($1, $2, NOW() AT TIME ZONE \'Europe/Berlin\') RETURNING id, user_id, count, to_char(timestamp, \'YYYY-MM-DD"T"HH24:MI:SS"Z"\') as timestamp', 
      [userId, count]
    );
    
    // Trigger smart notifications based on this push-up entry
    setTimeout(async () => {
      try {
        await checkForSmartNotifications(userId, count);
      } catch (error) {
        console.log('Smart notification check failed (non-critical):', error.message);
      }
    }, 1000); // Small delay to ensure DB is updated
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a specific pushup entry (only owner can delete)
app.delete('/api/pushups/:pushupId', async (req, res) => {
  try {
    const { pushupId } = req.params;
    const { userId } = req.body; // User ID for ownership verification
    
    // First verify that the pushup belongs to the requesting user
    const ownershipCheck = await pool.query(
      'SELECT user_id FROM pushups WHERE id = $1',
      [pushupId]
    );
    
    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Push-up entry not found' });
    }
    
    if (ownershipCheck.rows[0].user_id != userId) {
      return res.status(403).json({ error: 'You can only delete your own push-up entries' });
    }
    
    // Delete the pushup entry
    const result = await pool.query(
      'DELETE FROM pushups WHERE id = $1 RETURNING *',
      [pushupId]
    );
    
    res.json({ 
      success: true, 
      deleted: result.rows[0],
      message: 'Push-up entry deleted successfully' 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pushups/:userId', async (req, res) => {
  try {
    // Get today's date in Berlin timezone using consistent helper function
    const todayStr = getBerlinDateString();

    console.log(`🕐 Getting pushups for user ${req.params.userId} on Berlin date: ${todayStr}`);

    const result = await pool.query(`
      SELECT 
        id,
        user_id,
        count,
        to_char(timestamp, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as timestamp
      FROM pushups
      WHERE user_id = $1
      AND to_char(timestamp, 'YYYY-MM-DD') = $2
      ORDER BY timestamp ASC
    `, [req.params.userId, todayStr]);

    console.log(`📊 Found ${result.rows.length} pushups for user ${req.params.userId} on ${todayStr}`);

    const total = result.rows.reduce((sum, p) => sum + p.count, 0);
    res.json({ total, pushups: result.rows });
  } catch (err) {
    console.error('❌ Error in GET /api/pushups/:userId:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get pushups for a specific date (YYYY-MM-DD format)
app.get('/api/pushups/:userId/date/:date', async (req, res) => {
  try {
    const { userId, date } = req.params;
    
    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }
    
    const result = await pool.query(`
      SELECT 
        id,
        user_id,
        count,
        to_char(timestamp, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as timestamp
      FROM pushups 
      WHERE user_id = $1 
      AND to_char(timestamp, 'YYYY-MM-DD') = $2
      ORDER BY timestamp ASC
    `, [userId, date]);
    
    const total = result.rows.reduce((sum, p) => sum + p.count, 0);
    res.json({ total, pushups: result.rows, date });
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

app.get('/api/pushups/:userId/yearly-potential', async (req, res) => {
  try {
    const userId = req.params.userId;

    // Get the date of the first pushup for this user
    const firstPushupResult = await pool.query(`
      SELECT MIN(timestamp) as first_date
      FROM pushups 
      WHERE user_id = $1
    `, [userId]);

    if (!firstPushupResult.rows[0].first_date) {
      // User has no pushups yet
      return res.json({ remaining: 0, message: 'Noch keine Push-ups erfasst' });
    }

    const firstPushupDate = new Date(firstPushupResult.rows[0].first_date);
    const today = new Date();
    // Use consistent Berlin date calculation
    const todayBerlinStr = getBerlinDateString(today);
    const todayBerlin = new Date(todayBerlinStr + 'T00:00:00.000Z');

    // Calculate days since first pushup
    const daysSinceFirst = Math.floor((todayBerlin - firstPushupDate) / (1000 * 60 * 60 * 24)) + 1; // +1 to include today

    // Get total pushups made by user
    const totalResult = await pool.query('SELECT SUM(count) as total FROM pushups WHERE user_id = $1', [userId]);
    const actualTotal = totalResult.rows[0].total || 0;

    // Calculate theoretical maximum for days since first pushup
    const theoreticalMaximum = daysSinceFirst * 100;
    
    // Calculate deficit (what user should have done vs. what they actually did)
    const deficit = Math.max(0, theoreticalMaximum - actualTotal); // Only count positive deficits
    
    // Calculate yearly potential: 365 days * 100 - deficit
    // Cap at 36500 - no one can exceed the theoretical maximum
    const yearlyPotential = Math.min(36500, (365 * 100) - deficit);
    
    const remaining = yearlyPotential - actualTotal;

    res.json({
      remaining: remaining,
      daysSinceFirst: daysSinceFirst,
      yearlyPotential: yearlyPotential,
      actualTotal: actualTotal,
      theoreticalMaximum: theoreticalMaximum,
      deficit: deficit
    });
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
      SELECT to_char(timestamp, 'YYYY-MM-DD') as date, SUM(count) as total
      FROM pushups 
      WHERE user_id = $1 
      AND to_char(timestamp, 'YYYY-MM-DD') >= $2 
      AND to_char(timestamp, 'YYYY-MM-DD') <= $3
      GROUP BY to_char(timestamp, 'YYYY-MM-DD')
      ORDER BY to_char(timestamp, 'YYYY-MM-DD')
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
        to_char(timestamp, 'YYYY-MM-DD') as date, 
        SUM(count) as total
      FROM pushups 
      WHERE user_id = $1 
      AND to_char(timestamp, 'YYYY-MM-DD') >= $2 
      AND to_char(timestamp, 'YYYY-MM-DD') <= $3
      GROUP BY to_char(timestamp, 'YYYY-MM-DD')
      ORDER BY to_char(timestamp, 'YYYY-MM-DD')
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

// Cleanup old subscriptions endpoint
app.post('/api/cleanup-subscriptions', async (req, res) => {
  try {
    const { currentUserId, subscription } = req.body;
    
    console.log('🧹 Cleaning up old subscriptions for user:', currentUserId);
    
    // Get the subscription endpoint from the request
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Subscription endpoint required' });
    }
    
    // Delete only subscriptions with the SAME endpoint but DIFFERENT user_id
    // This ensures that on THIS device, only the current user gets notifications
    const result = await pool.query(`
      DELETE FROM push_subscriptions 
      WHERE endpoint = $1 AND user_id != $2
    `, [subscription.endpoint, currentUserId]);
    
    console.log(`✅ Cleaned up ${result.rowCount} old subscriptions for this device`);
    res.json({ success: true, cleaned: result.rowCount });
  } catch (error) {
    console.error('❌ Error cleaning up subscriptions:', error);
    res.status(500).json({ error: 'Failed to cleanup subscriptions' });
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

// Daily notifications endpoint (for GitHub Actions)
app.post('/api/send-daily-notifications', async (req, res) => {
  try {
    // Simple authentication with secret
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    if (token !== process.env.NOTIFICATION_SECRET) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    console.log('🔔 Starting daily notification process...');
    await notificationManager.sendDailyReminders();

    res.json({ success: true, message: 'Daily notifications sent' });
  } catch (error) {
    console.error('Error sending daily notifications:', error);
    res.status(500).json({ error: 'Failed to send notifications' });
  }
});

// Time-slot specific notifications endpoint
app.post('/api/send-notifications/:timeSlot', async (req, res) => {
  try {
    // Simple authentication with secret
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    if (token !== process.env.NOTIFICATION_SECRET) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const timeSlot = req.params.timeSlot;
    const validSlots = ['morning', 'afternoon', 'evening'];

    if (!validSlots.includes(timeSlot)) {
      return res.status(400).json({ error: 'Invalid time slot' });
    }

    console.log(`🔔 Starting ${timeSlot} notification process...`);
    await notificationManager.sendDailyReminders(timeSlot);

    res.json({ success: true, message: `${timeSlot} notifications sent` });
  } catch (error) {
    console.error(`Error sending ${req.params.timeSlot} notifications:`, error);
    res.status(500).json({ error: 'Failed to send notifications' });
  }
});

// Test notifications endpoint (for development)
app.post('/api/test-notifications', async (req, res) => {
  try {
    console.log('🔔 Testing notification system...');
    await notificationManager.sendDailyReminders();
    res.json({ success: true, message: 'Test notifications sent' });
  } catch (error) {
    console.error('Error testing notifications:', error);
    res.status(500).json({ error: 'Failed to test notifications' });
  }
});

// Test specific time slot notifications
app.post('/api/test-notifications/:timeSlot', async (req, res) => {
  try {
    const timeSlot = req.params.timeSlot;
    const validSlots = ['morning', 'afternoon', 'evening'];

    if (!validSlots.includes(timeSlot)) {
      return res.status(400).json({ error: 'Invalid time slot' });
    }

    console.log(`🔔 Testing ${timeSlot} notification system...`);
    await notificationManager.sendDailyReminders(timeSlot);
    res.json({ success: true, message: `Test ${timeSlot} notifications sent` });
  } catch (error) {
    console.error(`Error testing ${req.params.timeSlot} notifications:`, error);
    res.status(500).json({ error: 'Failed to test notifications' });
  }
});

// Test fallback notification system
app.post('/api/trigger-fallback', async (req, res) => {
  try {
    console.log('⏰ Testing fallback notification system...');

    // Only run if it's a reasonable time
    if (notificationManager.isGoodTimeForNotification()) {
      const currentHour = notificationManager.getCurrentBerlinHour();

      let timeSlot = 'afternoon'; // default
      if (currentHour >= 9 && currentHour <= 12) timeSlot = 'morning';
      else if (currentHour >= 17 && currentHour <= 19) timeSlot = 'evening';

      console.log(`⏰ Fallback test - Time slot: ${timeSlot}`);
      await notificationManager.sendDailyReminders(timeSlot);
      res.json({ success: true, message: `Fallback test completed for ${timeSlot} slot` });
    } else {
      res.json({ success: true, message: 'Fallback test skipped - not a good time for notifications' });
    }
  } catch (error) {
    console.error('Error testing fallback notifications:', error);
    res.status(500).json({ error: 'Failed to test fallback notifications' });
  }
});

// =================================================================
// 🏋️ GENERALIZED MULTI-EXERCISE API ENDPOINTS
// =================================================================

// POST /api/exercises/:exerciseType - Add exercise count
app.post('/api/exercises/:exerciseType', async (req, res) => {
  try {
    const { exerciseType } = req.params;
    const { userId, count } = req.body;
    
    // Validate exercise type
    if (!validateExerciseType(exerciseType)) {
      return res.status(400).json({ error: 'Invalid exercise type' });
    }
    
    const table = getExerciseTable(exerciseType);
    
    // Store Berlin timezone timestamp (consistent with display)
    const result = await pool.query(
      `INSERT INTO ${table} (user_id, count, timestamp) VALUES ($1, $2, NOW() AT TIME ZONE 'Europe/Berlin') RETURNING id, user_id, count, to_char(timestamp, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as timestamp`, 
      [userId, count]
    );

    // Trigger smart notifications for significant achievements
    if (count >= 20) {
      await checkForSmartNotifications(userId, count);
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/exercises/combined/:userId/details - Get today's detailed exercise logs for modal
app.get('/api/exercises/combined/:userId/details', async (req, res) => {
  try {
    const { userId } = req.params;
    const today = getBerlinDateString();
    
    // Get detailed exercises for each type
    const promises = ['pushups', 'squats', 'situps'].map(async (exerciseType) => {
      const table = getExerciseTable(exerciseType);
      const result = await pool.query(
        `SELECT id, user_id, count, to_char(timestamp, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as timestamp 
         FROM ${table} 
         WHERE user_id = $1 AND to_char(timestamp, 'YYYY-MM-DD') = $2 
         ORDER BY timestamp DESC`, 
        [userId, today]
      );
      return {
        exercise: exerciseType,
        data: result.rows
      };
    });
    
    const exerciseData = await Promise.all(promises);
    
    // Format response as expected by frontend
    const response = {};
    exerciseData.forEach(({ exercise, data }) => {
      response[exercise] = data;
    });
    
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/calendar/:userId/date/:date - Get detailed exercise data for specific date
app.get('/api/calendar/:userId/date/:date', async (req, res) => {
  try {
    const { userId, date } = req.params;
    
    // Get detailed exercises for each type for specific date
    const promises = ['pushups', 'squats', 'situps'].map(async (exerciseType) => {
      const table = getExerciseTable(exerciseType);
      const result = await pool.query(
        `SELECT id, user_id, count, to_char(timestamp, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as timestamp 
         FROM ${table} 
         WHERE user_id = $1 AND to_char(timestamp, 'YYYY-MM-DD') = $2 
         ORDER BY timestamp ASC`, 
        [userId, date]
      );
      return {
        exercise: exerciseType,
        data: result.rows
      };
    });
    
    const exerciseData = await Promise.all(promises);
    
    // Format response as expected by frontend
    const response = {};
    exerciseData.forEach(({ exercise, data }) => {
      response[exercise] = data;
    });
    
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/exercises/combined/:userId - Get today's combined total across all exercises
app.get('/api/exercises/combined/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const today = getBerlinDateString();
    
    // Get today's total for each exercise type
    const promises = ['pushups', 'squats', 'situps'].map(async (exerciseType) => {
      const table = getExerciseTable(exerciseType);
      const result = await pool.query(
        `SELECT COALESCE(SUM(count), 0) as total 
         FROM ${table} 
         WHERE user_id = $1 AND to_char(timestamp, 'YYYY-MM-DD') = $2`, 
        [userId, today]
      );
      return {
        exercise: exerciseType,
        total: parseInt(result.rows[0].total) || 0
      };
    });
    
    const exerciseTotals = await Promise.all(promises);
    const combinedTotal = exerciseTotals.reduce((sum, ex) => sum + ex.total, 0);
    const config = getExerciseConfig();
    
    res.json({
      combinedTotal,
      dailyGoal: config.combined.defaultGoal,
      hasReachedGoal: combinedTotal >= config.combined.defaultGoal,
      breakdown: exerciseTotals.reduce((acc, ex) => {
        acc[ex.exercise] = {
          total: ex.total,
          goal: config[ex.exercise].defaultGoal,
          hasReachedGoal: ex.total >= config[ex.exercise].defaultGoal
        };
        return acc;
      }, {})
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/exercises/:exerciseType/:userId - Get today's exercises
app.get('/api/exercises/:exerciseType/:userId', async (req, res) => {
  try {
    const { exerciseType, userId } = req.params;
    
    // Validate exercise type
    if (!validateExerciseType(exerciseType)) {
      return res.status(400).json({ error: 'Invalid exercise type' });
    }
    
    const table = getExerciseTable(exerciseType);
    const today = getBerlinDateString();
    
    const result = await pool.query(
      `SELECT id, user_id, count, to_char(timestamp, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as timestamp 
       FROM ${table} 
       WHERE user_id = $1 AND to_char(timestamp, 'YYYY-MM-DD') = $2 
       ORDER BY timestamp DESC`, 
      [userId, today]
    );
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/exercises/:exerciseType/:userId/date/:date - Get exercises for specific date
app.get('/api/exercises/:exerciseType/:userId/date/:date', async (req, res) => {
  try {
    const { exerciseType, userId, date } = req.params;
    
    // Validate exercise type
    if (!validateExerciseType(exerciseType)) {
      return res.status(400).json({ error: 'Invalid exercise type' });
    }
    
    const table = getExerciseTable(exerciseType);
    
    const result = await pool.query(
      `SELECT id, user_id, count, to_char(timestamp, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as timestamp 
       FROM ${table} 
       WHERE user_id = $1 AND to_char(timestamp, 'YYYY-MM-DD') = $2 
       ORDER BY timestamp DESC`, 
      [userId, date]
    );
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/exercises/:exerciseType/:userId/total - Get total exercises
app.get('/api/exercises/:exerciseType/:userId/total', async (req, res) => {
  try {
    const { exerciseType, userId } = req.params;
    
    // Validate exercise type
    if (!validateExerciseType(exerciseType)) {
      return res.status(400).json({ error: 'Invalid exercise type' });
    }
    
    const table = getExerciseTable(exerciseType);
    
    const result = await pool.query(`SELECT SUM(count) as total FROM ${table} WHERE user_id = $1`, [userId]);
    res.json({ total: parseInt(result.rows[0].total) || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/exercises/:exerciseType/:userId/yearly-potential - Get yearly potential
app.get('/api/exercises/:exerciseType/:userId/yearly-potential', async (req, res) => {
  try {
    const { exerciseType, userId } = req.params;
    
    // Validate exercise type
    if (!validateExerciseType(exerciseType)) {
      return res.status(400).json({ error: 'Invalid exercise type' });
    }
    
    const table = getExerciseTable(exerciseType);
    const config = getExerciseConfig()[exerciseType];
    
    // Calculate yearly potential based on performance
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const daysSinceStart = Math.floor((new Date() - startOfYear) / (1000 * 60 * 60 * 24)) + 1;
    const daysInYear = new Date().getFullYear() % 4 === 0 ? 366 : 365;
    
    // Get total exercises done this year
    const yearResult = await pool.query(
      `SELECT SUM(count) as total FROM ${table} 
       WHERE user_id = $1 AND EXTRACT(YEAR FROM timestamp) = $2`, 
      [userId, new Date().getFullYear()]
    );
    
    const totalThisYear = parseInt(yearResult.rows[0].total) || 0;
    const dailyGoal = config.defaultGoal;
    const expectedTotal = daysSinceStart * dailyGoal;
    const deficit = Math.max(0, expectedTotal - totalThisYear);
    
    // Calculate remaining days in year
    const remainingDays = daysInYear - daysSinceStart;
    const dailyNeeded = remainingDays > 0 ? Math.ceil((dailyGoal * daysInYear - totalThisYear) / remainingDays) : 0;
    const yearlyPotential = totalThisYear + (remainingDays * dailyNeeded);
    
    res.json({
      yearlyPotential,
      totalThisYear,
      dailyNeeded,
      remainingDays,
      deficit,
      dailyGoal,
      daysInYear
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/calendar/:exerciseType/:userId/:year/:month - Get calendar data
app.get('/api/calendar/:exerciseType/:userId/:year/:month', async (req, res) => {
  try {
    const { exerciseType, userId, year, month } = req.params;
    
    // Validate exercise type
    if (!validateExerciseType(exerciseType)) {
      return res.status(400).json({ error: 'Invalid exercise type' });
    }
    
    const table = getExerciseTable(exerciseType);
    
    // Get the actual last day of the month
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const startDate = year + '-' + String(month).padStart(2, '0') + '-01';
    const endDate = year + '-' + String(month).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0');
    
    const result = await pool.query(`
      SELECT 
        to_char(timestamp, 'YYYY-MM-DD') as date, 
        SUM(count) as total
      FROM ${table} 
      WHERE user_id = $1 
      AND to_char(timestamp, 'YYYY-MM-DD') >= $2 
      AND to_char(timestamp, 'YYYY-MM-DD') <= $3
      GROUP BY to_char(timestamp, 'YYYY-MM-DD')
      ORDER BY to_char(timestamp, 'YYYY-MM-DD')
    `, [userId, startDate, endDate]);
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leaderboard/:exerciseType - Get leaderboard for specific exercise
app.get('/api/leaderboard/:exerciseType', async (req, res) => {
  try {
    const { exerciseType } = req.params;
    
    // Validate exercise type
    if (!validateExerciseType(exerciseType)) {
      return res.status(400).json({ error: 'Invalid exercise type' });
    }
    
    const table = getExerciseTable(exerciseType);
    const today = getBerlinDateString();
    
    const result = await pool.query(`
      SELECT 
        u.id,
        u.name,
        COALESCE(SUM(e.count), 0) as today_total
      FROM users u
      LEFT JOIN ${table} e ON u.id = e.user_id 
        AND to_char(e.timestamp, 'YYYY-MM-DD') = $1
      GROUP BY u.id, u.name
      ORDER BY today_total DESC, u.name
    `, [today]);
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leaderboard/combined - Get combined leaderboard across all exercises
app.get('/api/leaderboard/combined', async (req, res) => {
  try {
    const today = getBerlinDateString();
    
    // Get all users
    const usersResult = await pool.query('SELECT id, name FROM users ORDER BY name');
    
    // For each user, get today's total across all exercises
    const leaderboardPromises = usersResult.rows.map(async (user) => {
      const exercisePromises = ['pushups', 'squats', 'situps'].map(async (exerciseType) => {
        const table = getExerciseTable(exerciseType);
        const result = await pool.query(
          `SELECT COALESCE(SUM(count), 0) as total 
           FROM ${table} 
           WHERE user_id = $1 AND to_char(timestamp, 'YYYY-MM-DD') = $2`, 
          [user.id, today]
        );
        return parseInt(result.rows[0].total) || 0;
      });
      
      const exerciseTotals = await Promise.all(exercisePromises);
      const combinedTotal = exerciseTotals.reduce((sum, total) => sum + total, 0);
      const config = getExerciseConfig();
      
      return {
        id: user.id,
        name: user.name,
        today_total: combinedTotal,
        hasReachedGoal: combinedTotal >= config.combined.defaultGoal,
        breakdown: {
          pushups: exerciseTotals[0],
          squats: exerciseTotals[1], 
          situps: exerciseTotals[2]
        }
      };
    });
    
    const leaderboard = await Promise.all(leaderboardPromises);
    
    // Smart sorting: goal achievers by combined total (highest first), others by total
    leaderboard.sort((a, b) => {
      if (a.hasReachedGoal && b.hasReachedGoal) {
        // Both reached goal: sort by total (highest first)
        return b.today_total - a.today_total;
      } else if (a.hasReachedGoal && !b.hasReachedGoal) {
        // A reached goal, B didn't: A wins
        return -1;
      } else if (!a.hasReachedGoal && b.hasReachedGoal) {
        // B reached goal, A didn't: B wins
        return 1;
      } else {
        // Neither reached goal: sort by total (highest first)
        return b.today_total - a.today_total;
      }
    });
    
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// HTTP Server
app.listen(PORT, HOST, () => {
  console.log(`HTTP Server running on http://${HOST}:${PORT}`);
  console.log(`Local access: http://localhost:${PORT}`);
  console.log(`LAN access: http://192.168.178.196:${PORT}`);
});

// Smart notification logic - triggered when someone adds push-ups
async function checkForSmartNotifications(triggerUserId, addedCount) {
  const berlinDate = getBerlinDateString();
  // Use Intl.DateTimeFormat for consistent timezone handling
  const currentHour = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    hour: 'numeric',
    hour12: false
  }).format(new Date());
  
  console.log(`🧠 Smart notification check: User ${triggerUserId} added ${addedCount} push-ups at ${currentHour}h`);
  
  // Get today's leaderboard to understand the situation
  const leaderboard = await pool.query(`
    SELECT 
      u.id,
      u.name,
      COALESCE(SUM(p.count), 0) as total,
      COUNT(p.id) as entries,
      MIN(to_char(p.timestamp, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')) as first_entry_time
    FROM users u
    LEFT JOIN pushups p ON u.id = p.user_id 
      AND to_char(p.timestamp, 'YYYY-MM-DD') = $1
    GROUP BY u.id, u.name
    ORDER BY total DESC, first_entry_time ASC
  `, [berlinDate]);
  
  const users = leaderboard.rows;
  const triggerUser = users.find(u => u.id == triggerUserId);
  
  if (!triggerUser) return;
  
  // Determine what kind of smart notification to send
  const notifications = [];
  
  // 1. Early bird notification (5-9 AM, first to reach 100)
  if (currentHour >= 5 && currentHour <= 9 && triggerUser.total >= 100) {
    const others = users.filter(u => u.id != triggerUserId && u.total < 100);
    if (others.length > 0) {
      notifications.push({
        type: 'early_bird',
        targetUsers: others.map(u => u.id),
        message: `🌅 Wow! ${triggerUser.name} hat schon um ${currentHour} Uhr die vollen 100 erreicht! Bist du der nächste? 💪`,
        cooldown: 'early_bird_today' // Only once per day
      });
    }
  }
  
  // 2. Leadership change notification (someone takes the lead)
  const previousLeader = users[1]; // Second place
  if (triggerUser.total > 0 && previousLeader && triggerUser.total > previousLeader.total) {
    const others = users.filter(u => u.id != triggerUserId);
    notifications.push({
      type: 'leadership_change',
      targetUsers: others.map(u => u.id),
      message: `👑 ${triggerUser.name} hat die Führung übernommen mit ${triggerUser.total} Dicken! Schnell, hol dir den ersten Platz zurück! 🏃‍♂️`,
      cooldown: `leadership_change_${triggerUserId}_today` // Once per user per day
    });
  }
  
  // 3. Close race notification (gap < 20 push-ups in top 3)
  if (users.length >= 2) {
    const leader = users[0];
    const second = users[1];
    if (leader.total - second.total <= 20 && leader.total > 50) {
      notifications.push({
        type: 'close_race',
        targetUsers: [second.id],
        message: `🔥 Nur noch ${leader.total - second.total} Dicke bis zum ersten Platz! ${leader.name} ist in Reichweite! 🎯`,
        cooldown: `close_race_today` // Once per day
      });
    }
  }
  
  // 4. Lazy notification (after 12 PM, someone still at 0)
  if (currentHour >= 12) {
    const lazyUsers = users.filter(u => u.total === 0);
    const activeUsers = users.filter(u => u.total > 0);
    
    if (lazyUsers.length > 0 && activeUsers.length > 0) {
      const topUser = activeUsers[0];
      notifications.push({
        type: 'lazy_reminder',
        targetUsers: lazyUsers.map(u => u.id),
        message: `😴 ${topUser.name} ist schon bei ${topUser.total} Dicken und du pennst noch? Zeit aufzuwachen! ⏰`,
        cooldown: 'lazy_reminder_today' // Once per day
      });
    }
  }
  
  // Send notifications (with cooldown check)
  for (const notification of notifications) {
    await sendSmartNotification(notification);
  }
}

async function sendSmartNotification({ type, targetUsers, message, cooldown }) {
  // Simple cooldown check (could be improved with Redis/DB)
  const today = getBerlinDateString();
  const cooldownKey = `${cooldown}_${today}`;
  
  // Skip if we've already sent this type today (basic rate limiting)
  // For now, we'll just log and send - in production you'd store this in DB/cache
  console.log(`📱 Smart notification [${type}]: "${message}" to users: ${targetUsers.join(', ')}`);
  
  try {
    // Get subscriptions for target users
    const subscriptions = await pool.query(
      'SELECT user_id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ANY($1)',
      [targetUsers]
    );
    
    // Send to each user
    for (const subscription of subscriptions.rows) {
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth
        }
      };
      
      const payload = JSON.stringify({
        title: 'Dickerchen Challenge! 💪',
        body: message,
        icon: '/icon-192.svg',
        badge: '/icon-192.svg',
        tag: type, // Prevent duplicate notifications
        data: { type, timestamp: Date.now() }
      });
      
      try {
        await webPush.sendNotification(pushSubscription, payload);
        console.log(`✅ Smart notification sent to user ${subscription.user_id}`);
      } catch (error) {
        console.log(`❌ Failed to send smart notification to user ${subscription.user_id}:`, error.message);
      }
    }
  } catch (error) {
    console.error('❌ Smart notification failed:', error);
  }
}

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
