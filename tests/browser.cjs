// npm install --no-save playwright, then npm run test:browser.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const base=process.env.TEST_URL || pathToFileURL(path.resolve(__dirname,'../index.html')).href;
const out=process.env.SCREENSHOT_DIR;
if(out)fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'chrome',headless:true});
 try {
  const context=await browser.newContext({viewport:{width:1280,height:800},hasTouch:true});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const checkLayout=async(label)=>{
   const bad=await page.evaluate(()=>[...document.querySelectorAll('button,a,canvas')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left<-.5||r.right>innerWidth+.5)}).map(e=>e.id||e.textContent));
   assert.deepEqual(bad,[],label+' has clipped controls');
  };
  for(const [width,height]of[[320,740],[375,812],[414,896],[768,1024],[1280,800],[844,390]]){
   await page.setViewportSize({width,height});await page.goto(base);await checkLayout(`lobby ${width}`);
   await page.locator('.hero-art').evaluate(img=>img.decode());
   assert.ok(await page.locator('.hero-art').evaluate(img=>img.naturalWidth>0 && img.getBoundingClientRect().height>0),'landing image loads and is visible');
   if(width===1280){const b=await page.locator('#toTeam').boundingBox();assert.ok(b.y+b.height<=height,'primary action fits laptop viewport');}
   await page.click('#toTeam');assert.equal(await page.locator('.teamCard').count(),16);await checkLayout(`teams ${width}`);
   await page.getByRole('button',{name:'대한민국 선택',exact:true}).click();await checkLayout(`match ${width}`);
   const r=await page.locator('canvas').boundingBox();assert.ok(r.y>=0&&r.y+r.height<=height,`field fits ${width}`);
  }
  console.log('PASS: lobby, 16 teams, match at 6 viewports including landscape');
  await page.setViewportSize({width:1280,height:800});await page.goto(base);if(out)await page.screenshot({path:path.join(out,'mini-match-desktop.png'),fullPage:true});
  await page.setViewportSize({width:375,height:812});if(out)await page.screenshot({path:path.join(out,'mini-match-mobile.png'),fullPage:true});
  await page.click('[data-mode="2p"]');await page.click('[data-goal="3"]');await page.click('#toTeam');
  await page.getByRole('button',{name:'대한민국 선택',exact:true}).click();assert.equal(await page.locator('.teamCard:disabled').count(),1);
  if(out)await page.screenshot({path:path.join(out,'mini-match-teams.png'),fullPage:true});
  await page.getByRole('button',{name:'브라질 선택',exact:true}).click();await page.waitForFunction(()=>kickoff===0);
  const start=await page.evaluate(()=>players.p1.x);await page.keyboard.down('KeyA');await page.waitForTimeout(250);await page.keyboard.up('KeyA');assert.ok(await page.evaluate(()=>players.p1.x)<start-20);
  await page.keyboard.press('Space');assert.ok(await page.evaluate(()=>paused));
  const still=await page.evaluate(()=>JSON.stringify(ball));await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>JSON.stringify(ball)),still);
  await page.keyboard.press('Shift+Tab');assert.equal(await page.locator('#quit').evaluate(e=>e===document.activeElement),true);
  await page.click('#resume');assert.equal(await page.evaluate(()=>paused),false);
  console.log('PASS: keyboard movement, pause, frozen physics, modal focus, resume');
  await page.evaluate(()=>{resetPositions();defenders.length=0;ball.x=80;ball.y=500;ball.vx=0;ball.vy=0;});
  const cdp=await context.newCDPSession(page);
  const points=await page.evaluate(()=>{const r=canvas.getBoundingClientRect();const p=(id,x,y)=>({id,x:r.left+x/W*r.width,y:r.top+y/H*r.height});return{start:[p(1,300,780),p(2,300,220)],end:[p(1,150,700),p(2,450,280)]};});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points.start});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points.end});await page.waitForTimeout(180);
  assert.ok(await page.evaluate(()=>players.p1.x<200&&players.p2.x>400),'both touches move independently');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok(await page.evaluate(()=>players.p1.touch===null&&players.p2.touch===null));
  console.log('PASS: simultaneous two-player touch and release');
  if(out)await page.screenshot({path:path.join(out,'mini-match-game.png'),fullPage:true});
  await page.evaluate(()=>{score.p1=2;ball.x=300;ball.y=24;ball.vy=-5;});await page.waitForSelector('#endScreen:not(.hidden)');
  assert.match(await page.locator('#winText').textContent(),/대한민국/);assert.equal(await page.locator('#finalScore').textContent(),'3 : 0');
  if(out)await page.screenshot({path:path.join(out,'mini-match-result.png'),fullPage:true});
  await page.click('#rematch');assert.equal(await page.locator('#liveScore').textContent(),'0 : 0');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.waitForSelector('#pauseScreen:not(.hidden)');await page.click('#quit');await page.waitForSelector('#startScreen:not(.hidden)');
  await page.click('#install');assert.match(await page.locator('#status').textContent(),/홈 화면|설치/);
  await page.evaluate(()=>Object.defineProperty(navigator,'share',{value:undefined,configurable:true}));
  await page.click('#share');await page.waitForFunction(()=>/복사|공유/.test(document.getElementById('status').textContent));
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.btn').first().evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
  assert.deepEqual(errors,[]);console.log('PASS: winning goal, result, rematch, blur pause, exit, install/share fallback, reduced motion, no JS errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
