import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getOpenItems } from './db/database';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Ask for permission (iOS requires this explicitly; Android 13+ too).
 * Call once on app startup.
 */
export async function registerForNotificationsAsync() {
  if (!Device.isDevice) {
    console.warn('Notifications need a physical device or a proper simulator.');
    return false;
  }
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.warn('Notification permission was not granted.');
    return false;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  return true;
}

/**
 * Schedules a recurring daily prompt to rate H.W.P.L.
 * hour/minute are in the device's local time, 24h format.
 */
export async function scheduleDailyRatingReminder(hour = 20, minute = 0) {
  await Notifications.cancelScheduledNotificationAsync('daily-hwpl-rating').catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: 'daily-hwpl-rating',
    content: {
      title: 'Rate your day',
      body: 'How was your day?',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelDailyRatingReminder() {
  await Notifications.cancelScheduledNotificationAsync('daily-hwpl-rating').catch(() => {});
}

/**
 * Schedules a recurring Wednesday reminder that lists outstanding items.
 * Because the body needs live data (open items), this re-schedules a
 * fresh notification each time the app is opened, aimed at the next
 * Wednesday, rather than relying on a single static repeating body.
 */
export async function scheduleMidweekReminder(hour = 9, minute = 0) {
  await Notifications.cancelScheduledNotificationAsync('midweek-reminder').catch(() => {});

  const items = await getOpenItems();
  const withDeadline = items.filter((i) => i.deadline);
  const body =
    items.length === 0
      ? 'No outstanding items — nice.'
      : `You have ${items.length} outstanding item${items.length > 1 ? 's' : ''}` +
        (withDeadline.length > 0 ? `, ${withDeadline.length} with a deadline.` : '.');

  const nextWednesday = getNextWeekday(3, hour, minute); // 3 = Wednesday

  await Notifications.scheduleNotificationAsync({
    identifier: 'midweek-reminder',
    content: { title: 'Midweek check-in', body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: nextWednesday,
    },
  });
}

function getNextWeekday(targetDay, hour, minute) {
  const now = new Date();
  const result = new Date(now);
  result.setHours(hour, minute, 0, 0);
  let daysUntil = (targetDay - now.getDay() + 7) % 7;
  if (daysUntil === 0 && result <= now) daysUntil = 7;
  result.setDate(now.getDate() + daysUntil);
  return result;
}
