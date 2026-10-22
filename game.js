// ===== 선택 가능한 국가대표 16팀 =====
const TEAMS = [
  { name:'대한민국', flag:'🇰🇷', color:'#e63946', dark:'#a01b28' },
  { name:'브라질',   flag:'🇧🇷', color:'#ffcf33', dark:'#1a8a4b' },
  { name:'아르헨티나',flag:'🇦🇷', color:'#79c0ec', dark:'#2f6fa8' },
  { name:'프랑스',   flag:'🇫🇷', color:'#2a4cc4', dark:'#16306b' },
  { name:'독일',     flag:'🇩🇪', color:'#3a3a3a', dark:'#000000' },
  { name:'스페인',   flag:'🇪🇸', color:'#d11149', dark:'#8a0a30' },
  { name:'잉글랜드', flag:'🏴', color:'#e8edf3', dark:'#11224a' },
  { name:'포르투갈', flag:'🇵🇹', color:'#15663a', dark:'#0c3d22' },
  { name:'네덜란드', flag:'🇳🇱', color:'#ff7b1c', dark:'#c25600' },
  { name:'일본',     flag:'🇯🇵', color:'#283593', dark:'#141d5e' },
  { name:'이탈리아', flag:'🇮🇹', color:'#1f9e8f', dark:'#0f5e55' },
  { name:'벨기에',   flag:'🇧🇪', color:'#f4b400', dark:'#8a6500' },
  { name:'크로아티아',flag:'🇭🇷', color:'#c0392b', dark:'#7a2018' },
  { name:'우루과이', flag:'🇺🇾', color:'#5aa9e6', dark:'#2c6fa6' },
  { name:'멕시코',   flag:'🇲🇽', color:'#2e9e4f', dark:'#176b32' },
  { name:'미국',     flag:'🇺🇸', color:'#5b2a86', dark:'#371a52' },
];

const config = { mode:'1p', winScore:5, team1:null, team2:null, picking:1 };
const $ = id => document.getElementById(id);
let paused = false, kickoff = 0, matchActive = false, soundOn = false, audioContext;
const keys = new Set();
const palette = { turf:'#284d35', stripe:'#2d533b', line:'#9eb294', accent:'#d1f566', white:'#f3f5ec', shadow:'#00000040', ink:'#162319' };

// ===== 캔버스 / 좌표계 =====
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = 600, H = 1000;
let scale = 1;

function resize() {
  const rect = $('wrap').getBoundingClientRect();
  scale = Math.min(Math.max(180, rect.width - 24) / W, Math.max(180, rect.height - 8) / H);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.style.width = `${W * scale}px`; canvas.style.height = `${H * scale}px`;
  canvas.width = Math.round(W * scale * dpr); canvas.height = Math.round(H * scale * dpr);
  const bounds = canvas.getBoundingClientRect(); offX = bounds.left; offY = bounds.top;
}
window.addEventListener('resize', resize);
resize();

const GOAL_W = 220;
const GOAL_X1 = (W - GOAL_W) / 2, GOAL_X2 = (W + GOAL_W) / 2;

const players = {
  p1: { x: W/2, y: H*0.78, r: 46, color:'#4da3ff', dark:'#1f6fd6', vx:0, vy:0, px:W/2, py:H*0.78, touch:null, half:[H/2, H] },
  p2: { x: W/2, y: H*0.22, r: 46, color:'#ff5a5a', dark:'#d62f2f', vx:0, vy:0, px:W/2, py:H*0.22, touch:null, half:[0, H/2] },
};
const ball = { x: W/2, y: H/2, vx: 0, vy: 0, r: 26 };

