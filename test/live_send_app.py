# ONE real send through the desktop app (Electron, app://tests origin), to london-english@live.com only
import asyncio, os, subprocess, time
from playwright.async_api import async_playwright
APP='/workspace/desktop_app'; PORT=9341
proc=subprocess.Popen([APP+'/dist/linux-unpacked/london-centre-tests',f'--remote-debugging-port={PORT}','--use-fake-device-for-media-stream','--no-sandbox'],
  env=dict(os.environ,LCT_NO_MAXIMIZE='1',LCT_START_URL='app://tests/tests/teen.html',LCT_RESULTS_DIR='/tmp/lct_live_results'),stdout=open('/tmp/live_app.log','w'),stderr=subprocess.STDOUT)
async def main():
  async with async_playwright() as p:
    for _ in range(60):
      try: b=await p.chromium.connect_over_cdp(f'http://127.0.0.1:{PORT}'); break
      except Exception: time.sleep(0.5)
    ctx=b.contexts[0]
    while not ctx.pages: await asyncio.sleep(0.25)
    pg=ctx.pages[0]; pg.on('dialog',lambda d: asyncio.ensure_future(d.accept())); resp=[]
    async def onresp(r):
      if 'api.emailjs.com' in r.url: resp.append((r.status, await r.text()))
    pg.on('response',lambda r: asyncio.ensure_future(onresp(r)))
    await pg.set_viewport_size({'width':1280,'height':800}); await pg.wait_for_selector('#lctEmail')
    print('UA', await pg.evaluate('navigator.userAgent'), '| origin', await pg.evaluate('location.origin'))
    await pg.fill('#sname','TEST - Grok Bot'); await pg.fill('#lctEmail','london-english@live.com'); await pg.click('#startBtn'); await pg.wait_for_timeout(1500)
    await pg.evaluate('finish()')
    await pg.wait_for_function("/emailed ✓|could not|not switched/.test((document.getElementById('lctMail')||{}).innerText||'')",timeout=60000); await pg.wait_for_timeout(1500)
    print('EMAILJS RESPONSE:',resp); print('MAIL:',(await pg.inner_text('#lctMail')).replace('\n',' | ')); print('SAVE:',(await pg.inner_text('#lctSave')).replace('\n',' | '))
    await pg.evaluate("document.getElementById('toast')&&document.getElementById('toast').classList.add('hide');window.scrollTo(0,0)"); await pg.wait_for_timeout(300)
    await pg.screenshot(path=APP+'/screenshots/live_email_sent_app.png'); await b.close()
try: asyncio.run(main())
finally: proc.terminate(); proc.wait(5)
