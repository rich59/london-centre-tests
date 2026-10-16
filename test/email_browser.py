"""Browser test of the email step + auto-save + EmailJS send (EmailJS mocked with Playwright routes; no email is sent)."""
import json, sys, threading, http.server, functools, pathlib, time
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
WEB = ROOT / 'web'; SHOTS = ROOT / 'test/shots/email'
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8765), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(WEB)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
TESTS = {'phonics': 'Phonics_Entry_Test.html', 'kids': 'Entry_Test_Ages_7-12.html', 'teen': 'Teenager_Placement_Test_CEFR.html', 'adult': 'Adult_Placement_Test_CEFR.html'}
CONF = json.loads((ROOT / 'app/config.json').read_text())
GOOD = dict(CONF, emailjs={'serviceId': 'service_test', 'templateId': 'template_test', 'publicKey': 'pk_test123'})
fails = []
def check(c, msg):
    print(('PASS ' if c else 'FAIL ') + msg); (None if c else fails.append(msg))
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
    for key, f in TESTS.items():
        for mode in (['unconfigured', 'ok', 'fail'] if key in ('teen', 'phonics') else ['ok']):
            ctx = b.new_context(viewport={'width': 1280, 'height': 900}, accept_downloads=True, permissions=['microphone'])
            pg = ctx.new_page(); sent = []; state = {'n': 0}
            pg.on('dialog', lambda d: d.accept())
            pg.on('pageerror', lambda e: print('  pageerror:', e))
            ctx.route('https://rich59.github.io/**', lambda r: r.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body=json.dumps(GOOD if mode != 'unconfigured' else CONF)))
            def emailjs(route, req):
                state['n'] += 1; sent.append(json.loads(req.post_data))
                if mode == 'fail' and state['n'] == 1: route.fulfill(status=400, headers={'Access-Control-Allow-Origin': '*'}, body='The service ID is invalid')
                else: route.fulfill(status=200, headers={'Access-Control-Allow-Origin': '*'}, body='OK')
            ctx.route('https://api.emailjs.com/**', emailjs)
            pg.goto(f'http://127.0.0.1:8765/tests/{f}'); pg.wait_for_selector('#lctEmail')
            check(pg.locator('#lctStep #sname').count() == 1, f'{key}: name field moved into the step box')
            if mode != 'fail':
                pg.locator('#lctStep').scroll_into_view_if_needed(); pg.screenshot(path=str(SHOTS / f'{key}_start.png'))
            pg.fill('#sname', 'Test Student')
            for s, k in (('#sage', 'x'),):
                if pg.locator(s).count(): pg.fill(s, '7')
            pg.click('#startBtn'); time.sleep(0.4)
            check(pg.locator('#start').is_visible() and 'email' in pg.inner_text('#lctEmailErr').lower(), f'{key}: start blocked without email')
            pg.fill('#lctEmail', 'not-an-email'); pg.click('#startBtn'); time.sleep(0.3)
            check(pg.locator('#start').is_visible() and pg.locator('#lctEmail.lct-bad').count() == 1, f'{key}: start blocked with bad email')
            if key == 'teen' and mode == 'unconfigured': pg.screenshot(path=str(SHOTS / f'{key}_start_error.png'))
            pg.fill('#lctEmail', 'parent.test@example.com'); pg.click('#startBtn'); time.sleep(1.5)
            check(not pg.locator('#start').is_visible(), f'{key}: test started with valid email')
            with pg.expect_download(timeout=20000) as dl:
                pg.evaluate('finish()')
            d = dl.value; path = SHOTS / f'{key}_{mode}_{d.suggested_filename}'; d.save_as(str(path))
            htm = path.read_text(encoding='utf-8')
            check('results-data' in htm and 'parent.test@example.com' in htm, f'{key}/{mode}: results HTML downloaded ({d.suggested_filename})')
            pg.wait_for_function("document.getElementById('lctMail') && !/Emailing/.test(document.getElementById('lctMail').innerText)", timeout=20000)
            txt = pg.inner_text('#lctMail')
            if mode == 'unconfigured': check('not switched on' in txt and pg.locator('#lctRetry').count() == 1 and not sent, f'{key}/unconfigured: "not switched on" + Retry, nothing sent')
            if mode == 'ok': check('Results emailed ✓' in txt and len(sent) == 1, f'{key}/ok: "Results emailed ✓"')
            if mode == 'fail':
                check('could not be emailed' in txt and pg.locator('#lctRetry').count() == 1, f'{key}/fail: failure + Retry shown')
                pg.screenshot(path=str(SHOTS / f'{key}_results_fail.png'))
                pg.click('#lctRetry'); pg.wait_for_function("/emailed ✓/.test(document.getElementById('lctMail').innerText)", timeout=20000)
                check(len(sent) == 2, f'{key}/fail: Retry sends again and shows ✓')
            if sent:
                tp = sent[-1]['template_params']; size = len(json.dumps(sent[-1]).encode())
                check(tp['to_email'] == 'parent.test@example.com' and tp['bcc_email'] == 'london-english@live.com' and sent[-1]['user_id'] == 'pk_test123', f'{key}: payload to student + bcc school')
                check(tp['level'] and tp['score'] and 'รายงานผล' in tp['report_html'] and 'Report (English)' in tp['report_html'], f'{key}: report EN+TH, score {tp["score"]}, level {tp["level"]}')
                check(size < 50000, f'{key}: payload {size} bytes < 50 KB')
                (SHOTS / f'{key}_email.html').write_text(tp['report_html'], encoding='utf-8')
            pg.evaluate("document.getElementById('lctSend').scrollIntoView({block:'start'})"); time.sleep(0.3)
            pg.screenshot(path=str(SHOTS / f'{key}_results_{mode}.png'))
            ctx.close()
    # real endpoint with dummy ids: error path, no email can be sent
    ctx = b.new_context(accept_downloads=True); pg = ctx.new_page(); pg.on('dialog', lambda d: d.accept())
    ctx.route('https://rich59.github.io/**', lambda r: r.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body=json.dumps(GOOD)))
    pg.goto('http://127.0.0.1:8765/tests/Teenager_Placement_Test_CEFR.html'); pg.fill('#sname', 'Dummy'); pg.fill('#lctEmail', 'x@example.com'); pg.click('#startBtn'); time.sleep(1)
    with pg.expect_download(): pg.evaluate('finish()')
    pg.wait_for_function("!/Emailing/.test(document.getElementById('lctMail').innerText)", timeout=20000)
    t = pg.inner_text('#lctMail'); check('could not be emailed' in t, 'real EmailJS endpoint (dummy ids) -> error shown: ' + t.splitlines()[0][:120])
    b.close()
print('FAILURES:', fails); sys.exit(1 if fails else 0)