// 경기장 곳곳을 랜덤하게 돌아다니는 수비수들 (팀별 색상)
const DEF_R = 24, DEF_SPEED = 1.4, DEF_PER_TEAM = 3;
const ROAM = { xMin: DEF_R + 10, xMax: W - DEF_R - 10, yMin: 160, yMax: H - 160 };
const defenders = [];
function makeDefenders() {
  defenders.length = 0;
  const t1 = config.team1 || { color:'#ff9a3d', dark:'#cc6f1a' };
  const t2 = config.team2 || { color:'#ff9a3d', dark:'#cc6f1a' };
  for (let i = 0; i < DEF_PER_TEAM * 2; i++) {
    const team = i < DEF_PER_TEAM ? t1 : t2;
    const a = Math.random() * Math.PI * 2;
    defenders.push({
      x: ROAM.xMin + Math.random() * (ROAM.xMax - ROAM.xMin),
      y: ROAM.yMin + Math.random() * (ROAM.yMax - ROAM.yMin),
      r: DEF_R, speed: DEF_SPEED, zone: ROAM,
      vx: Math.cos(a) * DEF_SPEED, vy: Math.sin(a) * DEF_SPEED,
      color: team.color, dark: team.dark,
    });
  }
}
makeDefenders();

let score = { p1: 0, p2: 0 };
let running = false;
let goalFlash = 0;

function resetPositions(servingTo) {
  clearInput();
  ball.x = W/2; ball.y = H/2;
  ball.vx = 0; ball.vy = (servingTo === 'p1') ? 4 : (servingTo === 'p2') ? -4 : 0;
  players.p1.x = players.p1.px = W/2; players.p1.y = players.p1.py = H*0.78;
  players.p2.x = players.p2.px = W/2; players.p2.y = players.p2.py = H*0.22;
  makeDefenders();
}

// ===== 화면 전환 =====
function show(id) {
  for (const s of ['startScreen','teamScreen','endScreen','pauseScreen']) document.getElementById(s).classList.add('hidden');
  if (id) document.getElementById(id).classList.remove('hidden');
  const inMatch = !id || id === 'endScreen' || id === 'pauseScreen';
  $('matchScreen').classList.toggle('hidden', !inMatch);
  $('siteHeader').classList.toggle('hidden', inMatch);
  $('siteFooter').classList.toggle('hidden', inMatch);
  $('matchScreen').inert = id === 'endScreen' || id === 'pauseScreen';
  if (!inMatch) { running = false; matchActive = false; clearInput(); }
  if (id === 'startScreen') $('toTeam').focus({preventScroll:true});
  if (id === 'pauseScreen') $('resume').focus();
  if (id === 'endScreen') $('rematch').focus();
}

document.getElementById('modeRow').addEventListener('click', e => {
  const b = e.target.closest('[data-mode]'); if (!b) return;
  config.mode = b.dataset.mode; setSel('modeRow', b);
});
document.getElementById('goalRow').addEventListener('click', e => {
  const b = e.target.closest('[data-goal]'); if (!b) return;
  config.winScore = +b.dataset.goal; setSel('goalRow', b);
});
function setSel(rowId, btn) {
  for (const c of document.getElementById(rowId).children) { c.classList.toggle('sel', c === btn); c.setAttribute('aria-pressed', c === btn); }
}
document.getElementById('toTeam').onclick = showTeamSelect;
document.getElementById('backToLanding').onclick = () => show('startScreen');
document.getElementById('rematch').onclick = beginMatch;
document.getElementById('home').onclick = () => show('startScreen');

