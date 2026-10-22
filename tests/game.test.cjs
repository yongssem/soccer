const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function game(){
 const elements = new Map();
 function element(id){
  if(elements.has(id))return elements.get(id);
  const classes=new Set(id==='matchScreen'?['hidden']:[]);
  const el={id,style:{},dataset:{},children:[],firstElementChild:{textContent:''},textContent:'',innerHTML:'',inert:false,disabled:false,
   classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle:(x,v)=>{if(v??!classes.has(x))classes.add(x);else classes.delete(x);}},
   addEventListener(){},setAttribute(k,v){this[k]=v;},focus(){},appendChild(c){this.children.push(c)},
   getBoundingClientRect:()=>({left:20,top:100,width:360,height:600}),getContext:()=>({}),querySelectorAll:()=>[]};
  elements.set(id,el);return el;
 }
 const sandbox={console,Set,Math,URL,location:{href:'https://example.test/soccer/'},navigator:{},matchMedia:()=>({matches:false}),setTimeout:()=>1,clearTimeout(){},requestAnimationFrame(){},
  document:{getElementById:element,createElement:()=>element('button'+elements.size),addEventListener(){},querySelector:()=>null,documentElement:{},hidden:false},
  window:{devicePixelRatio:2,addEventListener(){}}};
 vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'../game.js'),'utf8'),sandbox);
 return code=>vm.runInContext(code,sandbox);
}
function match(){const run=game();run("config.team1=TEAMS[0];config.team2=TEAMS[1];beginMatch();kickoff=0;defenders.length=0;");return run;}
test('selected teams start a match with a reset score and ready countdown',()=>{const run=game();run('config.team1=TEAMS[0];config.team2=TEAMS[1];beginMatch()');assert.equal(run('kickoff'),150);assert.equal(run('running && matchActive && !paused'),true);assert.equal(run('score.p1 + score.p2'),0);});
test('both players stay in their own halves, including pointer presses at edges',()=>{const run=match();run("handleStart('test',-400,700)");assert.equal(run('players.p1.px'),46);assert.equal(run('clampHalf(players.p1,0)'),546);assert.equal(run('clampHalf(players.p2,1000)'),454);});
test('pointer conversion uses canvas bounds rather than viewport center',()=>{const run=game();assert.equal(run('toGame(200,400).x'),300);assert.equal(run('toGame(200,400).y'),500);});
test('keyboard movement cannot cross field edges or center line',()=>{const run=match();run("keys.add('KeyA');keys.add('KeyW');for(let i=0;i<500;i++){keyboardControl(players.p1,'KeyA','KeyD','KeyW','KeyS');updatePlayer(players.p1)}");assert.equal(run('players.p1.px'),46);assert.equal(run('players.p1.py'),546);});
test('pause freezes ball and clears held input, resume continues',()=>{const run=match();run("ball.vx=7;keys.add('KeyD');setPaused(true);update()");assert.equal(run('ball.x'),300);assert.equal(run('keys.size'),0);run('setPaused(false);update()');assert.equal(run('ball.x'),307);});
test('countdown blocks physics before kickoff',()=>{const run=match();run('kickoff=100;ball.vx=10;update()');assert.equal(run('ball.x'),300);assert.equal(run('kickoff'),99);});
test('top goal credits bottom player exactly once and gives restart time',()=>{const run=match();run('ball.x=300;ball.y=25;ball.vy=-5;update();for(let i=0;i<50;i++)update()');assert.equal(run('score.p1'),1);assert.equal(run('score.p2'),0);assert.ok(run('kickoff')>0);});
test('bottom goal credits top player',()=>{const run=match();run('ball.x=300;ball.y=975;ball.vy=5;update()');assert.equal(run('score.p2'),1);});
test('end line outside goal rebounds without scoring',()=>{const run=match();run('ball.x=80;ball.y=25;ball.vy=-5;update()');assert.equal(run('score.p1'),0);assert.ok(run('ball.vy')>0);});
test('winning goal ends match and rematch removes old effects and input',()=>{const run=match();run("config.winScore=3;score.p1=2;goal('p1')");assert.equal(run('running'),false);assert.equal(run("$('winText').textContent"),'대한민국, 승리!');run('beginMatch()');assert.equal(run('score.p1'),0);assert.equal(run('goalFlash'),0);assert.equal(run('kickoff'),150);});
test('exact center overlap resolves with a finite kick rather than trapping ball',()=>{const run=match();run('ball.x=players.p1.x;ball.y=players.p1.y;collideCircle(players.p1)');assert.ok(run('Number.isFinite(ball.vy) && ball.y < players.p1.y'));});
test('same team cannot be picked for both players',()=>{const run=game();run("config.mode='2p';showTeamSelect();pickTeam(TEAMS[0]);pickTeam(TEAMS[0])");assert.equal(run('config.team2'),null);assert.equal(run('config.picking'),2);});
test('exiting to lobby stops match and clears input',()=>{const run=match();run("keys.add('KeyW');show('startScreen')");assert.equal(run('running || matchActive'),false);assert.equal(run('keys.size'),0);});
test('fixed simulation rate yields same movement at 60 and 144 display frames',()=>{
 const run60=match(),run144=match();
 for(const run of[run60,run144])run("config.mode='2p';ball.x=100;ball.y=500;ball.vx=1;$('matchScreen').classList.add('hidden');");
 run60('for(let i=1;i<=60;i++)loop(i*1000/60)');run144('for(let i=1;i<=144;i++)loop(i*1000/144)');
 assert.ok(Math.abs(run60('ball.x')-run144('ball.x'))<1.1);
});
