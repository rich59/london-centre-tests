import asyncio, os, subprocess, time, json
from playwright.async_api import async_playwright
APP='/workspace/desktop_app'; ELECTRON=APP+'/dist/linux-unpacked/london-centre-tests'
SH=APP+'/screenshots'; PORT=9337
proc=subprocess.Popen([ELECTRON,f'--remote-debugging-port={PORT}','--use-fake-device-for-media-stream',f'--use-file-for-fake-audio-capture={APP}/test/wav/teen_a2_en_GB-alba-medium.wav','--no-sandbox'],env=dict(os.environ,LCT_LOG='1',LCT_NO_MAXIMIZE='1',LCT_START_URL='app://tests/tests/teen.html',LCT_RESULTS_DIR='/tmp/lct_results'),stdout=open('/tmp/teen_e2e_electron.log','w'),stderr=subprocess.STDOUT)
async def main():
  async with async_playwright() as p:
    for _ in range(60):
      try: b=await p.chromium.connect_over_cdp(f'http://127.0.0.1:{PORT}'); break
      except Exception: time.sleep(0.5)
    ctx=b.contexts[0]
    for _ in range(40):
      if ctx.pages: break
      await asyncio.sleep(0.25)
    GOOD=json.load(open(APP+'/app/config.json')); GOOD['emailjs']={'serviceId':'service_test','templateId':'template_test','publicKey':'pk_test123'}
    sent=[]
    await ctx.route('https://rich59.github.io/**', lambda r: asyncio.ensure_future(r.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin':'*'}, body=json.dumps(GOOD))))
    async def ej(route, req):
      sent.append(json.loads(req.post_data)); await route.fulfill(status=200, headers={'Access-Control-Allow-Origin':'*'}, body='OK')
    await ctx.route('https://api.emailjs.com/**', ej)
    pg=ctx.pages[0]; errs=[]; pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('dialog',lambda d: asyncio.ensure_future(d.accept()))
    await pg.set_viewport_size({'width':1280,'height':800}); await pg.wait_for_load_state('load'); await pg.wait_for_timeout(1500)
    info=await pg.evaluate("({url:location.href,title:document.title,bar:!!document.getElementById('lct-bar'),sr:(window.webkitSpeechRecognition||{}).name,engine:window.lcSpeech&&window.lcSpeech.state,secure:isSecureContext,h1:document.querySelector('h1.ttl').innerText})")
    print('START',json.dumps(info,ensure_ascii=False))
    await pg.fill('#sname','Ploy Srisuk'); await pg.fill('#lctEmail','ploy.parent@example.com')
    await pg.evaluate("document.getElementById('lctStep').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(300)
    await pg.screenshot(path=SH+'/email_step_start_page.png')
    # speech-recognition self test (Vosk shim + auto-granted mic)
    await pg.click('#testSR'); await pg.wait_for_timeout(9000); print('SELFTEST',(await pg.inner_text('#srTestOut')).replace('\n',' | '))
    await pg.fill('#sinfo','M.4 – E2E test'); await pg.click('#startBtn'); T0=time.time(); await pg.wait_for_timeout(1500)
    Q=await pg.evaluate("Q.map(q=>({ans:q.ans,typed:!!q.typed,read:!!q.read,speak:!!q.speak}))")
    for i,q in enumerate(Q):
      if q['typed']: await pg.fill('#tin',q['ans'] if i<6 else 'xyz')
      elif q['read'] or q['speak']:
        if i+1 in (29,32):
          L=12.6115; ph=(time.time()-T0)%L; await asyncio.sleep((L-ph+0.4+3.4)%L)
          await pg.click('#recBtn'); await pg.wait_for_timeout(12600)
          if i+1==29: await pg.screenshot(path='/workspace/desktop_app/test/shots/teen_q29_recording.png')
          if await pg.is_visible('#stopBtn'): await pg.click('#stopBtn')
          await pg.wait_for_timeout(2500)
          print(f'Q{i+1} heard:', await pg.evaluate(f"(REC[{i}]||{{}}).transcript"))
      else:
        await pg.click(f"#qopts .opt[data-k='{q['ans'] if i%3!=2 else (q['ans']+1)%4}']")
      await pg.click('#nextBtn'); await pg.wait_for_timeout(80)
    await pg.click('#nextBtn'); await pg.wait_for_timeout(2500)
    await pg.evaluate("document.getElementById('toast').classList.add('hide')")
    await pg.wait_for_function("document.getElementById('lctMail') && /emailed ✓|could not|not switched/.test(document.getElementById('lctMail').innerText)", timeout=30000)
    await pg.wait_for_function("/Saved on this computer|Could not save/.test(document.getElementById('lctSave').innerText)", timeout=30000)
    await pg.evaluate("window.scrollTo(0,0)"); await pg.wait_for_timeout(300)
    await pg.screenshot(path=SH+'/results_emailed_status.png')
    print('SAVE', await pg.inner_text('#lctSave')); print('MAIL', await pg.inner_text('#lctMail'))
    print('SENT', len(sent), sent and {k:(v if len(str(v))<90 else len(str(v))) for k,v in sent[0]['template_params'].items()})
    import glob; [print('FILE', f, os.path.getsize(f)) for f in sorted(glob.glob('/tmp/lct_results/*/*'))]
    R=json.loads(await pg.evaluate("JSON.stringify({total:R.total,cefr:R.cefr,prov:R.provisional,sec:R.sections.map(s=>[s.section,s.score,s.out_of,s.included]),read:R.details.filter(d=>d.q==29||d.q==32).map(d=>[d.q,d.transcript,d.marks||d.mark,d.source]),test:R.test})"))
    print('RESULT',json.dumps(R,ensure_ascii=False))
    await pg.click('#copyAI'); await pg.wait_for_timeout(400); clip=await pg.evaluate("document.getElementById('aiText').value")
    print('COPYAI len',len(clip),'teen' in clip, clip[:160].replace('\n',' '))
    print('ERR',errs); await b.close()
try: asyncio.run(main())
finally: proc.terminate(); proc.wait(5)
