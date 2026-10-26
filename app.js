'use strict';
const $ = selector => document.querySelector(selector);
const STORE = 'calisthenics28_v2';
const FEELINGS = {easy: 'Con energía', good: 'Bien', hard: 'Me ha costado'};
const variants = {
 squat: ['Siéntate completamente en una silla estable y levántate con control.', 'Baja hacia la silla sin llegar a sentarte; sube sin impulso.'],
 push: ['Haz la flexión apoyando las manos en una pared.', 'Usa una encimera firme y mantén el cuerpo alineado.'],
 bridge: ['Eleva las caderas una distancia corta y cómoda.', 'Mantén dos segundos arriba sin arquear la espalda.'],
 angel: ['Mueve los brazos en un arco pequeño, sin dolor.', 'Dibuja el arco despacio sin tensar el cuello.'],
 deadbug: ['Mueve solo las piernas, una a una, sin arquear la zona lumbar.', 'Extiende brazo y pierna contrarios con control.'],
 lunge: ['Sujétate a una pared y baja solo unos centímetros.', 'Baja algo más, con apoyo si lo necesitas y sin perder estabilidad.'],
 hinge: ['Pon las manos en las caderas y llévalas hacia atrás.', 'Haz una pausa de tres segundos con la espalda neutra.'],
 superpull: ['Mantén el pecho apoyado y acerca los codos a las costillas.', 'Haz una pausa de dos segundos con los codos atrás.'],
 calf: ['Apóyate con ambas manos y eleva los dos talones lentamente.', 'Haz una pausa arriba antes de bajar con control.'],
 sideplank: ['Apoya las rodillas y eleva la cadera brevemente. Cambia de lado a mitad.', 'Mantén la plancha con rodillas apoyadas. Cambia de lado a mitad.'],
 wall: ['Mantente casi de pie, con la espalda apoyada en la pared.', 'Deslízate unos centímetros más abajo, sin dolor.'],
 bridge1: ['Haz un puente con ambos pies apoyados.', 'Descarga una pierna sin girar la pelvis. Cambia a mitad.'],
 birddog: ['Desde cuatro apoyos, extiende solo un brazo y alterna.', 'Extiende brazo y pierna contrarios y mantén dos segundos.']
};
function cleanDays(value) {
 if (!Array.isArray(value) || value.some(n => !Number.isInteger(n) || n < 1 || n > 28)) throw Error('Días inválidos');
 return [...new Set(value)].sort((a,b) => a-b);
}
function cleanRecords(value) {
 if (!Array.isArray(value) || value.length > 28) throw Error('Historial inválido');
 return value.map(r => {
  if (!r || !Number.isInteger(r.day) || r.day < 1 || r.day > 28 || !Object.hasOwn(FEELINGS, r.feeling) || !['beginner','experienced'].includes(r.level) || !Number.isFinite(r.seconds) || r.seconds < 0 || r.seconds > 900 || typeof r.date !== 'string' || !Number.isFinite(Date.parse(r.date))) throw Error('Sesión inválida');
  return {day:r.day, feeling:r.feeling, level:r.level, seconds:Math.floor(r.seconds), date:new Date(r.date).toISOString()};
 });
}
let state = {done:[], records:[], selected:1, level:'beginner', sound:false, voice:false, awake:true, timer:{ms:0,running:false,at:0}};
let storageWarning = false;
try {
 const raw = localStorage.getItem(STORE);
 if (raw) {
  const saved = JSON.parse(raw);
  state.done = cleanDays(saved.done);
  state.records = cleanRecords(saved.records);
  if (Number.isInteger(saved.selected) && saved.selected >= 1 && saved.selected <= 28) state.selected = saved.selected;
  if (['beginner','experienced'].includes(saved.level)) state.level = saved.level;
  for (const key of ['sound','voice','awake']) if (typeof saved[key] === 'boolean') state[key] = saved[key];
  if (saved.timer && Number.isFinite(saved.timer.ms) && saved.timer.ms >= 0 && saved.timer.ms <= 900000 && typeof saved.timer.running === 'boolean' && Number.isFinite(saved.timer.at)) state.timer = saved.timer;
 } else {
  const old = localStorage.getItem('calisthenics28_v1');
  if (old) state.done = cleanDays(JSON.parse(old));
  state.selected = nextPending();
 }
} catch { storageWarning = true; }
let running = false, startedAt = 0, elapsedMs = state.timer.ms, intervalId = null, phaseKey = '', lastSecond = -1, completionShown = false;
let wakeLock = null, wakeRequest = null, audio = null, focusMode = false, focusReturn = null, installPrompt = null, swRegistration = null;
const restored = state.timer.running || elapsedMs > 0;
if (state.timer.running) elapsedMs = Math.min(900000, Math.max(0, elapsedMs + Math.max(0, Date.now() - state.timer.at)));
function nextPending() { return Array.from({length:28},(_,i)=>i+1).find(n=>!state.done.includes(n)) || 28; }
function msNow() { return Math.min(900000, Math.max(0, elapsedMs + (running ? Date.now()-startedAt : 0))); }
let notificationTimeout;
function notify(message) { clearTimeout(notificationTimeout);$('#app-status').textContent=message;notificationTimeout=setTimeout(()=>{$('#app-status').textContent='';},7000); }
function save() {
 state.timer = {ms:msNow(), running, at:Date.now()};
 try { localStorage.setItem(STORE, JSON.stringify(state)); }
 catch { if (!storageWarning) notify('No se puede guardar en este navegador. Exporta tu progreso para conservarlo.'); storageWarning = true; }
}
function fmt(seconds) { return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`; }
function kind() { return D.week_plan[(state.selected-1)%7][0]; }
function timeline() {
 const blocks = [], add = (seconds,name,key='',type='soft',round=0) => blocks.push({seconds,name,key,type,round});
 const k=kind();
 if (D.plans[k]) {
  add(30,'Marcha suave'); add(30,'Movilidad de hombros','mob-shoulders'); add(30,'Movilidad de cadera','mob-hips'); add(30,'Movilidad de tobillos','mob-ankles');
  const work=30+5*Math.floor((state.selected-1)/7);
  for (let round=1;round<=2;round++) for (const key of D.plans[k].moves) {
   add(work,D.exercises[key],key,'work',round);
   add(60-work,'Descanso y transición','','rest',round);
  }
  add(60,'Respiración suave','mob-breathing'); add(60,'Movilidad suave de piernas'); add(60,'Relaja hombros y pecho');
 } else if (k==='M') {
  add(180,'Marcha suave');add(180,'Gato-vaca','mob-catcow');add(180,'Movilidad de cadera','mob-hips');add(180,'Hombros y espalda alta','mob-shoulders');add(90,'Movilidad de tobillos','mob-ankles');add(90,'Respiración diafragmática','mob-breathing');
 } else if (k==='W') { add(180,'Caminata de calentamiento');add(540,'Caminata a ritmo cómodo');add(180,'Caminata suave'); }
 else { add(180,'Respiración suave','mob-breathing');add(420,'Paseo ligero');add(300,'Estiramientos suaves'); }
 let end=0;return blocks.map(b=>({...b,start:end,end:(end+=b.seconds)}));
}
function currentSegment(seconds=Math.floor(msNow()/1000)) { const list=timeline();return list.find(b=>seconds<b.end) || list[list.length-1]; }
function updateProgress() {
 $('#progress-txt').textContent = `${state.done.length} de 28 días completados`;
 $('#bar').style.width = `${state.done.length/28*100}%`;
 for (const el of document.querySelectorAll('.day')) {
  const n=Number(el.dataset.day),done=state.done.includes(n),selected=n===state.selected;
  el.classList.toggle('done',done);el.classList.toggle('selected',selected);
  el.setAttribute('aria-pressed',String(selected));
  el.setAttribute('aria-label',`Día ${n}, ${D.week_plan[(n-1)%7][1]}${done?', completado':''}`);
  $(`#check-${n}`).textContent=done?'✓':'○';
 }
 $('#done-btn').textContent=state.done.includes(state.selected)?'Desmarcar día':'Marcar como completado';
 let target=state.timer.ms>0 && state.timer.ms<900000 && !state.done.includes(state.selected) ? state.selected : nextPending();
 $('#continue-btn').textContent = state.done.length===28 ? 'Ver mi reto completado' : target===1 && !state.done.length && !state.timer.ms ? 'Empezar mi reto' : `Continuar mi reto · día ${target}`;
 $('#continue-note').textContent = state.done.length===28 ? '¡28 días completados! Revisa tu recorrido y celebra lo que has conseguido.' : `${state.done.length} de 28 días · a tu ritmo, un día cada vez.`;
 renderHistory();
}
function renderHistory() {
 $('#history-summary').textContent = state.done.length ? `${state.done.length} días completados · ${Math.round(state.records.filter(r=>state.done.includes(r.day)).reduce((sum,r)=>sum+r.seconds,0)/60)} minutos registrados con el cronómetro.` : 'Tu primera sesión es el comienzo. Aquí verás tu avance y cómo te has sentido.';
 const list=$('#history-list');list.replaceChildren();
 for (const record of [...state.records].filter(r=>state.done.includes(r.day)).sort((a,b)=>b.date.localeCompare(a.date))) {
  const li=document.createElement('li');li.textContent=`Día ${record.day} · ${new Date(record.date).toLocaleDateString('es-ES')} · ${FEELINGS[record.feeling]} · ${record.level==='beginner'?'Principiante':'Con experiencia'} · ${fmt(record.seconds)} registrados`;list.append(li);
 }
 const legacy=state.done.filter(day=>!state.records.some(r=>r.day===day));
 if (legacy.length) {const li=document.createElement('li');li.textContent=`Días guardados sin valoración: ${legacy.join(', ')}.`;list.append(li);}
}
function updateVariants() {
 const idx=state.level==='beginner'?0:1;
 for (const [key,text] of Object.entries(variants)) {
  const card=$(`#ex-${key}`);let note=card.querySelector('.level-note');
  if (!note) {note=document.createElement('p');note.className='level-note';card.querySelector('.ex-copy').append(note);}
  note.textContent=`Tu variante: ${text[idx]}`;
 }
}
function renderSession() {
 const k=kind(),week=Math.floor((state.selected-1)/7)+1;
 $('#session-tag').textContent=`DÍA ${String(state.selected).padStart(2,'0')} · ${D.week_plan[(state.selected-1)%7][1].toUpperCase()}`;
 $('#session-title').textContent=D.plans[k]?.name || ({M:'MOVILIDAD Y ARTICULACIONES',W:'CAMINATA SUAVE',R:'RECUPERACIÓN ACTIVA'}[k]);
 $('#session-desc').textContent=`Semana ${week} · ${state.level==='beginner'?'Variantes para principiantes':'Variantes con experiencia'} · ${D.plans[k] ? `${30+5*(week-1)} s de trabajo / ${30-5*(week-1)} s de descanso.` : 'Movimiento cómodo, lento y sin dolor.'}`;
 $('#session-moves').replaceChildren();
 const entries=D.plans[k]?D.plans[k].moves.map(key=>({name:D.exercises[key],key})):timeline();
 entries.forEach((entry,i)=>{const item=document.createElement('div');item.className='session-item';const b=document.createElement('b');b.textContent=`${D.plans[k]?'EJ.':'BLOQUE'} ${i+1}`;item.append(b);const label=document.createElement(entry.key?'a':'span');label.textContent=entry.name+(entry.seconds?` · ${fmt(entry.seconds)}`:'');if(entry.key)label.href=targetFor(entry.key);item.append(label);$('#session-moves').append(item);});
 $('#level').value=state.level;updateVariants();updateProgress();renderTimer();
}
function targetFor(key) {return key.startsWith('mob-')?'#mov-'+({hips:'cadera',shoulders:'hombros',ankles:'tobillos',breathing:'respiracion',catcow:'catcow'}[key.slice(4)]):'#ex-'+key;}
function renderPreview(segment,seconds) {
 const list=timeline(),next=list.find(b=>b.start>=segment.end && b.type==='work');
 const shown=segment.type==='rest' && next ? next : segment;
 $('#live-status').textContent = seconds>=900 ? 'SESIÓN FINALIZADA' : segment.type==='rest' ? (next?'A CONTINUACIÓN':'PREPARA LA VUELTA A LA CALMA') : segment.type==='work' ? `AHORA · RONDA ${segment.round}/2` : 'AHORA · MOVIMIENTO SUAVE';
 $('#live-name').textContent=seconds>=900?'Buen trabajo, sesión terminada':shown.name;
 let key=seconds>=900?'':shown.key,src='',guide='Muévete a un ritmo cómodo, sin dolor. Respira con naturalidad.';
 if(key.startsWith('mob-')) {
  const source=document.querySelector(`[data-mobility-key="${key.slice(4)}"]`);src=source?.getAttribute('src')||'';
  const card=$(targetFor(key));guide=card?.querySelector('.mob-body p')?.textContent||guide;
 } else if(key) {src=$(`#ex-${key} img`).getAttribute('src');guide=variants[key][state.level==='beginner'?0:1];}
 if(segment.type==='work' && ['sideplank','bridge1'].includes(segment.key) && !(state.level==='beginner' && segment.key==='bridge1')) guide+=seconds-segment.start>=Math.floor(segment.seconds/2)?' Ahora, segundo lado.':' Empieza por el primer lado.';
 $('#live-guide').textContent=guide;
 const thumb=$('#live-image');$('#live-preview').classList.toggle('soft',!src);
 if(src && thumb.getAttribute('src')!==src)thumb.src=src;
 thumb.hidden=!src;thumb.alt=`Demostración de ${shown.name}`;
 $('#live-link').hidden=!key;if(key)$('#live-link').href=targetFor(key);
}
function renderTimer() {
 const seconds=Math.floor(msNow()/1000),seg=currentSegment(seconds),left=Math.max(0,seg.end-seconds);
 $('#clock').textContent=fmt(Math.max(0,900-seconds));
 $('#interval-clock').textContent=fmt(seconds>=900?0:left);
 $('#phase').textContent=seconds>=900?'Sesión finalizada':seg.name;
 $('#session').dataset.phase=seg.type;
 $('#start-btn').textContent=running?'Pausar':seconds>=900?'Volver a empezar':seconds>0?'Continuar sesión':'Iniciar 15 minutos';
 renderPreview(seg,seconds);
}
function selectDay(day,scroll=true) {
 if(!Number.isInteger(day)||day<1||day>28)return;
 if(day!==state.selected && msNow()>0 && msNow()<900000 && !confirm('¿Cambiar de día? Se reiniciará el cronómetro actual. Tu historial se conserva.'))return;
 if(day!==state.selected){pauseTimer();elapsedMs=0;state.selected=day;phaseKey='';completionShown=false;}
 save();renderSession();if(scroll)$('#session').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
}
function initAudio() {try {audio ||= new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{}}
function beep(high=false) {
 if(!state.sound || !audio || document.hidden)return;
 try {const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.connect(gain);gain.connect(audio.destination);oscillator.frequency.value=high?880:550;gain.gain.setValueAtTime(0.12,audio.currentTime);gain.gain.exponentialRampToValueAtTime(0.001,audio.currentTime+0.16);oscillator.start();oscillator.stop(audio.currentTime+0.17);}catch{}
}
function speak(text) {
 if(!state.voice || !('speechSynthesis' in window) || document.hidden)return;
 speechSynthesis.cancel();const message=new SpeechSynthesisUtterance(text);message.lang='es-ES';message.rate=0.95;speechSynthesis.speak(message);
}
function stopSpeech(){if('speechSynthesis' in window)speechSynthesis.cancel();}
async function acquireWake() {
 if(!running||!state.awake||document.visibilityState!=='visible'||wakeLock||wakeRequest)return;
 if(!('wakeLock' in navigator)){$('#wake-status').textContent='Este navegador no permite mantener la pantalla encendida. Revisa el bloqueo automático del dispositivo.';return;}
 wakeRequest=navigator.wakeLock.request('screen');
 try {const lock=await wakeRequest;if(!running||!state.awake||document.hidden){await lock.release();return;}wakeLock=lock;$('#wake-status').textContent='Pantalla encendida durante la sesión.';lock.addEventListener('release',()=>{if(wakeLock===lock){wakeLock=null;$('#wake-status').textContent=running?'El dispositivo ha liberado la pantalla.':' ';}});}
 catch {$('#wake-status').textContent='No se pudo mantener la pantalla encendida. Revisa el ahorro de batería.';}
 finally{wakeRequest=null;}
}
function releaseWake(){const lock=wakeLock;wakeLock=null;if(lock)lock.release().catch(()=>{});$('#wake-status').textContent='';}
function pauseTimer(){if(running)elapsedMs=msNow();running=false;clearInterval(intervalId);intervalId=null;stopSpeech();releaseWake();save();renderTimer();}
function toggleTimer(){
 if(running){pauseTimer();return;}
 if(elapsedMs>=900000){elapsedMs=0;completionShown=false;}
 if(state.sound)initAudio();running=true;startedAt=Date.now();lastSecond=-1;phaseKey='';save();acquireWake();tick();intervalId=setInterval(tick,200);
}
function resetTimer(){if(msNow()>0 && msNow()<900000 && !confirm('¿Reiniciar el cronómetro de esta sesión?'))return;pauseTimer();elapsedMs=0;completionShown=false;phaseKey='';save();renderTimer();$('#timer-info').textContent='Cronómetro listo. El historial se conserva.';}
function tick(){
 if(!running)return;const seconds=Math.floor(msNow()/1000);if(seconds===lastSecond)return;lastSecond=seconds;
 renderTimer();save();
 if(seconds>=900){pauseTimer();beep(true);speak('Sesión terminada. Buen trabajo.');if(!completionShown){completionShown=true;openCompletion();}return;}
 const seg=currentSegment(seconds),key=String(seg.start);
 if(key!==phaseKey){phaseKey=key;beep(true);speak(seg.type==='rest'?'Descanso. '+($('#live-name').textContent):seg.name);$('#timer-info').textContent=seg.type==='work'?`Ronda ${seg.round} de 2. Movimiento lento y controlado.`:'Sigue el ritmo del bloque actual.';}
 else if(seg.end-seconds<=3){beep();speak(String(seg.end-seconds));}
 const half=Math.floor(seg.seconds/2);
 if(seg.type==='work' && ['sideplank','bridge1'].includes(seg.key) && !(seg.key==='bridge1' && state.level==='beginner') && seconds===seg.start+half){beep(true);speak('Cambia de lado');}
}
function openCompletion(){
 if(state.done.includes(state.selected) && msNow()<900000){if(confirm('¿Desmarcar este día y quitar su valoración del historial?')){state.done=state.done.filter(n=>n!==state.selected);state.records=state.records.filter(r=>r.day!==state.selected);save();updateProgress();}return;}
 pauseTimer();$('#completion-copy').textContent=elapsedMs>=900000?`Has completado 15 minutos del día ${state.selected}. Guarda tu avance.`:`Día ${state.selected}: ${fmt(Math.floor(elapsedMs/1000))} registrados. Si has entrenado por tu cuenta, también puedes guardar el día.`;
 if(!$('#completion-dialog').open)$('#completion-dialog').showModal();
}
$('#completion-form').addEventListener('submit',event=>{event.preventDefault();const feeling=new FormData(event.target).get('feeling');if(!Object.hasOwn(FEELINGS,feeling))return;
 if(!state.done.includes(state.selected))state.done.push(state.selected);state.done=cleanDays(state.done);
 state.records=state.records.filter(r=>r.day!==state.selected);state.records.push({day:state.selected,feeling,level:state.level,seconds:Math.floor(msNow()/1000),date:new Date().toISOString()});
 save();updateProgress();$('#completion-dialog').close();notify(`¡Día ${state.selected} guardado! ${state.done.length} de 28 completados.`);
});
$('#close-completion').addEventListener('click',()=>$('#completion-dialog').close());
$('#continue-btn').addEventListener('click',()=>{if(state.done.length===28){$('#history').scrollIntoView();return;}const target=msNow()>0 && msNow()<900000 && !state.done.includes(state.selected)?state.selected:nextPending();selectDay(target);});
$('#level').addEventListener('change',event=>{pauseTimer();state.level=event.target.value;save();renderSession();notify('Nivel actualizado. Revisa tu variante antes de continuar.');});
for(const [id,key] of [['sound','sound'],['voice','voice'],['keep-awake','awake']]){
 $("#"+id).checked=state[key];$("#"+id).addEventListener('change',event=>{state[key]=event.target.checked;if(key==='sound'&&state.sound){initAudio();beep();}if(key==='voice'){if(state.voice)speak('Guía por voz activada');else stopSpeech();}if(key==='awake'){if(state.awake)acquireWake();else releaseWake();}save();});
}
if(!('speechSynthesis' in window)){$('#voice').disabled=true;$('#voice').parentElement.title='La voz no está disponible en este navegador.';}
function applyFocus(enabled){
 focusMode=enabled;document.body.classList.toggle('training-mode',enabled);$('#focus-btn').textContent=enabled?'Salir del entrenamiento ✕':'Modo entrenamiento ⛶';$('#focus-btn').setAttribute('aria-pressed',String(enabled));
 if(enabled){focusReturn=document.activeElement;$('#session').scrollTop=0;$('#start-btn').focus();}else{focusReturn?.focus();$('#session').scrollIntoView({block:'start'});}
}
$('#focus-btn').addEventListener('click',async()=>{if(focusMode){applyFocus(false);if(document.fullscreenElement)await document.exitFullscreen().catch(()=>{});}else{applyFocus(true);if($('#session').requestFullscreen)try{await $('#session').requestFullscreen();}catch{ /* CSS mode remains available. */ }}});
$('#session').addEventListener('keydown',event=>{if(!focusMode||event.key!=='Tab')return;const items=[...$('#session').querySelectorAll('button,a[href],input,select')].filter(el=>!el.hidden&&!el.disabled&&el.getClientRects().length);const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}});
$('#live-link').addEventListener('click',()=>{if(focusMode){applyFocus(false);if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});}});
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&focusMode)applyFocus(false);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&focusMode&&!$('#completion-dialog').open){applyFocus(false);if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(running)tick();acquireWake();}else{save();stopSpeech();}});
window.addEventListener('pagehide',save);
$('#export-btn').addEventListener('click',()=>{
 const file={format:'calistenia28',version:2,exportedAt:new Date().toISOString(),done:state.done,records:state.records,selected:state.selected,level:state.level};
 const url=URL.createObjectURL(new Blob([JSON.stringify(file,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`calistenia28-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('#backup-status').textContent='Copia exportada. Guárdala para continuar en otro dispositivo.';
});
$('#import-file').addEventListener('change',async event=>{
 const file=event.target.files[0];if(!file)return;
 try{
  if(file.size>100000)throw Error('Archivo demasiado grande');const data=JSON.parse(await file.text());
  if(data.format!=='calistenia28'||data.version!==2||!['beginner','experienced'].includes(data.level)||!Number.isInteger(data.selected)||data.selected<1||data.selected>28)throw Error('Formato inválido');
  const days=cleanDays(data.done),records=cleanRecords(data.records);if(records.some(r=>!days.includes(r.day))||new Set(records.map(r=>r.day)).size!==records.length)throw Error('Historial incoherente');
  pauseTimer();state.done=cleanDays([...state.done,...days]);
  const merged=new Map(state.records.map(r=>[r.day,r]));for(const record of records){const old=merged.get(record.day);if(!old||record.date>old.date)merged.set(record.day,record);}state.records=[...merged.values()];
  state.level=data.level;state.selected=state.done.includes(data.selected)?nextPending():data.selected;elapsedMs=0;completionShown=false;save();renderSession();$('#backup-status').textContent='Progreso importado y combinado con los días de este dispositivo.';
 }catch{$('#backup-status').textContent='No se pudo importar. Elige una copia JSON exportada desde Calistenia 28. Tu progreso no ha cambiado.';}finally{event.target.value='';}
});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('#install-btn').hidden=false;});
$('#install-btn').addEventListener('click',async()=>{if(!installPrompt)return;await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('#install-btn').hidden=true;});
function installed(){$('#install-btn').hidden=true;$('#install-help').textContent='Calistenia 28 está instalada. Puedes abrirla desde tu pantalla de inicio.';}
window.addEventListener('appinstalled',installed);if(matchMedia('(display-mode: standalone)').matches)installed();
async function setupOffline(){
 if(!('serviceWorker' in navigator)){$('#offline-status').textContent='Este navegador no permite guardar la app sin conexión.';return;}
 try {
  swRegistration=await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;$('#offline-status').textContent='Lista sin conexión: contenido y demostraciones guardados en este dispositivo.';
  const offerUpdate=()=>{if(swRegistration.waiting)$('#update-btn').hidden=false;};offerUpdate();
  swRegistration.addEventListener('updatefound',()=>{const worker=swRegistration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')offerUpdate();});});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(swRegistration.waiting===null && sessionStorage.getItem('calisthenics28-updating')){sessionStorage.removeItem('calisthenics28-updating');location.reload();}});
 }catch{$('#offline-status').textContent='No se pudo preparar el modo sin conexión. Conéctate y vuelve a abrir la app para reintentarlo.';}
}
$('#update-btn').addEventListener('click',()=>{if(running)pauseTimer();save();if(swRegistration?.waiting){try{sessionStorage.setItem('calisthenics28-updating','yes');}catch{}swRegistration.waiting.postMessage({type:'SKIP_WAITING'});}});
$('.hero-secondary').addEventListener('click',()=>{$('#guide').open=true;});
$('#session').closest('section').id='workout-section';
renderSession();save();
if(restored){$('#timer-info').textContent='Sesión recuperada y pausada. Pulsa «Continuar sesión» cuando estés listo.';if(elapsedMs>=900000)$('#timer-info').textContent='Tu sesión llegó al final. Puedes guardar el día completado.';}
if(storageWarning)notify('El almacenamiento no está disponible o había datos dañados. Exporta una copia para conservar tu avance.');
setupOffline();