function showTeamSelect() {
  config.team1 = null; config.team2 = null; config.picking = 1;
  buildGrid(); show('teamScreen'); updateTeamPrompt();
}
function updateTeamPrompt() {
  const el = document.getElementById('teamPrompt');
  if (config.picking === 1) {
    el.innerHTML = (config.mode === '1p' ? '내 팀을 선택하세요' : '플레이어 1 팀 선택');
    $('pickStep').textContent = 'CHOOSE YOUR SIDE / 01';
    $('selectionNote').textContent = config.mode === '1p' ? '아래쪽이 내 진영입니다. 상대 팀은 자동으로 정해져요.' : '플레이어 1은 아래쪽 · 플레이어 2는 위쪽에서 플레이해요.';
  } else {
    el.textContent = '상대 국가대표를 선택하세요';
    $('pickStep').textContent = 'CHOOSE YOUR SIDE / 02';
    $('selectionNote').textContent = `플레이어 1 · ${config.team1.name} 선택 완료. 플레이어 2의 팀을 골라주세요.`;
  }
  el.focus({preventScroll:true});
}
function buildGrid() {
  const g = document.getElementById('teamGrid'); g.innerHTML = '';
  TEAMS.forEach((t, i) => {
    const card = document.createElement('button');
    card.type = 'button'; card.disabled = config.team1 === t;
    card.setAttribute('aria-label', t.name + (card.disabled ? ' (이미 선택한 팀)' : ' 선택'));
    card.className = 'teamCard' + (config.team1 === t ? ' disabled' : '');
    card.innerHTML =
      `<div class="swatch" style="background:${t.color};border:2px solid ${t.dark}"></div>` +
      `<div><span class="flag" aria-hidden="true">${['KOR','BRA','ARG','FRA','GER','ESP','ENG','POR','NED','JPN','ITA','BEL','CRO','URU','MEX','USA'][i]}</span><span class="nm">${t.name}</span></div>`;
    card.onclick = () => pickTeam(t);
    g.appendChild(card);
  });
}
function pickTeam(t) {
  if (config.team1 === t) return;
  if (config.picking === 1) {
    config.team1 = t;
    if (config.mode === '2p') { config.picking = 2; buildGrid(); updateTeamPrompt(); }
    else {
      const others = TEAMS.filter(x => x !== t);
      config.team2 = others[Math.floor(Math.random() * others.length)];
      beginMatch();
    }
  } else {
    config.team2 = t; beginMatch();
  }
}
function beginMatch() {
  show(null);
  players.p1.color = config.team1.color; players.p1.dark = config.team1.dark;
  players.p2.color = config.team2.color; players.p2.dark = config.team2.dark;
  score = { p1: 0, p2: 0 };
  resetPositions(null);
  running = true; paused = false; matchActive = true; kickoff = 150; goalFlash = 0;
  updateHUD(); resize(); canvas.focus({preventScroll:true});
}

// ===== 입력 =====
function toGame(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return { x: (clientX - r.left) * W/r.width, y: (clientY - r.top) * H/r.height };
}
function clampHalf(p, y) {
  return Math.max(p.half[0] + p.r, Math.min(p.half[1] - p.r, y));
}
function claimPlayer(p, gx, gy, id) {
  if (gy >= p.half[0] && gy <= p.half[1]) {
    p.touch = id; p.px = Math.max(p.r, Math.min(W-p.r, gx)); p.py = clampHalf(p, gy); return true;
  }
  return false;
}
function handleStart(id, clientX, clientY) {
  if (!running || paused || kickoff > 0) return;
  const g = toGame(clientX, clientY);
  if (players.p1.touch === null && claimPlayer(players.p1, g.x, g.y, id)) return;
  if (config.mode === '2p' && players.p2.touch === null && claimPlayer(players.p2, g.x, g.y, id)) return;
}
function handleMove(id, clientX, clientY) {
  const g = toGame(clientX, clientY);
  for (const key in players) {
    const p = players[key];
    if (p.touch === id) {
      p.px = Math.max(p.r, Math.min(W - p.r, g.x));
      p.py = clampHalf(p, g.y);
    }
  }
}
function handleEnd(id) {
  for (const key in players) if (players[key].touch === id) players[key].touch = null;
}

canvas.addEventListener('touchstart', e => { e.preventDefault();
  for (const t of e.changedTouches) handleStart(t.identifier, t.clientX, t.clientY); }, {passive:false});
canvas.addEventListener('touchmove', e => { e.preventDefault();
  for (const t of e.changedTouches) handleMove(t.identifier, t.clientX, t.clientY); }, {passive:false});
canvas.addEventListener('touchend', e => { e.preventDefault();
  for (const t of e.changedTouches) handleEnd(t.identifier); }, {passive:false});
