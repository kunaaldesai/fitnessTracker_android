import * as Notifications from 'expo-notifications';
import { Platform, Vibration } from 'react-native';

export type WorkoutTimerAlertMode = 'vibrate' | 'sound' | 'both';

const TIMER_CHANNELS: Record<WorkoutTimerAlertMode, string> = {
  vibrate: 'workout-timer-vibrate',
  sound: 'workout-timer-sound',
  both: 'workout-timer-both',
};

const TIMER_VIBRATION_PATTERN = [0, 450, 180, 450, 180, 650];
let notificationsConfigured = false;

function shouldUseSound(alertMode: WorkoutTimerAlertMode) {
  return alertMode === 'sound' || alertMode === 'both';
}

function shouldUseVibration(alertMode: WorkoutTimerAlertMode) {
  return alertMode === 'vibrate' || alertMode === 'both';
}

function channelForAlertMode(alertMode: WorkoutTimerAlertMode) {
  return TIMER_CHANNELS[alertMode] || TIMER_CHANNELS.vibrate;
}

export function configureWorkoutTimerNotifications() {
  if (notificationsConfigured) return;
  notificationsConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const timerSound = notification.request.content.data?.timerSound === true;
      return {
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: timerSound,
        shouldSetBadge: false,
      };
    },
  });
  setupWorkoutTimerNotificationChannels().catch(() => undefined);
}

export async function setupWorkoutTimerNotificationChannels() {
  if (Platform.OS !== 'android') return;
  await Promise.all([
    Notifications.setNotificationChannelAsync(TIMER_CHANNELS.vibrate, {
      name: 'Rest timer vibration',
      importance: Notifications.AndroidImportance.HIGH,
      enableVibrate: true,
      vibrationPattern: TIMER_VIBRATION_PATTERN,
      sound: null,
      showBadge: false,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }),
    Notifications.setNotificationChannelAsync(TIMER_CHANNELS.sound, {
      name: 'Rest timer chime',
      importance: Notifications.AndroidImportance.HIGH,
      enableVibrate: false,
      sound: 'default',
      showBadge: false,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }),
    Notifications.setNotificationChannelAsync(TIMER_CHANNELS.both, {
      name: 'Rest timer chime and vibration',
      importance: Notifications.AndroidImportance.HIGH,
      enableVibrate: true,
      vibrationPattern: TIMER_VIBRATION_PATTERN,
      sound: 'default',
      showBadge: false,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }),
  ]);
}

export async function ensureWorkoutTimerNotificationPermission() {
  configureWorkoutTimerNotifications();
  await setupWorkoutTimerNotificationChannels();
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowSound: true,
      allowBadge: false,
    },
  });
  return requested.granted;
}

export async function scheduleWorkoutTimerNotification({
  seconds,
  alertMode,
}: {
  seconds: number;
  alertMode: WorkoutTimerAlertMode;
}) {
  configureWorkoutTimerNotifications();
  await setupWorkoutTimerNotificationChannels();
  const channelId = channelForAlertMode(alertMode);
  const useSound = shouldUseSound(alertMode);
  const useVibration = shouldUseVibration(alertMode);
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Rest timer done',
      body: 'Time for your next set.',
      sound: useSound ? 'default' : false,
      vibrate: useVibration ? TIMER_VIBRATION_PATTERN : undefined,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      data: {
        kind: 'workoutTimer',
        timerSound: useSound,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, Math.ceil(seconds)),
      repeats: false,
      channelId,
    },
  });
}

export async function cancelWorkoutTimerNotification(notificationId?: string | null) {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => undefined);
}

export async function triggerWorkoutTimerForegroundAlert(alertMode: WorkoutTimerAlertMode) {
  configureWorkoutTimerNotifications();
  if (shouldUseVibration(alertMode)) {
    Vibration.vibrate(TIMER_VIBRATION_PATTERN);
  }
  if (!shouldUseSound(alertMode)) return;
  const channelId = channelForAlertMode(alertMode);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Rest timer done',
      body: 'Time for your next set.',
      sound: 'default',
      vibrate: shouldUseVibration(alertMode) ? TIMER_VIBRATION_PATTERN : undefined,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      data: {
        kind: 'workoutTimer',
        timerSound: true,
      },
    },
    trigger: Platform.OS === 'android' ? { channelId } : null,
  }).catch(() => undefined);
}
