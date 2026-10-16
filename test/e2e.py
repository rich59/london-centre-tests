# Full run of one test inside the desktop app, with a TTS WAV as the fake microphone.
import asyncio, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
APP = '/workspace/desktop_app'
KEY = sys.argv[1]; WAV = sys.argv[2]; REC_MS = int(sys.argv[3]) if len(sys.argv) > 3 else 6000
ELECTRON = os.environ.get('ELECTRON_BIN', APP + '/node_modules/electron/dist/electron')
OUT = APP + '/test/shots/' + KEY; os.makedirs(OUT, exist_ok=True)
PORT = 9334
def launch():
    args = [ELECTRON] + ([APP] if ELECTRON.endswith('/electron') else []) + [f'--remote-debugging-port={PORT}', '--use-fake-device-for-media-stream', f'--use-file-for-fake-audio-capture={WAV}', '--no-sandbox']
    env = dict(os.environ, LCT_LOG='1', LCT_NO_MAXIMIZE='1', LCT_TEST_PDF_DIR=OUT)
    return subprocess.Popen(args, env=env, stdout=open(OUT + '/electron.log', 'w'), stderr=subprocess.STDOUT)
STEP = """() => { const vis = s => { const e = document.querySelector(s); return !!(e && e.offsetParent !== null && !e.disabled); };
  if (document.querySelector('#results') && !document.querySelector('#results').classList.contains('hide')) return 'results';
  if (document.querySelector('#reading') && !document.querySelector('#reading').classList.contains('hide')) return 'reading';
  if (vis('#recBtn')) return 'rec';
  if (vis('.tile')) return 'tiles';
  if (vis('#wr')) return 'write';
  if (vis('#tin')) return 'typed';
  if (vis('.key')) return 'keys';
  if (vis('#qopts .opt')) return 'opt';
  return 'none'; }"""
async def main():
    proc = launch(); log = []
    try:
        async with async_playwright() as p:
            for _ in range(60):
                try: b = await p.chromium.connect_over_cdp(f'http://127.0.0.1:{PORT}'); break
                except Exception: time.sleep(0.5)
            ctx = b.contexts[0]
            while not ctx.pages: await asyncio.sleep(0.25)
            pg = ctx.pages[0]; errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
            await pg.set_viewport_size({'width': 1280, 'height': 860})
            await pg.wait_for_load_state()
            await pg.click(f'#b-{KEY}'); await pg.wait_for_load_state('load'); await pg.wait_for_timeout(500)
            await pg.wait_for_function("window.lcSpeech && window.lcSpeech.state==='ready'", timeout=60000)
            await pg.fill('#sname', 'Test Student')
            if await pg.locator('#sage').count(): await pg.fill('#sage', '8')
            await pg.click('#startBtn'); await pg.wait_for_timeout(500)
            await pg.wait_for_selector('#sname', state='hidden', timeout=15000)
            recs = 0
            for i in range(120):
                await pg.wait_for_timeout(150)
                st = await pg.evaluate(STEP)
                if st in ('results', 'reading'): break
                if st == 'rec':
                    recs += 1
                    await pg.click('#recBtn'); await pg.wait_for_timeout(REC_MS if recs == 1 else 2500)
                    if recs == 1: await pg.screenshot(path=OUT + '/recording.png')
                    if await pg.locator('#stopBtn').is_visible(): await pg.click('#stopBtn')
                    await pg.wait_for_timeout(1500)
                    if recs == 1: await pg.screenshot(path=OUT + '/after_first_recording.png'); log.append(('first recording item text', (await pg.inner_text('body'))[:0]))
                elif st == 'tiles':
                    for k in range(12):
                        t = pg.locator('.tile:not(.used):not([disabled])')
                        if not await t.count(): break
                        try: await t.first.click(timeout=1000)
                        except Exception: break
                elif st == 'write':
                    ch = pg.locator('.chip[data-topic]')
                    if await ch.count(): await ch.first.click()
                    await pg.fill('#wr', 'My favourite activity is football. I play with my friends in the park after school every day. It is fast and fun and I like it very much because my team is good and we often win.')
                elif st == 'typed': await pg.fill('#tin', 'test')
                elif st == 'keys':
                    for c in 'cat': await pg.click(f".key[data-key='{c}']")
                elif st == 'opt': await pg.locator('#qopts .opt').first.click()
                nb = pg.locator('#nextBtn')
                if await nb.is_visible() and await nb.is_enabled(): await nb.click()
                elif st == 'none': log.append(('stuck', i)); await pg.screenshot(path=f'{OUT}/stuck_{i}.png')
            if st == 'reading':   # phonics reading passage
                await pg.click('#rdRec'); await pg.wait_for_timeout(REC_MS); await pg.screenshot(path=OUT + '/recording.png')
                await pg.click('#rdStop'); await pg.wait_for_timeout(2500)
                log.append(('rdTrans', await pg.inner_text('#rdTrans'))); log.append(('rdAuto', await pg.inner_text('#rdAuto')))
                log.append(('play enabled', await pg.is_enabled('#rdPlay')))
                await pg.screenshot(path=OUT + '/after_first_recording.png', full_page=True)
                await pg.click('#rdFinish')
            await pg.screenshot(path=OUT + '/end_loop.png'); print('loop end state', st, i, await pg.evaluate("(document.querySelector('#qnum')||{}).innerText"))
            await pg.wait_for_selector('#results:not(.hide)', timeout=20000); await pg.wait_for_timeout(1000)
            await pg.screenshot(path=OUT + '/results.png')
            txt = await pg.inner_text('#results')
            # Copy for AI → clipboard
            cb = pg.locator('#copyAI')
            if await cb.count():
                await cb.first.click(); await pg.wait_for_timeout(500)
                clip = await pg.evaluate('navigator.clipboard.readText()')
                open(OUT + '/copy_for_ai.txt', 'w').write(clip); log.append(('clipboard chars', len(clip)))
            # recordings present?
            log.append(('audio elements with recording', await pg.evaluate("[...document.querySelectorAll('audio')].filter(a=>a.src&&a.src.startsWith('blob:')).length")))
            # Save as PDF via the app's own button (dialog bypassed in test mode)
            r = await pg.evaluate('window.lcApp.savePdf()'); log.append(('savePdf', r))
            open(OUT + '/results.txt', 'w').write(txt)
            for line in txt.split('\n'):
                if any(k in line.lower() for k in ('transcript', 'accuracy', 'heard', 'words', 'read aloud', 'reading')): log.append(('results', line[:300]))
            log.append(('page errors', errs))
            await b.close()
    finally:
        proc.terminate(); proc.wait(5)
    for l in log: print(KEY, *l)
asyncio.run(main())