canvas.addEventListener('touchcancel', e => {
  for (const t of e.changedTouches) handleEnd(t.identifier); }, {passive:false});

let mouseDown = false;
canvas.addEventListener('mousedown', e => { mouseDown = true; handleStart('mouse', e.clientX, e.clientY); });
canvas.addEventListener('mousemove', e => { if (mouseDown) handleMove('mouse', e.clientX, e.clientY); });
window.addEventListener('mouseup', () => { mouseDown = false; handleEnd('mouse'); });

// ===== 컴퓨터(AI) =====
function aiControl(p) {
  let tx, ty;
  if (ball.y < H * 0.58) { tx = ball.x; ty = ball.y; }   // 자기 진영에 공이 오면 쫓아감
  else { tx = W/2; ty = H*0.22; }                         // 아니면 골문 앞 대기
  const step = 5.5;                                       // 반응 속도 제한 → 적당히 이길 수 있게
  p.px += Math.max(-step, Math.min(step, tx - p.px));
  p.py = clampHalf(p, p.py + Math.max(-step, Math.min(step, ty - p.py)));
  p.px = Math.max(p.r, Math.min(W - p.r, p.px));
}

// ===== 물리 =====
function updatePlayer(p) {
  const nx = p.x + (p.px - p.x) * 0.4;
  const ny = p.y + (p.py - p.y) * 0.4;
  p.vx = nx - p.x; p.vy = ny - p.y;
  p.x = nx; p.y = ny;
}
function collideCircle(c) {
  const dx = ball.x - c.x, dy = ball.y - c.y;
  const dist = Math.hypot(dx, dy);
  const min = c.r + ball.r;
  if (dist < min) {
    const nx = dist > 0 ? dx / dist : 0, ny = dist > 0 ? dy / dist : (c.y > H/2 ? -1 : 1);
    ball.x = c.x + nx * min; ball.y = c.y + ny * min;
    const speed = Math.hypot(ball.vx, ball.vy);
    ball.vx = nx * (speed * 0.5 + 5) + (c.vx || 0) * 1.5;
    ball.vy = ny * (speed * 0.5 + 5) + (c.vy || 0) * 1.5;
    tone(190 + speed * 10, .035);
  }
}
function updateDefender(d) {
  if (Math.random() < 0.03) {
    const a = Math.random() * Math.PI * 2;
    d.vx += Math.cos(a) * 0.6; d.vy += Math.sin(a) * 0.6;
  }
  const sp = Math.hypot(d.vx, d.vy) || 1;
  d.vx = d.vx / sp * d.speed; d.vy = d.vy / sp * d.speed;
  d.x += d.vx; d.y += d.vy;
  const z = d.zone;
  if (d.x < z.xMin) { d.x = z.xMin; d.vx = Math.abs(d.vx); }
  if (d.x > z.xMax) { d.x = z.xMax; d.vx = -Math.abs(d.vx); }
  if (d.y < z.yMin) { d.y = z.yMin; d.vy = Math.abs(d.vy); }
  if (d.y > z.yMax) { d.y = z.yMax; d.vy = -Math.abs(d.vy); }
}

function update() {
  if (!running || paused) return;
  if (kickoff > 0) { kickoff--; return; }
  keyboardControl(players.p1, 'KeyA','KeyD','KeyW','KeyS');
  if (config.mode === '2p') keyboardControl(players.p2, 'ArrowLeft','ArrowRight','ArrowUp','ArrowDown');
  if (config.mode === '1p') aiControl(players.p2);
  updatePlayer(players.p1);
  updatePlayer(players.p2);
  defenders.forEach(updateDefender);

  ball.x += ball.vx; ball.y += ball.vy;
  ball.vx *= 0.992; ball.vy *= 0.992;
  const sp = Math.hypot(ball.vx, ball.vy);
  if (sp > 26) { ball.vx *= 26/sp; ball.vy *= 26/sp; }

  if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx) * 0.8; }
  if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx) * 0.8; }
  if (ball.y < ball.r) {
    if (ball.x > GOAL_X1 && ball.x < GOAL_X2) { goal('p1'); return; }
    ball.y = ball.r; ball.vy = Math.abs(ball.vy) * 0.8;
  }
  if (ball.y > H - ball.r) {
    if (ball.x > GOAL_X1 && ball.x < GOAL_X2) { goal('p2'); return; }
    ball.y = H - ball.r; ball.vy = -Math.abs(ball.vy) * 0.8;
  }

  collideCircle(players.p1);
  collideCircle(players.p2);
  defenders.forEach(collideCircle);
}

