import asyncio, os, subprocess, time, json
from playwright.async_api import async_playwright
APP='/workspace/desktop_app'; EL=os.environ['ELECTRON_BIN']; OUT=APP+'/test/shots/nomodel'; os.makedirs(OUT, exist_ok=True)
proc=subprocess.Popen([EL,'--remote-debugging-port=9336','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture='+APP+'/test/wav/hello.wav','--no-sandbox'],env=dict(os.environ,LCT_NO_MAXIMIZE='1',LCT_LOG='1'),stdout=open(OUT+'/electron.log','w'),stderr=subprocess.STDOUT)
async def main():
  async with async_playwright() as p:
    for _ in range(60):
      try: b=await p.chromium.connect_over_cdp('http://127.0.0.1:9336'); break
      except Exception: time.sleep(0.5)
    ctx=b.contexts[0]
    while not ctx.pages: await asyncio.sleep(0.2)
    pg=ctx.pages[0]; await pg.wait_for_load_state(); await pg.wait_for_timeout(1500)
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.screenshot(path=OUT+'/home.png')
    print('HOME', await pg.evaluate("({sr:document.getElementById('st-sr').innerText,add:!document.getElementById('addModel').hidden,model:window.lcApp.speechModel})"))
    await pg.click('#b-adult'); await pg.wait_for_load_state('load'); await pg.wait_for_timeout(800)
    print('ADULT SR', await pg.evaluate("String(window.webkitSpeechRecognition)+' '+String(window.SpeechRecognition)"))
    await pg.click('#testSR'); await pg.wait_for_timeout(1000); print('selftest:', (await pg.inner_text('#srTestOut'))[:200])
    await pg.click('#testMic'); await pg.wait_for_timeout(6000); print('testMic:', (await pg.inner_text('#micInfo'))[:200].replace('\n',' | '))
    await pg.screenshot(path=OUT+'/adult_start.png')
    await b.close()
try: asyncio.run(main())
finally: proc.terminate(); proc.wait(5)
