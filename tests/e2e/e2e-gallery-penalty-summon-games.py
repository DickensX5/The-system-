import json, os
from playwright.sync_api import sync_playwright
errs=[]; results=[]
def ok(name, cond, extra=''):
    results.append((name, bool(cond))); print(('PASS ' if cond else 'FAIL ')+name, extra)
B='http://localhost:8123/index.html'
with sync_playwright() as p:
    br=p.chromium.launch(); ctx=br.new_context(viewport={'width':390,'height':844}); pg=ctx.new_page()
    pg.on('console', lambda m: errs.append(f'[{m.type}] {m.text}') if m.type=='error' else None)
    pg.on('pageerror', lambda e: errs.append('[pageerror] '+str(e)))
    pg.goto(B); pg.wait_for_selector('#app:not([hidden])'); pg.wait_for_timeout(1000)
    # ---- Gallery upload (compress -> IndexedDB blob -> metadata)
    pg.goto(B+'#/q/physique'); pg.wait_for_timeout(400)
    pg.set_input_files('input[type=file]', ''+__import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)),'..','..','assets','branding','system-logo-1024.png')+''); pg.wait_for_timeout(1200)
    ok('photo stored (metadata)', pg.evaluate("window.__SYSTEM__.S().gallery.physique.length")==1)
    ok('photo blob in IndexedDB', pg.evaluate("window.__SYSTEM__.store.adapter.listBlobs().then(l=>l.length)")==1)
    ok('photo thumbnail rendered', pg.evaluate("!!document.querySelector('.photo-grid img')"))
    # ---- Financial missed day -> lock -> penalty
    pg.evaluate("""window.__SYSTEM__.act('setup',(s,c)=>{const d=new Date(Date.now()-3*864e5);const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
       s.fin.settings.trackStart=k; s.fin.settings.workdays=[0,1,2,3,4,5,6]; s.fin.tx.push({id:'fx-seed',at:c.now,date:k,type:'start',amount:200000,note:'seed',voided:false}); })""")
    pg.goto(B+'#/q/financial'); pg.wait_for_timeout(600)
    ok('financial tab locked after missed day', 'Financial tab locked' in pg.inner_text('#view'))
    pg.screenshot(path='/tmp/shot_lock.png')
    bal0=pg.evaluate("window.__SYSTEM__.S().fin.tx.filter(t=>!t.voided).reduce((a,t)=>a+(t.type==='start'||t.type==='income'?t.amount:-t.amount),0)")
    pg.click('button:has-text("deduction")'); pg.wait_for_timeout(600)
    bal1=pg.evaluate("window.__SYSTEM__.S().fin.tx.filter(t=>!t.voided).reduce((a,t)=>a+(t.type==='start'||t.type==='income'?t.amount:-t.amount),0)")
    ok('deduction is exactly TSh 6,000', bal0-bal1==6000, f'({bal0}->{bal1})')
    n_pen=pg.evaluate("window.__SYSTEM__.S().fin.tx.filter(t=>t.type==='penalty').length"); ok('exactly one penalty tx for that day', n_pen==1)
    # other days still pending -> tick again must not duplicate existing
    pg.evaluate("window.__SYSTEM__.act('t',(s,c)=>{})"); pg.wait_for_timeout(300)
    ok('no duplicate penalty records', pg.evaluate("Object.keys(window.__SYSTEM__.S().fin.penalties).length")==pg.evaluate("new Set(Object.values(window.__SYSTEM__.S().fin.penalties).map(p=>p.date)).size"))
    # ---- Summon via UI
    pg.evaluate("window.__SYSTEM__.act('lvl',(s,c)=>{ s.xp.physique=56*30; s.xp.intelligence=140*30; })"); pg.wait_for_timeout(300)
    lv=pg.evaluate("window.__SYSTEM__.ov()"); ok('overall level >= 5 after seeding', lv>=5, f'(LV {lv})')
    pg.goto(B+'#/summon'); pg.wait_for_timeout(500)
    pg.fill('#sm-amt','40'); pg.wait_for_timeout(300)
    pg.click('button:has-text("Send 40 XP")'); pg.wait_for_selector('.sheet'); pg.click('.sheet button:has-text("Send 40 XP")'); pg.wait_for_timeout(800)
    ok('summon moved exactly 40 XP', pg.evaluate("window.__SYSTEM__.S().xp.romance")==40 and pg.evaluate("window.__SYSTEM__.S().xp.physique")==56*30-40)
    ok('summon recorded in inbox', pg.evaluate("window.__SYSTEM__.S().inbox.events.some(e=>e.type==='summon')"))
    # ---- Chess: e2-e4 then AI answers
    pg.goto(B+'#/arcade'); pg.wait_for_timeout(300); pg.click('text=Chess'); pg.wait_for_timeout(300)
    pg.click('button[aria-label="e2 wP"]'); pg.click('button[aria-label="e4 empty"]'); pg.wait_for_timeout(1200)
    ok('chess: player move + computer reply', pg.evaluate("document.querySelectorAll('.board.chess .sq.last').length")==2 and 'White to move' in pg.inner_text('#view'))
    # ---- Sudoku generates
    pg.goto(B+'#/arcade'); pg.wait_for_timeout(300); pg.click('button[aria-label="All games"]'); pg.click('text=Sudoku'); pg.wait_for_selector('.sudoku', timeout=15000)
    ok('sudoku board generated', pg.evaluate("document.querySelectorAll('.sudoku .sq.fixed').length")>=30)
    # ---- Cube move changes net
    pg.goto(B+'#/arcade'); pg.wait_for_timeout(300); pg.click('button[aria-label="All games"]'); pg.click('text=Cube Core'); pg.wait_for_timeout(300)
    before=pg.evaluate("[...document.querySelectorAll('.net .f i')].map(e=>e.style.background).join()")
    pg.click('button[aria-label="Turn R"]'); pg.wait_for_timeout(200)
    after=pg.evaluate("[...document.querySelectorAll('.net .f i')].map(e=>e.style.background).join()")
    ok('cube turn changes the net, 4 turns restore it', before!=after)
    for _ in range(3): pg.click('button[aria-label="Turn R"]'); 
    pg.wait_for_timeout(200); ok('cube 4x R is identity', pg.evaluate("[...document.querySelectorAll('.net .f i')].map(e=>e.style.background).join()")==before)
    # ---- Settings: erase requires typing RESET
    pg.goto(B+'#/settings'); pg.wait_for_timeout(300); pg.click('button:has-text("Erase all data")'); pg.wait_for_selector('.sheet')
    pg.click('.sheet button:has-text("Erase")'); pg.wait_for_timeout(300); ok('erase refused without RESET', pg.evaluate("window.__SYSTEM__.S().xp.romance")==40)
    br.close()
bad=[e for e in errs if 'favicon' not in e]
print('\nCONSOLE ERRORS:', bad or 'none'); print(f"\n{sum(1 for _,c in results if c)}/{len(results)} E2E-2 checks passed")
