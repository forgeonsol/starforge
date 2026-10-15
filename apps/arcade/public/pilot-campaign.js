(() => {
  "use strict";
  const canvas = document.querySelector("#pilotCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id);
  const STORE = "signal-pilot-campaign-v1";
  const W = 960, H = 540, FLOOR = 440, MAX = 100;
  const skills = ["flight", "arsenal", "evasion", "nova"];
  const worlds = [
    {name:"ION DUNES", color:"#ffb662", top:"#12213b", bottom:"#39263a", far:"#293959", ground:"#9e593f"},
    {name:"PRISM CANOPY", color:"#7bfff0", top:"#0c2540", bottom:"#22275a", far:"#1b6674", ground:"#286f7b"},
    {name:"VOID MARSH", color:"#c397ff", top:"#171b3c", bottom:"#452c6e", far:"#44345e", ground:"#594570"},
    {name:"SKYFORGE", color:"#ff8a65", top:"#22203e", bottom:"#6a3a50", far:"#5a425a", ground:"#965246"},
    {name:"FROSTLINE", color:"#9deaff", top:"#0b2440", bottom:"#2e5273", far:"#386287", ground:"#567e9a"},
    {name:"ECLIPSE CITY", color:"#f382c7", top:"#10162f", bottom:"#442c61", far:"#3d3761", ground:"#644369"},
    {name:"GRAVITY RIFT", color:"#b4a4ff", top:"#11192c", bottom:"#33386c", far:"#47517d", ground:"#58599b"},
    {name:"ASHEN ORBIT", color:"#ffb474", top:"#151b31", bottom:"#573344", far:"#5d3944", ground:"#97583d"},
    {name:"PRISM VAULT", color:"#9effce", top:"#0f2638", bottom:"#274b69", far:"#378090", ground:"#32788a"},
    {name:"STAR CORE", color:"#ffe481", top:"#181633", bottom:"#493b68", far:"#59538a", ground:"#816da4"},
  ];
  const base = {xp:0, coins:0, pilot:"girl", skillPoints:1, maxLevel:1, cleared:[], medals:{}, bestChain:0, skills:{flight:0,arsenal:0,evasion:0,nova:0}};
  let save;
  try { const raw = (() => { try { return localStorage.getItem(STORE); } catch { return null; } })() || "{}"; save = {...base,...JSON.parse(raw),skills:{...base.skills,...(JSON.parse(raw)?.skills||{})}}; }
  catch { save = structuredClone(base); }
  save.maxLevel = Math.max(1, Math.min(MAX, Number(save.maxLevel)||1));
  save.xp = Math.max(0, Number(save.xp)||0); save.skillPoints = Math.max(0, Number(save.skillPoints)||0);
  save.coins = Math.max(0, Number(save.coins)||0); save.pilot = save.pilot === "boy" ? "boy" : "girl";
  save.cleared = Array.isArray(save.cleared) ? save.cleared : [];
  save.medals = save.medals && typeof save.medals === "object" ? save.medals : {}; save.bestChain = Math.max(0, Number(save.bestChain)||0);
  skills.forEach((key) => save.skills[key] = Math.max(0, Math.min(10, Number(save.skills[key])||0)));
  let failReason = "hp", selected = save.maxLevel, mode = "menu", last = 0, clock = 0, hudClock=0, lastClearNew=false, world, player, enemies=[], shots=[], hostile=[], shards=[], spikes=[], gaps=[], platforms=[], beams=[], camera=0, length=3000, score=0, collected=0, boss=null, springs=[], chain={n:0,t:0,best:0}, magnetT=0, medalsGot=0, coinTotal=0, coinsTaken=0, flyFx=[], pulse=0, fireClock=0, dashClock=0, dashCooldown=0, hurtClock=0, levelClock=0, rewardFx=[];
  const held = new Set(), pressed = new Set();
  // Game-feel layer: particles, screen shake, squash & stretch, smoothed camera.
  let particles = [], shakeT = 0, flashT = 0, cameraTarget = 0;
  const sfx = (name, arg) => window.SFX?.play(name, arg);
  const medalCount = (n) => { const m = save.medals[n] || 0; return (m & 1) + (m >> 1 & 1) + (m >> 2 & 1); };
  const lang = () => { try { return localStorage.getItem("signal-language") === "zh" ? "zh" : "en"; } catch { return "en"; } };
  const L = (en, zh) => lang() === "zh" ? zh : en;
  function burst(x, y, color, n = 10, power = 1, gravity = 600) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = (60 + Math.random() * 200) * power; particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80 * power, life: .35 + Math.random() * .4, max: .75, size: 1.5 + Math.random() * 2.5, color, g: gravity }); } if (particles.length > 360) particles.splice(0, particles.length - 360); }
  function dust(x, y, n = 8) { for (let i = 0; i < n; i++) { const dir = i % 2 ? 1 : -1; particles.push({ x: x + dir * Math.random() * 10, y: y - 2, vx: dir * (40 + Math.random() * 90), vy: -20 - Math.random() * 60, life: .3 + Math.random() * .25, max: .55, size: 3 + Math.random() * 3, color: "rgba(200,204,214,.35)", g: 200, soft: true }); } }
  function shake(t) { shakeT = Math.max(shakeT, t); }
  const page = $("page-campaign"), overlay=$("pilotOverlay"), action=$("pilotMainAction");
  let lowQ=false, slowT=0;
  function resize(){ const ratio=Math.min(lowQ?1:2,window.devicePixelRatio||1); if(canvas.width!==W*ratio){canvas.width=W*ratio;canvas.height=H*ratio;} ctx.setTransform(ratio,0,0,ratio,0,0); ctx.imageSmoothingQuality="high"; }
  resize(); window.addEventListener("resize",()=>{resize();draw();});
  function persist(){ try { localStorage.setItem(STORE,JSON.stringify(save)); } catch {} window.dispatchEvent(new CustomEvent("pilot-build-updated",{detail:save.skills})); }
  function syncPilotPicker(){document.querySelectorAll("[data-pilot-choice]").forEach((button)=>{const active=button.dataset.pilotChoice===save.pilot;button.classList.toggle("selected",active);button.setAttribute("aria-pressed",String(active));});}
  function toast(text){ const el=$("pilotToast"); el.textContent=text; el.classList.add("on"); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove("on"),1500); }
  function worldFor(n){return Math.floor((n-1)/10)}
  function stageTitle(n){return ["THE IGNITION RUN","SHARD RUNNER","LOW ORBIT","THE LONG JUMP","STATIC BLOOM","SIGNAL CHASE","AFTERBURN","BREAK THE LINE","NIGHT CIRCUIT","GUARDIAN GATE"][((n-1)%10)]}
  function rngFor(n){let s=(n*9301+49297)%233280;return()=>{s=(s*9301+49297)%233280;return s/233280}}
  function paintHud(){
    const w=worldFor(selected), stage=String(selected).padStart(2,"0");
    $("pilotWorld").textContent=`WORLD ${String(w+1).padStart(2,"0")} · ${worlds[w].name}`;
    $("pilotMission").textContent=`MISSION ${stage} · ${stageTitle(selected)}`;
    const rank=Math.min(100,1+Math.floor(save.xp/110));
    $("pilotRank").textContent=`${rank<10?"CADET":rank<35?"ACE":rank<70?"VANGUARD":"FORGE ELITE"} · LV ${String(rank).padStart(2,"0")}`;
    $("pilotXpBar").style.width=`${(save.xp%110)/110*100}%`;
    $("pilotXpText").textContent=`${save.xp.toLocaleString()} XP · ${save.skillPoints} SKILL ${save.skillPoints===1?"POINT":"POINTS"}`;
    $("skillPoints").textContent=save.skillPoints;
    $("pilotArenaBonus").textContent=`FLIGHT +${save.skills.flight*2}% · FIRE +${(save.skills.arsenal*2.5).toFixed(1)}% · DASH LV ${save.skills.evasion} · NOVA LV ${save.skills.nova}`;
    for(const key of skills){
      const pips=$(key+"Pips"); pips.innerHTML=Array.from({length:10},(_,i)=>`<i class="${i<save.skills[key]?"on":""}"></i>`).join("");
      const button=document.querySelector(`[data-upgrade-skill="${key}"]`); button.disabled=save.skillPoints<1||save.skills[key]>=10;
      button.title=save.skills[key]>=10?"MAX RANK":"Spend 1 skill point";
    }
    syncRunHud();
  }
  function syncRunHud(){
    $("pilotScore").textContent=String(score).padStart(4,"0");
    $("pilotHealth").textContent=`${"♥ ".repeat(Math.max(0,player?.hp||3))}${"♡ ".repeat(Math.max(0,3-(player?.hp||3)))}`.trim();
    $("pilotCoins").textContent=String(save.coins).padStart(3,"0");
    $("pilotSuperBar").style.width=`${player?.nova||0}%`;
  }
  function renderRoute(){
    const done=new Set(save.cleared), route=$("pilotLevelGrid");
    if(route){
      route.innerHTML=Array.from({length:MAX},(_,i)=>{const n=i+1,can=n<=save.maxLevel,finished=done.has(n),cl=finished?"done":can?"available":"locked",curr=n===selected?"current":"";const md=medalCount(n);return `<button class="level-node ${cl} ${curr}" data-mission="${n}" data-medals="${md}" ${can?"":"disabled"} title="${md}/3 $FORGE medallions" aria-label="Mission ${n}${finished?", complete":can?", unlocked":", locked"} · ${md} of 3 medallions">${finished?"✦":String(n).padStart(2,"0")}</button>`}).join("");
      route.querySelectorAll("[data-mission]").forEach((button)=>button.addEventListener("click",()=>{selected=Number(button.dataset.mission);paintHud();renderRoute();draw();showMenu("menu");}));
    }
    const allMedals=Object.keys(save.medals).reduce((a,k)=>a+medalCount(k),0);$("routeProgress").textContent=`MISSION ${String(selected).padStart(2,"0")} / ${MAX} · ${save.cleared.length} CLEARED · ${allMedals}/${MAX*3} MEDALLIONS`;
    const ribbons=$("pilotWorldRibbon");
    if(ribbons)ribbons.innerHTML=worlds.map((theme,i)=>{const count=save.cleared.filter(n=>worldFor(n)===i).length;return `<span class="world-chip ${worldFor(selected)===i?"current":""} ${count===10?"done":""}">${String(i+1).padStart(2,"0")} · ${theme.name.split(" ").at(0)} ${count===10?"✦":`${count}/10`}</span>`}).join("");
  }
  function showMenu(kind){
    mode=kind; overlay.classList.remove("off");
    $("pilotPicker").hidden=!(kind==="menu"||kind==="failed");syncPilotPicker();
    if(kind==="menu"){
      $("pilotOverlayKicker").textContent=L(`ROUTE ${String(selected).padStart(2,"0")} · ${worlds[worldFor(selected)].name}`,`航线 ${String(selected).padStart(2,"0")} · ${worlds[worldFor(selected)].name}`);
      $("pilotOverlayTitle").textContent=L(`${stageTitle(selected)} is waiting.`,selected===1?"首次飞行从这里开始。":`任务 ${selected} · ${stageTitle(selected)}`);
      $("pilotOverlayCopy").textContent=L(`Mission ${selected} of 100. Chain coins for a score multiplier, ride launch pads to the sky trails and find the three $FORGE medallions (${medalCount(selected)}/3 found). A new clearance grants +15 coins, Pilot XP and a flight-school point.`,`第 ${selected} / 100 个任务。连续收集金币获得倍数，借助弹射板飞上空中金币线，找到 3 枚 $FORGE 徽章（已找到 ${medalCount(selected)}/3）。首次通关可获得 +15 硬币、飞行员经验和 1 个飞行学校数据点。`);
      action.textContent=L(`DEPLOY · MISSION ${String(selected).padStart(2,"0")}`,`出击 · 任务 ${String(selected).padStart(2,"0")}`);
    }else if(kind==="won"){
      const next=Math.min(MAX,selected+1); $("pilotOverlayKicker").textContent=L(`MISSION ${String(selected).padStart(2,"0")} · FLIGHT LOG SAVED`,`任务 ${String(selected).padStart(2,"0")} · 飞行记录已保存`);
      $("pilotOverlayTitle").textContent=selected===MAX?L("Star Core secured.","星核已夺回。"):L("Extraction confirmed.","撤离确认。");
      const tally=L(`Coins ${coinsTaken}/${coinTotal} · medallions ${medalsGot}/3 this run (${medalCount(selected)}/3 total) · best chain ×${chain.best} · ${Math.round(levelClock)}s`,`金币 ${coinsTaken}/${coinTotal} · 本局徽章 ${medalsGot}/3（累计 ${medalCount(selected)}/3）· 最佳连击 ×${chain.best} · ${Math.round(levelClock)} 秒`);
      $("pilotOverlayCopy").textContent=tally+" — "+(lastClearNew?L(`+15 forge coins · +${rewardXp(selected)} Pilot XP · +1 flight-school point.`,`+15 熔炉金币 · +${rewardXp(selected)} 飞行员经验 · +1 飞行学校数据点。`):coinsTaken===coinTotal&&medalCount(selected)===3?L("Perfect route: every coin and medallion.","完美航线：全部金币与徽章。"):L("Replay complete — first-clear rewards already claimed.","重玩完成——首次通关奖励已领取。"));
      action.textContent=selected===MAX?L("REPLAY FINAL MISSION","再次挑战"):L(`CONTINUE · MISSION ${String(next).padStart(2,"0")}`,`继续 · 任务 ${String(next).padStart(2,"0")}`);
    }else if(kind==="failed"){
      $("pilotOverlayKicker").textContent=L(failReason==="time"?"TIME UP · FLIGHT LOG RETAINED":"SIGNAL LOST · FLIGHT LOG RETAINED",failReason==="time"?"时间到 · 飞行记录保留":"信号丢失 · 飞行记录保留"); $("pilotOverlayTitle").textContent=L("Reset. You know the route now.","重整。你已经熟悉航线。");
      $("pilotOverlayCopy").textContent=L(`Mission ${selected} is still open. Your skill upgrades and earlier clearances remain saved.`,"当前任务仍可挑战。之前解锁的技能与通关记录都会保留。");action.textContent=L(`RETRY · MISSION ${String(selected).padStart(2,"0")}`,`重试任务 · ${String(selected).padStart(2,"0")}`);
    }else{
      $("pilotOverlayKicker").textContent=L("FLIGHT PAUSED · CHECKPOINT HELD","飞行已暂停 · 检查点保留");$("pilotOverlayTitle").textContent=L("Pick up where you left off.","从暂停处继续。");
      $("pilotOverlayCopy").textContent=L("Your position, collected shards and health are held while you browse the rest of $FORGE.","浏览 $FORGE 其他页面时，你的位置、已收集碎片和生命值都会保留。");action.textContent=L("RESUME MISSION","继续任务");
    }
  }
  function rewardXp(n){return 35+Math.floor(n*1.8)}
  function buildLevel(n){
    selected=Math.max(1,Math.min(MAX,n));world=worlds[worldFor(selected)];
    const rnd=rngFor(selected);length=2860+Math.min(600,worldFor(selected)*45); levelClock=0;score=0;collected=0;camera=0;fireClock=0;dashCooldown=0;hurtClock=0;pulse=0;lastClearNew=false;
    player={x:70,y:FLOOR,vx:0,vy:0,onGround:true,coyote:.14,jumpBuffer:0,jumpHold:0,jumpHeld:false,hp:3,nova:0,face:1,dash:0,dashDir:1,inv:0,run:0,sx:1,sy:1,safeX:70,safeY:FLOOR};particles=[];shakeT=0;flashT=0;cameraTarget=0;failReason="hp";
    enemies=[];shots=[];hostile=[];shards=[];spikes=[];gaps=[];platforms=[];beams=[];boss=null;springs=[];chain={n:0,t:0,best:0};magnetT=0;medalsGot=0;coinsTaken=0;flyFx=[];
    // Level layout. Jump apex is ~150px, so every platform sits 84–128px up (comfortably reachable), and
    // coins are laid out as readable guides: arcs over chasms and spikes, rows along platforms and safe ground.
    const coin=(cx,cy,plat)=>shards.push({x:cx,y:cy,kind:"coin",taken:false,plat});
    const arc=(x0,x1,n,lift)=>{for(let c=0;c<n;c++){const t=n===1?.5:c/(n-1);coin(x0+(x1-x0)*t,FLOOR-46-Math.sin(t*Math.PI)*lift);}};
    const end=length-(selected%5===0?600:330);
    let x=360, index=0;
    const springWant=selected<2?0:selected>12?3:2;
    while(x<end){
      // launch segment: a clean pad with a sky trail of coins arcing to the apex
      if(springs.length<springWant&&index>1&&index%5===2+(selected%2)&&x<end-420){const sx=x+36;springs.push({x:sx,t:0});for(let i=1;i<=7;i++){const u=i/8;coin(sx+u*270,FLOOR-42-4*246*u*(1-u));}x+=400;index++;continue;}
      if(index>0&&index%4===selected%4&&rnd()<.86){const width=76+rnd()*54;gaps.push({x:x-13,width});arc(x-30,x-13+width+18,4,70);x+=width+60;index++;continue;}
      let spike=null; if(rnd()<.56){spike={x:x+18+rnd()*40,width:32+rnd()*34};spikes.push(spike);}
      let platform=null;
      if(index%2===0||rnd()<.42){const w=104+rnd()*56, px=x+30+rnd()*26, py=FLOOR-(84+rnd()*44);platform={x:px,y:py,w,id:platforms.length};platforms.push(platform);
        const nC=3+(selected>15?1:0), span=Math.min(w-34,(nC-1)*26);for(let c=0;c<nC;c++)coin(px+w/2-span/2+c*(span/(nC-1)),py-30,platform.id);
        // occasional stepping tile: a second, higher plate reachable from the first
        if(selected>3&&index%5===3&&py>FLOOR-112){const w2=92+rnd()*30,p2={x:px+w-14+rnd()*20,y:py-66,w:w2,id:platforms.length,tile:true};platform.hasTile=true;platforms.push(p2);for(let c=0;c<3;c++)coin(p2.x+w2/2-26+c*26,p2.y-30,p2.id);}
      }
      if(spike&&!(platform&&platform.x<spike.x+spike.width&&platform.x+platform.w>spike.x))arc(spike.x-14,spike.x+spike.width+14,3,58);
      else if(!spike&&rnd()<.6){const n=3+(index%4===0?1:0);for(let c=0;c<n;c++)coin(x+40+c*26,FLOOR-40);}
      if(index%3===1||rnd()<.32){const type=index%3;enemies.push({x:x+115+rnd()*55,y:type===1?FLOOR-82:FLOOR,type,hp:1+Math.floor((selected-1)/22),dir:rnd()<.5?-1:1,range:28+rnd()*38,origin:x+128,fire:2+rnd()*2,phase:rnd()*4,dead:false,face:1});}
      if(selected%4===0&&index%5===2)beams.push({x:x+45,y:FLOOR-108,width:44,period:2.8,phase:rnd()*2.8});
      x+=168+rnd()*54; index++;
    }
    // Ground walkers patrol only solid, spike-free ground; nothing spawns inside the first stretch of the run.
    const blocked=(px)=>gaps.some(g=>px>g.x-14&&px<g.x+g.width+14)||spikes.some(sp=>px>sp.x-26&&px<sp.x+sp.width+26);
    enemies=enemies.filter((e)=>{
      if(e.type===1){e.minX=e.origin-e.range;e.maxX=e.origin+e.range;e.x=Math.max(e.minX,Math.min(e.maxX,e.x));return true;}
      let o=e.x;for(let k=0;k<12&&blocked(o);k++)o+=18;if(blocked(o)||o>length-200)return false;
      let lo=o,hi=o;while(lo>o-e.range-30&&!blocked(lo-4))lo-=4;while(hi<o+e.range+30&&!blocked(hi+4))hi+=4;
      if(hi-lo<24)return false;e.x=o;e.origin=o;e.minX=lo;e.maxX=hi;return true;});
    const prizePlatforms=platforms.filter((p)=>p.x>length*.15&&p.x<length*.78);
    const prize=(p,kind)=>{if(!p)return;shards=shards.filter(s=>s.plat!==p.id);shards.push({x:p.x+p.w/2,y:p.y-34,kind,taken:false,plat:p.id});};
    prize(prizePlatforms[0],"star");prize(prizePlatforms[2],"bloom");if(selected>=3)prize(prizePlatforms[4]||prizePlatforms[1],"magnet");
    // moving plates (from mission 6): slide on a slow sine; their coins ride along
    if(selected>=6){for(const pl of platforms){if(pl.tile||pl.hasTile||pl.id%2!==1||pl.x>end-200)continue;if(shards.some(s=>s.plat===pl.id&&s.kind!=="coin"))continue;pl.mv={ox:pl.x,r:34+rnd()*40,sp:.8+rnd()*.7,ph:rnd()*6};}}
    // launch pads (from mission 2): long clean stretches only, each with a sky trail of coins to the apex
    const clearRun=(a,b)=>!gaps.some(g=>g.x<b&&g.x+g.width>a)&&!spikes.some(sp=>sp.x<b&&sp.x+sp.width>a)&&!beams.some(bm=>bm.x>a&&bm.x<b);
    const medalSpots=[];
    for(const sp of springs)medalSpots.push({x:sp.x+135,y:FLOOR-300,w:3});
    for(const g of gaps)if(g.width>88)medalSpots.push({x:g.x+g.width/2,y:FLOOR-170,w:2});
    for(const pl of platforms)if(pl.tile)medalSpots.push({x:pl.x+pl.w/2,y:pl.y-96,w:1,plat:pl.id});
    for(const pl of platforms)if(!pl.tile&&!pl.mv&&pl.y<FLOOR-104)medalSpots.push({x:pl.x+pl.w/2,y:pl.y-112,w:0,plat:pl.id});
    // three $FORGE medallions per mission, spread across the route, preferring the hardest spots
    {const pool=medalSpots.filter(m=>m.x>420&&m.x<length-(boss?520:240)).sort((a,b)=>a.x-b.x),picked=[];
      for(let k=0;k<3;k++){const lo=pool.length*k/3,hi=pool.length*(k+1)/3,band=pool.slice(Math.floor(lo),Math.max(Math.floor(lo)+1,Math.floor(hi)));if(!band.length)continue;band.sort((a,b)=>b.w-a.w||a.x-b.x);picked.push(band[0]);}
      if(picked.length<3){for(const pl of platforms.slice().sort((a,b)=>a.y-b.y)){if(picked.length>=3)break;if(picked.some(m=>Math.abs(m.x-(pl.x+pl.w/2))<200))continue;picked.push({x:pl.x+pl.w/2,y:pl.y-112,plat:pl.id});}}
      const have=save.medals[selected]||0;picked.slice(0,3).forEach((m,i)=>shards.push({x:m.x,y:m.y,kind:"medal",idx:i,had:!!(have&(1<<i)),taken:false,plat:m.plat}));}
    // A unique guardian seals every tenth mission; its health and volleys rise with the world.
    // Guardians hold every fifth mission and rotate through the three arena bosses, each with its own attack language.
    if(selected%5===0){const kind=(selected/5-1)%3,hp=4+Math.round(selected/5*1.3)+(kind===2?2:0);boss={x:length-270,homeX:length-270,y:FLOOR-112,homeY:FLOOR-112,kind,hp,max:hp,shot:1.6,t:0,state:"idle",timer:2.4,volley:0,summon:2.5,dead:false,hw:62,hh:52};}
    for(let i=0;i<3;i++)shards.unshift({x:140+i*26,y:FLOOR-40,kind:"coin",taken:false});
    for(const sh of shards)sh.ox=sh.x;coinTotal=shards.filter(sh=>sh.kind==="coin").length;
    paintHud();draw();
  }
  function gapAt(x){return gaps.find(g=>x>g.x&&x<g.x+g.width)}
  function floorAt(x){return !gapAt(x)}
  function begin(){buildLevel(selected);mode="play";overlay.classList.add("off");canvas.focus?.();sfx("power");}
  function continueAction(){if(mode==="menu"||mode==="failed"){begin();return;}if(mode==="paused"){mode="play";overlay.classList.add("off");return;}if(mode==="won"){selected=Math.min(MAX,selected+1,save.maxLevel);paintHud();renderRoute();begin();}}
  function complete(){
    mode="won";player.inv=2;overlay.classList.remove("off");sfx("win");burst(player.x,player.y-60,world.color,40,1.4);
    const isNew=!save.cleared.includes(selected);lastClearNew=isNew;
    if(isNew){save.cleared.push(selected);save.cleared.sort((a,b)=>a-b);save.maxLevel=Math.min(MAX,Math.max(save.maxLevel,selected+1));save.xp+=rewardXp(selected);save.coins+=15;save.skillPoints++;score+=100;persist();}
    paintHud();renderRoute();showMenu("won");window.dispatchEvent(new CustomEvent("forge-pilot-clear",{detail:{mission:selected,isNew}}));
  }
  function fail(reason="hp"){if(mode!=="play")return;failReason=reason;mode="failed";sfx("lose");overlay.classList.remove("off");showMenu("failed");}
  function hurt(){if(player.inv>0)return;player.hp--;player.inv=1.1;player.vy=-260;player.onGround=false;player.x=Math.max(camera+35,player.x-40);toast(L("CORE HIT · RECOVER","核心受损 · 恢复中"));shake(.3);flashT=.35;burst(player.x,player.y-40,"#ff4a2e",14,1);sfx("hurt");window.SFX?.haptic(40);if(player.hp<=0)fail();syncRunHud();}
  // Falling into a gap now respawns you on the last safe ground instead of over the same hole.
  function fallOut(){player.hp--;player.inv=1.4;shake(.25);flashT=.35;sfx("hurt");window.SFX?.haptic(40);toast(L("CORE HIT · RECOVER","核心受损 · 恢复中"));if(player.hp<=0){syncRunHud();fail();return;}player.x=player.safeX;player.y=player.safeY;player.vx=0;player.vy=0;player.onGround=true;player.dash=0;burst(player.x,player.y-40,world.color,16,.8);syncRunHud();}
  function launchJump(){if(!(player.onGround||player.coyote>0))return;player.vy=-(650+save.skills.flight*7);player.onGround=false;player.coyote=0;player.jumpBuffer=0;player.jumpHold=.22;player.jumpHeld=true;player.run=0;player.sx=.82;player.sy=1.18;dust(player.x,player.y,6);sfx("jump");}
  function jump(){if(mode!=="play")return;player.jumpBuffer=.15;launchJump();}
  function dash(){if(mode!=="play"||dashCooldown>0)return;player.dash=.23;player.dashDir=held.has("ArrowLeft")||held.has("KeyA")?-1:held.has("ArrowRight")||held.has("KeyD")?1:player.face;player.inv=Math.max(player.inv,.34);dashCooldown=Math.max(3.1,6.2-save.skills.evasion*.3);player.face=player.dashDir;player.sx=1.25;player.sy=.85;burst(player.x,player.y-40,"#9ff2c4",10,.6,0);sfx("dash");toast(L("PHASE DASH","相位闪避"));}
  function nova(){if(mode!=="play"||player.nova<100)return;player.nova=0;pulse=.56;player.inv=Math.max(player.inv,.85);const r=260+save.skills.nova*23;for(const e of enemies){if(!e.dead&&Math.abs(e.x-player.x)<r)e.dead=true;}if(boss&&Math.abs(boss.x-player.x)<r)boss.hp=Math.max(0,boss.hp-(2+Math.floor(save.skills.nova/3)));shake(.25);sfx("pulse");for(const e of enemies){if(e.dead&&!e.poofed){e.poofed=true;burst(e.x,e.y-45,"#cfe3ff",14,1);}}toast(L("NOVA DISCHARGE","新星释放"));syncRunHud();}
  function collect(shard){shard.taken=true;collected++;let label="+1 FORGE COIN",col="#e9ebf0";
    if(shard.kind==="star"){save.coins+=5;score+=75;player.nova=100;player.inv=Math.max(player.inv,1.5);label=L("NOVA STAR · +5 COINS","新星 · +5 金币");col="#9ff2c4";}
    else if(shard.kind==="bloom"){save.coins+=3;score+=45;player.hp=Math.min(3,player.hp+1);player.inv=Math.max(player.inv,.75);label=L("BLOOM CORE · HULL RESTORED","绽放核心 · 机体修复");col="#9ff2c4";}
    else if(shard.kind==="cache"){save.coins+=25;score+=180;player.nova=100;player.inv=Math.max(player.inv,1.2);label=L("GUARDIAN CACHE · +25 COINS","守卫补给 · +25 金币");col="#ffffff";}
    else if(shard.kind==="magnet"){magnetT=9;score+=40;label=L("COIN MAGNET · 9s","金币磁铁 · 9 秒");col="#cfe3ff";ring(shard.x,shard.y,8,170,.6,"#cfe3ff",1.4);}
    else if(shard.kind==="medal"){medalsGot++;save.coins+=10;score+=150;col="#b98cff";const bit=1<<shard.idx,first=!((save.medals[selected]||0)&bit);
      if(first){save.medals[selected]=(save.medals[selected]||0)|bit;window.dispatchEvent(new CustomEvent("forge-pilot-medal",{detail:{mission:selected,idx:shard.idx}}));}
      label=L(`$FORGE MEDALLION ${medalsGot}/3`,`$FORGE 徽章 ${medalsGot}/3`)+(first?"":L(" · FOUND BEFORE"," · 已找到"));shake(.12);ring(shard.x,shard.y,10,120,.7,"#9945ff",2);ring(shard.x,shard.y,6,80,.55,"#14f195",1.4);burst(shard.x,shard.y,"#14f195",14,1,300);renderRoute();}
    else{coinsTaken++;chain.n=chain.t>0?chain.n+1:1;chain.t=1.15;if(chain.n>chain.best)chain.best=chain.n;if(chain.best>save.bestChain)save.bestChain=chain.best;
      const mult=1+Math.min(4,Math.floor(chain.n/5));save.coins++;score+=10*mult;player.nova=Math.min(100,player.nova+4);
      if(chain.n>=5&&chain.n%5===0){rewardFx.push({x:shard.x,y:shard.y-18,life:1.1,text:L(`CHAIN ×${chain.n} · SCORE ×${mult}`,`连击 ×${chain.n} · 分数 ×${mult}`)});ring(player.x,player.y-50,10,60,.4,"#ffffff",1);}
      flyFx.push({x:shard.x-camera,y:shard.y+camY,t:0});}
    if(shard.kind!=="coin")rewardFx.push({x:shard.x,y:shard.y,life:1,text:label});else rewardFx.push({x:shard.x,y:shard.y,life:.7,text:"+1 FORGE COIN"});
    burst(shard.x,shard.y,col,shard.kind==="coin"?7:18,shard.kind==="coin"?.55:1,300);
    sfx(shard.kind==="coin"?"coin":shard.kind==="medal"?"medal":shard.kind==="magnet"?"magnet":"power",Math.min(9,chain.n-1));
    clearTimeout(collect.t);collect.t=setTimeout(persist,500);if(shard.kind!=="coin")toast(label);syncRunHud();}
  function fire(dt){fireClock-=dt;if(held.has("KeyJ")||held.has("KeyX")||held.has("ControlLeft")||held.has("ControlRight")){if(fireClock<=0){shots.push({x:player.x+18*player.face,y:player.y-49,vx:620*player.face,life:1.2,damage:1});sfx("shoot");fireClock=Math.max(.16,.42*(1-save.skills.arsenal*.025));}}}
  function bossStep(dt){
    const b=boss,rage=b.hp/b.max<.5,k=rage?1.4:1,awake=b.x-player.x<W*.85;b.t+=dt;b.hit=Math.max(0,(b.hit||0)-dt);
    const aimAt=(x,y,sp,spread=0)=>{const dx=player.x-x,dy=(player.y-44)-y,l=Math.hypot(dx,dy)||1,a=Math.atan2(dy,dx)+spread;return{x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:3.4};};
    if(!awake){b.y=b.homeY+Math.sin(b.t*1.6)*8;}
    else if(b.kind===0){ // ANVIL RAY: weaving flight, fanned volleys, every third volley a ring of bolts with a two-bolt gap
      b.y=b.homeY-18+Math.sin(b.t*1.3)*30;b.x=b.homeX+Math.sin(b.t*.7)*46;b.shot-=dt*k;
      if(b.shot<=0){b.volley++;const n=rage?5:3;for(let i=0;i<n;i++)hostile.push(aimAt(b.x-58,b.y+6,250,(i-(n-1)/2)*.2));
        if(b.volley%3===0){const gap=Math.floor(Math.random()*12);for(let i=0;i<12;i++)if(i!==gap&&i!==(gap+1)%12){const a=i/12*Math.PI*2;hostile.push({x:b.x,y:b.y,vx:Math.cos(a)*165,vy:Math.sin(a)*165,life:3.6});}b.flare=.5;}
        b.shot=rage?1.05:1.5;sfx("shoot");}
    }else if(b.kind===1){ // TWIN HAMMER: telegraphs a lane on the ground, then charges low along it — jump it
      if(b.state==="idle"){b.y+=((b.homeY+Math.sin(b.t*1.8)*10)-b.y)*Math.min(1,dt*4);b.x+=(b.homeX-b.x)*Math.min(1,dt*2);b.timer-=dt*k;b.shot-=dt*k;
        if(b.shot<=0){hostile.push(aimAt(b.x-50,b.y,230));b.shot=1.9;}
        if(b.timer<=0){b.state="tele";b.timer=.95;b.laneTo=Math.max(camera+20,b.x-560);sfx("power");}}
      else if(b.state==="tele"){b.timer-=dt;b.y+=((FLOOR-60)-b.y)*Math.min(1,dt*6);b.x+=Math.sin(b.t*60)*1.2;if(b.timer<=0){b.state="charge";b.vx=-(560*k);shake(.15);}}
      else if(b.state==="charge"){b.x+=b.vx*dt;b.y=FLOOR-60;if(Math.random()<.6)burst(b.x+50,FLOOR-4,"#ff4a2e",1,.5,500);if(b.x<=b.laneTo){b.state="recover";shake(.2);burst(b.x-40,FLOOR-20,"#ffffff",10,.8);}}
      else{b.x+=Math.min(300,(b.homeX-b.x)*2.2)*dt;b.y+=(b.homeY-b.y)*Math.min(1,dt*3);if(Math.abs(b.homeX-b.x)<8){b.state="idle";b.timer=rage?1.6:2.6;}}
    }else{ // BELLOWS: breathes out drones and slow homing pairs; plates flare open before each breath
      b.y=b.homeY+Math.sin(b.t*1.1)*14;b.x=b.homeX+Math.sin(b.t*.4)*28;b.summon-=dt*k;b.shot-=dt*k;
      const kids=enemies.filter(e=>e.fromBoss&&!e.dead).length;
      if(b.summon<=0){if(kids<(rage?4:3)){enemies.push({x:b.x-50,y:FLOOR-82,type:1,hp:1,dir:-1,range:0,origin:b.x-200,minX:b.x-460,maxX:b.x-70,fire:9,phase:Math.random()*4,dead:false,face:-1,fromBoss:true});b.flare=.6;}b.summon=rage?2.4:3.4;}
      if(b.shot<=0){hostile.push(aimAt(b.x-40,b.y,150,-.12),aimAt(b.x-40,b.y,150,.12));b.shot=rage?1.6:2.3;}
    }
    b.flare=Math.max(0,(b.flare||0)-dt);
    const charging=b.state==="charge";if(Math.abs(player.x-b.x)<b.hw*(charging?1.05:.85)&&Math.abs((player.y-39)-b.y)<(charging?42:b.hh+24))hurt();
    if(b.hp<=0){b.dead=true;score+=180+selected*2;burst(b.x,b.y,"#ff4a2e",50,1.8);burst(b.x,b.y,"#ffffff",20,1.2);shake(.5);sfx("bigkill");window.SFX?.haptic(80);player.nova=Math.min(100,player.nova+35);for(const e of enemies)if(e.fromBoss&&!e.dead){e.dead=true;}shards.push({x:Math.max(camera+80,Math.min(b.x,length-140)),y:FLOOR-70,kind:"cache",taken:false});toast(L("GUARDIAN DOWN · CACHE DROPPED","守卫已击落 · 掉落补给"));}
  }
  function step(dt){
    if(mode!=="play")return;
    levelClock+=dt;dashCooldown=Math.max(0,dashCooldown-dt);chain.t=Math.max(0,chain.t-dt);if(chain.t===0)chain.n=0;magnetT=Math.max(0,magnetT-dt);
    for(const pl of platforms){if(!pl.mv)continue;const nx=pl.mv.ox+Math.sin(levelClock*pl.mv.sp+pl.mv.ph)*pl.mv.r,dx=nx-pl.x;pl.x=nx;if(dx){for(const sh of shards)if(sh.plat===pl.id&&!sh.taken)sh.x+=dx;if(player.onGround&&player.plat===pl.id)player.x+=dx;}}player.inv=Math.max(0,player.inv-dt);hurtClock=Math.max(0,hurtClock-dt);pulse=Math.max(0,pulse-dt);
    const left=held.has("ArrowLeft")||held.has("KeyA"),right=held.has("ArrowRight")||held.has("KeyD"),axis=(right?1:0)-(left?1:0);if(left)player.face=-1;if(right)player.face=1;
    const speed=264*(1+save.skills.flight*.02),target=axis*speed,accel=axis?(player.vx*axis<0?2500:player.onGround?1420:850):player.onGround?2050:320;
    player.vx+=Math.max(-accel*dt,Math.min(accel*dt,target-player.vx));
    player.x+=(player.dash>0?player.dashDir*speed*2.45:player.vx)*dt;player.x=Math.max(24,Math.min(length-28,player.x));if(player.x<=24||player.x>=length-28)player.vx=0;
    player.run+=Math.abs(player.vx)/speed*dt*9;player.dash=Math.max(0,player.dash-dt);player.jumpBuffer=Math.max(0,player.jumpBuffer-dt);player.jumpHold=Math.max(0,player.jumpHold-dt);
    if(player.jumpBuffer>0&&(player.onGround||player.coyote>0))launchJump();
    if(!player.onGround){const g=player.vy<0&&player.jumpHeld&&player.jumpHold>0?1120:player.vy<0?2080:1880;player.vy+=g*dt;player.y+=player.vy*dt;}
    const oldY=player.y-player.vy*dt, under=floorAt(player.x); player.landVy=player.vy;
    let landed=false;
    if(player.vy>=0&&under&&player.y>=FLOOR){player.y=FLOOR;player.vy=0;player.onGround=true;landed=true;player.plat=-1;}
    for(const platform of platforms){if(player.vy>=0&&player.x+13>platform.x&&player.x-13<platform.x+platform.w&&oldY<=platform.y&&player.y>=platform.y){player.y=platform.y;player.vy=0;player.onGround=true;landed=true;player.plat=platform.id;}}
    if(landed){if(!player.wasGround&&player.landVy>420){player.sx=1.2;player.sy=.82;dust(player.x,player.y,player.landVy>800?10:6);sfx("land");}player.coyote=.14;player.jumpHeld=false;if(!gapAt(player.x-14)&&!gapAt(player.x+14)){player.safeX=player.x;player.safeY=player.y;}}else{player.onGround=false;player.coyote=Math.max(0,player.coyote-dt);}
    for(const sp of springs){sp.t=Math.max(0,sp.t-dt);if(landed&&player.plat===-1&&Math.abs(player.x-sp.x)<22){player.vy=-(1040+save.skills.flight*6);player.onGround=false;landed=false;player.coyote=0;player.jumpHeld=false;player.jumpHold=0;player.sx=.72;player.sy=1.32;sp.t=.35;dust(player.x,FLOOR,10);burst(sp.x,FLOOR-8,"#ffffff",8,.7,500);ring(sp.x,FLOOR-6,6,46,.35,"#ffffff",1.4);sfx("spring");window.SFX?.haptic(20);}}
    player.wasGround=landed;player.landVy=player.vy>0?player.vy:player.landVy;player.sx+=(1-player.sx)*Math.min(1,dt*12);player.sy+=(1-player.sy)*Math.min(1,dt*12);
    if(player.y>H+60){fallOut();if(mode!=="play")return;}
    fire(dt);
    if(magnetT>0){const cx=player.x,cy=player.y-46;for(const s of shards){if(s.taken||s.kind!=="coin")continue;const dx=cx-s.x,dy=cy-s.y,d=Math.hypot(dx,dy);if(d<175){s.plat=null;s.pull=(s.pull||0)+dt*5;const v=Math.min(d,(260+s.pull*420)*dt);s.x+=dx/d*v;s.y+=dy/d*v;}}}
    for(const s of shards){if(!s.taken&&Math.abs(player.x-s.x)<(s.kind==="medal"?30:25)&&Math.abs((player.y-42)-s.y)<(s.kind==="medal"?42:37))collect(s);}
    for(const spike of spikes){if(player.x+15>spike.x&&player.x-15<spike.x+spike.width&&player.y>=FLOOR-38&&player.onGround)hurt();}
    for(const beam of beams){const active=((levelClock+beam.phase)%beam.period)>1.1;if(active&&Math.abs(player.x-beam.x)<beam.width/2&&player.y>beam.y-42)hurt();}
    for(const e of enemies){if(e.dead)continue;e.x+=e.dir*(52+Math.min(90,selected*1.2))*dt;if(e.x<e.minX){e.x=e.minX;e.dir=1;}else if(e.x>e.maxX){e.x=e.maxX;e.dir=-1;}e.fire-=dt;if(e.type===2&&e.fire<=0&&Math.abs(e.x-player.x)<410){hostile.push({x:e.x-16,y:e.y-53,vx:-190,life:3});e.fire=2.35;}
      const eh=[80,88,98][e.type],ecy=e.y-eh*.53,pcy=player.y-39;
      if(Math.abs(player.x-e.x)<34&&Math.abs(pcy-ecy)<43+eh*.25){if(player.vy>110&&player.y-13<e.y-eh*.72){e.dead=true;player.vy=-390;player.onGround=false;player.coyote=0;score+=25;player.nova=Math.min(100,player.nova+17);player.sx=1.25;player.sy=.8;burst(e.x,e.y-eh*.5,["#ff4a2e","#cfe3ff","#ff4a2e"][e.type],16,1);rewardFx.push({x:e.x,y:e.y-eh,life:.8,text:"+25"});shake(.12);sfx("stomp");}else hurt();}}
    for(const e of enemies){e.hit=Math.max(0,(e.hit||0)-dt);}
    if(boss&&!boss.dead)bossStep(dt);
    for(let i=shots.length-1;i>=0;i--){const s=shots[i];s.x+=s.vx*dt;s.life-=dt;if(boss&&!boss.dead&&Math.abs(s.x-boss.x)<boss.hw+16&&Math.abs(s.y-boss.y)<boss.hh+42){boss.hp-=s.damage;boss.hit=.08;burst(s.x,s.y,"#ffffff",4,.5,0);sfx("hit");shots.splice(i,1);score+=2;continue;}let hit=false;for(const e of enemies){const eh=[80,88,98][e.type];if(!e.dead&&Math.abs(s.x-e.x)<eh*.42&&Math.abs(s.y-(e.y-eh*.53))<eh*.43){e.hp-=s.damage;e.hit=.1;if(e.hp<=0){e.dead=true;score+=30;player.nova=Math.min(100,player.nova+8);burst(e.x,e.y-eh*.5,["#ff4a2e","#cfe3ff","#ff4a2e"][e.type],14,1);rewardFx.push({x:e.x,y:e.y-eh,life:.8,text:"+30"});sfx("kill");}else{burst(s.x,s.y,"#ffffff",4,.5,0);sfx("hit");}hit=true;break;}}if(hit||s.life<=0)shots.splice(i,1);}
    for(let i=hostile.length-1;i>=0;i--){const s=hostile[i];s.x+=s.vx*dt;s.y=(s.y||player.y-38)+(s.vy||0)*dt;s.life-=dt;if(Math.abs(player.x-s.x)<17&&Math.abs(player.y-38-s.y)<22){hurt();hostile.splice(i,1);}else if(s.life<=0||s.x<camera-30)hostile.splice(i,1);}
    if(!boss||boss.dead){if(player.x>length-66){complete();return;}}
    cameraTarget=Math.max(0,Math.min(length-W+100,player.x-300+player.face*70));camera+=(cameraTarget-camera)*Math.min(1,dt*5);
    if(player.dash>0&&Math.random()<.7)particles.push({x:player.x-player.dashDir*20,y:player.y-40-Math.random()*50,vx:-player.dashDir*60,vy:0,life:.25,max:.25,size:3,color:"#9ff2c4",g:0});
    for(let i=rewardFx.length-1;i>=0;i--){rewardFx[i].life-=dt;rewardFx[i].y-=24*dt;if(rewardFx[i].life<=0)rewardFx.splice(i,1);}
    if(player.nova===100&&pressed.has("KeyE"))nova();
    if(levelClock>90)fail("time");
  }
  // ================================================================== RENDER LAYER
  // Monochrome studio look: near-black space, faceted obsidian geometry, white hairlines, chrome and glass.
  // Each world rations a single accent. Everything below is purely visual; the simulation above is untouched.
  const MONO = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace", DISPLAY = "'Geist', Inter, system-ui, sans-serif";
  const PAL = { ink: "#060607", ice: "#eef3f8", signal: "#ff4a2e", mint: "#9ff2c4", cool: "#cfe3ff" };
  const MOTIFS = ["dunes", "prisms", "monoliths", "rings", "spires", "city", "rocks", "orbit", "vault", "core"];
  const ACCENTS = ["#ffc46b", "#9ff2c4", "#b79cff", "#ff8a5c", "#cfe3ff", "#ff9ec4", "#a8b4ff", "#ffb07a", "#9ff2e0", "#ffe08a"];
  const GUARDIAN_NAMES = ["ANVIL RAY", "TWIN HAMMER", "BELLOWS"];
  const ease = { out: (t) => 1 - Math.pow(1 - t, 3), inOut: (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, back: (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2) };
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const ready = (im) => !!(im && im.complete && im.naturalWidth);
  const img = (src) => { const im = new Image(); im.decoding = "async"; im.src = src; return im; };
  // pilot sheet: 0 idle · 1-8 run · 9-16 run+aim · 17 jump · 18 apex · 19 fall · 20 shoot · 21 dash
  const FR = { idle: 0, run: 1, runAim: 9, jump: 17, apex: 18, fall: 19, shoot: 20, dash: 21 };
  const heroes = Array.from({ length: 22 }, (_, i) => img(`assets/3d/pilot-a/p-${String(i).padStart(2, "0")}.webp`));
  const boyHeroes = Array.from({ length: 22 }, (_, i) => img(`assets/3d/pilot-b/p-${String(i).padStart(2, "0")}.webp`));
  const foeSprites = [0, 1, 2].map((t) => Array.from({ length: 8 }, (_, f) => img(`assets/3d/foes/foe-${t}-${f}.webp`)));
  const guardianSprites = [0, 1, 2].map((k) => Array.from({ length: 6 }, (_, f) => img(`assets/3d/guardians/guardian-${k}-${f}.webp`)));
  const FOE_SIZE = [124, 100, 150];
  // Warm-up: decode every sprite and pre-build the tinted silhouettes off the hot path, so the first hit,
  // dash or death never stalls a frame.
  (function warm() {
    const all = heroes.concat(boyHeroes, ...foeSprites, ...guardianSprites), idle = window.requestIdleCallback || ((f) => setTimeout(f, 60));
    all.forEach((im) => { if (im.decode) im.decode().catch(() => {}); });
    const jobs = []; foeSprites.forEach((set) => set.forEach((im) => jobs.push([im, "#ffffff"]))); [heroes, boyHeroes].forEach((set) => { jobs.push([set[FR.dash], PAL.mint]); set.forEach((im) => jobs.push([im, "#ffffff"])); });
    guardianSprites.forEach((set) => set.forEach((im) => { jobs.push([im, "#ffffff"]); jobs.push([im, PAL.signal]); }));
    const run = (dl) => { let n = 0; while (jobs.length && n < 6) { const [im, c] = jobs[0]; if (!ready(im)) break; tinted(im, c); jobs.shift(); n++; } if (jobs.length) idle(run); };
    idle(run);
  })();
  // --- small caches: tinted silhouettes, glow sprites, offscreen backdrops
  const tintCache = new Map();
  function tinted(im, color) { if (!ready(im)) return null; const key = im.src + color; let c = tintCache.get(key); if (c) return c; c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext("2d"); g.drawImage(im, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height); tintCache.set(key, c); return c; }
  const glowCache = new Map();
  function glow(color) { let c = glowCache.get(color); if (c) return c; c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, color); r.addColorStop(.25, color + "88"); r.addColorStop(1, color + "00"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); glowCache.set(color, c); return c; }
  function glowAt(x, y, r, color, a) { if (a <= 0) return; ctx.globalAlpha = a; ctx.drawImage(glow(color), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; }
  function seeded(n) { let s = (n * 2654435761) % 4294967296; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
  function mix(hex, k) { const n = parseInt(hex.slice(1), 16); const r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; const c = (v) => Math.min(255, Math.round(v * k)); return `rgb(${c(r)},${c(g)},${c(b)})`; }

  // --- tiny 3D: shapes with vertices / edges / faces, rotated and perspective-projected onto the 2D canvas
  function buildShape(verts, edgeLen) {
    const e = [], f = [], d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    for (let i = 0; i < verts.length; i++) for (let j = i + 1; j < verts.length; j++) if (Math.abs(d(verts[i], verts[j]) - edgeLen) < .01) e.push([i, j]);
    for (let i = 0; i < verts.length; i++) for (let j = i + 1; j < verts.length; j++) for (let k = j + 1; k < verts.length; k++) if (Math.abs(d(verts[i], verts[j]) - edgeLen) < .01 && Math.abs(d(verts[j], verts[k]) - edgeLen) < .01 && Math.abs(d(verts[i], verts[k]) - edgeLen) < .01) f.push([i, j, k]);
    const m = Math.max(...verts.map((v) => Math.hypot(...v))); return { v: verts.map((v) => v.map((c) => c / m)), e, f };
  }
  const PHI = (1 + Math.sqrt(5)) / 2;
  const SHAPES = {
    oct: buildShape([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], Math.SQRT2),
    tet: buildShape([[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], 2 * Math.SQRT2),
    ico: buildShape([[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]], 2),
    cube: (() => { const v = []; for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push([x, y, z]); const s = buildShape(v, 2); s.quads = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]; return s; })(),
  };
  const P3 = [];
  function project(shape, cx, cy, r, ax, ay, az = 0) {
    const ca = Math.cos(ax), sa = Math.sin(ax), cb = Math.cos(ay), sb = Math.sin(ay), cc = Math.cos(az), sc = Math.sin(az);
    for (let i = 0; i < shape.v.length; i++) {
      let [x, y, z] = shape.v[i];
      let t = x * cc - y * sc; y = x * sc + y * cc; x = t;
      t = x * cb + z * sb; z = -x * sb + z * cb; x = t;
      t = y * ca - z * sa; z = y * sa + z * ca; y = t;
      const k = 3.2 / (3.2 + z * .9); P3[i] = P3[i] || { x: 0, y: 0, z: 0 }; P3[i].x = cx + x * r * k; P3[i].y = cy + y * r * k; P3[i].z = z;
    }
    return P3;
  }
  function wire(shape, cx, cy, r, ax, ay, az, color, alpha, lw = 1) {
    const p = project(shape, cx, cy, r, ax, ay, az); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath();
    for (const [a, b] of shape.e) { ctx.moveTo(p[a].x, p[a].y); ctx.lineTo(p[b].x, p[b].y); }
    ctx.globalAlpha = alpha; ctx.stroke(); ctx.globalAlpha = 1;
  }
  // faceted solid: back faces culled, each face shaded by its normal against a top-left key light
  function solid(shape, cx, cy, r, ax, ay, az, base, edge, edgeAlpha = .5) {
    const p = project(shape, cx, cy, r, ax, ay, az), faces = shape.quads || shape.f, list = [];
    for (const f of faces) { let z = 0; for (const i of f) z += p[i].z; list.push({ f, z: z / f.length }); }
    list.sort((u, v) => v.z - u.z);
    for (const { f } of list) {
      const a = p[f[0]], b = p[f[1]], c = p[f[2]], ux = b.x - a.x, uy = b.y - a.y, uz = (b.z - a.z) * r, vx = c.x - a.x, vy = c.y - a.y, vz = (c.z - a.z) * r;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl; if (nz > 0) { nx = -nx; ny = -ny; nz = -nz; }
      const lit = clamp01(nx * -.42 + ny * -.66 + nz * -.62);
      ctx.beginPath(); ctx.moveTo(p[f[0]].x, p[f[0]].y); for (let i = 1; i < f.length; i++) ctx.lineTo(p[f[i]].x, p[f[i]].y); ctx.closePath();
      ctx.fillStyle = mix(base, .3 + lit * .9); ctx.fill();
      if (edge) { ctx.globalAlpha = edgeAlpha * (.35 + lit * .65); ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1; }
    }
  }
  // --- backdrops, cached per world: sky + stars, two faceted ridge layers, haze
  const bgCache = new Map();
  function backdropFor(wi) {
    if (bgCache.has(wi)) return bgCache.get(wi);
    const accent = ACCENTS[wi], motif = MOTIFS[wi], rnd = seeded(wi * 97 + 13), mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
    const sky = mk(W, H), g = sky.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, "#040405"); grad.addColorStop(.62, "#0a0a0d"); grad.addColorStop(.8, "#0e0e12"); grad.addColorStop(1, "#060607"); g.fillStyle = grad; g.fillRect(0, 0, W, H);
    const hz = g.createRadialGradient(W * .6, FLOOR - 40, 10, W * .6, FLOOR - 40, W * .7); hz.addColorStop(0, accent + "1c"); hz.addColorStop(1, accent + "00"); g.fillStyle = hz; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 140; i++) { const y = rnd() * (FLOOR - 60), a = .08 + rnd() * .45 * (1 - y / FLOOR); g.globalAlpha = a; g.fillStyle = rnd() < .08 ? accent : "#fff"; const s = rnd() < .9 ? .8 : 1.5; g.fillRect(rnd() * W, y, s, s); }
    g.globalAlpha = 1;
    // grid of faint lines on the far sky (studio cyclorama feel)
    g.strokeStyle = "rgba(255,255,255,.025)"; g.lineWidth = 1; for (let y = 60; y < FLOOR; y += 48) { g.beginPath(); g.moveTo(0, y + .5); g.lineTo(W, y + .5); g.stroke(); }
    const ridge = (amp, base, rough, fill, line, lineA, seedK) => {
      const c = mk(W * 2, H), q = c.getContext("2d"), r2 = seeded(wi * 31 + seedK), pts = [];
      const stepW = motif === "city" ? 0 : motif === "spires" ? 46 : motif === "dunes" ? 120 : 70;
      if (motif === "city") { let x = 0; while (x < W * 2) { const w = 26 + r2() * 60, h = amp * (.25 + r2() * .9); pts.push([x, base - h], [x + w, base - h]); x += w + r2() * 8; } }
      else { for (let x = 0; x <= W * 2; x += stepW * (.6 + r2() * .8)) pts.push([x, base - amp * (motif === "spires" ? Math.pow(r2(), 2.2) : .25 + r2() * .75)]); pts.push([W * 2, pts[0][1]]); }
      q.beginPath(); q.moveTo(0, H); for (const [x, y] of pts) q.lineTo(x, y); q.lineTo(W * 2, H); q.closePath(); q.fillStyle = fill; q.fill();
      // facet shading: alternate faces catch the key light
      for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; if (y1 < y0 && motif !== "city") { q.beginPath(); q.moveTo(x0, y0); q.lineTo(x1, y1); q.lineTo(x1 + (x1 - x0) * .2, base + 30); q.lineTo(x0, base + 30); q.closePath(); q.fillStyle = "rgba(255,255,255,.018)"; q.fill(); } }
      q.beginPath(); for (let i = 0; i < pts.length; i++) i ? q.lineTo(pts[i][0], pts[i][1]) : q.moveTo(pts[i][0], pts[i][1]); q.strokeStyle = line; q.globalAlpha = lineA; q.lineWidth = 1; q.stroke(); q.globalAlpha = 1;
      if (motif === "city") { for (let i = 0; i < 260; i++) { const x = r2() * W * 2, y = base - r2() * amp; if (q.getImageData) { } q.fillStyle = r2() < .12 ? accent : "rgba(255,255,255,.5)"; q.globalAlpha = .12 + r2() * .25; q.fillRect(x, y, 2, 1); } q.globalAlpha = 1; }
      const fog = q.createLinearGradient(0, base - amp, 0, H); fog.addColorStop(0, "rgba(6,6,7,0)"); fog.addColorStop(1, "rgba(6,6,7,.85)"); q.globalCompositeOperation = "source-atop"; q.fillStyle = fog; q.fillRect(0, 0, W * 2, H); q.globalCompositeOperation = "source-over";
      // keep only the band that holds the silhouette, so per-frame blits touch as few pixels as possible
      const top = Math.max(0, Math.floor(base - amp * 1.15 - 4)), band = mk(W * 2, H - top); band.getContext("2d").drawImage(c, 0, -top); band.top = top; return band;
    };
    const far = ridge(motif === "dunes" ? 70 : motif === "orbit" ? 30 : 120, FLOOR - 30, 1, "#0d0e11", "#ffffff", .12, 1);
    const near = ridge(motif === "dunes" ? 50 : motif === "city" ? 150 : 80, FLOOR + 6, 1, "#08080a", accent, .16, 2);
    // atmosphere glows are baked: a calm sky and a "hot" sky for the guardian fight, cross-faded live
    const bake = (src, color, k) => { const c = mk(W, H), q = c.getContext("2d"); q.drawImage(src, 0, 0); const R = motif === "orbit" ? [W * .55, FLOOR - 120, 420, .14] : motif === "monoliths" ? [W * .7, 198, 260, .12] : motif === "dunes" || motif === "city" || motif === "core" ? [W * .7, 168, (motif === "city" ? 92 : motif === "core" ? 54 : 70) * 3.2, .16] : [W * .7, 168, 250, .12];
      const g1 = q.createRadialGradient(R[0], R[1], 0, R[0], R[1], R[2]); g1.addColorStop(0, color); g1.addColorStop(.25, color + "88"); g1.addColorStop(1, color + "00"); q.globalAlpha = R[3] * k; q.fillStyle = g1; q.fillRect(0, 0, W, H);
      const g2 = q.createRadialGradient(W * .5, FLOOR + 10, 0, W * .5, FLOOR + 10, W * .75); g2.addColorStop(0, color); g2.addColorStop(.25, color + "88"); g2.addColorStop(1, color + "00"); q.globalAlpha = .05 * k; q.fillStyle = g2; q.fillRect(0, 0, W, H); q.globalAlpha = 1; return c; };
    const calm = bake(sky, accent, 1), hot = bake(sky, PAL.signal, 2.2);
    const out = { sky: calm, hot, far, near }; bgCache.set(wi, out); return out;
  }
  let vignette = null;
  function vignetteCanvas() { if (vignette) return vignette; vignette = document.createElement("canvas"); vignette.width = W; vignette.height = H; const g = vignette.getContext("2d"), v = g.createRadialGradient(W / 2, H * .46, H * .32, W / 2, H / 2, W * .66); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.62)"); g.fillStyle = v; g.fillRect(0, 0, W, H); return vignette; }

  // --- transient visual state (never read by the simulation)
  let fxRings = [], ghosts = [], ghostClock = 0, introT = 0, bossIntroT = 0, bossSeen = false, winT = 0, failT = 0, glitchT = 0, muzzleT = 0, lastShots = 0, lastHp = 3, prevMode = "menu", camY = 0, zoom = 1, intensity = 0, lastWorld = -1, worldFade = 0;
  function ring(x, y, r0, r1, life, color, lw = 1.5) { fxRings.push({ x, y, r0, r1, life, max: life, color, lw }); if (fxRings.length > 40) fxRings.shift(); }
  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .97; p.rot = (p.rot || 0) + (p.vr || 0) * dt; p.life -= dt; if (p.life <= 0) particles.splice(i, 1); }
    for (let i = fxRings.length - 1; i >= 0; i--) { fxRings[i].life -= dt; if (fxRings[i].life <= 0) fxRings.splice(i, 1); }
    for (let i = ghosts.length - 1; i >= 0; i--) { ghosts[i].life -= dt; if (ghosts[i].life <= 0) ghosts.splice(i, 1); }
    shakeT = Math.max(0, shakeT - dt); flashT = Math.max(0, flashT - dt);
    introT = Math.max(0, introT - dt); bossIntroT = Math.max(0, bossIntroT - dt); winT = Math.max(0, winT - dt); failT = Math.max(0, failT - dt); glitchT = Math.max(0, glitchT - dt); muzzleT = Math.max(0, muzzleT - dt); worldFade = Math.max(0, worldFade - dt);
    if (player) {
      if (player.dash > 0) { ghostClock -= dt; if (ghostClock <= 0) { ghostClock = .028; ghosts.push({ x: player.x, y: player.y, idx: FR.dash, face: player.face, life: .26 }); } }
      const lift = Math.max(0, Math.min(70, FLOOR - player.y - 40)); camY += (lift * .32 - camY) * Math.min(1, dt * 3.2);
      const prog = clamp01(player.x / Math.max(1, length - 60)), bossOn = boss && !boss.dead && boss.x - camera < W + 80;
      intensity += ((bossOn ? 1 : prog * .55) - intensity) * Math.min(1, dt * 1.5);
    }
  }
  // particles are tiny facets (rotating triangles) and soft dust, never generic dots
  function drawParticles() {
    if (!particles.length) return; ctx.save();
    for (const p of particles) {
      const a = Math.max(0, p.life / p.max), x = p.x - camera; if (x < -20 || x > W + 20) continue; ctx.globalAlpha = a;
      if (p.soft) { ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(x, p.y, p.size * (1.4 - a * .4), 0, Math.PI * 2); ctx.fill(); continue; }
      ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = p.color; const s = p.size * (.6 + a * .9), r = p.rot || (p.rot = Math.random() * 6), c = Math.cos(r) * s, sn = Math.sin(r) * s;
      ctx.beginPath(); ctx.moveTo(x + c * 1.6, p.y + sn * 1.6); ctx.lineTo(x - sn, p.y + c); ctx.lineTo(x + sn * .7 - c * .4, p.y - c * .7 - sn * .4); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function burstShards(x, y, color, n, power) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = (80 + Math.random() * 240) * power; particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 90 * power, life: .45 + Math.random() * .5, max: .95, size: 2 + Math.random() * 3.5, color, g: 900, vr: (Math.random() - .5) * 18 }); } }

  // --- world layers
  function drawBackdrop() {
    const wi = worldFor(selected), motif = MOTIFS[wi], accent = ACCENTS[wi], bg = backdropFor(wi), heat = intensity;
    ctx.drawImage(bg.sky, 0, 0); const hot = clamp01((heat - .35) / .6); if (hot > .01) { ctx.globalAlpha = hot; ctx.drawImage(bg.hot, 0, 0); ctx.globalAlpha = 1; }
    // hero object: one large, slowly turning form per world, sitting far behind everything
    const hx = W * .7 - camera * .012, hy = 168, tt = clock * .08;
    const bossTint = heat > .7 ? PAL.signal : accent;
    ctx.save();
    if (motif === "dunes" || motif === "city" || motif === "core") {
      const r = motif === "city" ? 92 : motif === "core" ? 54 : 70;
      if (motif === "core") { glowAt(hx, hy, r * 1.6, "#ffffff", .5); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(hx, hy, r * .42, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#fff"; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2 + clock * .05, l = r * (1.1 + (i % 3) * .5); ctx.globalAlpha = .12; ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * r * .6, hy + Math.sin(a) * r * .6); ctx.lineTo(hx + Math.cos(a) * l * 1.6, hy + Math.sin(a) * l * 1.6); ctx.stroke(); } ctx.globalAlpha = 1; wire(SHAPES.ico, hx, hy, r * 1.5, tt * 2, tt * 3, 0, "#ffffff", .22); }
      else { ctx.fillStyle = "#020203"; ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.4; ctx.globalAlpha = .85; ctx.beginPath(); ctx.arc(hx, hy, r + .5, Math.PI * .95 + Math.sin(clock * .1) * .1, Math.PI * 2.25); ctx.stroke(); ctx.globalAlpha = .25; ctx.beginPath(); ctx.arc(hx, hy, r + 6, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(255,255,255,.1)"; ctx.beginPath(); ctx.ellipse(hx, hy, r * 2.1, r * .34, -.18, 0, Math.PI * 2); ctx.stroke(); }
    } else if (motif === "orbit") {
      const R = 1200, cx = W * .55 - camera * .01, cy = FLOOR + R - 120; 
      ctx.fillStyle = "#050506"; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.globalAlpha = .55; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI * 1.25, Math.PI * 1.75); ctx.stroke();
      ctx.globalAlpha = .08; for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.arc(cx, cy, R - i * 26, Math.PI * 1.3, Math.PI * 1.7); ctx.stroke(); } ctx.globalAlpha = 1;
    } else if (motif === "monoliths") {
      const y = 70 + Math.sin(clock * .4) * 6; ctx.fillStyle = "#030304"; ctx.fillRect(hx - 30, y, 60, 230); ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.fillRect(hx - 30, y, 1, 230); ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(hx + 29, y, 1, 230); ctx.fillRect(hx - 30, y, 60, 1);
    } else if (motif === "rings") {
      ctx.strokeStyle = "#fff"; for (let i = 0; i < 3; i++) { ctx.globalAlpha = [.5, .22, .14][i]; ctx.lineWidth = i ? 1 : 1.4; ctx.beginPath(); ctx.ellipse(hx, hy, 120 - i * 18, Math.abs(Math.cos(clock * (.12 + i * .05) + i)) * (120 - i * 18) + 2, i * .6 + clock * .02, 0, Math.PI * 2); ctx.stroke(); } ctx.globalAlpha = 1;
      wire(SHAPES.oct, hx, hy, 26, clock * .3, clock * .4, 0, "#ffffff", .5);
    } else if (motif === "rocks") {
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + clock * .06, rx = 150, x = hx + Math.cos(a) * rx, y = hy + Math.sin(a) * rx * .28; solid(SHAPES.tet, x, y, 8 + i % 3 * 5, clock * .2 + i, clock * .3 + i, 0, "#2a2c33", "#ffffff", .25); }
      ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.beginPath(); ctx.ellipse(hx, hy, 150, 42, 0, 0, Math.PI * 2); ctx.stroke(); solid(SHAPES.ico, hx, hy, 32, clock * .1, clock * .14, 0, "#1d1f24", "#ffffff", .35);
    } else if (motif === "vault") {
      wire(SHAPES.cube, hx, hy, 110, .5 + tt, tt * 1.4, .2, "#ffffff", .2); wire(SHAPES.ico, hx, hy, 62, -tt * 2, tt * 2.4, 0, accent, .4);
    } else { // prisms, spires
      const s = motif === "spires" ? SHAPES.oct : SHAPES.ico; wire(s, hx, hy, motif === "spires" ? 120 : 110, tt * 1.3, tt * 2, .3, "#ffffff", .18 + heat * .1); wire(s, hx, hy, motif === "spires" ? 48 : 44, -tt * 3, tt * 2, 0, accent, .35);
    }
    ctx.restore();
    // ridge layers
    const fx = -Math.round((camera * .05) % (W * 2)), nx = -Math.round((camera * .14) % (W * 2));
    ctx.drawImage(bg.far, fx, bg.far.top); if (fx + W * 2 < W) ctx.drawImage(bg.far, fx + W * 2, bg.far.top);
    // mid structures: deterministic per world, parallax .3
    drawMidLayer(wi, motif, accent);
    ctx.drawImage(bg.near, nx, bg.near.top); if (nx + W * 2 < W) ctx.drawImage(bg.near, nx + W * 2, bg.near.top);
    // drifting atmosphere: light motes rising slowly
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 38; i++) { const sp = 6 + (i % 5) * 3, x = ((i * 211.7 - camera * (.35 + (i % 4) * .1) + Math.sin(clock * .3 + i) * 12) % W + W) % W, y = ((i * 97.3 - clock * sp) % (FLOOR - 40) + (FLOOR - 40)) % (FLOOR - 40) + 20; ctx.globalAlpha = (.12 + (i % 3) * .08) * (.6 + .4 * Math.sin(clock * 1.3 + i * 2)); ctx.fillRect(x, y, i % 7 ? 1 : 1.6, i % 7 ? 1 : 1.6); }
    ctx.globalAlpha = 1;
    // horizon haze strengthens as the run intensifies
  }
  function drawMidLayer(wi, motif, accent) {
    const par = .3, spacing = 260, start = Math.floor((camera * par - 80) / spacing), end = Math.ceil((camera * par + W + 80) / spacing);
    for (let i = start; i <= end; i++) {
      const r = seeded(i * 7919 + wi * 104729), x = i * spacing + r() * 120 - camera * par, k = r(), base = FLOOR + 4;
      ctx.save();
      if (motif === "dunes") { // pylons with a slow blinking cap
        const h = 120 + k * 120; ctx.fillStyle = "#0b0c0f"; ctx.fillRect(x - 2, base - h, 4, h); ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(x - 2, base - h, 1, h);
        ctx.fillStyle = "#16171b"; ctx.fillRect(x - 9, base - h, 18, 3); glowAt(x, base - h - 2, 12, accent, (Math.sin(clock * 2 + i) > .6 ? .9 : .25));
        ctx.strokeStyle = "rgba(255,255,255,.06)"; ctx.beginPath(); ctx.moveTo(x, base - h + 4); ctx.quadraticCurveTo(x + spacing * .5, base - h + 60, x + spacing, base - h + 8 + r() * 40); ctx.stroke();
      } else if (motif === "prisms" || motif === "vault") {
        const y = 150 + k * 170 + Math.sin(clock * .7 + i) * 8, s = motif === "vault" ? SHAPES.cube : r() < .5 ? SHAPES.tet : SHAPES.oct;
        wire(s, x, y, 16 + r() * 22, clock * (.2 + k * .3) + i, clock * (.3 + k * .2), i, "#ffffff", .2 + k * .2);
        if (k > .6) glowAt(x, y, 18, accent, .25);
      } else if (motif === "monoliths") {
        const h = 90 + k * 160, w = 18 + r() * 26, y = base - h - 20 - Math.sin(clock * .5 + i) * 10; ctx.fillStyle = "#0a0a0c"; ctx.fillRect(x, y, w, h); ctx.fillStyle = "rgba(255,255,255,.4)"; ctx.fillRect(x, y, 1, h); ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(x, y, w, 1);
        if (k > .55) { ctx.fillStyle = accent; ctx.globalAlpha = .55 + .3 * Math.sin(clock * 1.6 + i); ctx.fillRect(x + w / 2 - .5, y + h * .3, 1, h * .3); }
      } else if (motif === "rings") {
        const y = 170 + k * 120, rr = 22 + r() * 34; ctx.strokeStyle = "#fff"; ctx.globalAlpha = .22; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, rr, Math.abs(Math.sin(clock * .6 + i)) * rr + 1, i, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = .1; ctx.fillStyle = "#fff"; ctx.fillRect(x - .5, y + rr, 1, base - y - rr);
      } else if (motif === "spires") {
        const h = 80 + k * 190, w = 16 + r() * 26; ctx.beginPath(); ctx.moveTo(x - w / 2, base); ctx.lineTo(x - w * .1, base - h); ctx.lineTo(x + w / 2, base); ctx.closePath(); ctx.fillStyle = "#0c0d10"; ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - w * .1, base - h); ctx.lineTo(x + w / 2, base); ctx.lineTo(x + w * .05, base); ctx.closePath(); ctx.fillStyle = "rgba(207,227,255,.08)"; ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.beginPath(); ctx.moveTo(x - w / 2, base); ctx.lineTo(x - w * .1, base - h); ctx.stroke();
      } else if (motif === "city") {
        const h = 110 + k * 200, w = 30 + r() * 40; ctx.fillStyle = "#09090b"; ctx.fillRect(x, base - h, w, h); ctx.fillStyle = "rgba(255,255,255,.3)"; ctx.fillRect(x, base - h, w, 1);
        for (let yy = base - h + 10; yy < base - 8; yy += 9) for (let xx = x + 5; xx < x + w - 5; xx += 7) { const on = Math.sin(xx * 12.9 + yy * 78.2 + i) > .55; if (on) { ctx.fillStyle = Math.sin(xx + yy) > .9 ? accent : "rgba(255,255,255,.22)"; ctx.fillRect(xx, yy, 3, 1); } }
        if (k > .7) { glowAt(x + w / 2, base - h - 6, 10, PAL.signal, Math.sin(clock * 3 + i) > 0 ? .9 : .2); ctx.fillStyle = "rgba(255,255,255,.4)"; ctx.fillRect(x + w / 2 - .5, base - h - 20, 1, 20); }
      } else if (motif === "rocks" || motif === "orbit") {
        const y = 140 + k * 180 + Math.sin(clock * .6 + i * 1.7) * 10; solid(motif === "orbit" ? SHAPES.cube : SHAPES.tet, x, y, 10 + r() * 18, clock * .25 + i, clock * .35 + i * 2, 0, "#25272d", "#ffffff", .3);
        if (motif === "orbit" && k > .5) { ctx.strokeStyle = "rgba(255,255,255,.3)"; ctx.beginPath(); ctx.moveTo(x - 26, y); ctx.lineTo(x + 26, y); ctx.stroke(); }
      } else { // core: falling light shards
        const y = ((k * 400 + clock * (20 + k * 30)) % 420); solid(SHAPES.oct, x, y, 6 + r() * 10, clock + i, clock * 1.3, 0, "#3a3320", accent, .6);
      }
      ctx.restore();
    }
  }

  // --- terrain: glass-topped obsidian slabs with a bright front hairline and perspective seams
  function solidSpans() {
    const out = [], a = camera - 20, b = camera + W + 20; let x = a;
    const gs = gaps.filter((g) => g.x + g.width > a && g.x < b).sort((u, v) => u.x - v.x);
    for (const g of gs) { if (g.x > x) out.push([x, g.x]); x = Math.max(x, g.x + g.width); }
    if (x < b) out.push([x, b]); return out;
  }
  function drawGround(accent) {
    const spans = solidSpans(), top = FLOOR - 5;
    for (const [a, b] of spans) {
      const x0 = a - camera, x1 = b - camera, w = x1 - x0;
      const tg = ctx.createLinearGradient(0, top, 0, FLOOR + 9); tg.addColorStop(0, "#1b1c21"); tg.addColorStop(1, "#2b2d33"); ctx.fillStyle = tg; ctx.fillRect(x0, top, w, 14);
      const fg = ctx.createLinearGradient(0, FLOOR + 9, 0, H + 60); fg.addColorStop(0, "#111215"); fg.addColorStop(.25, "#09090b"); fg.addColorStop(1, "#040405"); ctx.fillStyle = fg; ctx.fillRect(x0, FLOOR + 9, w, H + 60 - FLOOR);
      // perspective seams on the top face recede towards the centre of the screen
      ctx.strokeStyle = "rgba(255,255,255,.07)"; ctx.lineWidth = 1; ctx.beginPath();
      for (let gx = Math.ceil(a / 48) * 48; gx < b; gx += 48) { const sx = gx - camera, dx = (sx - W / 2) * .05; ctx.moveTo(sx + dx, top); ctx.lineTo(sx, FLOOR + 9); }
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(x0, top, w, 1);
      ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.fillRect(x0, FLOOR + 9, w, 1);
      ctx.fillStyle = "rgba(255,255,255,.035)"; for (let gx = Math.ceil(a / 192) * 192; gx < b; gx += 192) ctx.fillRect(gx - camera, FLOOR + 10, 1, H - FLOOR);
      // edge caps where the slab ends at a chasm
      for (const [ex, side] of [[x0, 1], [x1, -1]]) { if (ex > -10 && ex < W + 10 && (gapAt(camera + ex - side * 6))) { const eg = ctx.createLinearGradient(0, FLOOR, 0, FLOOR + 90); eg.addColorStop(0, "rgba(255,255,255,.7)"); eg.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = eg; ctx.fillRect(ex - (side > 0 ? 0 : 1), top, 1, 95); glowAt(ex, FLOOR + 9, 16, PAL.signal, .35 + .15 * Math.sin(clock * 4)); } }
    }
  }
  function drawGroundAccent(accent) {
    const spans = solidSpans(), y = FLOOR + 32, pulseX = ((clock * 260) % (W + 400)) - 200;
    for (const [a, b] of spans) { const x0 = a - camera, x1 = b - camera; ctx.fillStyle = accent; ctx.globalAlpha = .16; ctx.fillRect(x0, y, x1 - x0, 1); ctx.globalAlpha = 1; if (pulseX > x0 && pulseX < x1) { const g = ctx.createLinearGradient(pulseX - 120, 0, pulseX, 0); g.addColorStop(0, accent + "00"); g.addColorStop(1, accent); ctx.fillStyle = g; ctx.fillRect(Math.max(x0, pulseX - 120), y, Math.min(120, pulseX - x0), 1); } }
  }
  // glass reflection of the actors in the slab, clipped to solid ground and faded with depth
  function drawReflections(drawActors) {
    ctx.save(); ctx.beginPath(); for (const [a, b] of solidSpans()) ctx.rect(a - camera, FLOOR + 10, b - a, H - FLOOR); ctx.clip();
    ctx.translate(0, (FLOOR + 10) * 2); ctx.scale(1, -1); ctx.globalAlpha = .13; drawActors(true); ctx.restore();
    ctx.save(); const g = ctx.createLinearGradient(0, FLOOR + 10, 0, FLOOR + 110); g.addColorStop(0, "rgba(6,6,7,0)"); g.addColorStop(1, "rgba(6,6,7,.95)"); ctx.beginPath(); for (const [a, b] of solidSpans()) ctx.rect(a - camera, FLOOR + 11, b - a, H - FLOOR); ctx.clip(); ctx.fillStyle = g; ctx.fillRect(0, FLOOR + 10, W, H); ctx.restore();
  }
  function drawPlatform(p, accent) {
    const x = p.x - camera, w = p.w, y = p.y; if (x < -200 || x > W + 40) return;
    if (floorAt(p.x + w / 2)) { ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.beginPath(); ctx.ellipse(x + w / 2, FLOOR + 2, w * .46, 4, 0, 0, Math.PI * 2); ctx.fill(); }
    const hover = Math.sin(clock * 1.6 + p.x * .01) * .8;
    ctx.save(); ctx.translate(0, hover);
    glowAt(x + w * .28, y + 24, 14, accent, .3 + .1 * Math.sin(clock * 9 + p.x)); glowAt(x + w * .72, y + 24, 14, accent, .3 + .1 * Math.sin(clock * 9 + p.x + 1));
    ctx.beginPath(); ctx.moveTo(x + 3, y - 5); ctx.lineTo(x + w - 3, y - 5); ctx.lineTo(x + w, y + 2); ctx.lineTo(x, y + 2); ctx.closePath(); ctx.fillStyle = "#26282e"; ctx.fill();
    const fg = ctx.createLinearGradient(0, y + 2, 0, y + 18); fg.addColorStop(0, "#15161a"); fg.addColorStop(1, "#08080a"); ctx.fillStyle = fg;
    ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x + w, y + 2); ctx.lineTo(x + w - 6, y + 18); ctx.lineTo(x + 6, y + 18); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.88)"; ctx.fillRect(x, y + 2, w, 1); ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fillRect(x + 3, y - 5, w - 6, 1);
    ctx.fillStyle = accent; ctx.globalAlpha = .6; ctx.fillRect(x + 12, y + 18, w - 24, 1); ctx.globalAlpha = 1;
    if (p.mv) { const dir = Math.cos(levelClock * p.mv.sp + p.mv.ph) >= 0 ? 1 : -1; ctx.fillStyle = accent; for (const [ex, d] of [[x - 7, -1], [x + w + 7, 1]]) { ctx.globalAlpha = d === dir ? .9 : .25; ctx.beginPath(); ctx.moveTo(ex + d * 4, y - 1); ctx.lineTo(ex - d * 2, y - 5); ctx.lineTo(ex - d * 2, y + 3); ctx.closePath(); ctx.fill(); } ctx.globalAlpha = 1; }
    const sweep = ((clock * .35 + p.x * .001) % 1.6) / 1.6 * (w + 80) - 40; if (sweep > 0 && sweep < w) { const g = ctx.createLinearGradient(x + sweep - 30, 0, x + sweep + 30, 0); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(.5, "rgba(255,255,255,.18)"); g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.fillRect(x + Math.max(0, sweep - 30), y - 5, 60, 7); }
    ctx.restore();
  }
  // signal-red crystal shards: two-tone facets, a hot base line and a slow breathing glow
  function drawSpikes(sp) {
    const x = sp.x - camera; if (x > W + 10 || x + sp.width < -10) return; const n = Math.ceil(sp.width / 16), pulse = .5 + .5 * Math.sin(clock * 3 + sp.x);
    glowAt(x + sp.width / 2, FLOOR, sp.width * .9, PAL.signal, .14 + pulse * .1);
    for (let i = 0; i < n; i++) {
      const x1 = x + i * (sp.width / n), w = sp.width / n, h = 20 + ((i * 37 + sp.x) % 11) + (i % 2 ? 0 : 6), tip = x1 + w * (.4 + ((i * 13) % 5) * .05);
      ctx.beginPath(); ctx.moveTo(x1, FLOOR + 2); ctx.lineTo(tip, FLOOR - h); ctx.lineTo(tip, FLOOR + 2); ctx.closePath(); ctx.fillStyle = "#ff6a4d"; ctx.fill();
      ctx.beginPath(); ctx.moveTo(tip, FLOOR - h); ctx.lineTo(x1 + w, FLOOR + 2); ctx.lineTo(tip, FLOOR + 2); ctx.closePath(); ctx.fillStyle = "#8a1a0c"; ctx.fill();
      ctx.strokeStyle = "rgba(255,230,220,.85)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tip, FLOOR - h); ctx.lineTo(tip, FLOOR - h + 8); ctx.stroke();
    }
    ctx.fillStyle = PAL.signal; ctx.globalAlpha = .7 + pulse * .3; ctx.fillRect(x - 2, FLOOR + 2, sp.width + 4, 1.5); ctx.globalAlpha = 1;
  }
  function drawBeam(beam) {
    const x = beam.x - camera; if (x < -40 || x > W + 40) return;
    const t = (levelClock + beam.phase) % beam.period, active = t > 1.1, warn = !active && t > .75, top = beam.y - 7;
    // emitters
    for (const [y, dir] of [[top, 1], [FLOOR + 2, -1]]) { ctx.fillStyle = "#1b1c21"; ctx.fillRect(x - 11, y - (dir > 0 ? 8 : 0), 22, 8); ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.fillRect(x - 11, dir > 0 ? y : y, 22, 1); }
    if (active) {
      const k = Math.min(1, (t - 1.1) * 8), flick = .85 + .15 * Math.sin(clock * 60);
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = PAL.signal; ctx.globalAlpha = .18 * k; ctx.fillRect(x - beam.width / 2, top, beam.width, FLOOR - top);
      ctx.globalAlpha = .55 * k * flick; ctx.fillRect(x - 4, top, 8, FLOOR - top); ctx.fillStyle = "#fff"; ctx.globalAlpha = .95 * k; ctx.fillRect(x - 1, top, 2, FLOOR - top); ctx.restore();
      glowAt(x, FLOOR, 30, PAL.signal, .6 * k); glowAt(x, top, 22, PAL.signal, .5 * k);
      if (Math.random() < .35) particles.push({ x: beam.x + (Math.random() - .5) * 10, y: FLOOR - 2, vx: (Math.random() - .5) * 160, vy: -60 - Math.random() * 120, life: .25, max: .25, size: 1.5, color: "#ff8a6e", g: 900, vr: 20 });
    } else {
      ctx.strokeStyle = PAL.signal; ctx.globalAlpha = warn ? (Math.sin(clock * 40) > 0 ? .8 : .25) : .2; ctx.setLineDash([2, 6]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + .5, top); ctx.lineTo(x + .5, FLOOR); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      const charge = clamp01(t / 1.1); ctx.fillStyle = PAL.signal; ctx.fillRect(x - 10, top - 11, 20 * charge, 1.5);
    }
  }
  // rewards: chrome coins, a mint nova crystal, a glass heal ring, a chrome cache cube
  let COIN = null;
  function coinAtlas() {
    if (COIN) return COIN; COIN = document.createElement("canvas"); COIN.width = 64 * 24; COIN.height = 64; const g = COIN.getContext("2d");
    for (let i = 0; i < 24; i++) {
      const sx = Math.cos(i / 24 * Math.PI * 2), w = Math.max(3.2, Math.abs(sx) * 20), cx = i * 64 + 32, cy = 32;
      const halo = g.createRadialGradient(cx, cy, 0, cx, cy, 32); halo.addColorStop(0, "rgba(255,255,255,.16)"); halo.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = halo; g.fillRect(i * 64, 0, 64, 64);
      g.fillStyle = "#16171b"; g.beginPath(); g.ellipse(cx + (sx > 0 ? 2.6 : -2.6), cy, w, 24, 0, 0, Math.PI * 2); g.fill();
      const lg = g.createLinearGradient(cx - w, cy - 24, cx + w, cy + 24); lg.addColorStop(0, "#ffffff"); lg.addColorStop(.45, sx > 0 ? "#a4aab4" : "#5e636c"); lg.addColorStop(1, "#202329");
      g.fillStyle = lg; g.beginPath(); g.ellipse(cx, cy, w, 24, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 1.6; g.stroke();
      if (Math.abs(sx) > .3) { g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 1; g.beginPath(); g.ellipse(cx, cy, w * .72, 17, 0, 0, Math.PI * 2); g.stroke(); g.fillStyle = PAL.mint; g.beginPath(); g.moveTo(cx, cy - 9); g.lineTo(cx + w * .3, cy); g.lineTo(cx, cy + 9); g.lineTo(cx - w * .3, cy); g.closePath(); g.fill(); }
    }
    return COIN;
  }
  function drawPickup(x, y, kind, seed) {
    const bob = Math.sin(clock * 3 + seed) * 2.5, spin = clock * 2.4 + seed * .01; y += bob;
    if (kind === "magnet") { drawMagnetPickup(x, y - bob, seed); return; }
    if (kind === "coin") {
      // coins come from a pre-rendered 24-step spin atlas: one drawImage per coin per frame
      const f = ((Math.floor(spin / (Math.PI * 2) * 24) % 24) + 24) % 24; ctx.drawImage(coinAtlas(), f * 64, 0, 64, 64, x - 16, y - 16, 32, 32);
    } else if (kind === "star") {
      glowAt(x, y, 40, PAL.mint, .45 + .15 * Math.sin(clock * 4)); solid(SHAPES.oct, x, y, 15, spin * .6, spin, .3, "#5fbf92", "#ffffff", .9);
      ctx.strokeStyle = PAL.mint; ctx.globalAlpha = .5; ctx.beginPath(); ctx.ellipse(x, y, 22, 6, -.3, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    } else if (kind === "bloom") {
      glowAt(x, y, 34, PAL.mint, .35); ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y, 14 * Math.abs(Math.cos(spin * .5)) + 3, 14, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = PAL.mint; ctx.fillRect(x - 6, y - 1.5, 12, 3); ctx.fillRect(x - 1.5, y - 6, 3, 12);
    } else {
      glowAt(x, y, 44, "#ffffff", .3); solid(SHAPES.cube, x, y, 13, .5 + spin * .3, spin * .6, 0, "#8d929c", "#ffffff", .9); glowAt(x, y, 10, PAL.mint, .8);
    }
  }
  const tokenLogo = img("logo.svg");
  function drawSpring(sp, accent) {
    const x = sp.x - camera; if (x < -60 || x > W + 60) return; const k = sp.t > 0 ? Math.sin((1 - sp.t / .35) * Math.PI) : 0, h = 14 - k * 9, near = player ? clamp01(1 - Math.abs(player.x - sp.x) / 260) : 0;
    glowAt(x, FLOOR - 6, 52, accent, .28 + .12 * Math.sin(clock * 4 + sp.x) + k * .5 + near * .15);
    // light column hinting the flight path
    const col = ctx.createLinearGradient(0, FLOOR - 230, 0, FLOOR); col.addColorStop(0, "rgba(255,255,255,0)"); col.addColorStop(1, `rgba(255,255,255,${.05 + near * .06 + k * .2})`); ctx.fillStyle = col; ctx.fillRect(x - 18, FLOOR - 230, 36, 228);
    ctx.fillStyle = "#0d0e11"; ctx.fillRect(x - 28, FLOOR - 3, 56, 8); ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.fillRect(x - 28, FLOOR - 3, 56, 1);
    ctx.strokeStyle = "rgba(255,255,255,.65)"; ctx.lineWidth = 1.2; ctx.beginPath(); for (let i = 0; i < 4; i++) { const yy = FLOOR - 3 - (i + .5) * h / 4; ctx.moveTo(x - 15, yy + h / 9); ctx.lineTo(x + 15, yy - h / 9); } ctx.stroke();
    ctx.fillStyle = "#2a2c33"; ctx.beginPath(); ctx.roundRect(x - 26, FLOOR - 8 - h, 52, 6, 2); ctx.fill(); ctx.fillStyle = accent; ctx.fillRect(x - 24, FLOOR - 8 - h, 48, 2); ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fillRect(x - 24, FLOOR - 8 - h, 48, .8);
    ctx.lineWidth = 1.6; for (let i = 0; i < 3; i++) { const ph = ((clock * 1.3 + i / 3) % 1), yy = FLOOR - 26 - ph * 60; ctx.globalAlpha = (1 - ph) * (.7 + near * .3); ctx.strokeStyle = i % 2 ? "#ffffff" : accent; ctx.beginPath(); ctx.moveTo(x - 9, yy + 6); ctx.lineTo(x, yy); ctx.lineTo(x + 9, yy + 6); ctx.stroke(); } ctx.globalAlpha = 1;
    if (near > .2) { ctx.font = `500 8.5px ${MONO}`; ctx.textAlign = "center"; ctx.fillStyle = `rgba(255,255,255,${near * .7})`; ctx.fillText(L("LAUNCH PAD", "弹射板"), x, FLOOR + 24); ctx.textAlign = "left"; }
  }
  function drawMedal(x, y, had, seed) {
    const bob = Math.sin(clock * 2.4 + seed) * 3, sp = Math.cos(clock * 2.2 + seed * .01), w = Math.max(.12, Math.abs(sp)); y += bob;
    if (had) { ctx.globalAlpha = .38; ctx.strokeStyle = "#ffffff"; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(x, y, 17 * w, 17, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; return; }
    glowAt(x, y, 46, "#9945ff", .32 + .12 * Math.sin(clock * 3 + seed)); glowAt(x + 6, y - 4, 26, "#14f195", .18);
    const g = ctx.createLinearGradient(x - 18, y - 18, x + 18, y + 18); g.addColorStop(0, "#9945ff"); g.addColorStop(.5, "#7b61ff"); g.addColorStop(1, "#14f195");
    ctx.fillStyle = "#0a0a0d"; ctx.beginPath(); ctx.ellipse(x + (sp > 0 ? 2.5 : -2.5) * w, y, 19 * w, 19, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 19 * w, 19, 0, 0, Math.PI * 2); ctx.fill();
    if (ready(tokenLogo) && w > .3) { ctx.save(); ctx.translate(x, y); ctx.scale(w * (sp < 0 ? -1 : 1), 1); ctx.drawImage(tokenLogo, -15, -15, 30, 30); ctx.restore(); }
    ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(x, y, 19 * w, 19, 0, 0, Math.PI * 2); ctx.stroke();
    if (Math.random() < .08) particles.push({ x: x + camera + (Math.random() - .5) * 30, y: y + (Math.random() - .5) * 30, vx: 0, vy: -30, life: .6, max: .6, size: 1.6, color: Math.random() < .5 ? "#14f195" : "#b98cff", g: 0, vr: 3 });
  }
  function drawMagnetPickup(x, y, seed) {
    y += Math.sin(clock * 3 + seed) * 2.5; glowAt(x, y, 34, PAL.cool, .35); ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(clock * 2) * .25);
    ctx.lineCap = "butt"; ctx.lineWidth = 7; ctx.strokeStyle = "#d9dde4"; ctx.beginPath(); ctx.arc(0, -2, 10, Math.PI, 0); ctx.lineTo(10, 9); ctx.moveTo(-10, -2); ctx.lineTo(-10, 9); ctx.stroke();
    ctx.fillStyle = PAL.cool; ctx.fillRect(-13.5, 6, 7, 5); ctx.fillRect(6.5, 6, 7, 5); ctx.restore();
    ctx.strokeStyle = "rgba(207,227,255,.5)"; ctx.lineWidth = 1; ctx.setLineDash([2, 4]); ctx.lineDashOffset = -clock * 20; ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
  }
  function drawGate(accent) {
    const gx = length - camera - 58; if (gx < -80 || gx > W + 90) return; const sealed = boss && !boss.dead, col = sealed ? PAL.signal : accent, cy = FLOOR - 74, k = winT > 0 ? 1 + (1 - winT / 1.6) * 2 : 1;
    const col2 = ctx.createLinearGradient(gx - 24, 0, gx + 24, 0); col2.addColorStop(0, "rgba(255,255,255,0)"); col2.addColorStop(.5, sealed ? "rgba(255,74,46,.12)" : `rgba(255,255,255,${.16 * k})`); col2.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = col2; ctx.fillRect(gx - 24, 0, 48, FLOOR + 9);
    glowAt(gx, cy, 80 * k, col, .2 + (sealed ? 0 : .1 * Math.sin(clock * 2)));
    ctx.lineWidth = 1.5; for (let i = 0; i < 3; i++) { const sp = clock * (.8 + i * .35) * (i % 2 ? -1 : 1), rx = Math.abs(Math.cos(sp)) * (30 + i * 6) + 2, ry = 56 + i * 7; ctx.strokeStyle = i === 1 ? col : "#ffffff"; ctx.globalAlpha = [.85, .7, .3][i]; if (sealed) ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.ellipse(gx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    ctx.globalAlpha = 1; ctx.strokeStyle = col; ctx.globalAlpha = .6; ctx.beginPath(); ctx.ellipse(gx, FLOOR + 3, 46, 7, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(gx, cy, 3, 0, Math.PI * 2); ctx.fill();
    ctx.font = `500 9px ${MONO}`; ctx.textAlign = "center"; ctx.fillStyle = sealed ? PAL.signal : "rgba(255,255,255,.6)"; ctx.fillText(sealed ? L("SEALED · DEFEAT GUARDIAN", "封锁 · 击败守卫") : L("EXTRACTION", "撤离点"), gx, cy - 86); ctx.textAlign = "left";
    if (!sealed && Math.random() < .3) particles.push({ x: length - 58 + (Math.random() - .5) * 40, y: FLOOR, vx: 0, vy: -40 - Math.random() * 60, life: 1.2, max: 1.2, size: 1.4, color: "#ffffff", g: 0, vr: 2 });
  }
  let lastDrawClock = 0, ddt = 0, hudPop = 0;
  function drawEnemy(e, reflect) {
    const x = e.x - camera, type = e.type, size = FOE_SIZE[type], aiming = type === 2 && Math.abs(e.x - player.x) < 410;
    if (!reflect) { const want = aiming ? (player.x < e.x ? -1 : 1) : e.dir; e.face = e.face === undefined ? want : e.face + (want - e.face) * Math.min(1, ddt * 9); }
    const face = e.face || e.dir, hover = type === 1 ? Math.sin(clock * 2.6 + e.phase) * 8 : Math.abs(Math.sin(clock * 7 + e.phase)) * -1.5;
    const frame = Math.floor(clock * (type === 1 ? 14 : type === 2 ? 11 : 15) + e.phase * 3) % 8, im = foeSprites[type][frame];
    const baseY = type === 1 ? e.y + 2 : e.y;
    if (!reflect) { ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.beginPath(); ctx.ellipse(x, FLOOR + 2, size * (type === 1 ? .16 : .34), type === 1 ? 3 : 4, 0, 0, Math.PI * 2); ctx.fill(); if (type === 1) glowAt(x, baseY + hover - 28, 24, PAL.cool, .28); }
    if (!ready(im)) return; ctx.save(); ctx.translate(x, baseY + hover);
    ctx.scale(Math.sign(face) * Math.max(.08, Math.abs(face)), 1); if (type === 1) ctx.rotate(-.07);
    let recoil = 0; if (type === 2 && e.fire > 2.15) recoil = (e.fire - 2.15) * 30; ctx.translate(-recoil, 0);
    ctx.drawImage(im, -size / 2, -size, size, size);
    if (!reflect) { const rim = tinted(im, "#ffffff"); if (rim) { ctx.globalAlpha = .08; ctx.drawImage(rim, -size / 2 - 1, -size - 1, size, size); if (e.hit > 0) { ctx.globalAlpha = Math.min(1, e.hit * 9); ctx.drawImage(rim, -size / 2, -size, size, size); } ctx.globalAlpha = 1; } }
    ctx.restore();
    if (!reflect && aiming && e.fire < .55) { const k = 1 - e.fire / .55; glowAt(x - 16, e.y - 53, 8 + k * 16, PAL.signal, .3 + k * .6); ctx.strokeStyle = PAL.signal; ctx.globalAlpha = k; ctx.beginPath(); ctx.arc(x - 16, e.y - 53, 14 - k * 9, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
  }
  function drawBoss(reflect) {
    if (!boss || boss.dead) return; const k = boss.kind, frame = Math.floor(clock * (boss.flare > 0 ? 14 : 7)) % 6, im = guardianSprites[k][frame], x = boss.x - camera, y = boss.y, rage = boss.hp / boss.max < .5, S = 236, charging = boss.state === "charge", tele = boss.state === "tele";
    if (!reflect && tele) { const lx = boss.laneTo - camera, k2 = 1 - boss.timer / .95; ctx.fillStyle = PAL.signal; ctx.globalAlpha = .08 + .1 * k2 + (Math.sin(clock * 40) > 0 ? .06 : 0); ctx.fillRect(lx, FLOOR - 104, x - lx, 96); ctx.globalAlpha = .9; ctx.fillRect(lx, FLOOR + 7, (x - lx) * k2, 2); ctx.globalAlpha = 1; ctx.font = `500 9px ${MONO}`; ctx.fillStyle = PAL.signal; ctx.textAlign = "center"; ctx.fillText(L("JUMP", "跳跃"), (lx + x) / 2, FLOOR - 112); ctx.textAlign = "left"; }
    if (!reflect && charging) { ctx.save(); ctx.globalCompositeOperation = "lighter"; for (let i = 0; i < 6; i++) { const yy = y - 40 + i * 16; ctx.fillStyle = i % 2 ? "rgba(255,74,46,.35)" : "rgba(255,255,255,.25)"; ctx.fillRect(x + 60, yy, 80 + i * 14, 1.5); } ctx.restore(); }
    if (x < -160 || x > W + 160) return;
    if (!reflect) { ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.beginPath(); ctx.ellipse(x, FLOOR + 2, 80, 7, 0, 0, Math.PI * 2); ctx.fill(); glowAt(x, y, 150, rage ? PAL.signal : ACCENTS[worldFor(selected)], .18 + (rage ? .12 * Math.sin(clock * 6) + .1 : 0)); }
    if (!ready(im)) return; ctx.save(); ctx.translate(x, y); ctx.rotate(charging ? -.22 : tele ? Math.sin(clock * 50) * .03 : Math.sin(clock * .8) * .03); const sc = 1 + (boss.flare || 0) * .12; ctx.scale(sc, sc); ctx.drawImage(im, -S / 2, -S / 2, S, S);
    if (!reflect) { const w = tinted(im, rage ? PAL.signal : "#ffffff"); if (w) { if (boss.hit > 0) { ctx.globalAlpha = Math.min(1, boss.hit * 9); ctx.drawImage(tinted(im, "#ffffff"), -S / 2, -S / 2, S, S); } if (rage) { ctx.globalAlpha = .12 + .08 * Math.sin(clock * 8); ctx.globalCompositeOperation = "lighter"; ctx.drawImage(w, -S / 2, -S / 2, S, S); } } }
    ctx.restore();
    if (!reflect && rage && Math.random() < .2) burstShards(boss.x + (Math.random() - .5) * 90, y + (Math.random() - .5) * 60, PAL.signal, 1, .3);
  }
  function drawPlayer(reflect) {
    if (!player) return; const sx = player.x - camera, moving = Math.abs(player.vx) > 28, firing = held.has("KeyJ") || held.has("KeyX") || held.has("ControlLeft") || held.has("ControlRight");
    const rf = Math.floor(player.run * 1.6) % 8, idx = player.dash > 0 ? FR.dash : !player.onGround ? (player.vy < -170 ? FR.jump : player.vy < 170 ? FR.apex : FR.fall) : moving ? (firing ? FR.runAim : FR.run) + rf : firing ? FR.shoot : FR.idle, set = save.pilot === "boy" ? boyHeroes : heroes, im = set[idx];
    const bob = player.onGround && moving ? -Math.abs(Math.sin(player.run * 1.6 / 8 * Math.PI * 2)) * 2.5 : 0;
    if (!reflect) {
      let ground = floorAt(player.x) ? FLOOR : null; for (const p of platforms) if (player.x > p.x && player.x < p.x + p.w && p.y >= player.y - 2 && (ground === null || p.y < ground)) ground = p.y;
      if (ground !== null) { const d = clamp01((ground - player.y) / 220); ctx.fillStyle = `rgba(0,0,0,${.55 - d * .4})`; ctx.beginPath(); ctx.ellipse(sx, ground + 2, 26 * (1 - d * .5), 4.5 * (1 - d * .4), 0, 0, Math.PI * 2); ctx.fill(); }
      for (const gh of ghosts) { const t = tinted(set[gh.idx], PAL.mint); if (!t) continue; ctx.save(); ctx.globalAlpha = gh.life / .26 * .38; ctx.globalCompositeOperation = "lighter"; ctx.translate(gh.x - camera, gh.y); ctx.scale(gh.face < 0 ? -1 : 1, 1); ctx.drawImage(t, -54, -140, 108, 144); ctx.restore(); }
    }
    if (!ready(im)) { if (!reflect) drawPilotFallback(sx, player.y); return; }
    const blink = player.inv > 0 && mode === "play" ? .55 + .45 * Math.cos(clock * 22) : 1, breathe = idx === 0 ? 1 + Math.sin(clock * 2.6) * .012 : 1, tilt = player.dash > 0 ? 0 : player.onGround ? (player.vx / 264) * .05 : Math.max(-.12, Math.min(.12, player.vy * .00012)) * player.face;
    ctx.save(); ctx.translate(sx, player.y + bob); ctx.rotate(tilt); ctx.scale(player.face < 0 ? -player.sx : player.sx, player.sy * breathe); if (!reflect) ctx.globalAlpha = blink;
    if (glitchT > 0 && !reflect) { const t = tinted(im, PAL.signal); if (t) { ctx.globalAlpha = .6; ctx.drawImage(t, -54 + (Math.random() - .5) * 10, -140, 108, 144); ctx.globalAlpha = 1; } }
    ctx.drawImage(im, -54, -140, 108, 144);
    const outfit = !reflect && window.ForgeEconomy && window.ForgeEconomy.equipped("outfits"); if (outfit) { const tc = tinted(im, outfit.color); if (tc) { const ga = ctx.globalAlpha, gc = ctx.globalCompositeOperation; ctx.globalCompositeOperation = "color"; ctx.globalAlpha = ga * .9; ctx.drawImage(tc, -54, -140, 108, 144); ctx.globalCompositeOperation = gc; ctx.globalAlpha = ga; } }
    if (!reflect && player.inv > 0 && mode === "play") { const t = tinted(im, "#ffffff"); if (t) { ctx.globalAlpha = .18 * blink; ctx.globalCompositeOperation = "lighter"; ctx.drawImage(t, -54, -140, 108, 144); } }
    ctx.restore();
    if (!reflect && !player.onGround) { const fx = sx - player.face * 22, fy = player.y - 52; glowAt(fx, fy + 6, 18, PAL.cool, .35 + Math.random() * .15); }
    if (!reflect && muzzleT > 0) { const mx = sx + player.face * 30, my = player.y - 49; glowAt(mx, my, 26, "#ffffff", muzzleT / .07); ctx.fillStyle = "#fff"; ctx.globalAlpha = muzzleT / .07; ctx.beginPath(); ctx.moveTo(mx, my - 6); ctx.lineTo(mx + player.face * 14, my); ctx.lineTo(mx, my + 6); ctx.lineTo(mx - player.face * 3, my); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
  }
  function drawPilotFallback(x, y) { ctx.fillStyle = "#e9ebf0"; ctx.beginPath(); ctx.roundRect(x - 14, y - 96, 28, 56, 12); ctx.fill(); ctx.beginPath(); ctx.arc(x, y - 112, 17, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#0a0e17"; ctx.beginPath(); ctx.ellipse(x + 6, y - 112, 10, 8, 0, 0, Math.PI * 2); ctx.fill(); }
  function drawShots() {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const fxi = window.ForgeEconomy && window.ForgeEconomy.equipped("fx"), fxc = fxi ? (fxi.color === "prism" ? ["#ff4a2e", "#ffc46b", "#9ff2c4", "#8fd3ff", "#b79cff"][Math.floor(clock * 6) % 5] : fxi.color) : null;
    for (const s of shots) { const x = s.x - camera; if (x < -40 || x > W + 40) continue; const dir = Math.sign(s.vx) || 1, g = ctx.createLinearGradient(x - dir * 34, 0, x, 0); g.addColorStop(0, fxc ? fxc + "00" : "rgba(207,227,255,0)"); g.addColorStop(1, fxc ? fxc + "bb" : "rgba(207,227,255,.7)"); ctx.fillStyle = g; ctx.fillRect(Math.min(x, x - dir * 34), s.y - 1.5, 34, 3); ctx.fillStyle = "#fff"; ctx.fillRect(Math.min(x, x - dir * 12), s.y - .75, 12, 1.5); glowAt(x, s.y, 9, fxc || "#cfe3ff", .6); }
    ctx.restore();
    for (const s of hostile) { const x = s.x - camera, y = s.y || FLOOR - 40; if (x < -20 || x > W + 20) continue; glowAt(x, y, 16, PAL.signal, .7); ctx.fillStyle = "#1a0603"; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#ff8a6e"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = "#fff"; ctx.fillRect(x - .75, y - .75, 1.5, 1.5);
      ctx.strokeStyle = "rgba(255,74,46,.35)"; ctx.beginPath(); ctx.moveTo(x + 6, y); ctx.lineTo(x + 6 - (s.vx || -200) * .06, y - (s.vy || 0) * .06); ctx.stroke(); }
  }
  function drawRings() { for (const r of fxRings) { const t = 1 - r.life / r.max, e = ease.out(t), x = r.x - camera; ctx.strokeStyle = r.color; ctx.lineWidth = r.lw * (1 - t * .6); ctx.globalAlpha = (1 - t) * .9; ctx.beginPath(); ctx.arc(x, r.y, r.r0 + (r.r1 - r.r0) * e, 0, Math.PI * 2); ctx.stroke(); } ctx.globalAlpha = 1; }
  function drawRewardText() { ctx.save(); ctx.textAlign = "center"; for (const fx of rewardFx) { const x = fx.x - camera; if (x < -180 || x > W + 180) continue; const a = Math.min(1, fx.life * 1.8), text = fx.text.startsWith("+1 FORGE") ? "+1" : fx.text, short = text.length < 6; if (text.indexOf("×") > 0 || text.indexOf("$FORGE") === 0) { ctx.globalAlpha = a; ctx.font = `600 11px ${MONO}`; ctx.fillStyle = text.indexOf("$FORGE") === 0 ? "#c9a8ff" : "#ffffff"; ctx.fillText(text, x, fx.y - 34); continue; } ctx.globalAlpha = a; ctx.font = short ? `600 13px ${MONO}` : `500 10px ${MONO}`; ctx.fillStyle = short ? "#ffffff" : PAL.mint; ctx.fillText(text, x, fx.y - 25); } ctx.restore(); }

  // --- frame
  function draw() {
    ddt = Math.max(0, Math.min(.05, clock - lastDrawClock)); lastDrawClock = clock;
    const wi = worldFor(selected), accent = ACCENTS[wi];
    detectEvents(accent);
    ctx.save(); ctx.fillStyle = PAL.ink; ctx.fillRect(0, 0, W, H);
    drawBackdrop();
    if (shakeT > 0) { const k = Math.min(1, shakeT * 4) * 7; ctx.translate((Math.random() - .5) * k, (Math.random() - .5) * k); }
    const introZ = introT > 0 ? ease.inOut(clamp01(introT / 2.4)) : 0; zoom = 1 + introZ * .07;
    if (zoom !== 1) { const px = player ? player.x - camera : W / 2; ctx.translate(px, FLOOR); ctx.scale(zoom, zoom); ctx.translate(-px, -FLOOR); }
    ctx.translate(0, camY);
    drawScene(accent);
    ctx.restore();
    drawScreenFx(accent);
    prevMode = mode;
  }
  function detectEvents(accent) {
    if (!player) return;
    if (mode === "play" && prevMode !== "play" && prevMode !== "paused") { introT = 2.4; bossSeen = false; ring(player.x, player.y - 60, 10, 140, .9, "#ffffff", 1.2); burstShards(player.x, player.y - 70, PAL.cool, 14, .6); lastHp = player.hp; }
    if (mode === "won" && prevMode === "play") { winT = 1.6; ring(length - 58, FLOOR - 74, 20, 420, 1.3, "#ffffff", 2); ring(length - 58, FLOOR - 74, 10, 260, 1, accent, 1.2); }
    if (mode === "failed" && prevMode === "play") { failT = 1.4; burstShards(player.x, player.y - 60, "#ffffff", 26, 1.2); burstShards(player.x, player.y - 60, PAL.signal, 16, 1); ring(player.x, player.y - 60, 6, 200, .8, PAL.signal, 2); }
    if (player.hp < lastHp && mode !== "menu") { glitchT = .35; ring(player.x, player.y - 60, 8, 90, .5, PAL.signal, 1.6); }
    lastHp = player.hp;
    if (shots.length > lastShots && mode === "play") muzzleT = .07; lastShots = shots.length;
    for (const e of enemies) if (e.dead && !e.fxDone) { e.fxDone = true; const eh = [80, 88, 98][e.type]; ring(e.x, e.y - eh * .5, 6, 70, .45, e.type === 1 ? PAL.cool : PAL.signal, 1.4); burstShards(e.x, e.y - eh * .5, "#ffffff", 8, .8); burstShards(e.x, e.y - eh * .5, "#3a3d44", 10, .9); }
    if (boss && !bossSeen && boss.x - camera < W - 60 && mode === "play") { bossSeen = true; bossIntroT = 2.6; shake(.2); }
    if (boss && boss.dead && !boss.fxDone) { boss.fxDone = true; ring(boss.x, boss.y, 10, 380, 1.2, "#ffffff", 2.5); ring(boss.x, boss.y, 10, 240, .9, PAL.signal, 1.6); burstShards(boss.x, boss.y, "#ffffff", 30, 1.6); burstShards(boss.x, boss.y, "#2a2c33", 30, 1.4); }
    if (lastWorld !== worldFor(selected)) { lastWorld = worldFor(selected); worldFade = .8; }
  }
  function drawScene(accent) {
    drawGround(accent);
    const actors = (reflect) => { for (const e of enemies) if (!e.dead && e.x - camera > -90 && e.x - camera < W + 90) drawEnemy(e, reflect); drawBoss(reflect); drawPlayer(reflect); };
    drawReflections(actors);
    drawGroundAccent(accent);
    for (const sp of spikes) drawSpikes(sp);
    for (const p of platforms) drawPlatform(p, accent);
    for (const beam of beams) drawBeam(beam);
    for (const sp of springs) drawSpring(sp, accent);
    drawGate(accent);
    for (const s of shards) { if (s.taken) continue; const x = s.x - camera; if (x < -40 || x > W + 40) continue; if (s.kind === "medal") drawMedal(x, s.y, s.had, s.ox || s.x); else drawPickup(x, s.y, s.kind, s.ox || s.x); }
    if (magnetT > 0 && player) { const a = Math.min(1, magnetT) * .5, sx = player.x - camera; ctx.strokeStyle = PAL.cool; ctx.globalAlpha = a * .5; ctx.lineWidth = 1; ctx.setLineDash([3, 7]); ctx.lineDashOffset = clock * 30; ctx.beginPath(); ctx.arc(sx, player.y - 46, 170, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.globalAlpha = 1; glowAt(sx, player.y - 46, 60, PAL.cool, a * .25); }
    actors(false);
    drawShots();
    drawParticles();
    drawRings();
    drawRewardText();
    if (pulse > 0 && player) { const t = 1 - pulse / .56, pr = ease.out(t) * (260 + save.skills.nova * 23), sx = player.x - camera; ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = PAL.cool; ctx.lineWidth = 2; ctx.globalAlpha = 1 - t; ctx.beginPath(); ctx.arc(sx, player.y - 50, pr, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; ctx.globalAlpha = (1 - t) * .5; ctx.beginPath(); ctx.arc(sx, player.y - 50, pr * .82, 0, Math.PI * 2); ctx.stroke(); wire(SHAPES.ico, sx, player.y - 50, pr * .5, clock, clock * 1.3, 0, "#ffffff", (1 - t) * .35); ctx.restore(); }
  }
  function letterbox(k) { if (k <= 0) return; const h = 46 * ease.out(k); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, h); ctx.fillRect(0, H - h, W, h); ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(0, h, W, 1); ctx.fillRect(0, H - h - 1, W, 1); }
  function drawScreenFx(accent) {
    ctx.drawImage(vignetteCanvas(), 0, 0);
    if (flashT > 0) { const a = flashT / .35; ctx.strokeStyle = PAL.signal; ctx.globalAlpha = a * .8; ctx.lineWidth = 2; ctx.strokeRect(6, 6, W - 12, H - 12); glowAt(0, H / 2, H * .6, PAL.signal, a * .25); glowAt(W, H / 2, H * .6, PAL.signal, a * .25); ctx.globalAlpha = 1; }
    if (worldFade > 0) { ctx.fillStyle = `rgba(6,6,7,${worldFade / .8})`; ctx.fillRect(0, 0, W, H); }
    // cinematic cards: level intro, guardian arrival, extraction, signal lost
    if (introT > 0) {
      const t = 1 - introT / 2.4, inA = clamp01(t / .18), outA = clamp01(introT / .5), a = Math.min(inA, outA); letterbox(a);
      const lineW = 260 * ease.out(clamp01((t - .05) / .35)); ctx.fillStyle = "#fff"; ctx.globalAlpha = a; ctx.fillRect(W / 2 - lineW / 2, H / 2 + 8, lineW, 1);
      ctx.textAlign = "center"; ctx.font = `500 10px ${MONO}`; ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.fillText(`WORLD ${String(worldFor(selected) + 1).padStart(2, "0")} · ${worlds[worldFor(selected)].name}  —  MISSION ${String(selected).padStart(2, "0")}`, W / 2, H / 2 - 40);
      const rise = (1 - ease.out(clamp01((t - .08) / .4))) * 16; ctx.font = `800 40px ${DISPLAY}`; ctx.fillStyle = "#fff"; ctx.save(); ctx.beginPath(); ctx.rect(0, H / 2 - 40, W, 46); ctx.clip(); ctx.fillText(stageTitle(selected), W / 2, H / 2 - 4 + rise); ctx.restore();
      ctx.font = `500 9px ${MONO}`; ctx.fillStyle = accent; ctx.fillText(boss ? L("GUARDIAN SECTOR", "守卫区") : L("REACH THE EXTRACTION RING", "抵达撤离环"), W / 2, H / 2 + 28); ctx.globalAlpha = 1; ctx.textAlign = "left";
    }
    if (bossIntroT > 0 && boss) {
      const t = 1 - bossIntroT / 2.6, a = Math.min(clamp01(t / .15), clamp01(bossIntroT / .5)); letterbox(a);
      ctx.globalAlpha = a; ctx.textAlign = "right"; const xR = W - 64, yB = H - 76; ctx.font = `500 10px ${MONO}`; ctx.fillStyle = PAL.signal; ctx.fillText(L("GUARDIAN DETECTED", "检测到守卫"), xR, yB - 44);
      const wipe = ease.out(clamp01((t - .05) / .4)); ctx.save(); ctx.beginPath(); ctx.rect(xR - 520 * wipe, yB - 40, 520, 50); ctx.clip(); ctx.font = `800 44px ${DISPLAY}`; ctx.fillStyle = "#fff"; ctx.fillText(GUARDIAN_NAMES[boss.kind], xR, yB); ctx.restore();
      ctx.fillStyle = "#fff"; ctx.fillRect(xR - 220 * wipe, yB + 12, 220 * wipe, 1); ctx.font = `500 9px ${MONO}`; ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.fillText(`CORE ${boss.max} · ${L("SEALS THE EXTRACTION RING", "封锁撤离环")}`, xR, yB + 28); ctx.globalAlpha = 1; ctx.textAlign = "left";
    }
    if (winT > 0) { const t = 1 - winT / 1.6; ctx.fillStyle = "#fff"; ctx.globalAlpha = Math.max(0, .5 - t) * .9; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; letterbox(clamp01(t * 3)); }
    if (failT > 0) { const t = 1 - failT / 1.4; ctx.fillStyle = `rgba(6,6,7,${.5 * clamp01(t * 2)})`; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = PAL.signal; ctx.globalAlpha = (1 - t) * .5; ctx.lineWidth = 1; for (let i = 0; i < 3; i++) { const y = Math.random() * H; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } ctx.globalAlpha = 1; }
    if (mode === "play" || mode === "paused") drawHud(accent);
    if (flyFx.length) { for (let i = flyFx.length - 1; i >= 0; i--) { const f = flyFx[i]; f.t += ddt * 2.4; if (f.t >= 1) { flyFx.splice(i, 1); hudPop = .25; continue; } const e = ease.inOut(f.t), tx = 34, ty = 46, mx = (f.x + tx) / 2, my = Math.min(f.y, ty) - 60, x = (1 - e) * (1 - e) * f.x + 2 * (1 - e) * e * mx + e * e * tx, y = (1 - e) * (1 - e) * f.y + 2 * (1 - e) * e * my + e * e * ty, sz = 22 - e * 10; ctx.globalAlpha = .95; ctx.drawImage(coinAtlas(), (Math.floor(clock * 30 + i) % 24) * 64, 0, 64, 64, x - sz / 2, y - sz / 2, sz, sz); } ctx.globalAlpha = 1; }
  }
  function drawHud(accent) {
    if (!player) return; const hb = introT > 0 || bossIntroT > 0 ? .25 : 1;
    ctx.save(); ctx.globalAlpha = hb;
    // route: hairline track, ticks for chasms and guardian, a diamond marker for the pilot
    const x0 = 24, y0 = 24, tw = 220, prog = clamp01(player.x / (length - 60));
    ctx.font = `500 9px ${MONO}`; ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.fillText(`ROUTE ${String(Math.round(prog * 100)).padStart(3, "0")}%`, x0, y0 - 6);
    ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fillRect(x0, y0, tw, 1); ctx.fillStyle = "#fff"; ctx.fillRect(x0, y0, tw * prog, 1);
    ctx.fillStyle = "rgba(255,74,46,.7)"; for (const g of gaps) ctx.fillRect(x0 + tw * g.x / length, y0 - 2, 1, 5);
    if (boss) { ctx.fillStyle = boss.dead ? "rgba(255,255,255,.4)" : PAL.signal; ctx.fillRect(x0 + tw * boss.x / length - 1, y0 - 4, 2, 9); }
    ctx.fillStyle = accent; ctx.fillRect(x0 + tw - 1, y0 - 4, 2, 9);
    const mx = x0 + tw * prog; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(mx, y0 - 4); ctx.lineTo(mx + 4, y0); ctx.lineTo(mx, y0 + 4); ctx.lineTo(mx - 4, y0); ctx.closePath(); ctx.fill();
    // coins · medallions · chain
    hudPop = Math.max(0, hudPop - ddt); const cs = 1 + hudPop * 1.2; ctx.save(); ctx.translate(34, 46); ctx.scale(cs, cs); ctx.drawImage(coinAtlas(), (Math.floor(clock * 14) % 24) * 64, 0, 64, 64, -8, -8, 16, 16); ctx.restore();
    ctx.font = `500 10px ${MONO}`; ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.fillText(`${String(coinsTaken).padStart(2, "0")}/${coinTotal}`, 48, 50);
    for (let i = 0; i < 3; i++) { const mxp = 104 + i * 15, got = shards.some((s) => s.kind === "medal" && s.idx === i && s.taken), had = ((save.medals[selected] || 0) >> i) & 1; ctx.save(); ctx.translate(mxp, 46); ctx.rotate(Math.PI / 4); if (got) { const g = ctx.createLinearGradient(-5, -5, 5, 5); g.addColorStop(0, "#9945ff"); g.addColorStop(1, "#14f195"); ctx.fillStyle = g; ctx.fillRect(-4.5, -4.5, 9, 9); } else { ctx.strokeStyle = had ? "rgba(185,140,255,.7)" : "rgba(255,255,255,.35)"; ctx.lineWidth = 1; ctx.strokeRect(-4, -4, 8, 8); } ctx.restore(); }
    if (chain.n >= 2) { const mult = 1 + Math.min(4, Math.floor(chain.n / 5)), cx0 = 156; ctx.font = `600 10px ${MONO}`; ctx.fillStyle = mult > 1 ? "#fff" : "rgba(255,255,255,.7)"; ctx.fillText(`CHAIN ${chain.n}${mult > 1 ? ` · ×${mult}` : ""}`, cx0, 50); ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fillRect(cx0, 55, 64, 1); ctx.fillStyle = mult > 1 ? "#b98cff" : "#fff"; ctx.fillRect(cx0, 55, 64 * clamp01(chain.t / 1.15), 1); }
    if (magnetT > 0) { ctx.font = `500 8.5px ${MONO}`; ctx.fillStyle = PAL.cool; ctx.fillText(`MAGNET ${magnetT.toFixed(1)}s`, 24, 70); ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fillRect(88, 67, 60, 1); ctx.fillStyle = PAL.cool; ctx.fillRect(88, 67, 60 * clamp01(magnetT / 9), 1); }
    // timer pill + ability gauges
    const left = Math.max(0, 90 - levelClock), warn = left < 15, label = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(Math.floor(left % 60)).padStart(2, "0")}`;
    const px = W - 112, py = 12; ctx.fillStyle = "rgba(6,6,7,.6)"; ctx.beginPath(); ctx.roundRect(px, py, 88, 26, 13); ctx.fill(); ctx.strokeStyle = warn ? "rgba(255,74,46,.8)" : "rgba(255,255,255,.14)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = warn && Math.floor(clock * 4) % 2 ? PAL.signal : "#fff"; ctx.font = `500 12px ${MONO}`; ctx.textAlign = "right"; ctx.fillText(label, px + 76, py + 17); ctx.fillStyle = warn ? PAL.signal : "rgba(255,255,255,.5)"; ctx.beginPath(); ctx.arc(px + 14, py + 13, 2.5, 0, Math.PI * 2); ctx.fill();
    const gauge = (yy, name, v, readyC) => { ctx.textAlign = "right"; ctx.font = `500 8.5px ${MONO}`; ctx.fillStyle = v >= 1 ? readyC : "rgba(255,255,255,.45)"; ctx.fillText(name, W - 82, yy + 3); ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fillRect(W - 76, yy, 52, 1); ctx.fillStyle = v >= 1 ? readyC : "#fff"; ctx.fillRect(W - 76, yy, 52 * clamp01(v), 1); if (v >= 1) glowAt(W - 24, yy, 8, readyC, .6 + .3 * Math.sin(clock * 5)); };
    const dashMax = Math.max(3.1, 6.2 - save.skills.evasion * .3);
    gauge(52, "DASH", 1 - dashCooldown / dashMax, PAL.mint); gauge(64, "NOVA", player.nova / 100, PAL.cool);
    ctx.textAlign = "left";
    // guardian health: thin segmented bar, centre top
    if (boss && !boss.dead && boss.x - camera < W + 40) {
      const bw = 300, bx = W / 2 - bw / 2, by = 30, f = clamp01(boss.hp / boss.max); ctx.textAlign = "center"; ctx.font = `500 9px ${MONO}`; ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.fillText(`${GUARDIAN_NAMES[boss.kind]} · ${boss.hp}/${boss.max}`, W / 2, by - 8);
      ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(bx, by, bw, 2); ctx.fillStyle = f < .5 ? PAL.signal : "#fff"; ctx.fillRect(bx, by, bw * f, 2); ctx.fillStyle = "rgba(6,6,7,1)"; for (let i = 1; i < boss.max; i++) ctx.fillRect(bx + bw * i / boss.max, by, 1, 2);
      if (boss.hit > 0) glowAt(bx + bw * f, by + 1, 14, "#ffffff", boss.hit * 8); ctx.textAlign = "left";
    }
    ctx.restore();
  }
  function roundRect(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r);}
  function upgrade(key){if(save.skillPoints<1||save.skills[key]>=10)return;save.skillPoints--;save.skills[key]++;persist();paintHud();toast(`${key.toUpperCase()} RANK ${save.skills[key]} · ARENA LINKED`);}
  function loop(ts){const raw=(ts-last)/1000||0,dt=Math.min(.032,raw);last=ts;clock+=dt;
    // graceful scaling: if frames stay slow, drop the backing store to 1x pixel ratio
    if(!lowQ&&page.classList.contains("active")&&mode==="play"){slowT=raw>.024&&raw<.25?slowT+raw:Math.max(0,slowT-raw*.5);if(slowT>2.5){lowQ=true;resize();}}
    if(page.classList.contains("active")){step(dt);updateParticles(dt);draw();if(mode==="play"){hudClock+=dt;if(hudClock>.12){syncRunHud();hudClock=0;}}}pressed.clear();requestAnimationFrame(loop);}
  action.addEventListener("click",continueAction);
  document.querySelectorAll("[data-pilot-choice]").forEach((button)=>button.addEventListener("click",()=>{if(mode!=="menu"&&mode!=="failed")return;save.pilot=button.dataset.pilotChoice;persist();syncPilotPicker();}));
  document.querySelectorAll("[data-upgrade-skill]").forEach((b)=>b.addEventListener("click",()=>upgrade(b.dataset.upgradeSkill)));
  document.querySelector('[data-page="campaign"]').addEventListener("click",()=>{if(mode==="play"){mode="paused";showMenu("paused");}paintHud();draw();});
  document.querySelector('[data-page="arena"]').addEventListener("click",()=>{if(mode==="play"){mode="paused";showMenu("paused");}});
  document.addEventListener("keydown",(event)=>{if(!page.classList.contains("active"))return;const k=event.code;if((k==="Escape"||k==="KeyP")&&!event.repeat){if(mode==="play"){mode="paused";held.clear();showMenu("paused");}else if(mode==="paused"){mode="play";overlay.classList.add("off");}return;}if(k==="Enter"&&mode!=="play"&&!(event.target instanceof HTMLInputElement)){continueAction();return;}if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(k))event.preventDefault();if(!held.has(k))pressed.add(k);held.add(k);if(k==="Space"||k==="ArrowUp"||k==="KeyW")jump();if(k==="ShiftLeft"||k==="ShiftRight")dash();if(k==="KeyE")nova();});
  document.addEventListener("keyup",(event)=>{held.delete(event.code);if(["Space","ArrowUp","KeyW"].includes(event.code)&&player)player.jumpHeld=false;});
  window.addEventListener("blur",()=>{held.clear();if(mode==="play"&&page.classList.contains("active")){mode="paused";showMenu("paused");}});
  document.querySelectorAll("[data-pilot-key]").forEach((b)=>{const k=b.dataset.pilotKey;b.addEventListener("pointerdown",(e)=>{e.preventDefault();if(!held.has(k))pressed.add(k);held.add(k);if(k==="Space"||k==="ArrowUp")jump();if(k==="ShiftLeft")dash();if(k==="KeyE")nova();});for(const type of ["pointerup","pointerleave","pointercancel"])b.addEventListener(type,()=>{held.delete(k);if((k==="Space"||k==="ArrowUp")&&player)player.jumpHeld=false;});});
  document.querySelectorAll("[data-page]").forEach((b)=>b.addEventListener("click",()=>{if(mode==="play"&&b.dataset.page!=="campaign"){mode="paused";showMenu("paused");}}));
  window.addEventListener("signal-language",()=>{if(mode!=="play")showMenu(mode==="won"||mode==="failed"||mode==="paused"?mode:"menu");});
  window.addEventListener("forge-pilot-unlock",(e)=>{const m=Math.max(1,Math.min(MAX,Number(e.detail&&e.detail.maxLevel)||1));if(m>save.maxLevel){save.maxLevel=m;persist();paintHud();renderRoute();}});
  window.addEventListener("storage",(event)=>{if(event.key===STORE){try{save={...save,...JSON.parse(event.newValue),skills:{...save.skills,...JSON.parse(event.newValue).skills}};paintHud();}catch{}}});
  if(!save.cleared.length)showMenu("menu");else showMenu("menu");
  if(/[?&]pilotdebug/.test(location.search))window.__pilot={get player(){return player},get shards(){return shards},get springs(){return springs},get platforms(){return platforms},get gaps(){return gaps},get length(){return length},get state(){return{mode,coinsTaken,coinTotal,medalsGot,chain,magnetT,score}}};
  paintHud();renderRoute();buildLevel(selected);showMenu("menu");requestAnimationFrame(loop);
})();
