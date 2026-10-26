// Run against a local server: NODE_PATH=/path/to/node_modules node tests/browser.cjs
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.BASE_URL||'http://localhost:8000';
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const errors=[];
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',acceptDownloads:true});
 await context.addInitScript(()=>{
  window.__spoken=[];window.__beeps=0;window.__locks=0;
  Object.defineProperty(navigator,'wakeLock',{value:{request:async()=>{window.__locks++;return {release:async()=>{},addEventListener:()=>{}};}}});
  window.AudioContext=class {state='running';currentTime=0;destination={};createOscillator(){return {connect(){},frequency:{},start(){window.__beeps++},stop(){}};}createGain(){return {connect(){},gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}}};}};
  Object.defineProperty(window,'speechSynthesis',{value:{cancel(){},speak(message){window.__spoken.push(message.text);}}});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.clock.install();await page.goto(base);
 assert.equal(await page.locator('#workout-section').evaluate(el=>el.parentElement.tagName),'MAIN');
 assert.equal(await page.locator('#calendar .week').count(),4);
 assert.equal(await page.locator('main > section').count(),8);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await page.locator('#continue-btn').textContent(),'Empezar mi reto');
 assert.equal(await page.locator('#phase').textContent(),'Marcha suave');
 await page.locator('#sound').check();await page.locator('#voice').check();await page.locator('#start-btn').click();
 await page.clock.runFor(3000);await page.locator('#start-btn').click();assert.equal(await page.locator('#clock').textContent(),'14:57');
 await page.clock.runFor(2000);assert.equal(await page.locator('#clock').textContent(),'14:57');
 await page.reload();assert.equal(await page.locator('#clock').textContent(),'14:57');assert.equal(await page.locator('#start-btn').textContent(),'Continuar sesión');
 await page.locator('#start-btn').click();await page.clock.runFor(117000);
 assert.equal(await page.locator('#phase').textContent(),'Sentadilla a silla');assert.equal(await page.locator('#interval-clock').textContent(),'00:30');
 assert.match(await page.locator('#live-guide').textContent(),/Siéntate completamente/);
 await page.clock.runFor(27000);assert.equal(await page.locator('#interval-clock').textContent(),'00:03');
 await page.clock.runFor(3000);assert.equal(await page.locator('#phase').textContent(),'Descanso y transición');assert.equal(await page.locator('#live-name').textContent(),'Flexión inclinada');
 const signals=await page.evaluate(()=>({voice:window.__spoken,beeps:window.__beeps,locks:window.__locks}));assert(signals.beeps>0);assert(signals.locks>0);assert(signals.voice.includes('3'));assert(signals.voice.some(s=>s.startsWith('Descanso')));
 await page.clock.runFor(30000);assert.equal(await page.locator('#phase').textContent(),'Flexión inclinada');
 await page.locator('#focus-btn').click();assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('training-mode')),true);
 await page.screenshot({path:path.join(require('node:os').tmpdir(),'calistenia-training.png')});
 await page.keyboard.press('Escape');
 await page.locator('#level').selectOption('experienced');assert.equal(await page.locator('#start-btn').textContent(),'Continuar sesión');assert.match(await page.locator('#live-guide').textContent(),/encimera/);
 await page.locator('#start-btn').click();await page.clock.runFor(720000); // session reaches 15:00
 assert.equal(await page.locator('#completion-dialog').evaluate(el=>el.open),true);assert.match(await page.locator('#completion-copy').textContent(),/15 minutos/);
 await page.locator('input[value="easy"]').check();await page.getByRole('button',{name:'Guardar día completado'}).click();assert.equal(await page.locator('#progress-txt').textContent(),'1 de 28 días completados');assert.match(await page.locator('#history-list').textContent(),/Con energía/);
 await page.locator('#history summary').click();const downloadWait=page.waitForEvent('download');await page.locator('#export-btn').click();const download=await downloadWait;const backup=await download.path();
 await page.reload();assert.equal(await page.locator('#progress-txt').textContent(),'1 de 28 días completados');
 await page.locator('#continue-btn').click();assert.match(await page.locator('#session-tag').textContent(),/DÍA 02/);
 await page.reload();assert.match(await page.locator('#session-tag').textContent(),/DÍA 02/);
 await page.locator('#start-btn').click();await page.clock.runFor(180000);assert.equal(await page.locator('#phase').textContent(),'Gato-vaca');assert.equal(await page.locator('#live-image').evaluate(img=>!img.hidden&&!!img.getAttribute('src')),true);
 await page.clock.runFor(180000);assert.equal(await page.locator('#phase').textContent(),'Movilidad de cadera');
 await page.locator('#start-btn').click();await page.locator('[data-day="8"]').click();await page.locator('#start-btn').click();await page.clock.runFor(120000);assert.equal(await page.locator('#interval-clock').textContent(),'00:35');
 // Active session survives navigation and is restored paused, including time away.
 await page.reload();assert.equal(await page.locator('#start-btn').textContent(),'Continuar sesión');assert.match(await page.locator('#phase').textContent(),/Sentadilla/);
 // A clean device can import the backup, reject invalid input and keep its data.
 const clean=await browser.newContext({serviceWorkers:'block'});const other=await clean.newPage();await other.goto(base);
 await other.locator('#import-file').setInputFiles(backup);assert.equal(await other.locator('#progress-txt').textContent(),'1 de 28 días completados');assert.match(await other.locator('#history-list').textContent(),/Con energía/);
 const before=await other.evaluate(()=>localStorage.getItem('calisthenics28_v2'));
 await other.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"format":"calistenia28","version":2,"done":[999]}')});assert.match(await other.locator('#backup-status').textContent(),/No se pudo importar/);assert.equal(await other.evaluate(()=>localStorage.getItem('calisthenics28_v2')),before);
 await clean.close();
 // v1 completion data is migrated without dropping completed days.
 const legacy=await browser.newContext({serviceWorkers:'block'});await legacy.addInitScript(()=>localStorage.setItem('calisthenics28_v1','[1,2,3]'));const old=await legacy.newPage();await old.goto(base);assert.equal(await old.locator('#progress-txt').textContent(),'3 de 28 días completados');assert.match(await old.locator('#session-tag').textContent(),/DÍA 04/);await legacy.close();
 // Real service worker and all exercise images work after the network goes away.
 const offline=await browser.newContext({viewport:{width:390,height:844}});const off=await offline.newPage();off.on('pageerror',e=>errors.push(e.message));await off.goto(base);await off.waitForFunction(()=>document.querySelector('#offline-status').textContent.startsWith('Lista sin conexión'),null,{timeout:30000});await off.reload();await offline.setOffline(true);await off.reload();assert.match(await off.locator('#offline-status').textContent(),/Lista sin conexión/);
 await off.evaluate(async()=>{for(const image of document.images){image.loading='eager';if(image.getAttribute('src'))await image.decode();}});
 assert.equal(await off.evaluate(()=>[...document.images].filter(img=>img.getAttribute('src')&&(!img.complete||!img.naturalWidth)).length),0);
 await off.locator('#continue-btn').click();await off.locator('#start-btn').click();assert.equal(await off.locator('#start-btn').textContent(),'Pausar');await off.locator('#start-btn').click();
 await off.evaluate(()=>scrollTo(0,0));await off.screenshot({path:path.join(require('node:os').tmpdir(),'calistenia-home.png')});
 assert.deepEqual(errors,[]);console.log('PASS: mobile layout, all calendar weeks, timer phases/pause/reload, cues, wake lock, focus mode, levels, completion/history, next day, mobility, week progression, backup round-trip/validation, v1 migration and offline reload/images.');
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
