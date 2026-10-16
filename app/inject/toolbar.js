// Home / Print / Save-as-PDF strip added to the top of each test page by the desktop app
(function () {
  if (!window.lcApp || document.getElementById('lct-bar')) return;
  var bar = document.createElement('div'); bar.id = 'lct-bar'; bar.className = 'noprint';
  function btn(cls, label, title, fn) { var b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = label; b.title = title; b.onclick = fn; bar.appendChild(b); return b; }
  btn('home', '\u2302 Home', 'Back to the home screen (choose another test)', function () {
    if (confirm('Go back to the home screen?\n\nAnything in this test that you have not printed, saved as PDF or copied will be lost.')) window.lcApp.home();
  });
  btn('print', '\uD83D\uDDA8 Print', 'Print this page', function () { window.print(); });
  btn('pdf', '\uD83D\uDCC4 Save as PDF', 'Save this page as a PDF file', function () { window.lcApp.savePdf(); });
  var sp = document.createElement('span'); sp.className = 'sp'; bar.appendChild(sp);
  var nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = 'London Centre Tests \u00B7 microphone allowed \u00B7 offline speech recognition'; bar.appendChild(nm);
  document.body.insertBefore(bar, document.body.firstChild);
})();
