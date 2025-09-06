const { Pool } = require('pg');
const webPush = require('web-push');

// PostgreSQL connection
const pool = new Pool(
  process.env.DATABASE_URL ? {
    connectionString: process.env.DATABASE_URL,
    ssl: false
  } : {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'dickerchen',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
  }
);

class NotificationManager {
  constructor() {
    this.dailyGoal = 100;
    this.maxNotificationHour = 19; // Don't send after 7 PM
    this.notificationHistory = new Map(); // Track sent notifications per user
  }

  // Get Berlin timezone date string
  getBerlinDateString(date = new Date()) {
    const berlinDate = new Date(date.toLocaleString("en-US", {timeZone: "Europe/Berlin"}));
    return berlinDate.getFullYear() + '-' +
           String(berlinDate.getMonth() + 1).padStart(2, '0') + '-' +
           String(berlinDate.getDate()).padStart(2, '0');
  }

  // Get current Berlin hour
  getCurrentBerlinHour() {
    const now = new Date();
    const berlinTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Berlin"}));
    return berlinTime.getHours();
  }

  // Check if it's a good time to send notifications
  isGoodTimeForNotification() {
    const currentHour = this.getCurrentBerlinHour();
    return currentHour >= 8 && currentHour <= this.maxNotificationHour; // 8 AM to 7 PM
  }

  // Get user category based on activity
  getUserCategory(user) {
    const daysActive = user.first_pushup_date ?
      Math.floor((new Date() - new Date(user.first_pushup_date)) / (1000 * 60 * 60 * 24)) : 0;

    if (daysActive < 7) return 'new'; // New users
    if (user.total_all_time > 1000) return 'advanced'; // Very active users
    if (user.today_total > 50) return 'active'; // Today's active users
    return 'casual'; // Casual users
  }

  // Get users who need notifications based on time of day
  async getUsersNeedingNotifications(timeSlot = 'afternoon') {
    const today = this.getBerlinDateString();

    // Smart criteria based on time slot - more flexible
    const timeCriteria = {
      morning: 'AND COALESCE(SUM(CASE WHEN DATE(p.timestamp AT TIME ZONE \'UTC\' AT TIME ZONE \'Europe/Berlin\') = $1 THEN p.count END), 0) = 0',
      afternoon: 'AND COALESCE(SUM(CASE WHEN DATE(p.timestamp AT TIME ZONE \'UTC\' AT TIME ZONE \'Europe/Berlin\') = $1 THEN p.count END), 0) < 50',
      evening: 'AND COALESCE(SUM(CASE WHEN DATE(p.timestamp AT TIME ZONE \'UTC\' AT TIME ZONE \'Europe/Berlin\') = $1 THEN p.count END), 0) BETWEEN 40 AND 90'
    };

    const query = `
      SELECT
        u.id,
        u.name,
        COALESCE(SUM(CASE WHEN DATE(p.timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin') = $1 THEN p.count END), 0) as today_total,
        COALESCE(SUM(p.count), 0) as total_all_time,
        MIN(DATE(p.timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin')) as first_pushup_date
      FROM users u
      LEFT JOIN pushups p ON u.id = p.user_id
      GROUP BY u.id, u.name
      HAVING COALESCE(SUM(p.count), 0) > 0
      ${timeCriteria[timeSlot] || timeCriteria.afternoon}
      ORDER BY RANDOM() -- Randomize order to avoid always notifying same users first
    `;

    const result = await pool.query(query, [today]);

    // Apply smart filtering with randomization
    const filteredUsers = result.rows
      .filter(user => {
        const userHistory = this.notificationHistory.get(user.id) || [];
        const todayNotifications = userHistory.filter(n =>
          n.date === today && n.timeSlot === timeSlot
        );
        return todayNotifications.length < this.getMaxNotificationsPerSlot(user);
      })
      .slice(0, Math.floor(Math.random() * 8) + 3); // Random number between 3-10 users per batch

    return filteredUsers;
  }

  // Get maximum notifications per time slot for user category
  getMaxNotificationsPerSlot(user) {
    const category = this.getUserCategory(user);
    const limits = {
      new: 1,      // New users: max 1 per slot
      casual: 1,   // Casual users: max 1 per slot
      active: 2,   // Active users: max 2 per slot
      advanced: 3  // Advanced users: max 3 per slot
    };
    return limits[category] || 1;
  }

