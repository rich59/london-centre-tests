import asyncio, subprocess, os, time, json
from playwright.async_api import async_playwright
EXE = '/workspace/desktop_app/dist/win-unpacked/London Centre Tests.exe'
env = dict(os.environ, WINEDEBUG='-all', LCT_NO_MAXIMIZE='1')
proc = subprocess.Popen(['wine', EXE, '--no-sandbox', '--disable-gpu', '--remote-debugging-port=9341'], env=env, stdout=open('/tmp/wine_probe.log', 'w'), stderr=subprocess.STDOUT)
async def main():
    async with async_playwright() as p:
        b = None
        for _ in range(120):
            try: b = await p.chromium.connect_over_cdp('http://127.0.0.1:9341'); break
            except Exception: await asyncio.sleep(1)
        ctx = b.contexts[0]
        for _ in range(60):
            if ctx.pages: break
            await asyncio.sleep(1)
        pg = ctx.pages[0]; await pg.wait_for_load_state()
        try: await pg.wait_for_function("document.getElementById('st-sr') && document.getElementById('st-sr').className!=='wait'", timeout=120000)
        except Exception as e: print('wait sr', e)
        print('URL', pg.url)
        print(await pg.evaluate("({mic:(document.getElementById('st-mic')||{}).innerText,sr:(document.getElementById('st-sr')||{}).innerText,ua:navigator.userAgent})"))
        await pg.screenshot(path='/workspace/desktop_app/test/shots/wine_home.png')
        await pg.click('#b-adult'); await pg.wait_for_load_state('load'); await pg.wait_for_timeout(1500)
        print('adult', await pg.evaluate("({url:location.href,bar:!!document.getElementById('lct-bar'),sr:(window.webkitSpeechRecognition||{}).name,engine:window.lcSpeech&&window.lcSpeech.state})"))
        await b.close()
try: asyncio.run(asyncio.wait_for(main(), 300))
finally:
    proc.terminate(); subprocess.run(['wineserver', '-k'])