function goal(scorer) {
  score[scorer]++;
  goalFlash = 30; updateHUD(); tone(660, .18);
  if (score[scorer] >= config.winScore) {
    running = false;
    const team = scorer === 'p1' ? config.team1 : config.team2;
    matchActive = false; clearInput();
    $('winText').textContent = `${team.name}, 승리!`;
    $('finalScore').textContent = `${score.p1} : ${score.p2}`;
    $('resultTeams').textContent = `${config.team1.name} vs ${config.team2.name}`;
    show('endScreen');
    return;
  }
  resetPositions(scorer === 'p1' ? 'p2' : 'p1');
  kickoff = 120;
}

// ===== 그리기 =====
function drawField() {
  ctx.fillStyle = palette.turf; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = palette.stripe;
  for (let i = 0; i < H; i += 100) ctx.fillRect(0, i, W, 50);

  ctx.strokeStyle = palette.line; ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, W-16, H-16);
  ctx.beginPath(); ctx.moveTo(8, H/2); ctx.lineTo(W-8, H/2); ctx.stroke();
  ctx.beginPath(); ctx.arc(W/2, H/2, 90, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.arc(W/2, H/2, 6, 0, Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.fill();

  ctx.lineWidth = 8; ctx.strokeStyle = palette.accent;
  ctx.beginPath(); ctx.moveTo(GOAL_X1, 8); ctx.lineTo(GOAL_X2, 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(GOAL_X1, H-8); ctx.lineTo(GOAL_X2, H-8); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 3;
  ctx.strokeRect(GOAL_X1-50, 8, GOAL_W+100, 130);
  ctx.strokeRect(GOAL_X1-50, H-138, GOAL_W+100, 130);
  ctx.lineWidth = 1; ctx.strokeStyle = palette.line;
  for (let x = GOAL_X1; x <= GOAL_X2; x += 20) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,30); ctx.moveTo(x,H); ctx.lineTo(x,H-30); ctx.stroke(); }
  ctx.save(); ctx.globalAlpha = .4; ctx.textAlign='center'; ctx.font='bold 20px sans-serif'; ctx.fillStyle=palette.white;
  ctx.fillText('MINI MATCH', W/2, H/2-120); ctx.restore();
}
function drawDefender(d) {
  ctx.beginPath(); ctx.arc(d.x, d.y+4, d.r, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
  ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI*2);
  ctx.fillStyle = d.color; ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = d.dark; ctx.stroke();
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = palette.white; ctx.fillText(['3','6','8'][defenders.indexOf(d)%3], d.x, d.y+1); ctx.textBaseline = 'alphabetic';
}
function drawPlayer(p) {
  ctx.beginPath(); ctx.arc(p.x, p.y+4, p.r, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
  ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
  ctx.fillStyle = p.color; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = p.dark; ctx.stroke();
  ctx.beginPath(); ctx.arc(p.x, p.y, p.r*0.45, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
  ctx.fillStyle = p.dark; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 23px sans-serif';
  ctx.fillText(p === players.p1 ? '1' : '2', p.x, p.y+1); ctx.textBaseline = 'alphabetic';
}
function drawBall() {
  ctx.beginPath(); ctx.arc(ball.x, ball.y+3, ball.r, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
  ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#222'; ctx.stroke();
  ctx.fillStyle = palette.ink; ctx.strokeStyle = palette.ink; ctx.lineWidth = 1.5;
  const spin = (ball.x + ball.y) / 75;
  ctx.beginPath();
  for(let i=0;i<5;i++){ const a=spin+i*Math.PI*2/5; const x=ball.x+Math.cos(a)*ball.r*.42,y=ball.y+Math.sin(a)*ball.r*.42; if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y); }
  ctx.closePath(); ctx.fill();
  for(let i=0;i<5;i++){const a=spin+i*Math.PI*2/5;ctx.beginPath();ctx.moveTo(ball.x+Math.cos(a)*ball.r*.42,ball.y+Math.sin(a)*ball.r*.42);ctx.lineTo(ball.x+Math.cos(a)*ball.r*.9,ball.y+Math.sin(a)*ball.r*.9);ctx.stroke();}
}
function drawScore() {
  if (!config.team1 || !config.team2) return;
  ctx.textAlign = 'center';
  // 위쪽 = team2 (뒤집어서 표시)
  ctx.save(); ctx.translate(W/2, H/2 - 30); ctx.rotate(Math.PI);
  ctx.font = 'bold 24px sans-serif'; ctx.fillStyle = config.team2.color;
  ctx.fillText(config.team2.flag + ' ' + config.team2.name, 0, -36);
  ctx.font = 'bold 54px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(score.p2, 0, 6);
  ctx.restore();
  // 아래쪽 = team1
  ctx.font = 'bold 24px sans-serif'; ctx.fillStyle = config.team1.color;
  ctx.fillText(config.team1.flag + ' ' + config.team1.name, W/2, H/2 + 30);
  ctx.font = 'bold 54px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(score.p1, W/2, H/2 + 84);
}

function draw() {
  ctx.save(); ctx.scale(canvas.width/W, canvas.height/H);
  drawField();
  defenders.forEach(drawDefender);
  drawBall();
  drawPlayer(players.p1);
  drawPlayer(players.p2);
  ctx.restore();
  const announcement = $('announcement');
  announcement.classList.toggle('hidden', !running || kickoff <= 0);
  if (running && kickoff > 0) announcement.firstElementChild.textContent = goalFlash > 0 ? 'GOAL!' : kickoff > 30 ? String(Math.ceil((kickoff-30)/40)) : 'KICK OFF';
  if (!paused && goalFlash > 0) goalFlash--;
}

// Fixed 60 Hz simulation keeps high-refresh screens from speeding up the match.
let previousTime = 0, accumulator = 0;
function loop(time) {
  accumulator += Math.min(time - previousTime, 100); previousTime = time;
  while (accumulator >= 1000/60) { update(); accumulator -= 1000/60; }
  if (!$('matchScreen').classList.contains('hidden')) draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function clearInput() {
  keys.clear();
  for (const p of Object.values(players)) { p.touch = null; p.px = p.x; p.py = p.y; p.vx = p.vy = 0; }
}
function keyboardControl(p, left, right, up, down) {
  let x = Number(keys.has(right)) - Number(keys.has(left));
  let y = Number(keys.has(down)) - Number(keys.has(up));
  if (!x && !y) return;
  const n = Math.hypot(x,y);
  p.px = Math.max(p.r, Math.min(W-p.r, p.px + x/n*10));
  p.py = clampHalf(p, p.py + y/n*10);
}
function updateHUD() {
  $('team1Name').textContent = `① ${config.team1.name}`;
  $('team2Name').textContent = `${config.team2.name} ②`;
  $('liveScore').textContent = `${score.p1} : ${score.p2}`;
  $('matchMeta').textContent = `${config.winScore}골 먼저 넣으면 승리 · ${config.mode === '1p' ? '나 vs 컴퓨터' : '플레이어 1 vs 플레이어 2'}`;
}
function setPaused(value) {
  if (!matchActive) return;
  paused = value; clearInput(); show(value ? 'pauseScreen' : null);
  if (!value) canvas.focus({preventScroll:true});
}
$('pause').onclick = () => setPaused(true);
$('resume').onclick = () => setPaused(false);
$('quit').onclick = () => show('startScreen');
const controls = ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
window.addEventListener('keydown', e => {
  const dialog = document.querySelector('.overlay:not(.hidden)');
  if (e.code === 'Tab' && dialog) {
    const buttons = [...dialog.querySelectorAll('button:not(:disabled)')];
    const first = buttons[0], last = buttons.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  if (!matchActive) return;
  if ((e.code === 'Space' || e.code === 'Escape') && !e.repeat) {
    if (e.code === 'Space' && e.target.closest('button')) return;
    e.preventDefault(); setPaused(!paused); return;
  }
  if (controls.includes(e.code) && !paused) { e.preventDefault(); keys.add(e.code); }
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => setPaused(true));
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });
function tone(frequency, duration) {
  if (!soundOn) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume().catch(()=>{});
    const osc = audioContext.createOscillator(), gain = audioContext.createGain();
    osc.frequency.value=frequency; osc.type='sine';
    gain.gain.setValueAtTime(.04,audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);
    osc.connect(gain); gain.connect(audioContext.destination); osc.start(); osc.stop(audioContext.currentTime+duration);
  } catch { soundOn=false; $('sound').setAttribute('aria-pressed','false'); $('sound').textContent='소리 사용 불가'; }
}
$('sound').onclick = () => { soundOn=!soundOn; $('sound').setAttribute('aria-pressed',soundOn); $('sound').textContent=soundOn?'소리 켬':'소리 끔'; tone(440,.08); };
let statusTimer;
function status(message) { $('status').textContent=message; $('status').classList.remove('hidden'); clearTimeout(statusTimer); statusTimer=setTimeout(()=>$('status').classList.add('hidden'),6000); }
$('share').onclick = async () => {
  if (location.protocol === 'file:') { status('게임을 웹에 게시한 뒤 링크를 공유할 수 있어요.'); return; }
  const url = new URL('.', location.href).href;
  try { if (navigator.share) { await navigator.share({title:'미니 축구 | MINI MATCH',text:'작은 경기장, 큰 승부. 한 판 할까요?',url}); return; } } catch(e) { if(e.name==='AbortError') return; }
  try { await navigator.clipboard.writeText(url); status('게임 링크를 복사했어요. 친구에게 보내보세요.'); }
  catch { status(`주소창의 게임 주소를 복사해 공유해주세요.`); }
};
$('fullscreen').onclick = async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else if(document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else status('이 브라우저는 전체화면을 지원하지 않아요. 홈 화면에 추가해 실행해보세요.'); }
  catch { status('전체화면을 열 수 없어요. 브라우저의 전체화면 기능을 사용해주세요.'); }
};
document.addEventListener('fullscreenchange',()=> { $('fullscreen').textContent=document.fullscreenElement?'화면 축소 ⛶':'전체화면 ⛶'; $('fullscreen').setAttribute('aria-label',document.fullscreenElement?'전체화면 끄기':'전체화면 켜기'); resize(); });
let installPrompt;
window.addEventListener('beforeinstallprompt', e=> { e.preventDefault(); installPrompt=e; });
window.addEventListener('appinstalled',()=> { installPrompt=null; $('install').textContent='설치됨'; });
$('install').onclick=async()=> {
  if (location.protocol === 'file:') { status('홈 화면에 추가하려면 웹에 게시된 게임 주소로 접속해주세요.'); return; }
  if (matchMedia('(display-mode: standalone)').matches) { status('이미 앱으로 실행 중이에요.'); return; }
  if (installPrompt) { const prompt=installPrompt; installPrompt=null; await prompt.prompt(); return; }
  status(/iPhone|iPad/.test(navigator.userAgent)?'Safari의 공유 버튼 → 홈 화면에 추가를 선택하세요.':'브라우저 메뉴에서 앱 설치 또는 홈 화면에 추가를 선택하세요.');
};
