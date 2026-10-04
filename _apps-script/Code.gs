/**
 * Studio Fritz website forms -> Google Sheet + email.
 * Bound to the sheet: open the sheet, Extensions > Apps Script, paste this in.
 * Handles: newsletter sign-ups, Contact + product "Inquire" pop-ups, Trade.
 */
const NOTIFY_TO = 'contact@studiofritz.co';
const TABS = { newsletter: 'Newsletter', inquiry: 'Inquiries', trade: 'Trade' };
const COLUMN_ORDER = ['name', 'email', 'company', 'items', 'message', 'project', 'designer', 'page'];

function doGet() {
  return json_({ ok: true, service: 'Studio Fritz forms' });
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.website) return json_({ ok: true });              // honeypot: bots filled the hidden field; pretend success, store nothing
    if (!TABS[d.type]) return json_({ ok: false, error: 'unknown form' });

    const data = {};
    Object.keys(d).forEach(function (k) {
      if (k !== 'website') data[k] = String(d[k]).slice(0, 5000);
    });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '')) return json_({ ok: false, error: 'email' });

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try { saveRow_(TABS[d.type], data); } finally { lock.release(); }

    notify_(d.type, data);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function saveRow_(tabName, data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(tabName) || ss.insertSheet(tabName);
  if (sheet.getLastRow() === 0) sheet.appendRow(['Timestamp']);

  let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const keys = Object.keys(data).filter(function (k) { return k !== 'type'; });
  keys.sort(function (a, b) {
    const ia = COLUMN_ORDER.indexOf(a), ib = COLUMN_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  keys.forEach(function (k) {                               // new field on the form -> new column, automatically
    if (headers.indexOf(k) < 0) {
      sheet.getRange(1, headers.length + 1).setValue(k);
      headers.push(k);
    }
  });
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

  const row = headers.map(function (h) {
    if (h === 'Timestamp') return new Date();
    const v = data[h] || '';
    return /^[=+\-@]/.test(v) ? "'" + v : v;                // stop a typed "=..." becoming a live formula
  });
  sheet.appendRow(row);
}

function notify_(type, d) {
  const name = oneLine_(d.name), company = oneLine_(d.company);
  let subject;
  if (type === 'trade') subject = 'Trade | Studio Fritz x ' + name + (company ? ', ' + company : '');
  else if (type === 'inquiry') subject = 'Inquiry | Studio Fritz x ' + name + (company ? ', ' + company : '');
  else subject = 'Newsletter signup | ' + oneLine_(d.email);

  const labels = { name: 'Name', email: 'Email', company: 'Company', items: 'Item(s) of interest', message: 'Message',
                   project: 'Project', designer: 'Showroom / designer', page: 'Submitted from' };
  const lines = Object.keys(d).filter(function (k) { return k !== 'type'; }).map(function (k) {
    return (labels[k] || k) + ': ' + d[k];
  });

  MailApp.sendEmail({
    to: NOTIFY_TO,
    subject: subject,
    body: lines.join('\n\n'),
    replyTo: d.email,                                       // Reply in Gmail goes straight to the person who wrote in
    name: 'Studio Fritz website'
  });
}

function oneLine_(s) { return String(s || '').replace(/[\r\n]+/g, ' ').trim(); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/** Run once from the editor (Run > testInquiry) to grant permissions and check the sheet + email. */
function testInquiry() {
  const r = doPost({ postData: { contents: JSON.stringify({
    type: 'inquiry', name: 'Test Person', email: 'test@example.com', company: 'Test Co',
    items: 'Westlake Table', message: 'Test message from the editor', page: '/contact' }) } });
  Logger.log(r.getContent());
}