  // Track notification in history
  trackNotification(userId, message, timeSlot) {
    const today = this.getBerlinDateString();
    if (!this.notificationHistory.has(userId)) {
      this.notificationHistory.set(userId, []);
    }

    const userHistory = this.notificationHistory.get(userId);
    userHistory.push({
      date: today,
      timeSlot: timeSlot,
      message: message,
      timestamp: new Date()
    });

    // Keep only last 7 days of history
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    this.notificationHistory.set(userId,
      userHistory.filter(n => new Date(n.timestamp) > weekAgo)
    );
  }

  // Generate personalized notification message
  generateNotificationMessage(user, timeSlot = 'afternoon') {
    const category = this.getUserCategory(user);
    const userHistory = this.notificationHistory.get(user.id) || [];
    const sentMessages = userHistory.map(n => n.message);

    const messageSets = {
      new: {
        morning: [
          `Guten Morgen ${user.name}! Start in den Tag mit deinen Dicken! 🌅`,
          `${user.name}, der Tag beginnt - Zeit für Push-ups! 💪`
        ],
        afternoon: [
          `Hey ${user.name}! Nachmittag ist Push-up Zeit! 🏋️‍♂️`,
          `${user.name}, mach deine Dicken bevor der Tag vorbei ist! 🔥`
        ],
        evening: [
          `Noch schnell ${user.name}! Ein paar Dicken vor dem Feierabend! ⚡`,
          `${user.name}, Abendroutine: Push-ups nicht vergessen! 🌙`
        ]
      },
      casual: {
        morning: [
          `Morgen ${user.name}! Deine täglichen Dicken warten! 🌞`,
          `${user.name}, beginne den Tag stark mit Push-ups! 💪`
        ],
        afternoon: [
          `Hey ${user.name}! Zeit für deine Push-up Challenge! 🏆`,
          `${user.name}, nachmittags Push-ups machen glücklich! 😊`
        ],
        evening: [
          `${user.name}, der Tag neigt sich - Dicken-Time! 🌅`,
          `Abend-Reminder ${user.name}: Push-ups! �`
        ]
      },
      active: {
        morning: [
          `Guten Morgen ${user.name}! Du schaffst das heute wieder! 🚀`,
          `${user.name}, starte durch mit deinen Dicken! 🔥`
        ],
        afternoon: [
          `Hey ${user.name}! Du bist bei ${user.today_total} - weiter so! 💪`,
          `${user.name}, du machst das super! Mehr Dicken? 🏋️‍♂️`
        ],
        evening: [
          `Fast geschafft ${user.name}! Nur noch ${this.dailyGoal - user.today_total} bis zum Ziel! 🎯`,
          `${user.name}, du bist so nah dran! Gib alles! ⚡`
        ]
      },
      advanced: {
        morning: [
          `Morgen Champion ${user.name}! Bereit für neue Rekorde? 🏆`,
          `${user.name}, du weißt wie's geht - los geht's! 💪`
        ],
        afternoon: [
          `Hey ${user.name}! Bei ${user.today_total} Dicken - machst du weiter? �`,
          `${user.name}, du bist eine Push-up Maschine! 🔥`
        ],
        evening: [
          `Wow ${user.name}! ${user.today_total} Dicken heute - Wahnsinn! 🏆`,
          `${user.name}, du dominierst! Mehr als ${this.dailyGoal}? �`
        ]
      }
    };

    const availableMessages = messageSets[category]?.[timeSlot] || messageSets.casual[timeSlot];
    const unusedMessages = availableMessages.filter(msg => !sentMessages.includes(msg));

    // If all messages used, reset and use any message
    const messagesToChoose = unusedMessages.length > 0 ? unusedMessages : availableMessages;

    return messagesToChoose[Math.floor(Math.random() * messagesToChoose.length)];
  }

