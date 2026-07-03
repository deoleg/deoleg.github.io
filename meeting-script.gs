// ─── Google Apps Script — paste this at script.google.com ────────────────────
// Before deploying: click "+" next to "Services" in the left sidebar,
//   find "Google Calendar API" and click Add. This enables the Calendar object.
// Deploy → New deployment → Web app
//   Execute as:  Me
//   Who has access:  Anyone
// Copy the URL and paste it into partner.html where it says REPLACE_WITH_APPS_SCRIPT_URL

const CAL_ID      = 'c7747b07eb17cb248191a9b3be9c09e3a995ec734e3fe61be1bcc4ea484c5a8e@group.calendar.google.com';
const OWNER_EMAIL = 'mr.deoleg@gmail.com';
const WORK_EMAIL  = 'oleg.dermenji@cru.md'; // shared with OWNER_EMAIL as "See all event details"
const TZ          = 'Europe/Chisinau';
const TITLE       = 'Online Meeting with the Dermenji Family';
const DURATION    = 45;   // minutes
const WIN_START   = 14;   // 14:00 Moldova
const WIN_END     = 21;   // 21:00 Moldova
const WEEKS       = 4;
const MAX_SLOTS   = 250;
const BUFFER_MS   = 15 * 60000;  // 15-min gap before/after each event

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

// Returns busy intervals.
// Queries OWNER_EMAIL (primary calendar) — it aggregates accepted events from ALL
// calendars OWNER_EMAIL owns or attends (Via Veritas, etc.). Also queries CAL_ID so
// already-booked meeting slots are excluded, and WORK_EMAIL directly — calendars
// merely shared for viewing (not owned/attended) don't feed into OWNER_EMAIL's
// own freebusy, so the work calendar has to be queried explicitly.
function getBusyIntervals(start, end) {
  const resp = Calendar.Freebusy.query({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    items:   [{ id: OWNER_EMAIL }, { id: CAL_ID }, { id: WORK_EMAIL }]
  });
  const busy = [];
  const cals = resp.calendars || {};
  for (const id in cals) {
    for (const p of (cals[id].busy || [])) {
      busy.push([new Date(p.start).getTime(), new Date(p.end).getTime()]);
    }
  }
  return busy;
}

function getSlots() {
  const now   = new Date();
  const until = new Date(now.getTime() + WEEKS * 7 * 86400000);

  // Check ALL calendars for busy time, not just the meeting calendar
  const busy = getBusyIntervals(now, until);

  const result = [];

  // Start cursor 2 hours from now, rounded down to full hour
  const cur = new Date(now);
  cur.setMinutes(0, 0, 0);
  cur.setTime(cur.getTime() + 2 * 3600000);

  while (cur < until && result.length < MAX_SLOTS) {
    const end = new Date(cur.getTime() + DURATION * 60000);

    const sh = +Utilities.formatDate(cur, TZ, 'H');
    const sm = +Utilities.formatDate(cur, TZ, 'm');
    const startMin = sh * 60 + sm;

    // Slot must start >= 14:00 and end (start + 45 min) <= 21:00 (Moldova)
    const inWindow = startMin >= WIN_START * 60 && startMin + DURATION <= WIN_END * 60;

    if (inWindow) {
      const cs = cur.getTime(), ce = end.getTime();
      // Block slot if it overlaps with any busy period INCLUDING the 15-min buffer zone
      const free = !busy.some(([bs, be]) => cs < be + BUFFER_MS && ce > bs - BUFFER_MS);
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

  // Double-check with buffer: query a wider window then apply the same ±15-min logic
  const cs = start.getTime(), ce = end.getTime();
  const allBusy = getBusyIntervals(
    new Date(cs - BUFFER_MS - 60000),
    new Date(ce + BUFFER_MS + 60000)
  );
  if (allBusy.some(([bs, be]) => cs < be + BUFFER_MS && ce > bs - BUFFER_MS)) {
    return { ok: false, conflict: true };
  }

  cal.createEvent(name, start, end, {
    description: TITLE + '\nTimezone: ' + userTz
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
