const DEFAULT_CHECKIN_REMINDER_TIME = '09:00';

function normalizeCheckinReminderTime(value) {
  if (typeof value !== 'string') return DEFAULT_CHECKIN_REMINDER_TIME;
  const match = value.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return DEFAULT_CHECKIN_REMINDER_TIME;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return DEFAULT_CHECKIN_REMINDER_TIME;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return DEFAULT_CHECKIN_REMINDER_TIME;

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function getCheckinReminderPreference(userInfo = {}) {
  return {
    enabled: userInfo.checkinReminderEnabled !== false,
    time: normalizeCheckinReminderTime(userInfo.checkinReminderTime)
  };
}

function buildCheckinReminderUpdate(enabled, time) {
  return {
    checkinReminderEnabled: enabled !== false,
    checkinReminderTime: normalizeCheckinReminderTime(time)
  };
}

function getCheckinReminderSummary(userInfo = {}) {
  const preference = getCheckinReminderPreference(userInfo);
  return preference.enabled ? `${preference.time} 提醒` : '未开启';
}

export {
  DEFAULT_CHECKIN_REMINDER_TIME,
  normalizeCheckinReminderTime,
  getCheckinReminderPreference,
  buildCheckinReminderUpdate,
  getCheckinReminderSummary
};
