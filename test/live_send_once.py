# ONE real send through the live website (approved: to london-english@live.com only)
import time, json
from playwright.sync_api import sync_playwright
URL='https://rich59.github.io/london-centre-tests/tests/Teenager_Placement_Test_CEFR.html'
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
    ctx=b.new_context(viewport={'width':1280,'height':800},accept_downloads=True,permissions=['microphone']); pg=ctx.new_page(); pg.on('dialog',lambda d:d.accept())
    n={'c':0}; resp=[]
    def guard(route,req):
        n['c']+=1
        body=json.loads(req.post_data); tp=body['template_params']
        if n['c']>1 or tp['to_email']!='london-english@live.com' or tp['bcc_email'] not in ('','london-english@live.com'):
            print('BLOCKED extra/other send'); return route.abort()
        route.continue_()
    ctx.route('https://api.emailjs.com/**',guard)
    pg.on('response',lambda r: resp.append((r.status,r.text())) if 'api.emailjs.com' in r.url else None)
    pg.goto(URL); pg.wait_for_selector('#lctEmail')
    pg.fill('#sname','TEST - Grok Bot'); pg.fill('#lctEmail','london-english@live.com'); pg.click('#startBtn'); time.sleep(1.5)
    with pg.expect_download() as d: pg.evaluate('finish()')
    pg.wait_for_function("!/Emailing/.test(document.getElementById('lctMail').innerText)",timeout=30000); time.sleep(1)
    print('EMAILJS RESPONSE:',resp,'| sends:',n['c'])
    print('STATUS:',pg.inner_text('#lctMail').replace('\n',' | '))
    pg.evaluate("window.scrollTo(0,0)"); time.sleep(0.3); pg.screenshot(path='screenshots/live_email_sent_web.png')
    b.close()
