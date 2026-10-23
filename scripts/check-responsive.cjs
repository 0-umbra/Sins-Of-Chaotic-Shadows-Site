const {chromium}=require('playwright');
(async()=>{
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.url()+':'+r.status())});
for(const [w,h] of [[320,740],[375,812],[430,932],[600,960],[768,1024],[820,1180],[1024,768],[1180,820],[1280,800],[1440,900],[1920,1080]]){
 await page.setViewportSize({width:w,height:h});await page.goto('http://localhost:8080');await page.waitForFunction(()=>document.querySelector('#fVer').textContent==='0.22.1');
 const over=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width&&s.position!=='absolute'&&s.position!=='fixed'&&(r.right>innerWidth+1||r.left< -1)}).map(e=>e.className||e.id||e.tagName));
 if(over.length)throw Error(`${w}: overflowing ${over}`);
 // Verify no stretched/cropped screenshots or logos
 const badImgs=await page.evaluate(()=>[...document.querySelectorAll('img')].filter(img=>{
  if(img.id==='lbImg'||!img.complete||!img.naturalWidth)return false;
  const r=img.getBoundingClientRect(),s=getComputedStyle(img);
  if(!r.width||!r.height)return false;
  if(s.objectFit!=='contain')return true;
  const nat=img.naturalWidth/img.naturalHeight,box=r.width/r.height;
  return Math.abs(nat-box)>0.06;
 }).map(i=>i.src));
 if(badImgs.length)throw Error(`${w}: distorted or non-contain images ${badImgs}`);
 for(const id of ['trailer','download','showcase','maps','modes','weapons','abilities','gallery','updates','community','compatibility','faq','about']){await page.locator('#'+id).scrollIntoViewIfNeeded();}
 if(!await page.locator('#updatesTitle').isVisible() || await page.locator('.update-card').count()!==5)throw Error('updates missing');
 if(await page.getByRole('link',{name:'Play in Browser',exact:true}).count())throw Error('browser play remains');
 if(await page.getByText(/no sign.up required/i).count())throw Error('old sign-up statement remains');
 if(await page.getByText(/twitter/i).count())throw Error('twitter reference remains');
 if(!await page.locator('#offlineTitle').isVisible())throw Error('offline notice missing');
 if(!await page.locator('#reportIssue').textContent().then(t=>t.includes('UNDER DEVELOPMENT')))throw Error('issue under-development notice missing');
 if(await page.locator('#meleeCollection img').count()!==0)throw Error('melee collection still has unrelated image');
 if(await page.locator('[data-dev-discord]').first().getAttribute('href')!=='https://discord.com/users/1341279384535044097')throw Error('dev discord link mismatch');
 if(!await page.locator('.dl-note').textContent().then(t=>t.includes('Security Scan Notice:')))throw Error('install note missing');
 if(await page.locator('#dlBtn').getAttribute('href')!=='/apk/SCS.apk')throw Error('download changed');
 if(await page.locator('#heroDl').getAttribute('href')!=='/apk/SCS.apk')throw Error('hero download changed');
 // Interactive filter checks (maps, weapons, resonators)
 await page.locator('[data-map-filter="sunken-meridian"]').click();
 if(await page.locator('#mapsGrid .map-card:visible').count()!==1)throw Error('sunken meridian map filter failed');
 await page.locator('[data-map-filter="active"]').click();
 if(await page.locator('#mapsGrid .map-card:visible').count()!==4)throw Error('active maps filter failed');
 await page.locator('[data-map-filter="all"]').click();
 if(await page.locator('#mapsGrid .map-card:visible').count()!==5)throw Error('all maps filter failed');
 await page.locator('[data-wfilter="sniper"]').click();
 if(await page.locator('#weaponGrid .wcard:visible').count()!==3)throw Error('weapon filter failed');
 await page.locator('[data-wfilter="all"]').click();
 await page.locator('[data-res="rift"]').click();
 if(!await page.locator('[data-res-panel="rift"]').isVisible())throw Error('resonator switch failed');
 await page.locator('[data-res="vex"]').click();
 await page.evaluate(()=>scrollTo(0,0));
 if(w<=1100){await page.locator('#burger').click();await page.locator('#navLinks a').last().click();if(await page.locator('#burger').getAttribute('aria-expanded')!=='false')throw Error('menu state');await page.locator('#burger').click();await page.keyboard.press('Escape');}
 await page.locator('[data-modal="mTerms"]').click();await page.keyboard.press('Tab');if(await page.evaluate(()=>!document.querySelector('#mTerms').contains(document.activeElement)))throw Error('focus leak');await page.keyboard.press('Escape');if(await page.locator('#mTerms').isVisible())throw Error('modal open');
 await page.locator('.gitem').first().click();await page.keyboard.press('ArrowRight');await page.keyboard.press('Escape');
 console.log(`PASS ${w}x${h}`);
}
console.log('Browser errors:',errors);if(errors.length)throw Error('browser errors');
const response=await page.request.get('http://localhost:8080/apk/SCS.apk');const crypto=require('node:crypto');if(crypto.createHash('sha256').update(await response.body()).digest('hex')!=='da487b1657b3c2d5ac3f8f6340de9b11eb45de55d55899e631d2ac0ddb907280')throw Error('APK checksum');console.log('PASS APK bytes and original destination');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
