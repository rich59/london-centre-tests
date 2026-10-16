/* London Centre Tests – email step on the start page, automatic saving and emailing of results.
   Shared by all four tests (desktop app + browser). Settings come from config.json (see EMAIL-SETUP.md).
   Needs window.LCT_TEST = {key, name, parent} and window.LCT_CONFIG_DEFAULT (both added by scripts/build-tests.py). */
(function () {
  'use strict';
  if (window.__lctResults) return; window.__lctResults = true;
  var T = window.LCT_TEST || { key: 'test', name: document.title, parent: false };
  var DEF = window.LCT_CONFIG_DEFAULT || {};
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var EMAIL_RE = /^[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]{2,}$/;
  var validEmail = function (v) { v = String(v || '').trim(); return v.length <= 254 && EMAIL_RE.test(v); };

  // ---------- styles ----------
  var css = document.createElement('style');
  css.textContent = '.lct-step{border:4px solid #C8102E;border-radius:20px;background:#fff;padding:12px 16px;margin:12px 0 16px;box-shadow:0 4px 0 #7a0a1c}' +
    '.lct-step h3{margin:0 0 4px;font-size:22px;color:#C8102E}.lct-step .lct-th{font-family:Sarabun,Tahoma,"Leelawadee UI",Thonburi,sans-serif;font-size:16px;color:#26324f;line-height:1.6}' +
    '.lct-step p{margin:8px 0}.lct-step input[type=email]{font:inherit;font-size:21px;padding:10px;border:3px solid #012169;border-radius:14px;width:100%;max-width:460px;color:#012169;background:#fff}' +
    '.lct-step input.lct-bad{border-color:#c62828;background:#fff5f5}.lct-err{color:#c62828;font-weight:bold;font-size:16px;min-height:1px}.lct-note{font-size:15px;color:#3d4a6b}' +
    '.lct-send{border:4px solid #012169;border-radius:20px;background:#fff;padding:14px 18px;margin:0 0 16px;box-shadow:0 5px 0 #012169}' +
    '.lct-send h3{margin:0 0 8px}.lct-line{font-size:17px;margin:6px 0;line-height:1.5}.lct-line .th{font-family:Sarabun,Tahoma,"Leelawadee UI",sans-serif;font-size:15px;color:#3d4a6b;display:block}' +
    '.lct-ok{color:#137a2e;font-weight:bold}.lct-no{color:#c62828;font-weight:bold}.lct-wait{color:#9a6b00;font-weight:bold}' +
    '.lct-send button{font:inherit;font-size:16px;font-weight:600;border:none;border-radius:12px;padding:8px 14px;margin:4px 6px 0 0;background:#012169;color:#fff;cursor:pointer}' +
    '.lct-send button.red{background:#C8102E}@media print{.lct-send{display:none!important}}';
  document.head.appendChild(css);

  // ---------- start page: name + email step ----------
  function addStep() {
    var sname = $('sname'), start = $('start'); if (!sname || !start || $('lctEmail')) return;
    var p = sname.closest('p') || sname.parentNode;
    var box = document.createElement('div'); box.className = 'lct-step'; box.id = 'lctStep';
    var who = T.parent ? "Parent's email" : "Student's email", whoTH = T.parent ? 'อีเมลของผู้ปกครอง' : 'อีเมลของผู้เรียน';
    var school = (DEF.schoolEmail || 'london-english@live.com');
    box.innerHTML = '<h3>Step 1 – Name and email</h3><div class="lct-th">ขั้นตอนที่ 1 – กรอกชื่อและอีเมลก่อนเริ่มทำแบบทดสอบ</div>';
    p.parentNode.insertBefore(box, p); box.appendChild(p);
    var e = document.createElement('p');
    e.innerHTML = '<label style="font-size:20px">' + who + ' <span class="lct-th">(' + whoTH + ')</span><br>' +
      '<input type="email" id="lctEmail" autocomplete="email" inputmode="email" placeholder="e.g. name@gmail.com" required></label>' +
      '<div class="lct-err" id="lctEmailErr" role="alert"></div>' +
      '<div class="lct-note">The results are saved and emailed automatically to this address and to the school (' + esc(school) + ') when the test is finished.</div>' +
      '<div class="lct-th">เมื่อทำแบบทดสอบเสร็จ ระบบจะบันทึกผลและส่งผลสอบทางอีเมลไปยังอีเมลนี้และอีเมลของโรงเรียนโดยอัตโนมัติ</div>';
    box.appendChild(e);
    var inp = $('lctEmail');
    inp.addEventListener('input', function () { if (validEmail(inp.value)) { inp.classList.remove('lct-bad'); $('lctEmailErr').textContent = ''; } });
    // runs before the test's own Start handler (capture phase on document)
    document.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest && ev.target.closest('#startBtn'); if (!b) return;
      if (!$('sname').value.trim()) return;               // the test itself asks for the name
      if (!validEmail(inp.value)) {
        ev.stopImmediatePropagation(); ev.preventDefault();
        inp.classList.add('lct-bad');
        $('lctEmailErr').innerHTML = (inp.value.trim() ? 'Please check the email address – e.g. name@gmail.com' : 'Please type the ' + (T.parent ? "parent's" : "student's") + ' email address – e.g. name@gmail.com') +
          '<br><span class="lct-th">กรุณากรอกอีเมลให้ถูกต้อง เช่น name@gmail.com</span>';
        inp.focus(); try { inp.scrollIntoView({ block: 'center' }); } catch (_) {}
      }
    }, true);
  }

  // ---------- result summary (adapters for the four tests) ----------
  function getR() { try { return typeof R !== 'undefined' ? R : null; } catch (_) { return null; } }
  function asText(x) { if (Array.isArray(x)) return x.map(function (p) { return Array.isArray(p) ? p[0] + ': ' + p[1] : String(p); }).join('\n'); return String(x || ''); }
  function num(x) { return Math.round(x * 10) / 10; }
  function summary(r) {
    var s = { score: '', level: '', sections: [] };
    if (T.key === 'phonics') { s.score = r.score + ' / ' + r.out_of; s.level = r.placement; }
    else if (T.key === 'kids') { s.score = num(r.total_provisional) + ' / ' + r.out_of; s.level = r.placement; }
    else { s.score = num(r.total) + ' / 100'; s.level = 'CEFR ' + r.cefr + (r.provisional ? ' (provisional)' : ''); }
    (r.sections || []).forEach(function (x) {
      s.sections.push({ name: x.section, questions: x.questions || '', score: (x.included === false ? 'not auto-scored' : num(x.score) + ' / ' + x.out_of) });
    });
    s.en = asText(r.teacher_report); s.th = asText(r.teacher_report_th);
    return s;
  }
  function paras(t) {
    return String(t || '').split(/\n+/).filter(Boolean).map(function (l) {
      var m = l.match(/^([^:]{2,40}):\s(.*)$/); return '<p style="margin:0 0 8px">' + (m ? '<b>' + esc(m[1]) + ':</b> ' + esc(m[2]) : esc(l)) + '</p>';
    }).join('');
  }
  function emailHTML(r, s, email, school) {
    var d = new Date(r.date || Date.now());
    var when = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    var rows = s.sections.map(function (x) { return '<tr><td style="border:1px solid #c9d1e6;padding:4px 8px">' + esc(x.name) + '</td><td style="border:1px solid #c9d1e6;padding:4px 8px">' + esc(x.questions) + '</td><td style="border:1px solid #c9d1e6;padding:4px 8px"><b>' + esc(x.score) + '</b></td></tr>'; }).join('');
    return '<div style="font-family:Segoe UI,Arial,sans-serif;color:#012169;max-width:720px">' +
      '<div style="background:#C8102E;color:#fff;padding:12px 16px;border-bottom:5px solid #012169"><div style="font-size:18px;font-weight:bold">' + esc(school) + '</div><div style="font-size:15px">' + esc(T.name) + '</div></div>' +
      '<div style="padding:12px 16px;border:1px solid #c9d1e6;border-top:none">' +
      '<p style="margin:0 0 6px"><b>Student / ผู้เรียน:</b> ' + esc(r.student && r.student.name) + '<br><b>Email:</b> ' + esc(email) + '<br><b>Date / วันที่:</b> ' + esc(when) + '</p>' +
      '<p style="font-size:26px;color:#C8102E;font-weight:bold;margin:10px 0 2px">' + esc(s.score) + '</p>' +
      '<p style="font-size:20px;margin:0 0 10px;background:#012169;color:#fff;padding:6px 10px;border-radius:8px;display:inline-block">' + esc(s.level) + '</p>' +
      '<h3 style="margin:12px 0 6px">Section scores / คะแนนรายส่วน</h3><table style="border-collapse:collapse;font-size:14px"><tr style="background:#012169;color:#fff"><th style="padding:4px 8px;text-align:left">Section</th><th style="padding:4px 8px;text-align:left">Questions</th><th style="padding:4px 8px;text-align:left">Score</th></tr>' + rows + '</table>' +
      '<h3 style="margin:14px 0 6px">Report (English)</h3><div style="font-size:14px;line-height:1.5">' + paras(s.en) + '</div>' +
      '<h3 style="margin:14px 0 6px">รายงานผล (ภาษาไทย)</h3><div style="font-size:15px;line-height:1.7;font-family:Sarabun,Tahoma,Leelawadee UI,sans-serif">' + paras(s.th) + '</div>' +
      '<p style="font-size:12px;color:#55617d;margin-top:14px">Indicative in-school placement only – not an official certificate. / ผลนี้เป็นการประเมินเพื่อจัดระดับชั้นเรียนเท่านั้น ไม่ใช่ใบรับรองอย่างเป็นทางการ</p></div></div>';
  }
  function stamp(d) { var p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()); }
  function safeName(n) { return String(n || 'student').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/\s+/g, '_').replace(/^[._]+|[._]+$/g, '').slice(0, 40) || 'student'; }

  // ---------- config (inline default → ../config.json → live config on GitHub Pages) ----------
  function configured(c) { var e = c && c.emailjs; return !!(e && e.serviceId && e.templateId && e.publicKey && !/^YOUR_/.test(e.serviceId + e.templateId + e.publicKey) && !/YOUR_/.test(e.serviceId + e.templateId + e.publicKey)); }
  function fetchJSON(u, ms) {
    var ctl = window.AbortController ? new AbortController() : null; var t = setTimeout(function () { if (ctl) ctl.abort(); }, ms || 5000);
    return fetch(u, { cache: 'no-store', signal: ctl ? ctl.signal : undefined }).then(function (r) { clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  function getConfig() {
    var c = DEF, tries = [];
    if (DEF.remoteConfigUrl && navigator.onLine !== false) tries.push(DEF.remoteConfigUrl + (DEF.remoteConfigUrl.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now());
    if (location.protocol !== 'file:') tries.push(new URL('../config.json', location.href).href);
    var i = 0;
    function next() {
      if (i >= tries.length) return Promise.resolve(c);
      var u = tries[i++];
      return fetchJSON(u, 5000).then(function (j) { if (configured(j)) return j; if (!configured(c)) c = Object.assign({}, c, j); return next(); }, function () { return next(); });
    }
    if (configured(DEF) && !DEF.remoteConfigUrl) return Promise.resolve(DEF);
    return next().then(function (x) { return configured(x) ? x : (configured(DEF) ? DEF : x); });
  }

  // ---------- results panel ----------
  var state = { n: 0, sent: false, email: '', data: null, folder: '' };
  function panel() {
    var res = $('results'); var p = $('lctSend'); if (p) return p;
    p = document.createElement('div'); p.className = 'lct-send'; p.id = 'lctSend';
    p.innerHTML = '<h3>💾 Saving and emailing the results <span style="font-weight:normal;font-size:15px" class="th">(บันทึกและส่งผลสอบทางอีเมล)</span></h3><div class="lct-line" id="lctSave"></div><div class="lct-line" id="lctMail"></div>';
    var first = res.querySelector('.card'); if (first && first.nextSibling) res.insertBefore(p, first.nextSibling); else res.insertBefore(p, res.firstChild);
    return p;
  }
  function setLine(id, cls, en, th, buttons) {
    var el = $(id); if (!el) return; el.innerHTML = '<span class="' + cls + '">' + en + '</span>' + (th ? '<span class="th">' + th + '</span>' : '');
    (buttons || []).forEach(function (b) { var x = document.createElement('button'); x.type = 'button'; x.textContent = b[0]; if (b[2]) x.className = b[2]; x.onclick = b[1]; x.id = b[3] || ''; el.appendChild(x); });
  }

  function collect() {
    var r = getR(); if (!r) return null;
    var email = ($('lctEmail') && $('lctEmail').value.trim()) || state.email;
    state.email = email;
    try { r.student = r.student || {}; r.student.email = email; r.student.email_role = T.parent ? 'parent' : 'student'; } catch (_) {}
    var s = summary(r), school = DEF.schoolName || 'London Centre of English Language School';
    var html = emailHTML(r, s, email, school);
    var txt = ''; try { if (typeof txtReport === 'function') txt = txtReport(); } catch (_) {}
    var d = new Date(r.date || Date.now());
    if (!state.folder) state.folder = stamp(d) + '_' + safeName(r.student && r.student.name) + '_' + T.key;
    return { r: r, s: s, html: html, txt: txt, email: email, folder: state.folder, json: JSON.stringify({ test: T.name, test_key: T.key, email: email, email_role: T.parent ? 'parent' : 'student', summary: { score: s.score, level: s.level, sections: s.sections }, results: r }, null, 2) };
  }
  function fullPage(d) {
    return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>' + esc(T.name + ' – ' + (d.r.student && d.r.student.name)) + '</title></head><body style="margin:16px">' + d.html +
      (d.txt ? '<details style="font-family:Segoe UI,Arial,sans-serif;margin-top:16px"><summary><b>Full report (text)</b></summary><pre style="white-space:pre-wrap;font-size:12px">' + esc(d.txt) + '</pre></details>' : '') +
      '<script type="application/json" id="results-data">' + d.json.replace(/</g, '\\u003c') + '</script></body></html>';
  }
  function download(name, data, type) { var b = new Blob([data], { type: type }); var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }

  function save(d) {
    var app = window.lcApp && window.lcApp.saveResults;
    if (app) {
      setLine('lctSave', 'lct-wait', '💾 Saving the results on this computer…');
      return window.lcApp.saveResults({ folder: d.folder, files: { 'report.html': fullPage(d), 'results.json': d.json, 'report.txt': d.txt || '' }, pdf: 'report.pdf' }).then(function (res) {
        if (res && res.ok) setLine('lctSave', 'lct-ok', '💾 Saved on this computer ✓ – ' + esc(res.dir), 'บันทึกผลไว้ในเครื่องแล้ว (PDF, HTML, JSON)', [['📂 Open folder', function () { window.lcApp.openResults(res.dir); }]]);
        else throw new Error(res && res.error || 'unknown error');
        return res;
      }).catch(function (e) { setLine('lctSave', 'lct-no', '❌ Could not save the results: ' + esc(e.message || e), 'บันทึกผลไม่สำเร็จ', [['🔁 Retry', function () { save(collect()); }, 'red']]); });
    }
    var name = 'Results_' + d.folder + '.html';
    try { download(name, fullPage(d), 'text/html'); } catch (_) {}
    setLine('lctSave', 'lct-ok', '💾 Results file downloaded ✓ (' + esc(name) + ' – check the Downloads folder)', 'ดาวน์โหลดไฟล์ผลสอบแล้ว (ดูในโฟลเดอร์ Downloads)',
      [['⬇ Download report again', function () { download(name, fullPage(collect()), 'text/html'); }], ['⬇ Results (JSON)', function () { var x = collect(); download('Results_' + x.folder + '.json', x.json, 'application/json'); }]]);
    return Promise.resolve({ ok: true });
  }

  function send(d, manual) {
    var schoolTo = DEF.schoolEmail || 'london-english@live.com';
    var who = esc(d.email) + ' and the school (' + esc(schoolTo) + ')';
    setLine('lctMail', 'lct-wait', '📧 Emailing the results to ' + who + '…', 'กำลังส่งผลสอบทางอีเมล…');
    var retry = [['🔁 Retry sending', function () { send(collect(), true); }, 'red', 'lctRetry']];
    if (navigator.onLine === false) { setLine('lctMail', 'lct-no', '❌ Not emailed – this computer is offline. The results are saved; connect to the internet and press Retry.', 'ส่งอีเมลไม่สำเร็จ – ไม่มีอินเทอร์เน็ต ผลสอบถูกบันทึกไว้แล้ว กด Retry เมื่อเชื่อมต่ออินเทอร์เน็ต', retry); return Promise.resolve(false); }
    return getConfig().then(function (c) {
      if (!configured(c)) { setLine('lctMail', 'lct-no', '⚠️ Not emailed – email sending is not switched on yet (EmailJS keys missing in config.json). The results are saved.', 'ยังไม่ได้เปิดระบบส่งอีเมล ผลสอบถูกบันทึกไว้แล้ว', retry); return false; }
      var school = c.schoolEmail || schoolTo, e = c.emailjs;
      var params = { to_email: d.email, to_name: (d.r.student && d.r.student.name) || '', bcc_email: c.sendToSchool === false ? '' : school, reply_to: school, school_email: school,
        school_name: c.schoolName || DEF.schoolName || '', subject: T.name + ' – ' + ((d.r.student && d.r.student.name) || '') + ' – ' + d.s.level,
        student_name: (d.r.student && d.r.student.name) || '', test_name: T.name, score: d.s.score, level: d.s.level,
        report_html: d.html, report_text: (d.s.en + '\n\n' + d.s.th).slice(0, 4000) };
      // EmailJS free plan: max 50 KB per request – shorten the long report text if needed
      var size = function () { return new Blob([JSON.stringify(params)]).size; };
      if (size() > 46000) params.report_text = '';
      for (var cut = 0.8; size() > 46000 && cut > 0.1; cut -= 0.15) {
        var s2 = Object.assign({}, d.s, { en: d.s.en.slice(0, Math.floor(d.s.en.length * cut)) + ' …', th: d.s.th.slice(0, Math.floor(d.s.th.length * cut)) + ' …' });
        params.report_html = emailHTML(d.r, s2, d.email, params.school_name) + '<p style="font-size:12px">(Shortened – the full report is saved on the test computer.)</p>';
      }
      return fetch(e.apiUrl || 'https://api.emailjs.com/api/v1.0/email/send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: e.serviceId, template_id: e.templateId, user_id: e.publicKey, template_params: params }) })
        .then(function (res) { return res.text().then(function (t) { if (!res.ok) throw new Error(t || ('HTTP ' + res.status)); return t; }); })
        .then(function () { state.sent = true; setLine('lctMail', 'lct-ok', 'Results emailed ✓ – to ' + who + (manual ? ' (sent again)' : ''), 'ส่งผลสอบทางอีเมลเรียบร้อยแล้ว ✓'); return true; });
    }).catch(function (err) {
      setLine('lctMail', 'lct-no', '❌ The results could not be emailed: ' + esc(String(err && err.message || err).slice(0, 200)) + '. They are saved on this computer – press Retry.', 'ส่งอีเมลไม่สำเร็จ ผลสอบถูกบันทึกไว้แล้ว กด Retry เพื่อส่งอีกครั้ง', retry); return false;
    });
  }

  function onResults() {
    var d = collect(); if (!d) return; state.n++; state.data = d; panel();
    var p = save(d);
    Promise.resolve(p).then(function () {
      if (state.n === 1) return send(d, false);
      setLine('lctMail', state.sent ? 'lct-ok' : 'lct-wait', state.sent ? 'Results were emailed before the teacher changes ✓' : 'The results have been updated.', '', [['📧 Send updated results', function () { send(collect(), true); }]]);
    });
  }
  function watch() {
    var res = $('results'); if (!res) return;
    var vis = !res.classList.contains('hide'), timer = null;
    new MutationObserver(function () {
      var v = !res.classList.contains('hide');
      if (v && !vis) { clearTimeout(timer); timer = setTimeout(onResults, 900); }
      vis = v;
    }).observe(res, { attributes: true, attributeFilter: ['class'] });
  }
  window.lctResults = { validEmail: validEmail, getConfig: getConfig, state: state };
  function init() { addStep(); watch(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