  // Send notification to user
  async sendNotificationToUser(userId, title, body) {
    try {
      // Get user's push subscriptions
      const subscriptions = await pool.query(
        'SELECT subscription FROM push_subscriptions WHERE user_id = $1',
        [userId]
      );

      if (subscriptions.rows.length === 0) {
        console.log(`No push subscriptions found for user ${userId}`);
        return false;
      }

      let successCount = 0;
      for (const row of subscriptions.rows) {
        try {
          const subscription = row.subscription;
          await webPush.sendNotification(subscription, JSON.stringify({
            title: title,
            body: body,
            icon: '/icon-192.svg',
            badge: '/icon-192.svg',
            data: { userId: userId }
          }));
          successCount++;
        } catch (error) {
          console.log(`Failed to send notification to user ${userId}:`, error.message);
          // Remove invalid subscriptions
          if (error.statusCode === 410) {
            await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1 AND subscription = $2', [userId, row.subscription]);
          }
        }
      }

      return successCount > 0;
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  }

  // Main method to send daily reminders
  async sendDailyReminders(timeSlot = 'afternoon') {
    if (!this.isGoodTimeForNotification()) {
      console.log('Not a good time for notifications');
      return;
    }

    console.log(`🔔 Sending ${timeSlot} notifications...`);

    try {
      // Get users needing notifications for this time slot
      const usersNeedingNotifications = await this.getUsersNeedingNotifications(timeSlot);
      console.log(`Found ${usersNeedingNotifications.length} users needing ${timeSlot} notifications`);

      // Send notifications with random delays to avoid spam
      const notifications = [];
      for (let i = 0; i < usersNeedingNotifications.length; i++) {
        const user = usersNeedingNotifications[i];
        const delay = Math.random() * 30000; // Random delay up to 30 seconds

        const notificationPromise = new Promise(async (resolve) => {
          setTimeout(async () => {
            const message = this.generateNotificationMessage(user, timeSlot);
            const success = await this.sendNotificationToUser(user.id, this.getNotificationTitle(timeSlot), message);

            if (success) {
              this.trackNotification(user.id, message, timeSlot);
              console.log(`✅ Sent ${timeSlot} notification to ${user.name} (${this.getUserCategory(user)})`);
            }
            resolve();
          }, delay);
        });

        notifications.push(notificationPromise);
      }

      // Wait for all notifications to be sent
      await Promise.all(notifications);

      // Send special encouragement to users close to goal (only in afternoon/evening)
      if (timeSlot === 'afternoon' || timeSlot === 'evening') {
        const usersCloseToGoal = await this.getUsersCloseToGoal();
        console.log(`Found ${usersCloseToGoal.length} users close to goal`);

        const goalNotifications = [];
        for (let i = 0; i < usersCloseToGoal.length; i++) {
          const user = usersCloseToGoal[i];
          const delay = Math.random() * 20000; // Shorter delay for goal notifications

          const notificationPromise = new Promise(async (resolve) => {
            setTimeout(async () => {
              const message = this.generateNotificationMessage(user, 'closeToGoal');
              const success = await this.sendNotificationToUser(user.id, 'Fast geschafft! 🎯', message);

              if (success) {
                this.trackNotification(user.id, message, timeSlot);
                console.log(`🎯 Sent goal encouragement to ${user.name}`);
              }
              resolve();
            }, delay);
          });

          goalNotifications.push(notificationPromise);
        }

        await Promise.all(goalNotifications);
      }

      console.log(`✅ ${timeSlot} notifications completed`);
    } catch (error) {
      console.error(`❌ Error sending ${timeSlot} notifications:`, error);
    }
  }

  // Get notification title based on time slot
  getNotificationTitle(timeSlot) {
    const titles = {
      morning: 'Guten Morgen! 🌅',
      afternoon: 'Dickerchen Erinnerung! 💪',
      evening: 'Letzte Chance! 🌙'
    };
    return titles[timeSlot] || 'Dickerchen! 💪';
  }

  // Wake up the server (for Fly.io)
  async wakeUpServer() {
    try {
      const response = await fetch(`${process.env.APP_URL || 'http://localhost:3001'}/api/test`);
      if (response.ok) {
        console.log('✅ Server is awake');
        return true;
      }
    } catch (error) {
      console.log('❌ Failed to wake up server:', error.message);
    }
    return false;
  }
}

module.exports = NotificationManager;
