import time, sys
from playwright.sync_api import sync_playwright
BASE='https://rich59.github.io/london-centre-tests/'
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
    ctx=b.new_context(viewport={'width':1280,'height':720},accept_downloads=True,permissions=['microphone']); pg=ctx.new_page(); pg.on('dialog',lambda d:d.accept())
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(BASE); pg.wait_for_load_state('networkidle'); pg.screenshot(path='screenshots/pages_index.png'); print('INDEX', pg.title())
    for bid in ['b-phonics','b-kids','b-teen','b-adult']:
        pg.goto(BASE); pg.click('#'+bid); pg.wait_for_selector('#lctEmail'); print('OPEN', bid, pg.url, '|', pg.title(), '| secure', pg.evaluate('isSecureContext'))
    pg.fill('#sname','Live Check'); pg.fill('#lctEmail','live.check@example.com'); pg.click('#startBtn'); time.sleep(1)
    with pg.expect_download() as d: pg.evaluate('finish()')
    pg.wait_for_function("!/Emailing/.test(document.getElementById('lctMail').innerText)",timeout=20000)
    print('LIVE MAIL STATUS:', pg.inner_text('#lctMail').replace('\n',' | '), '| download', d.value.suggested_filename)
    print('ERR', errs); b.close()
