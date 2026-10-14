import json, re
from playwright.sync_api import sync_playwright
errs=[]; results=[]
def ok(name, cond, extra=''):
    results.append((name, bool(cond))); print(('PASS ' if cond else 'FAIL ')+name, extra)
B='http://localhost:8123/index.html'
with sync_playwright() as p:
    br=p.chromium.launch()
    ctx=br.new_context(viewport={'width':390,'height':844}); pg=ctx.new_page()
    pg.on('console', lambda m: errs.append(f'[{m.type}] {m.text}') if m.type=='error' else None)
    pg.on('pageerror', lambda e: errs.append('[pageerror] '+str(e)))
    pg.goto(B); pg.wait_for_selector('#app:not([hidden])'); pg.wait_for_timeout(1200)
    pg.evaluate("navigator.serviceWorker.ready.then(()=>1)"); 
    ok('service worker registered & ready', pg.evaluate("navigator.serviceWorker.ready.then(r=>!!r.active)"))
    # ---- Financial: income -> level up
    pg.goto(B+'#/q/financial'); pg.wait_for_timeout(300)
    pg.click('text=Income'); pg.wait_for_selector('.sheet'); pg.fill('.sheet input[type=number]','100000'); pg.click('.sheet button:has-text("Save")'); pg.wait_for_timeout(700)
    ok('balance shows TSh 100,000', 'TSh 100,000' in pg.inner_text('#view'))
    ok('financial level 3 (100000/36000)', 'Level 3' in pg.inner_text('#view'))
    if pg.query_selector('.levelup'):
        pg.screenshot(path='/tmp/shot_levelup.png'); pg.click('.levelup')
    ok('overall level-up celebration appeared', os.path.exists('/tmp/shot_levelup.png') if (os:=__import__('os')) else False)
    # ---- overspend rejected with message, nothing changed
    pg.click('text=Spending'); pg.wait_for_selector('.sheet'); pg.fill('.sheet input[type=number]','999999'); pg.click('.sheet button:has-text("Save")'); pg.wait_for_timeout(400)
    ok('overspend rejected with toast', 'Not enough recorded balance' in pg.inner_text('#toasts'))
    ok('balance unchanged after rejection', pg.evaluate("window.__SYSTEM__.S().fin.tx.length")==1)
    pg.keyboard.press('Escape')
    # ---- persistence across reload
    pg.reload(); pg.wait_for_selector('#app:not([hidden])'); pg.wait_for_timeout(900)
    pg.goto(B+'#/q/financial'); pg.wait_for_timeout(400)
    ok('income persisted after reload', 'TSh 100,000' in pg.inner_text('#view'))
    # ---- Physique
    pg.goto(B+'#/q/physique'); pg.wait_for_timeout(300)
    pg.click('button:has-text("All 20") >> nth=0'); pg.wait_for_timeout(500)
    ok('push-ups complete -> 2 XP', pg.evaluate("window.__SYSTEM__.S().xp.physique")==2)
    # ---- Rewards: claim twice quickly (double tap)
    pg.goto(B+'#/rewards'); pg.wait_for_timeout(400)
    n=pg.evaluate("Object.values(window.__SYSTEM__.S().grants).filter(g=>!g.claimed).length")
    ok('level-up grants waiting', n>=2, f'({n})')
    btn=pg.query_selector('.li button:has-text("Claim")'); btn.dblclick(); pg.wait_for_timeout(700)
    claimed=pg.evaluate("Object.values(window.__SYSTEM__.S().grants).filter(g=>g.claimed).length")
    ok('double-tap claims exactly one', claimed==1, f'(claimed={claimed})')
    gold=pg.evaluate("window.__SYSTEM__.S().currency.gold"); ok('gold received once', gold==20, f'(gold={gold})')
    # ---- Lootbox
    pg.evaluate("""window.__SYSTEM__.act('give', (s,c)=>{ s.inv.items['phy_iron-crate']={count:1,at:c.now}; })""")
    pg.click('button.tab:has-text("Inventory")'); pg.wait_for_timeout(300)
    pg.click('.item:has-text("Iron Crate")'); pg.wait_for_selector('.sheet'); pg.click('.sheet button:has-text("Open")'); pg.wait_for_selector('.reveal .gem.item', timeout=4000); pg.wait_for_timeout(300)
    pg.screenshot(path='/tmp/shot_loot.png')
    ok('lootbox opened once, one event', pg.evaluate("window.__SYSTEM__.S().inbox.events.filter(e=>e.type==='lootbox').length")==1)
    pg.click('.sheet button:has-text("Nice")')
    # ---- Intelligence daily via UI
    pg.goto(B+'#/q/intelligence'); pg.wait_for_timeout(500)
    qs=pg.evaluate("import('/js/data/intelligence-bank.js').then(m=>m.dailyQuestions(new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0')+'-'+String(new Date().getDate()).padStart(2,'0')))")
    for i,q in enumerate(qs):
        card=pg.locator('.question').nth(i)
        if q['type']=='choice': card.locator('.opt').nth(q['answer']).click()
        else: card.locator('input').fill(str(q['answer'])); card.locator('button:has-text("Check")').click()
        pg.wait_for_timeout(500)
    ok('daily quest gives 20 XP', pg.evaluate("window.__SYSTEM__.S().xp.intelligence")==20)
    # ---- Offline reload
    ctx.set_offline(True); pg.goto(B+'#/home'); pg.wait_for_selector('#app:not([hidden])', timeout=8000); pg.wait_for_timeout(1200)
    ok('app boots while OFFLINE', 'LV' in pg.inner_text('#view'))
    ok('offline banner shown', 'offline' in pg.inner_text('#banners').lower())
    pg.screenshot(path='/tmp/shot_offline.png')
    ctx.set_offline(False)
    # ---- Settings export has data
    pg.goto(B+'#/settings'); pg.wait_for_timeout(400)
    with pg.expect_download() as d: pg.click('button:has-text("Export progress")')
    data=json.load(open(d.value.path())); ok('export contains progress', data['fin']['tx'] and data['xp']['physique']==2)
    br.close()
bad=[e for e in errs if 'favicon' not in e]
print('\nCONSOLE ERRORS:', bad or 'none')
print(f"\n{sum(1 for _,c in results if c)}/{len(results)} E2E checks passed")
