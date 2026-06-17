// ─── Google Apps Script — paste this at script.google.com ────────────────────
// Deploy → New deployment → Web app
//   Execute as:  Me
//   Who has access:  Anyone
// Copy the URL and paste it into partner.html where it says REPLACE_WITH_APPS_SCRIPT_URL

const CAL_ID      = 'c7747b07eb17cb248191a9b3be9c09e3a995ec734e3fe61be1bcc4ea484c5a8e@group.calendar.google.com';
const OWNER_EMAIL = 'mr.deoleg@gmail.com';
const TZ          = 'Europe/Chisinau';
const TITLE       = 'Online Meeting with the Dermenji Family';
const DURATION    = 45;   // minutes
const WIN_START   = 14;   // 14:00 Moldova
const WIN_END     = 21;   // 21:00 Moldova
const WEEKS       = 4;
const MAX_SLOTS   = 20;

function doGet(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  try {
    if (p.action === 'book') {
      return respond(book(p.name, p.start, p.tz || 'UTC'));
    }
    return respond(getSlots());
  } catch (err) {
    return respond({ ok: false, error: err.message });
  }
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSlots() {
  const cal   = CalendarApp.getCalendarById(CAL_ID);
  const now   = new Date();
  const until = new Date(now.getTime() + WEEKS * 7 * 86400000);

  // Fetch all events once, build busy intervals
  const busy = cal.getEvents(now, until).map(ev => [
    ev.getStartTime().getTime(),
    ev.getEndTime().getTime()
  ]);

  const result = [];

  // Start cursor 2 hours from now, rounded down to full hour
  const cur = new Date(now);
  cur.setMinutes(0, 0, 0);
  cur.setTime(cur.getTime() + 2 * 3600000);

  while (cur < until && result.length < MAX_SLOTS) {
    const end = new Date(cur.getTime() + DURATION * 60000);

    const sh = +Utilities.formatDate(cur, TZ, 'H');
    const eh = +Utilities.formatDate(end, TZ, 'H');
    const em = +Utilities.formatDate(end, TZ, 'm');

    // Slot must start >= 14:00 and end <= 21:00 (Moldova)
    const inWindow = sh >= WIN_START && (eh < WIN_END || (eh === WIN_END && em === 0));

    if (inWindow) {
      const cs = cur.getTime(), ce = end.getTime();
      const free = !busy.some(([bs, be]) => cs < be && ce > bs);
      if (free) result.push({ start: cur.toISOString(), end: end.toISOString() });
    }

    cur.setTime(cur.getTime() + DURATION * 60000);
  }

  return { ok: true, slots: result };
}

function book(name, startISO, userTz) {
  const cal   = CalendarApp.getCalendarById(CAL_ID);
  const start = new Date(startISO);
  const end   = new Date(start.getTime() + DURATION * 60000);

  // Double-check slot is still free
  if (cal.getEvents(start, end).length > 0) {
    return { ok: false, conflict: true };
  }

  cal.createEvent(TITLE + ' — ' + name, start, end, {
    description: 'Booked by: ' + name + '\nTimezone: ' + userTz
  });

  const when = Utilities.formatDate(start, TZ, 'EEEE, MMMM d, yyyy · HH:mm') + ' (Moldova)';

  MailApp.sendEmail({
    to: OWNER_EMAIL,
    subject: '📅 New meeting — ' + name,
    body: [
      'New meeting booked!',
      '',
      'Name: '    + name,
      'Time: '    + when,
      'Timezone: '+ userTz,
      '',
      'The event has been added to your Google Calendar.'
    ].join('\n')
  });

  return { ok: true };
}
