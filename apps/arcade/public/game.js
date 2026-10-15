(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id);
  const SAVE_KEY = "signal-protocol-save-v3";
  const GUEST_KEY = "signal-protocol-guest-v1";
  const LANGUAGE_KEY = "signal-language";
  let language = (() => { try { return localStorage.getItem(LANGUAGE_KEY) === "zh" ? "zh" : "en"; } catch { return "en"; } })();
  const WIDTH = 960;
  const HEIGHT = 552;
  const STEP_SECONDS = 40;
  const worldArt = new Image(); worldArt.src = "arena-world-v13.webp";
  const fighterArt = new Image(); fighterArt.src = "hero-fighter-v13.webp";
  const bossArt = new Image(); bossArt.src = "boss-manta-v13.webp";
  const bossArts = new Map();
  function bossImage(type) { let im = bossArts.get(type.art); if (!im) { im = new Image(); im.src = type.art || "boss-manta-v13.webp"; bossArts.set(type.art, im); } return im; }
  const dayNo = Math.floor(Date.now() / 86400000);
  const rigs = [
    { id: "trace", name: "SPARK", effect: "Fastest trigger", effectZh: "快速锁定目标", tint: "#f3e3b3", fire: 0.20, speed: 250, hp: 3, pulse: 145 },
    { id: "vault", name: "ANVIL", effect: "One extra hull point", effectZh: "额外一格生命核心", tint: "#7fe0c5", fire: 0.27, speed: 225, hp: 4, pulse: 138 },
    { id: "echo", name: "FLUX", effect: "Wider forge blast", effectZh: "熔炉爆破范围更大", tint: "#ff9ab8", fire: 0.25, speed: 235, hp: 3, pulse: 206 },
  ];
  const bossTypes = [
    { name: "ANVIL RAY", color: "#ff7a3d", style: "volley", art: "boss-manta-v13.webp" },
    { name: "TWIN HAMMER", color: "#4aa8ff", style: "charge", art: "boss-hammer.webp" },
    { name: "BELLOWS", color: "#3fe0c5", style: "siphon", art: "boss-bellows.webp" },
  ];
  const maps = [
    { id: "rust", name: "Rust Belt", local: "Rust Belt", localZh: "锈带", min: 1, biome: "PROLOGUE · LEVEL 1", biomeZh: "序章 · 等级 1", copy: "Open lanes and drifting rocks. Where every pilot starts.", copyZh: "废弃铸造厂与裂隙初现的痕迹。", icon: "⌁", palette: ["#31452e", "#111b1b", "#ffb454"] },
    { id: "neon", name: "Neon Gardens", local: "Neon Gardens", localZh: "霓虹花园", min: 2, biome: "SECTOR 02 · LEVEL 2", biomeZh: "区域 02 · 等级 2", copy: "Light traps appear in rhythm with each pulse.", copyZh: "光圈陷阱随脉冲节奏显现。", icon: "✳", palette: ["#4b225b", "#10172b", "#ff68cd"] },
    { id: "abyss", name: "Abyss Reactor", local: "Abyss Reactor", localZh: "深渊反应堆", min: 4, biome: "SECTOR 04 · LEVEL 4", biomeZh: "区域 04 · 等级 4", copy: "Pulsing rifts and heavier elite swarms.", copyZh: "脉动裂隙与更强的精英蜂群。", icon: "◈", palette: ["#133b4c", "#111522", "#68dfff"] },
    { id: "orbit", name: "Orbit of Silence", local: "Orbit of Silence", localZh: "寂静轨道", min: 7, biome: "SECTOR 07 · LEVEL 7", biomeZh: "区域 07 · 等级 7", copy: "Gravity arcs around a singularity core.", copyZh: "奇点核心周围的重力弧线。", icon: "◉", palette: ["#46283f", "#141523", "#ffb86d"] },
  ];
  const mapArt = new Map(maps.map((map) => { const image = new Image(); image.src = `assets/maps/${map.id}.webp`; return [map.id, image]; }));
  const achievements = [
    { id: "first_run", icon: "▶", name: "First Contact", nameZh: "首次接触", rule: "Finish your first run.", ruleZh: "完成首次挑战。" },
    { id: "boss_breaker", icon: "☠", name: "Boss Breaker", nameZh: "首领终结者", rule: "Defeat any boss.", ruleZh: "击败任意首领。" },
    { id: "sector_3", icon: "III", name: "Deep Run", nameZh: "深入裂隙", rule: "Reach sector 3.", ruleZh: "抵达第 3 区域。" },
    { id: "sector_6", icon: "VI", name: "Edge Walker", nameZh: "临界行者", rule: "Reach sector 6.", ruleZh: "抵达第 6 区域。" },
    { id: "signal_5000", icon: "✦", name: "Spark 5000", nameZh: "火花 5000", rule: "Earn 5,000 lifetime XP.", ruleZh: "累计获得 5,000 经验。" },
    { id: "ten_runs", icon: "×10", name: "A Regular", nameZh: "常驻飞行员", rule: "Finish 10 runs.", ruleZh: "完成 10 次挑战。" },
    { id: "hundred_kills", icon: "100", name: "Clean Sweep", nameZh: "全面清除", rule: "Defeat 100 enemies.", ruleZh: "击败 100 名敌人。" },
  ];
  const upgradePool = [
    { id: "split", icon: "⑂", name: "Forked Lancer", nameZh:"分裂长枪", text: "Fire one extra shot in a spread", textZh:"扇形额外发射一枚子弹", tag: "WEAPON" },
    { id: "overclock", icon: "ϟ", name: "Hot Barrel", nameZh:"热炮管", text: "Increase firing speed by 18%", textZh:"射速提升 18%", tag: "WEAPON" },
    { id: "pierce", icon: "↗", name: "Rail Rounds", nameZh:"轨道弹", text: "Shots deal more damage and pierce", textZh:"提升伤害并穿透敌人", tag: "WEAPON" },
    { id: "drone", icon: "◌", name: "Orbit Drone", nameZh:"轨道无人机", text: "Add an autonomous support shooter", textZh:"增加自动支援射手", tag: "SUPPORT" },
    { id: "hull", icon: "⬡", name: "Reinforced Shell", nameZh:"强化外壳", text: "Restore one core and boost max health", textZh:"恢复一格生命并提高生命上限", tag: "DEFENSE" },
  ];
  const baseSave = { callsign: "PLAYER", xp: 0, best: 0, daily: 0, rewardMarks: [] };
  let profile;
  // Optional run modes driven by the token layer (raids, boss rush, hardcore). null = the classic arena run.
  let runMode = null, pendingMode = null;
  try { profile = { ...baseSave, ...JSON.parse((() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })() || "{}") }; }
  catch { profile = { ...baseSave }; }

  let state = "menu";
  let selectedRig = rigs[0];
  let input = new Set();
  let now = 0, lastFrame = 0, elapsed = 0, nextLevelAt = STEP_SECONDS, level = 1;
  let score = 0, health = 3, maxHealth = 3, energy = 100, bossesDefeated = 0, kills = 0;
  let fireClock = 0, spawnClock = 0, pickupClock = 0, collisionClock = 0, pulseTimer = 0, invulnerable = 0, shake = 0, mapHazardClock = 6, mapHazardFlash = 0;
  let pilotDashTimer = 0, pilotDashCooldown = 0, pilotDashX = 1, pilotDashY = 0;
  let bullets = [], hostileShots = [], enemies = [], bosses = [], drops = [], sparks = [];
  let splitLevel = 0, overclockLevel = 0, pierceLevel = 0, droneLevel = 0, weaponName = "Spark Repeater";
  let selectedReward = [];
  let serverProfile = null;
  let profileReady = false;
  let profileReadyPromise;
  let raidCode = "";
  let activeMap = profile.map || "rust";
  let trailClock = 0;
  // Game-feel state: hit-stop, floating text, shockwaves, damage flash, combo streak, level banner.
  let hitStop = 0, damageFlash = 0, combo = 0, comboClock = 0, bestCombo = 0, banner = null, droneShotAt = 0;
  let floaters = [], rings = [];
  // Power-ups and run modifiers.
  let rapidTimer = 0, magnetTimer = 0, shieldUp = false, grazeCount = 0;
  const INK = "#060607", DISPLAY_FONT = "'Geist', 'Helvetica Neue', Arial, sans-serif", UI_FONT = "'Geist', 'Helvetica Neue', Arial, sans-serif", MONO_FONT = "'Geist Mono', ui-monospace, Menlo, monospace", GOLD = "#eef3f8", GOLD_HI = "#ffffff";
  let use3D = false;
  const fx3d = (name, data) => { if (use3D) window.Forge3D.event(name, data); };
  function comboMult() { return 1 + Math.min(3, Math.floor(combo / 10)) * .5; }
  let touchStick = null;
  const sfx = (name) => window.SFX?.play(name);
  // Static hosting has no /api backend: everything runs on this device unless the page opts in.
  const ONLINE = window.FORGE_ONLINE === true;
  const store = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch {} },
  };
  // pilotBuild() used to parse localStorage several times per frame; cache it and refresh on change.
  let pilotBuildCache = null;
  window.addEventListener("pilot-build-updated", () => { pilotBuildCache = null; });
  window.addEventListener("storage", (event) => { if (event.key === "signal-pilot-campaign-v1") pilotBuildCache = null; });
  const owns = (id) => !!serverProfile?.inventory?.includes(id);
  const glowCache = new Map();
  function glowSprite(color) {
    let sprite = glowCache.get(color);
    if (sprite) return sprite;
    sprite = document.createElement("canvas"); sprite.width = sprite.height = 64;
    const g = sprite.getContext("2d"), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `${color}cc`); grad.addColorStop(.35, `${color}55`); grad.addColorStop(1, `${color}00`);
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64); glowCache.set(color, sprite); return sprite;
  }
  function glow(x, y, radius, color, alpha = 1) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = alpha;
    ctx.drawImage(glowSprite(color), x - radius, y - radius, radius * 2, radius * 2); ctx.restore();
  }
  function floatText(x, y, text, color = "#ffffff", size = 14) { floaters.push({ x, y, text, color, size, life: .9, max: .9 }); if (floaters.length > 40) floaters.shift(); }
  function shockwave(x, y, color, radius = 60, life = .45, width = 3) { rings.push({ x, y, color, radius, life, max: life, width }); }
  const hudCache = new Map();
  function setText(id, value) { if (hudCache.get(id) === value) return; hudCache.set(id, value); const el = $(id); if (el) el.textContent = value; }
  const catalog = [
    { id: "ion", name: "Ion Core", nameZh: "离子核心", type: "ENERGY", typeZh: "能量", cost: 250, icon: "✳", text: "+25% pulse regeneration", textZh: "脉冲恢复速度 +25%" },
    { id: "phantom", name: "Phantom Hull", nameZh: "幻影装甲", type: "ARMOR", typeZh: "装甲", cost: 500, icon: "⬡", text: "+1 health core at the start of each run", textZh: "每次挑战开始时额外获得 1 格生命" },
    { id: "overdrive", name: "Overdrive Array", nameZh: "超频阵列", type: "WEAPON", typeZh: "武器", cost: 750, icon: "ϟ", text: "+15% firing speed", textZh: "射速 +15%" },
    { id: "revenant", name: "Revenant Frame", nameZh: "复苏机架", type: "ARTIFACT", typeZh: "遗物", cost: 1200, icon: "☠", text: "+10% score from enemies and caches", textZh: "击败敌人和开启核心时得分 +10%" },
    { id: "magnet", name: "Shard Magnet", nameZh: "碎片磁吸器", type: "COLLECTION", typeZh: "收集", cost: 350, icon: "✧", text: "Collect star shards from farther away", textZh: "更远距离吸引星屑" },
    { id: "chrono", name: "Chrono Greaves", nameZh: "时序护胫", type: "MOBILITY", typeZh: "机动", cost: 450, icon: "➤", text: "+12% movement speed", textZh: "移动速度 +12%" },
    { id: "drone", name: "Warden Drone", nameZh: "守望无人机", type: "SUPPORT", typeZh: "支援", cost: 900, icon: "◉", text: "Drone automatically attacks the nearest target", textZh: "无人机自动攻击最近的目标" },
    { id: "nova", name: "Nova Capacitor", nameZh: "新星电容器", type: "PULSE", typeZh: "脉冲", cost: 650, icon: "✺", text: "+25% forge blast radius", textZh: "熔炉爆破半径 +25%" },
    { id: "kinetic", name: "Kinetic Lens", nameZh: "动能透镜", type: "AMMO", typeZh: "弹药", cost: 800, icon: "↗", text: "Each shot pierces one more target", textZh: "每发子弹可多穿透一个目标" },
    { id: "leech", name: "Siphon Matrix", nameZh: "虹吸矩阵", type: "RECOVERY", typeZh: "恢复", cost: 1100, icon: "⌬", text: "Defeating a boss restores two cores", textZh: "击败首领后恢复两格生命" },
    { id: "aurora", name: "Aurora Mantle", nameZh: "极光披风", type: "COSMETIC", typeZh: "外观", cost: 1400, icon: "❋", text: "Icy contrail, star trail, and aura", textZh: "冰晶尾迹、星尘轨迹与光环" },
    { id: "rift", name: "Rift Walker", nameZh: "裂隙行者", type: "LEGENDARY", typeZh: "传说", cost: 1800, icon: "⟁", text: "Secret hull and +8% movement speed", textZh: "隐藏机体与移动速度 +8%" },
  ];
  const skinRows = [
    ["Signal Runner","信号疾行者","#c8ff63","needle"],["Dust Comet","尘埃彗星","#f7ad68","comet"],["Tidal Prism","潮汐棱镜","#58e8df","prism"],["Violet Warden","紫曜守卫","#b98dff","wing"],["Copper Finch","赤铜雀","#ff7968","finch"],
    ["Moonlit Kite","月影风筝","#a9cfff","kite"],["Static Bloom","静电花冠","#f878cb","bloom"],["Frost Circuit","霜环回路","#82e9ff","circuit"],["Solar Relic","恒星遗物","#ffd369","relic"],["Moss Phantom","苔影幽灵","#9ee581","phantom"],
    ["Cinder Viper","余烬毒蛇","#ff795b","viper"],["Glass Tempest","琉璃风暴","#76e8f1","storm"],["Velvet Singularity","绒夜奇点","#cf80ff","singularity"],["Chrome Mantis","铬钢螳螂","#bce9dd","mantis"],["Lunar Sawtooth","月牙锯齿","#b6b9ff","saw"],
    ["Jade Afterburn","翡翠尾焰","#5ce0aa","afterburn"],["Candy Fracture","糖晶裂片","#ff77a9","fracture"],["Deep Current","深海流线","#478bff","current"],["Amber Oracle","琥珀先知","#ffbf58","oracle"],["Night Orchard","暗夜果园","#c1e676","orchard"],
    ["Starforge Ace","星铸王牌","#f7e484","forge"],["Polar Mirage","极光幻境","#7ef5e5","mirage"],["Rose Engine","玫瑰引擎","#ff719d","engine"],["Blue Hour","蓝调时刻","#78a7ff","hour"],["Thorn Cathedral","荆棘圣堂","#ca8eff","cathedral"],
    ["Redshift Monarch","红移君主","#ff685c","monarch"],["Dream Eater","织梦吞噬者","#a483ff","eater"],["Sapphire Howl","蓝宝石长啸","#58d7ff","howl"],["Primal Aurora","原初极光","#82eeae","aurora"],["Eventide Crown","暮光王冠","#f4a1ff","crown"],
    ["Rift Dancer","裂隙舞者","#e88aff","dancer"],["Obsidian Bloom","曜黑花影","#ff8098","obsidian"],["Electric Koi","电光锦鲤","#75f2db","koi"],["Mirage Drifter","蜃景漂流者","#ffd676","drifter"],["Thunder Archive","雷霆档案","#a8b8ff","archive"],
    ["Prism Breaker","棱镜破界者","#85f7ff","breaker"],["Eclipse Herald","日蚀使者","#f3b1ff","herald"],["Wildfire Bloom","野火绽放","#ff9760","wildfire"],["Last Light","终焉微光","#ffe789","lastlight"],["Astra Prime","星核原型","#e3ff87","prime"],
  ].map(([name,nameZh,color,form],index)=>({id:`skin-${String(index+1).padStart(2,"0")}`,name,nameZh,color,form,index:index+1}));
  const skinSprites = skinRows.map((skin) => { const image = new Image(); image.src = `assets/ships/ship-${String(skin.index).padStart(2,"0")}.webp`; return image; });
  const enemySprites = Array.from({length:8},(_,i)=>{const image=new Image();image.src=`assets/enemies/enemy-${String(i+1).padStart(2,"0")}.webp`;return image;});
  const ammoTypes = [
    { id: "ammo-pulse", name: "Gilt Round", nameZh: "鎏金弹", shape: "orb", color: "#f3e3b3", cost: 0, owned: true },
    { id: "ammo-prism", name: "Prism Darts", nameZh: "棱镜飞镖", shape: "diamond", color: "#52e9df", cost: 280 },
    { id: "ammo-ember", name: "Ember Bolts", nameZh: "余烬弹", shape: "flare", color: "#ff785e", cost: 320 },
    { id: "ammo-void", name: "Void Rings", nameZh: "虚空环弹", shape: "ring", color: "#c182ff", cost: 560 },
    { id: "ammo-toxin", name: "Toxin Shards", nameZh: "毒晶碎片", shape: "triangle", color: "#9be85c", cost: 480 },
    { id: "ammo-frost", name: "Frost Stars", nameZh: "霜星弹", shape: "star", color: "#7bdfff", cost: 420 },
    { id: "ammo-solar", name: "Solar Orbs", nameZh: "太阳耀斑", shape: "sun", color: "#ffd16a", cost: 680 },
    { id: "ammo-glitch", name: "Glitch Squares", nameZh: "故障方块", shape: "square", color: "#fa68c7", cost: 760 },
  ];
  const zh = {
    navArena:"竞技场",navCampaign:"飞行员",navSectors:"区域",navRecords:"成就",navBoard:"排行榜",navHangar:"机库",navArmory:"军械库",navRewards:"奖励",navManual:"手册",navSquad:"小队",
    backToSite:"关于 $FORGE",arenaEyebrow:"星铸 · 竞技场开放",arenaTitle:"你能守住熔炉多久？",arenaSub:"守住熔炉，抵挡废铁蜂群。每 40 秒出现一个新首领。",
    hudTime:"时间 ",hudCore:"生命 ",hudScore:"得分 ",startKicker:"区域 01 · 蜂群来袭",startTitle:"熔炉需要一名飞行员。",startCopy:"废铁蜂群正冲向熔炉。每 40 秒出现新的首领。收集星屑，强化武器，不要停下。",chooseRig:"选择战舰",rigAdvantage:"战舰特长",callsign:"飞行员代号",enterArena:"出发",touchNote:"移动 · 射击 · 爆破",move:"移动",autoFire:"自动射击",overclock:"熔炉爆破",profileTitle:"飞行员资料",accountLabel:"游戏账户",bestRun:"最佳挑战",dailyBoard:"每日全球榜",seasonDrops:"赛季奖励",fieldNotes:"战场笔记",fieldNotesText:"飞蚊成群围攻，冲角兽锁定后猛冲，水蛭会吸走你的热能。擦弹为爆破充能，连杀获得得分倍率，冲刺可直接撞碎小怪。",
    worldsTitle:"区域",worldsIntro:"在挑战中抵达新等级即可解锁区域。每张地图都有独特色彩、场地节奏和危险机制。",recordsTitle:"成就",recordsIntro:"挑战次数、击败数、首领、最高区域和累计经验都会记入你的飞行档案。",boardTitle:"全球排行榜",todayLeaders:"今日领航员",scoreRule:"计分规则",dailyBest:"最佳成绩决定排名",dailyBestText:"每局结束后成绩都会提交给服务器校验。排名按你最好的一局计算，不可能的分数会被拒绝。",climbTag:"冲击榜单",bossBonus:"首领战带来额外得分",bossBonusText:"击败首领可获得大量分数。坚持生存，收集核心，打造适合你的配置。",callsignTag:"你的飞行员代号",saveCallsign:"保存代号",
    hangarTitle:"战舰图鉴",playToUnlock:"持续生存即可解锁",equippedNow:"当前战舰",equippedHint:"选择已解锁外观即可装备。",armoryTitle:"模块与弹药",balanceLabel:"余额",welcomeTag:"首次进入 · 欢迎补给",welcomeText:"一次性欢迎金币已准备就绪。继续游戏、击败首领即可获得更多金币。",modulesTag:"永久强化",modulesTitle:"改变你的生存方式",modulesNote:"每个模块只需解锁一次 · 效果永久保存",projectileTag:"弹药实验室",projectileTitle:"改变每一发子弹的形状与颜色",projectileNote:"弹药外观 · 可随时切换",
    prizesTitle:"赛季奖励",seasonPrizeTag:"赛季奖励路线",reward1:"每日榜首可获得专属战舰外观和「吞噬者」称号。",reward2:"排名第二或第三的飞行员可获得稀有弹药外观与 1,000 积分。",reward3:"前十名玩家均可获得飞行员徽章和 500 积分。",prizesNote:"当前版本的赛季奖励为游戏内数字道具。确认赞助奖励池和正式规则后，可再添加外部奖品。",todayTag:"今日",postRunTitle:"登上排行榜",postRunText:"完成一场挑战并提交成绩，即可加入今日排行榜。验证通过后会立即显示。",openLeaderboard:"查看排行榜",
    manualTitle:"飞行员手册",manualGoal:"目标",manualGoalText:"尽可能守住熔炉。每过 40 秒蜂群加速并出现首领。每回合结束后选择一项强化。",manualControls:"操作",manualControlsText:"使用 WASD 或方向键移动。按住空格自动射击。按 B 消耗满格热能释放熔炉爆破，Shift 冲刺可穿过敌人。手机上也可使用触控按钮。",manualEnemies:"敌人",manualEnemiesText:"飞蚊追击你，冲角兽锁定后猛冲，水蛭靠近时吸取热能。首领会齐射、沿直线冲锋、喷出蜂群，血量过半后进入暴怒。",manualEscalation:"难度升级",manualEscalationText:"等级提升会提高敌人的速度、生命值和出现频率。每三关增加首领数量；第五关后会出现精英敌人。",manualProgress:"成长",manualProgressText:"分数、金币、游戏时间、购买和收藏都保存在此浏览器中。累计飞行每满七分钟即可获得一艘新战舰。",manualTip:"不要停在原地",manualTipText:"沿边缘移动可以快速脱身，但大型蜂群也可能将你困住。把爆破留给首领的预警攻击，擦弹可以回充。",
    squadTitle:"小队与邀请",raidTag:"合作首领战",raidCreateTitle:"集结小队",raidCreateText:"创建房间并分享代码。最多四名飞行员可共同攻击服务器首领。小队获胜后，每位成员可得 120 积分。",createRaid:"创建突袭",roomCode:"房间代码",joinRaidTitle:"加入房间",joinRaid:"加入突袭",referralNetwork:"招募网络",invitePilot:"邀请飞行员",inviteText:"分享你的专属链接。好友完成首次挑战后，你将获得 250 积分。",copyLink:"复制邀请链接",raidSquad:"小队与伤害",raidAttack:"协力攻击",homeLink:"$FORGE · 游戏介绍",footerNotice:"金币与道具不具现金价值", 
    pilotTitle:"熔炉之外",pilotSubtitle:"跑完航线，掌握装备，再把每项强化带回竞技场。",pilotCertification:"飞行认证",pilotWorld:"世界",pilotMission:"任务",pilotCore:"核心",pilotData:"得分",pilotNova:"新星",pilotRun:"奔跑",pilotJump:"跳跃",pilotBlaster:"射击",pilotDash:"闪避",pilotReady:"触控操作已就绪",pilotTraining:"熔炉飞行学校",pilotPoint:"技能点",pilotSchoolIntro:"技能会带入竞技场。每个等级都会改变战机的操控。",pilotFlight:"矢量控制",pilotFlightDesc:"每级提升战机速度 2%",pilotArsenal:"快速射击",pilotArsenalDesc:"每级提升射速 2.5%",pilotEvasion:"相位闪避",pilotEvasionDesc:"缩短冲刺冷却时间",pilotSuper:"新星超载",pilotSuperDesc:"每级提升脉冲范围 10%",pilotShipLink:"战机联动",pilotRoute:"星坠航线 · 进度地图",pilotLevels:"100 个任务，一位飞行员。",pilotAvailable:"可挑战任务",pilotUnlock:"完成任务即可解锁新关卡并获得飞行学校数据点。",pilotStreak:"任务进度",pilotMissionSelected:"已选任务",pilotDeploy:"出击",pilotContinue:"继续",pilotResume:"继续任务",pilotReplay:"再次挑战",pilotRetry:"重试任务",pilotFlightReady:"航线已就绪 · 选择任务",pilotFirstFlight:"首次飞行从这里开始。",pilotIntro:"奔跑、跳跃、击落无人机、收集信号碎片并抵达撤离信标。",pilotObjective:"任务目标",pilotPause:"飞行已暂停 · 检查点保留",pilotPickup:"已收集信号数据",pilotClear:"撤离确认。",pilotFail:"信号丢失 · 飞行记录保留",pilotFailTitle:"重整。你已经熟悉航线。",pilotRetryCopy:"当前任务仍可挑战。之前解锁的技能与通关记录都会保留。",pilotRankCadet:"学员",pilotRankAce:"王牌",pilotRankVanguard:"先锋",pilotRankElite:"熔炉精英",
    play:"开始游戏",pauseKey:"暂停",skinOwned:"已拥有",skinEquip:"装备",skinEquipped:"使用中",skinLocked:"累计游玩解锁",skinBuy:"购买外观",ammoOwned:"已拥有",ammoEquip:"装备弹药",ammoEquipped:"当前弹药",ammoBuy:"购买",shopBuy:"购买",moduleOwned:"已解锁",unaffordable:"还差",minute:"分钟",minutes:"分钟",nextSkin:"再存活 {time} 即可解锁下一款外观。",allSkins:"战舰外观",earnedSkins:"游戏解锁",shopSkins:"商店外观",ownedCount:"已拥有 {owned} / 40 款",noProfile:"登录后可保存外观、弹药和游戏进度。",firstSkin:"新外观已解锁：{name}",ammoLab:"弹药实验室"
  };
  function tr(en, zhText) { return language === "zh" ? zhText : en; }
  function pilotBuild() {
    if (pilotBuildCache) return pilotBuildCache;
    pilotBuildCache = readPilotBuild();
    return pilotBuildCache;
  }
  function readPilotBuild() {
    try { const saved = JSON.parse(localStorage.getItem("signal-pilot-campaign-v1") || "{}"); return { flight: Math.min(10, Number(saved.skills?.flight) || 0), arsenal: Math.min(10, Number(saved.skills?.arsenal) || 0), evasion: Math.min(10, Number(saved.skills?.evasion) || 0), nova: Math.min(10, Number(saved.skills?.nova) || 0) }; }
    catch { return { flight: 0, arsenal: 0, evasion: 0, nova: 0 }; }
  }
  function applyLocale() {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    document.querySelectorAll("[data-locale]").forEach((node) => {
      const defaultText = node.dataset.en ?? (node.firstChild?.nodeType === Node.TEXT_NODE ? node.firstChild.textContent : node.textContent);
      node.dataset.en = defaultText;
      const value = language === "zh" ? zh[node.dataset.locale] : defaultText;
      if (!value) return;
      if (node.firstChild?.nodeType === Node.TEXT_NODE) node.firstChild.textContent = value;
      else node.textContent = value;
    });
    document.querySelectorAll("[data-locale-placeholder]").forEach((node) => {
      const value = language === "zh" ? zh[node.dataset.localePlaceholder] : node.dataset.enPlaceholder;
      if (value) node.placeholder = value;
    });
    $("langToggle").textContent = language === "en" ? "EN · 中文" : "中文 · EN";
    $("langToggle").setAttribute("aria-label", language === "en" ? "Switch to Chinese" : "切换至英文");
    if (serverProfile) { renderMaps(); renderAchievements(); renderHangar(); renderShop(); syncProfile(); }
  }
  const player = { x: WIDTH / 2, y: HEIGHT / 2, vx: 1, vy: 0, radius: 12 };
  let randomSeed = dayNo % 2147483647 || 1;

  function rng() { randomSeed = randomSeed * 16807 % 2147483647; return (randomSeed - 1) / 2147483646; }
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(profile)); } catch {} }
  function readGuestProfile() {
    try {
      const saved = JSON.parse(store.get(GUEST_KEY) || "{}");
      const guest = { guest: true, callsign: profile.callsign, credits: 1000, inventory: [], playSeconds: 0, equippedSkin: "skin-01", equippedAmmo: "ammo-pulse", ...saved };
      const count = Math.min(10, 1 + Math.floor(Math.max(0, Number(guest.playSeconds) || 0) / 420));
      guest.earnedSkins = Array.from({ length: count }, (_, index) => `skin-${String(index + 1).padStart(2, "0")}`);
      guest.nextSkinAtSeconds = count < 10 ? count * 420 : null;
      guest.unlockedMaps = ["rust", ...(Number(guest.highestLevel) >= 2 ? ["neon"] : []), ...(Number(guest.highestLevel) >= 4 ? ["abyss"] : []), ...(Number(guest.highestLevel) >= 7 ? ["orbit"] : [])];
      for (const id of (window.ForgeEconomy?.ownedMapIds() || [])) if (!guest.unlockedMaps.includes(id)) guest.unlockedMaps.push(id);
      guest.achievements = guestAchievements(guest);
      store.set(GUEST_KEY, JSON.stringify(guest));
      return guest;
    } catch {
      const guest = { guest: true, callsign: profile.callsign, credits: 1000, inventory: [], playSeconds: 0, equippedSkin: "skin-01", equippedAmmo: "ammo-pulse", earnedSkins: ["skin-01"], nextSkinAtSeconds: 420, unlockedMaps: ["rust"], achievements: [] };
      store.set(GUEST_KEY, JSON.stringify(guest));
      return guest;
    }
  }
  function guestAchievements(g) {
    const n = (v) => Number(v) || 0, out = [];
    if (n(g.totalRuns) >= 1) out.push("first_run");
    if (n(g.totalBosses) >= 1) out.push("boss_breaker");
    if (n(g.highestLevel) >= 3) out.push("sector_3");
    if (n(g.highestLevel) >= 6) out.push("sector_6");
    if (n(g.lifetimeXp) >= 5000) out.push("signal_5000");
    if (n(g.totalRuns) >= 10) out.push("ten_runs");
    if (n(g.totalKills) >= 100) out.push("hundred_kills");
    return out;
  }
  function localRuns() { return Array.isArray(profile.runs) ? profile.runs : []; }
  function recordLocalRun(run) {
    const runs = [...localRuns(), { score: run.score, level: run.level, bossesDefeated: run.bossesDefeated, at: Date.now() }].sort((a, b) => b.score - a.score).slice(0, 10);
    profile.runs = runs; persist();
  }
  function drawLocalBoard() {
    const runs = localRuns();
    const rows = runs.map((run, i) => ({ callsign: `${profile.callsign}`, level: run.level, bossesDefeated: run.bossesDefeated, score: run.score, isMine: i === 0, when: run.at }));
    drawBoard(rows, "LOCAL", tr("Your ten best runs on this device.", "此设备上你的十次最佳成绩。"));
  }
  function saveGuestProfile() { if (serverProfile?.guest) store.set(GUEST_KEY, JSON.stringify(serverProfile)); }
  function cleanCallsign(value) { return (value || "PLAYER").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16).toUpperCase() || "PLAYER"; }
  function showToast(message) { const el = $("toast"); el.textContent = message; el.classList.add("on"); setTimeout(() => el.classList.remove("on"), 1700); }
  function gainScore(points) { score += Math.round(points * (serverProfile?.inventory.includes("revenant") ? 1.1 : 1) * (runMode?.mode === "hardcore" ? 2 : 1)); }
  function currentRank() { return profile.xp >= 1800 ? "FORGEMASTER" : profile.xp >= 900 ? "ACE" : profile.xp >= 350 ? "WINGMAN" : "ROOKIE"; }

  function syncProfile() {
    profile.callsign = cleanCallsign(profile.callsign);
    $("callsign").value = profile.callsign;
    $("boardName").value = profile.callsign; if ($("profileCallsign")) $("profileCallsign").value = profile.callsign;
    $("topname").textContent = profile.callsign;
    $("avatar").textContent = profile.callsign[0];
    $("xp").textContent = profile.xp.toLocaleString();
    $("best").innerHTML = `${profile.best.toLocaleString()} <em>PTS</em>`;
    const gates = profile.xp < 350 ? [0, 350, "WINGMAN"] : profile.xp < 900 ? [350, 900, "ACE"] : profile.xp < 1800 ? [900, 1800, "FORGEMASTER"] : [1800, 1800, "MAX RANK"];
    $("rankline").textContent = `${currentRank()} · ${Math.max(0, gates[1] - profile.xp)} XP TO ${gates[2]}`;
    $("rankProgress").style.width = `${gates[0] === gates[1] ? 100 : Math.min(100, (profile.xp - gates[0]) / (gates[1] - gates[0]) * 100)}%`;
    if ($("terminalLevel")) $("terminalLevel").textContent = `PILOT LV. ${String(Math.max(1, 1 + Math.floor(profile.xp / 350))).padStart(2,"0")} · ${currentRank()}`;
    if ($("terminalStat")) $("terminalStat").textContent = tr(`PROFILE: ${profile.xp.toLocaleString()} XP · ${Number(serverProfile?.credits || 0).toLocaleString()} COINS · ${Number(serverProfile?.referrals || 0)} RECRUITS`, `资料：${profile.xp.toLocaleString()} 经验 · ${Number(serverProfile?.credits || 0).toLocaleString()} 积分 · ${Number(serverProfile?.referrals || 0)} 位好友`);
    if ($("shopBalance")) $("shopBalance").textContent = Number(serverProfile?.credits || 0).toLocaleString();
    if (typeof renderLedger === "function") renderLedger();
    if ($("mapLabel")) $("mapLabel").textContent = maps.find((map) => map.id === activeMap)?.name.toUpperCase() || "RUST BELT";
  }

  function drawBoard(rows = null, stateLabel = "CONNECTING", hint = "Scores are shared across the arena.") {
    $("boardState").textContent = stateLabel;
    $("boardHint").textContent = hint;
    if (!rows?.length) {
      const empty = stateLabel === "LIVE" ? tr("No pilots have posted a run today. Be the first on the board.", "今日暂无成绩，快来创造第一条记录。") : tr("No runs yet. Finish a run and it lands here.", "暂无成绩。完成一局后会显示在这里。");
      $("board").innerHTML = `<div class="statusline">${empty}</div>`;
      if ($("fullBoard")) $("fullBoard").innerHTML = `<div class="statusline">${empty}</div>`;
      return;
    }
    const rowHtml = (row, i) => {
      const mine = row.isMine;
      return `<div class="board-row ${mine ? "me" : ""}"><span class="pos">${String(i + 1).padStart(2, "0")}</span><div class="name">${escapeText(row.callsign)}<small>${row.when ? `${new Date(row.when).toLocaleDateString(language === "zh" ? "zh-CN" : "en-GB", { day: "2-digit", month: "short" })} · ${tr("LEVEL","等级")} ${String(row.level).padStart(2, "0")} · ${row.bossesDefeated} ${tr("BOSSES","首领")}` : mine ? tr("YOUR BEST","你的最佳") : row.level == null ? tr("BEST RUN","最佳成绩") : `${tr("LEVEL","等级")} ${String(row.level).padStart(2, "0")} · ${row.bossesDefeated} ${tr("BOSSES","首领")}`}</small></div><span class="pts">${Number(row.score).toLocaleString()}</span></div>`;
    };
    $("board").innerHTML = rows.slice(0, 10).map(rowHtml).join("");
      if ($("fullBoard")) $("fullBoard").innerHTML = rows.map(rowHtml).join("") || `<div class="statusline">${tr("No results yet. Set the first score.","暂无成绩，快来创造第一条记录。")}</div>`;
  }

  function escapeText(value) { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }
  async function loadBoard() {
    if (!ONLINE) { drawLocalBoard(); return; }
    try {
      const response = await fetch("/api/leaderboard", { headers: { Accept: "application/json" } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Board unavailable");
      // /api/leaderboard: { rank, key, name, score, change, isYou }
      drawBoard((body.rows || []).map((row) => ({ callsign: row.name, score: row.score, isMine: !!row.isYou })), "LIVE", tr("Best verified run per pilot", "每位飞行员的最佳验证成绩"));
    } catch {
      drawLocalBoard();
    }
  }

  async function loadProfile() {
    try {
      if (!ONLINE) throw new Error("offline");
      const ref = new URLSearchParams(location.search).get("ref");
      let response = await fetch(`/api/profile${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`, { headers: { Accept: "application/json" } });
      let body = await response.json(); if (!response.ok) throw new Error(body.error || "Profile unavailable");
      if (Number(body.player.welcomeClaimed) === 0) {
        const crate = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "welcome" }) });
      const grant = await crate.json(); if (!crate.ok) throw new Error(grant.error || tr("Welcome credits are unavailable.", "欢迎积分暂不可用。"));
        response = await fetch(response.url, { headers: { Accept: "application/json" } });
        body = await response.json(); if (!response.ok) throw new Error(body.error || "Profile unavailable");
        if (grant.claimed) showToast(tr("Welcome drop: +1,000 coins", "新手补给：+1,000 积分"));
      }
      serverProfile = { ...body.player, inventory: body.inventory || [], earnedSkins: body.earnedSkins || ["skin-01"], nextSkinAtSeconds: body.nextSkinAtSeconds };
      serverProfile.equippedSkin ||= "skin-01";
      serverProfile.equippedAmmo ||= "ammo-pulse";
      if (!((body.unlockedMaps || ["rust"]).includes(activeMap))) activeMap="rust";
      profile.map=activeMap;
      if (serverProfile.callsign) { profile.callsign = cleanCallsign(serverProfile.callsign); persist(); }
      profile.xp = Number(serverProfile.lifetimeXp) || 0;
      profile.best = Math.max(Number(profile.best) || 0, Number(serverProfile.bestRun) || 0);
      serverProfile.unlockedMaps = body.unlockedMaps || ["rust"];
      serverProfile.achievements = body.achievements || [];
      const link = `${location.origin}${location.pathname}?ref=${serverProfile.referralCode}`;
      if ($("refLink")) $("refLink").textContent = link;
      if ($("refCount")) $("refCount").textContent = tr(`${serverProfile.referrals || 0} confirmed pilots`, `已确认 ${serverProfile.referrals || 0} 位好友`);
      if ($("shopBalance")) $("shopBalance").textContent = Number(serverProfile.credits || 0).toLocaleString();
      if ($("profileCallsign")) $("profileCallsign").value = serverProfile.callsign;
      renderShop(); renderMaps(); renderAchievements(); renderHangar(); syncProfile();
    } catch (error) {
      serverProfile = readGuestProfile();
      if ($("refLink")) $("refLink").textContent = tr("Invite links arrive with online play.", "邀请链接将随在线模式开放。");
      renderShop(); renderMaps(); renderAchievements(); renderHangar(); syncProfile();
    } finally {
      profileReady = true;
      renderShop(); renderHangar();
    }
  }

  function renderShop() {
    const grid = $("shopGrid"); if (!grid) return;
    const owned = serverProfile?.inventory || [];
    const credits = Number(serverProfile?.credits || 0);
    grid.innerHTML = catalog.map((item, index) => {
      const has = owned.includes(item.id); const affordable = credits >= item.cost;
      const art = `assets/3d/modules/module-${String(index+1).padStart(2,"0")}.webp`;
      return `<article class="portal-card store-item ${has ? "is-owned" : ""}"><div class="store-art" data-item="${item.id}" style="--item-hue:${index*31}deg"><span class="item-signal">MODULE / ${String(index+1).padStart(2,"0")}</span><img class="module-art" src="${art}" alt="" loading="lazy"><span class="item-type">${language === "zh" ? item.typeZh : item.type}</span></div><div class="store-copy"><h3>${language === "zh" ? item.nameZh : item.name}</h3><p>${language === "zh" ? item.textZh : item.text}</p></div><div class="store-buyrow"><span class="cost">${item.cost.toLocaleString()} ◈</span><button class="${has || !affordable ? "ghost-btn" : "primary-btn"}" data-buy="${item.id}" ${has || !affordable ? "disabled" : ""}>${has ? tr("OWNED", "已解锁") : affordable ? tr("BUY", "购买") : `${tr("NEED", "还差")} ${(item.cost-credits).toLocaleString()} ◈`}</button></div></article>`;
    }).join("");
    grid.querySelectorAll("[data-buy]").forEach((button) => button.addEventListener("click", () => buyItem(button.dataset.buy, button)));
    renderAmmo();
  }

  async function buyItem(itemId, button) {
    if (!profileReady && profileReadyPromise) await profileReadyPromise;
    if (!button.isConnected) return;
    button.disabled = true;
    try {
      if (serverProfile?.guest) {
        const moduleItem = catalog.find((entry) => entry.id === itemId);
        const skin = skinRows.find((entry) => entry.id === itemId && entry.index > 10);
        const ammo = ammoTypes.find((entry) => entry.id === itemId && !entry.owned);
        const cost = moduleItem?.cost ?? (skin ? 420 + (skin.index - 11) * 85 : ammo?.cost);
        if (!Number.isFinite(cost) || serverProfile.inventory.includes(itemId) || serverProfile.credits < cost) throw new Error(tr("Not enough coins for this item.", "金币不足，无法购买此物品。"));
        serverProfile.credits -= cost;
        serverProfile.inventory.push(itemId);
        saveGuestProfile(); renderShop(); renderHangar(); syncProfile();
        showToast(tr("Purchase saved on this device.", "购买已保存在此设备。"));
        return;
      }
      const response = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "buy", item: itemId }) });
      const body = await response.json();
      if (!response.ok) throw new Error(response.status === 402 ? tr("Not enough coins for this item.", "金币不足，无法购买此物品。") : response.status === 401 ? tr("Sign in to purchase items.", "登录后即可购买物品。") : body.error);
      const item = catalog.find((entry)=>entry.id===itemId) || skinRows.find((entry)=>entry.id===itemId) || ammoTypes.find((entry)=>entry.id===itemId);
      showToast(tr(`Added to your collection: ${item?.name || "item"}`, `已加入收藏：${item?.nameZh || item?.name || "物品"}`));
      await loadProfile();
    } catch(error) { showToast(error.message || tr("Purchase failed.", "购买失败。")); button.disabled = false; }
  }

  function renderAmmo() {
    const grid = $("ammoGrid"); if (!grid) return;
    const owned = serverProfile?.inventory || [], credits = Number(serverProfile?.credits || 0), equipped = serverProfile?.equippedAmmo || "ammo-pulse";
    grid.innerHTML = ammoTypes.map((ammo) => {
      const has = ammo.owned || owned.includes(ammo.id), active = equipped === ammo.id, name = language === "zh" ? ammo.nameZh : ammo.name;
      const action = active ? `<button class="ghost-btn" disabled>${tr("EQUIPPED", "使用中")}</button>` : has ? `<button class="primary-btn" data-equip-ammo="${ammo.id}">${tr("EQUIP", "装备")}</button>` : `<button class="ghost-btn" data-buy="${ammo.id}" ${credits < ammo.cost ? "disabled" : ""}>${credits < ammo.cost ? `${tr("NEED", "还差")} ${(ammo.cost-credits).toLocaleString()} ◈` : `${tr("BUY", "购买")} · ${ammo.cost.toLocaleString()} ◈`}</button>`;
      return `<article class="portal-card ammo-card"><div class="ammo-showcase" style="--ammo:${ammo.color}"><span class="ammo-shape ${ammo.shape}"></span><i></i></div><div class="ammo-card-title"><div><span class="tag">${tr("PROJECTILE STYLE", "弹药样式")}</span><h3>${name}</h3></div><span class="ammo-cost">${has ? tr("OWNED", "已拥有") : `${ammo.cost.toLocaleString()} ◈`}</span></div>${action}</article>`;
    }).join("");
    grid.querySelectorAll("[data-equip-ammo]").forEach((button)=>button.addEventListener("click", async()=>{
      try { if(serverProfile?.guest){serverProfile.equippedAmmo=button.dataset.equipAmmo;saveGuestProfile();renderAmmo();showToast(tr("Projectile style equipped.","弹药样式已装备。"));return;}const response=await fetch("/api/profile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"equip-ammo",ammoId:button.dataset.equipAmmo})});if(!response.ok)throw new Error();showToast(tr("Projectile style equipped.","弹药样式已装备。"));await loadProfile(); }
      catch { showToast(tr("Could not equip this projectile style.","无法装备此弹药样式。")); }
    }));
    grid.querySelectorAll("[data-buy]").forEach((button)=>button.addEventListener("click",()=>buyItem(button.dataset.buy,button)));
  }

  function drawSkinBadge(canvas, skin) {
    const c=canvas.getContext("2d"),w=canvas.width,h=canvas.height,color=skin.color;
    c.clearRect(0,0,w,h);c.save();c.translate(w/2,h/2);c.scale(1.55,1.55);
    const glow=c.createRadialGradient(0,0,2,0,0,44);glow.addColorStop(0,`${color}50`);glow.addColorStop(1,`${color}00`);c.fillStyle=glow;c.fillRect(-48,-48,96,96);
    c.strokeStyle=`${color}99`;c.lineWidth=1;c.beginPath();c.ellipse(0,1,27,11,-.45,0,Math.PI*2);c.stroke();
    c.rotate(-Math.PI/2);c.shadowColor=color;c.shadowBlur=16;
    const form=skin.form; c.beginPath();
    if(["wing","finch","mantis","saw","fracture","cathedral","monarch","howl","breaker"].includes(form)){
      c.moveTo(0,-24);c.lineTo(5,-8);c.lineTo(24,-17);c.lineTo(14,-2);c.lineTo(23,6);c.lineTo(7,6);c.lineTo(0,19);c.lineTo(-7,6);c.lineTo(-23,6);c.lineTo(-14,-2);c.lineTo(-24,-17);c.lineTo(-5,-8);
    }else if(["comet","afterburn","dancer","drifter","wildfire","lastlight","current","hour"].includes(form)){
      c.moveTo(0,-25);c.lineTo(8,-7);c.lineTo(7,5);c.lineTo(3,11);c.lineTo(0,8);c.lineTo(-3,11);c.lineTo(-7,5);c.lineTo(-8,-7);
    }else if(["singularity","oracle","mirage","crown","eater","archive","prime","obsidian"].includes(form)){
      c.moveTo(0,-22);c.lineTo(15,-10);c.lineTo(19,3);c.lineTo(11,18);c.lineTo(0,13);c.lineTo(-11,18);c.lineTo(-19,3);c.lineTo(-15,-10);
    }else if(["bloom","orchard","aurora","koi","herald","engine"].includes(form)){
      for(let i=0;i<12;i++){const a=i*Math.PI/6,r=i%2?13:23;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?c.lineTo(x,y):c.moveTo(x,y)}
    }else{
      c.moveTo(0,-23);c.lineTo(12,-7);c.lineTo(10,9);c.lineTo(0,19);c.lineTo(-10,9);c.lineTo(-12,-7);
    }
    c.closePath();const metal=c.createLinearGradient(-19,-18,18,18);metal.addColorStop(0,"#ffffff");metal.addColorStop(.24,color);metal.addColorStop(.72,color);metal.addColorStop(1,"#273143");c.fillStyle=metal;c.strokeStyle="#f8ffff";c.lineWidth=1.25;c.fill();c.stroke();
    c.shadowBlur=0;c.fillStyle="#122033";c.beginPath();c.moveTo(0,-15);c.lineTo(5,-2);c.lineTo(0,7);c.lineTo(-5,-2);c.closePath();c.fill();c.fillStyle="#efffff";c.shadowColor="#fff";c.shadowBlur=9;c.beginPath();c.ellipse(0,-5,2.5,5,0,0,Math.PI*2);c.fill();c.shadowBlur=0;
    c.fillStyle="#fff";for(let i=0;i<3;i++){c.fillRect(-11+i*11,3,3,1.5)}
    if(skin.index%3===0){c.rotate(Math.PI/2);c.strokeStyle=`${color}ee`;c.lineWidth=2;c.beginPath();c.ellipse(0,0,28,8,.35,0,Math.PI*2);c.stroke()}
    c.restore();
  }

  async function equipSkin(skinId) {
    try { if(serverProfile?.guest){if(!serverProfile.earnedSkins.includes(skinId)&&!serverProfile.inventory.includes(skinId))throw new Error();serverProfile.equippedSkin=skinId;saveGuestProfile();renderHangar();showToast(tr("Ship skin equipped.","战舰外观已装备。"));return;}const response=await fetch("/api/profile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"equip-skin",skinId})});const body=await response.json();if(!response.ok)throw new Error(body.error);showToast(tr("Ship skin equipped.","战舰外观已装备。"));await loadProfile(); }
    catch { showToast(tr("That ship skin is still locked.","该战舰外观尚未解锁。")); }
  }

  function renderHangar() {
    const grid=$("skinGrid");if(!grid)return;
    const earned=serverProfile?.earnedSkins||["skin-01"],owned=serverProfile?.inventory||[],credits=Number(serverProfile?.credits||0),equipped=serverProfile?.equippedSkin||"skin-01";
    const total=skinRows.filter((skin)=>earned.includes(skin.id)||owned.includes(skin.id)).length;
    $("skinCount").textContent=language==="zh"?`${total} / 40 已拥有`:`${total} / 40 OWNED`;
    const seconds=Number(serverProfile?.playSeconds)||0,nextAt=serverProfile?.nextSkinAtSeconds;
    $("playtimeTotal").textContent=language==="zh"?`${Math.floor(seconds/60)} 分钟战场时间`:`${Math.floor(seconds/60)} MINUTES IN THE ARENA`;
    $("nextSkinHint").textContent=nextAt?tr(`Next free skin at ${Math.floor(nextAt/60)} min · ${Math.max(0,nextAt-seconds)} sec to go.`,`累计游玩至 ${Math.floor(nextAt/60)} 分钟解锁下款外观 · 还需 ${Math.max(0,nextAt-seconds)} 秒。`):tr("All 10 playtime skins unlocked. Explore the shop for 30 more.","通过游戏获得的 10 款外观已全部解锁。商店中还有 30 款。");
    $("skinProgressLabel").textContent=nextAt?(language==="zh"?`${seconds%420} / 420 秒`:`${seconds%420} / 420 SEC`):tr("10 / 10 UNLOCKED","10 / 10 已解锁");
    $("skinProgressBar").style.width=nextAt?`${(seconds%420)/420*100}%`:"100%";
    const selected=skinRows.find((skin)=>skin.id===equipped)||skinRows[0];$("equippedSkinName").textContent=(language==="zh"?selected.nameZh:selected.name).toUpperCase();
    grid.innerHTML=skinRows.map((skin)=>{
      const timeUnlocked=earned.includes(skin.id),shopOwned=owned.includes(skin.id),has=timeUnlocked||shopOwned,active=equipped===skin.id,isShop=skin.index>10,price=420+(skin.index-11)*85,name=language==="zh"?skin.nameZh:skin.name;
      const label=active?tr("EQUIPPED","使用中"):has?tr("EQUIP","装备"):isShop?(credits>=price?`${tr("BUY SKIN","购买外观")} · ${price.toLocaleString()} ◈`:`${tr("NEED","还差")} ${(price-credits).toLocaleString()} ◈`):tr(`Unlock at ${(skin.index-1)*7} min`,`${(skin.index-1)*7} 分钟解锁`);
      const action=active?`<button class="ghost-btn" disabled>${label}</button>`:has?`<button class="primary-btn" data-equip-skin="${skin.id}">${label}</button>`:isShop?`<button class="ghost-btn" data-buy="${skin.id}" ${credits<price?"disabled":""}>${label}</button>`:`<button class="ghost-btn" disabled>${label}</button>`;
      return `<article class="portal-card skin-card ${has?"owned":"locked"} ${active?"equipped":""}" style="--skin-color:${skin.color}"><div class="skin-card-top"><span>FRAME ${String(skin.index).padStart(2,"0")}</span><span class="skin-rarity">${isShop?tr("SHOP","商店"):timeUnlocked?tr("PLAY REWARD","游玩奖励"):tr("TIME REWARD","时长奖励")}</span></div><div class="skin-preview" style="--skin-color:${skin.color}"><img data-skin-preview="${skin.id}" src="assets/3d/ships/ship-${String(skin.index).padStart(2,"0")}.webp" alt="${name}" loading="lazy"></div><h3>${name}</h3><small class="skin-code">${skin.form.toUpperCase()} · ${isShop?`${price.toLocaleString()} ${tr("COINS","金币")}`:timeUnlocked?tr("PLAY REWARD","游玩奖励"):`${(skin.index-1)*7} ${tr("MIN SURVIVED","分钟生存")}`}</small>${action}</article>`;
    }).join("");
    grid.querySelectorAll("[data-equip-skin]").forEach((button)=>button.addEventListener("click",()=>equipSkin(button.dataset.equipSkin)));
    grid.querySelectorAll("[data-buy]").forEach((button)=>button.addEventListener("click",()=>buyItem(button.dataset.buy,button)));
  }

  function renderMaps() {
    const grid = $("mapGrid"); if (!grid) return;
    const unlocked = serverProfile?.unlockedMaps || ["rust"];
    $("mapProgress").textContent = language==="zh"?`${unlocked.length} / ${maps.length} 已解锁`:`${unlocked.length} / ${maps.length} UNLOCKED`;
    grid.innerHTML = maps.map((map) => {
      const open = unlocked.includes(map.id), selected = activeMap === map.id;
      const title=language==="zh"?map.localZh:map.local, biome=language==="zh"?map.biomeZh:map.biome, copy=language==="zh"?map.copyZh:map.copy;
      return `<article class="portal-card map-card ${open?"":"locked"} ${selected?"selected":""}" data-map="${map.id}" data-open="${open}"><div class="map-art" data-biome="${map.id}"><img src="assets/3d/maps/${map.id}.webp" alt="" loading="lazy"><span class="map-sector">${biome}</span><span class="map-state">${selected?tr("ACTIVE SECTOR","当前区域"):open?tr("ENTER SECTOR","进入区域"):tr(`LEVEL ${map.min}`,`等级 ${map.min}`)}</span><span class="map-locked">◈ ${tr(`UNLOCKS AT LEVEL ${map.min}`,`达到等级 ${map.min} 解锁`)}</span></div><div class="map-caption"><span class="tag">${open?tr("SECTOR OPEN","区域已开放"):tr(`LOCKED · LEVEL ${map.min}`,`未解锁 · 等级 ${map.min}`)}</span><h3>${title}<small>${selected?tr(" · ACTIVE"," · 使用中"):""}</small></h3><p>${copy}</p></div></article>`;
    }).join("");
    grid.querySelectorAll("[data-map]").forEach((card) => card.addEventListener("click", () => {
      if (card.dataset.open !== "true") { showToast(tr("Reach the required level to unlock this sector.","达到指定等级即可解锁该区域。")); return; }
      activeMap = card.dataset.map; profile.map = activeMap; persist(); renderMaps(); syncProfile(); const map=maps.find((entry)=>entry.id===activeMap);showToast(`${tr("Sector selected:","已选择区域：")} ${language==="zh"?map?.localZh:map?.local}`);
    }));
  }

  function renderAchievements() {
    const grid = $("achievementGrid"); if (!grid) return;
    const earned = serverProfile?.achievements || [];
    $("achievementProgress").textContent = language==="zh"?`${earned.length} / ${achievements.length} 已获得`:`${earned.length} / ${achievements.length} EARNED`;
    grid.innerHTML = achievements.map((achievement) => `<article class="portal-card achievement-card ${earned.includes(achievement.id)?"unlocked":""}"><div class="achievement-medal">${achievement.icon}</div><h3>${language==="zh"?achievement.nameZh:achievement.name}</h3><p>${language==="zh"?achievement.ruleZh:achievement.rule}</p><small>${earned.includes(achievement.id)?tr("UNLOCKED","已解锁"):tr("IN PROGRESS","进行中")}</small></article>`).join("");
  }

  async function raidAction(action, payload = {}) {
    if (!ONLINE) throw new Error(tr("Squad raids arrive with online play.", "小队突袭将随在线模式开放。"));
    const response = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
    const body = await response.json(); if (!response.ok) throw new Error(body.error || "Raid request failed"); return body;
  }
  async function refreshRaid() {
    if (!raidCode || !ONLINE) return;
    try {
      const response = await fetch(`/api/raid?code=${encodeURIComponent(raidCode)}`); const body = await response.json(); if (!response.ok) throw new Error(body.error);
      const room = body.room; $("raidPanel").hidden = false; $("raidBoss").textContent = room.boss; $("raidFill").style.width = `${Math.max(0, Number(room.hp)/Number(room.maxHp)*100)}%`;
      $("raidHp").textContent = `${Number(room.hp).toLocaleString()} / ${Number(room.maxHp).toLocaleString()} HP · ${room.status === "won" ? tr("BOSS DOWN · REWARD PAID","首领已击败 · 奖励已发放") : tr("STRIKE TOGETHER","协力攻击")}`;
      $("raidMembers").innerHTML = (body.members || []).map((member) => `<div class="board-row"><span class="pos">✦</span><div class="name">${escapeText(member.callsign)}</div><span class="pts">${Number(member.damage).toLocaleString()} DMG</span></div>`).join("");
      $("raidTeam").textContent = `${body.members.length}/4 PILOTS`;
      $("raidStatus").textContent = `${tr("ROOM","房间")} ${raidCode} · ${room.status === "won" ? tr("VICTORY","胜利") : tr("RAID ACTIVE","突袭进行中")}`;
      $("raidAttack").disabled = room.status !== "open" || body.members.length < 2;
      if (body.members.length < 2 && room.status === "open") $("raidStatus").textContent = tr("Waiting for a second pilot. Attacks unlock when they join.","等待第二位飞行员加入。加入后即可开始攻击。");
    } catch(error) { $("raidStatus").textContent = error.message; }
  }

  async function postRun() {
    const run = { callsign: profile.callsign, score, duration: Math.floor(elapsed), level, bossesDefeated, kills };
    recordLocalRun(run);
    if (serverProfile?.guest) {
      const oldCount = serverProfile.earnedSkins.length;
      serverProfile.playSeconds += run.duration;
      serverProfile.credits += Math.min(500, Math.floor(score / 350));
      serverProfile.lifetimeXp = (Number(serverProfile.lifetimeXp) || 0) + score;
      serverProfile.totalRuns = (Number(serverProfile.totalRuns) || 0) + 1;
      serverProfile.totalBosses = (Number(serverProfile.totalBosses) || 0) + bossesDefeated;
      serverProfile.totalKills = (Number(serverProfile.totalKills) || 0) + kills;
      serverProfile.highestLevel = Math.max(Number(serverProfile.highestLevel) || 1, level);
      const count = Math.min(10, 1 + Math.floor(serverProfile.playSeconds / 420));
      serverProfile.earnedSkins = Array.from({ length: count }, (_, index) => `skin-${String(index + 1).padStart(2, "0")}`);
      serverProfile.nextSkinAtSeconds = count < 10 ? count * 420 : null;
      serverProfile.unlockedMaps = ["rust", ...(serverProfile.highestLevel >= 2 ? ["neon"] : []), ...(serverProfile.highestLevel >= 4 ? ["abyss"] : []), ...(serverProfile.highestLevel >= 7 ? ["orbit"] : [])]; for (const id of (window.ForgeEconomy?.ownedMapIds() || [])) if (!serverProfile.unlockedMaps.includes(id)) serverProfile.unlockedMaps.push(id);
      const before = new Set(serverProfile.achievements || []);
      serverProfile.achievements = guestAchievements(serverProfile);
      const fresh = serverProfile.achievements.filter((id) => !before.has(id));
      saveGuestProfile(); renderHangar(); renderShop(); renderMaps(); renderAchievements(); syncProfile(); drawLocalBoard();
      if (fresh.length) { const a = achievements.find((entry) => entry.id === fresh[0]); if (a) setTimeout(() => showToast(tr(`Achievement: ${a.name}`, `获得成就：${a.nameZh}`)), 1800); }
      if (count > oldCount) { const skin = skinRows[count - 1]; showToast(tr(`New ship skin unlocked: ${skin.name}`, `解锁新战舰外观：${skin.nameZh}`)); }
      $("modalCopy").textContent += tr(` +${Math.min(500, Math.floor(score / 350))} coins. Progress saved on this device.`, ` +${Math.min(500, Math.floor(score / 350))} 金币。进度已保存在此设备。`);
      return;
    }
    try {
      const response = await fetch("/api/score", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(run) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Score could not be posted");
      await loadBoard();
      $("modalCopy").textContent += tr(` Your result is on the live daily board. +${body.creditsEarned || 0} credits.`, ` 成绩已提交至每日排行榜。+${body.creditsEarned || 0} 积分。`);
      if (body.newlyEarnedSkin) { const skin=skinRows.find((entry)=>entry.id===body.newlyEarnedSkin); if(skin) showToast(tr(`New ship skin unlocked: ${skin.name}`,`解锁新战舰外观：${skin.nameZh}`)); }
      await loadProfile();
    } catch (error) {
      $("modalCopy").textContent += tr(` ${error instanceof Error ? error.message : "The live board is unavailable."} Your local record is safe.`, ` ${error instanceof Error ? error.message : "排行榜暂不可用。"} 本地记录仍然安全。`);
      $("boardState").textContent = "OFFLINE";
      $("boardHint").textContent = "Could not submit this run to the shared board.";
    }
  }

  function createRigOptions() {
    $("rigOptions").innerHTML = rigs.map((rig) => `<button type="button" class="option ${rig.id === selectedRig.id ? "sel" : ""}" data-rig="${rig.id}"><b>${rig.name}</b><small>${language === "zh" ? rig.effectZh : rig.effect}</small></button>`).join("");
    document.querySelectorAll("[data-rig]").forEach((button) => button.addEventListener("click", () => {
      selectedRig = rigs.find((rig) => rig.id === button.dataset.rig) || rigs[0];
      createRigOptions();
    }));
  }

  function resizeCanvas() {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = WIDTH * ratio; canvas.height = HEIGHT * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function drawCover(image, offsetX = 0, offsetY = 0, zoom = 1) {
    // Map art is 2:1 while the arena is 960×552; draw it "cover" style instead of stretching.
    const scale = Math.max(WIDTH / image.naturalWidth, HEIGHT / image.naturalHeight) * zoom;
    const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
    ctx.drawImage(image, (WIDTH - w) / 2 + offsetX, (HEIGHT - h) / 2 + offsetY, w, h);
  }

  function drawBackground() {
    const map = maps.find((entry) => entry.id === activeMap) || maps[0];
    ctx.fillStyle = "#05060a"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const scene = mapArt.get(map.id);
    const driftX = Math.sin(elapsed * .09) * 6 - (player.x - WIDTH / 2) * .012, driftY = Math.cos(elapsed * .08) * 4 - (player.y - HEIGHT / 2) * .012;
    if (scene?.complete && scene.naturalWidth) drawCover(scene, driftX, driftY, 1.04);
    else if (worldArt.complete && worldArt.naturalWidth) drawCover(worldArt, driftX, driftY, 1.04);
    // Calm the painted scene so ships, enemies and shots always read first.
    ctx.fillStyle = "rgba(5,7,14,.28)"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const accent = map.palette[2];
    ctx.save(); ctx.globalAlpha = activeMap === "rust" ? .06 : .12; ctx.fillStyle = map.palette[0]; ctx.fillRect(0, 0, WIDTH, HEIGHT); ctx.restore();
    // Parallax star dust.
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 46; i++) {
      const depth = .4 + (i % 5) * .25;
      const x = ((i * 173 + Math.sin(elapsed * .035 + i) * 7 - player.x * .02 * depth) % WIDTH + WIDTH) % WIDTH;
      const y = ((i * 97 + elapsed * (6 + i % 4 * 4) * depth - player.y * .02 * depth) % HEIGHT + HEIGHT) % HEIGHT;
      ctx.globalAlpha = .12 + (i % 4) * .06 + Math.sin(elapsed * .6 + i) * .04; ctx.fillStyle = i % 7 === 0 ? accent : "#e8f1ff";
      ctx.beginPath(); ctx.arc(x, y, i % 9 === 0 ? 1.4 : .8 * depth, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // Soft orbital guide rings.
    ctx.save(); ctx.translate(WIDTH / 2, HEIGHT / 2); ctx.rotate(elapsed * (activeMap === "orbit" ? -.006 : .003));
    ctx.strokeStyle = `${accent}26`; ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, 0, 178 + i * 38, 78 + i * 22, -.12, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
    // Slow light sweep.
    const ribbonY = HEIGHT * (.22 + (Math.sin(elapsed * .12) + 1) * .08);
    const ribbon = ctx.createLinearGradient(0, ribbonY, WIDTH, ribbonY + 45);
    ribbon.addColorStop(0, `${accent}00`); ribbon.addColorStop(.45, `${accent}14`); ribbon.addColorStop(1, `${accent}00`);
    ctx.fillStyle = ribbon; ctx.fillRect(0, ribbonY, WIDTH, 46);
    if (mapHazardFlash !== 0 && activeMap !== "rust") {
      const warningColor = activeMap === "neon" ? "#ff62d2" : activeMap === "abyss" ? "#4cddff" : "#ffb86d";
      const hy = activeMap === "abyss" ? HEIGHT / 2 : HEIGHT / 2 + (activeMap === "orbit" ? 120 : 0); const hx = activeMap === "abyss" ? (elapsed % 16 < 8 ? 170 : WIDTH - 170) : WIDTH / 2;
      const radius = activeMap === "abyss" ? 82 : activeMap === "orbit" ? 122 : 180, live = mapHazardFlash < 0;
      ctx.save();
      if (activeMap === "abyss") { ctx.fillStyle = `${warningColor}${live ? "38" : "16"}`; ctx.beginPath(); ctx.arc(hx, hy, radius, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.strokeStyle = `${warningColor}${live ? "40" : "18"}`; ctx.lineWidth = 64; ctx.beginPath(); ctx.arc(hx, hy, radius, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = live ? .9 : .45 + Math.sin(elapsed * 18) * .25; ctx.strokeStyle = warningColor; ctx.lineWidth = live ? 3 : 2; ctx.setLineDash(live ? [] : [10, 8]); ctx.lineDashOffset = -elapsed * 40;
      ctx.beginPath(); ctx.arc(hx, hy, radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    }
  }

  function polygon(x, y, radius, sides, rotation = 0) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) { const angle = rotation + i * Math.PI * 2 / sides; const px = x + Math.cos(angle) * radius; const py = y + Math.sin(angle) * radius; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.closePath();
  }

  const snap = { player, enemies: [], bosses: [], bullets: [], hostileShots: [], drops: [] };
  function hazardInfo() {
    if (activeMap === "rust") return null;
    const hx = activeMap === "abyss" ? (elapsed % 16 < 8 ? 170 : WIDTH - 170) : WIDTH / 2;
    const hy = activeMap === "abyss" ? HEIGHT / 2 : (activeMap === "orbit" ? HEIGHT / 2 + 120 : HEIGHT / 2);
    return { type: activeMap === "abyss" ? "disc" : "ring", x: hx, y: hy, r: activeMap === "abyss" ? 82 : activeMap === "orbit" ? 122 : 180, w: 64, warn: mapHazardFlash > 0 ? mapHazardFlash : 0, live: mapHazardFlash < 0 };
  }
  function snapshot() {
    snap.state = state; snap.elapsed = elapsed; snap.level = level; snap.enemies = enemies; snap.bosses = bosses; snap.bullets = bullets; snap.hostileShots = hostileShots; snap.drops = drops;
    snap.invulnerable = invulnerable; snap.shieldUp = shieldUp; snap.dash = pilotDashTimer; snap.rapid = rapidTimer; snap.splitLevel = splitLevel;
    snap.droneCount = droneLevel + (serverProfile?.inventory?.includes("drone") ? 1 : 0); snap.skin = currentSkin(); snap.activeMap = activeMap;
    const eco = window.ForgeEconomy, ps = eco && eco.equipped("skins"); if (ps && ps.hull) { snap.skin = { ...snap.skin, index: ps.hull }; snap.finish = ps.finish; } else snap.finish = null; snap.weaponFx = eco ? eco.equipped("fx") : null;
    snap.hazard = state === "playing" || state === "paused" ? hazardInfo() : null; snap.health = health; snap.maxHealth = maxHealth;
    return snap;
  }
  function draw() {
    if (use3D) {
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      window.Forge3D.render(snapshot());
      drawFloaters(); drawOverlayFx();
      return;
    }
    drawBackground();
    for (const drop of drops) {
      if (drop.life < 2.5 && Math.floor(drop.life * 8) % 2) continue; // blink before expiring
      if (drop.power) {
        const col = drop.power === "rapid" ? "#f3e3b3" : drop.power === "shield" ? "#7fe0c5" : "#ff9ab8", bob = Math.sin(elapsed * 5 + drop.offset) * 3;
        glow(drop.x, drop.y, 34, col, .7);
        ctx.save(); ctx.translate(drop.x, drop.y + bob); ctx.rotate(Math.sin(elapsed * 3 + drop.offset) * .2);
        const coin = ctx.createRadialGradient(-5, -6, 1, 0, 0, 16); coin.addColorStop(0, "#fff6d8"); coin.addColorStop(.45, GOLD); coin.addColorStop(1, "#6d5020");
        ctx.fillStyle = coin; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#1a1408"; ctx.font = "600 16px " + DISPLAY_FONT; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(drop.power === "rapid" ? "R" : drop.power === "shield" ? "S" : "M", 0, 1);
        ctx.restore(); continue;
      }
      const pulse = 1 + Math.sin(elapsed * 4 + drop.offset) * .12, color = drop.cache ? "#d8b468" : "#f3e3b3";
      glow(drop.x, drop.y, drop.cache ? 34 : 22, color, .9);
      ctx.save(); ctx.translate(drop.x, drop.y); ctx.rotate(Math.PI / 4 + elapsed * (drop.cache ? 1.2 : .6));
      ctx.fillStyle = drop.cache ? "#d8b468" : "#f3e3b3"; ctx.strokeStyle = "rgba(5,7,14,.7)"; ctx.lineWidth = 1.5; const s = (drop.cache ? 8 : 6) * pulse;
      ctx.fillRect(-s, -s, s * 2, s * 2); ctx.strokeRect(-s, -s, s * 2, s * 2); ctx.fillStyle = "#fff"; ctx.globalAlpha = .8; ctx.fillRect(-s * .4, -s * .4, s * .8, s * .8); ctx.restore();
    }
    for (const bullet of bullets) drawProjectile(bullet);
    for (const shot of hostileShots) {
      const sr = shot.radius || 5; glow(shot.x, shot.y, sr * 3.2, "#ff6a5a", .65);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(shot.x, shot.y, sr + 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ff6a5a"; ctx.beginPath(); ctx.arc(shot.x, shot.y, sr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(shot.x - sr * .3, shot.y - sr * .3, sr * .35, 0, Math.PI * 2); ctx.fill();
    }
    for (const mob of enemies) drawEnemy(mob);
    for (const boss of bosses) drawBoss(boss);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const p of sparks) { const a = Math.max(0, p.life / p.max); ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (.5 + a * .5), 0, Math.PI * 2); ctx.fill(); }
    for (const ring of rings) { const t = 1 - ring.life / ring.max; ctx.globalAlpha = (1 - t) * .9; ctx.strokeStyle = ring.color; ctx.lineWidth = ring.width * (1 - t) + .5; ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.radius * (.2 + t * .8), 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore(); ctx.globalAlpha = 1;
    if (pulseTimer > 0) {
      const radius = selectedRig.pulse * (owns("nova") ? 1.25 : 1) * (1 + pilotBuild().nova * .1) * (1 - pulseTimer / .55);
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(player.x, player.y, radius * .6, player.x, player.y, radius);
      g.addColorStop(0, "rgba(216,180,104,0)"); g.addColorStop(.85, `rgba(216,180,104,${Math.min(.35, pulseTimer)})`); g.addColorStop(1, "rgba(243,227,179,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(player.x, player.y, radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(243,227,179,${Math.min(1, pulseTimer * 2)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(player.x, player.y, radius, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (state !== "menu" && state !== "over") drawPlayer();
    drawFloaters();
    drawOverlayFx();
  }

  function drawFloaters() {
    if (!floaters.length) return;
    ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const f of floaters) {
      const t = 1 - f.life / f.max, rise = easeOut(Math.min(1, t * 1.6));
      ctx.globalAlpha = Math.min(1, f.life / f.max * 2.2);
      const p = use3D ? window.Forge3D.project(f.x, f.y, 24) : f;
      const big = f.size >= 18;
      ctx.font = `${big ? 700 : 500} ${Math.round(f.size * (big ? 1 : .92))}px ${big ? UI_FONT : MONO_FONT}`;
      if ("letterSpacing" in ctx) ctx.letterSpacing = big ? "-0.5px" : "0.5px";
      ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = 8;
      ctx.fillStyle = monoTint(f.color); ctx.fillText(f.text, p.x, p.y - rise * 10);
      ctx.shadowBlur = 0;
    }
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    ctx.restore();
  }

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  // Floaters arrive in legacy colours from all over the code; map them onto the restrained palette.
  function monoTint(c) { const k = String(c).toLowerCase(); if (k.includes("ff6a5a") || k.includes("ff375f") || k.includes("ff4a2e")) return "#ff6b52"; if (k.includes("7fe0c5") || k.includes("9ff2c4")) return "#9ff2c4"; if (k === "#ffffff" || k === "#fff") return "#ffffff"; return "#e8ecf2"; }
  function gauge(x, y, label, frac, ready, accentCol) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = ready ? accentCol : "rgba(255,255,255,.55)"; ctx.lineWidth = 2; ctx.lineCap = "butt";
    ctx.beginPath(); ctx.arc(x, y, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, frac)); ctx.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 19, y + Math.sin(a) * 19); ctx.lineTo(x + Math.cos(a) * 21, y + Math.sin(a) * 21); ctx.stroke(); }
    if (ready) { ctx.fillStyle = accentCol; ctx.globalAlpha = .18 + .12 * Math.sin(elapsed * 6); ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.fillStyle = "#ffffff"; ctx.font = "600 10px " + MONO_FONT; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label[0], x, y + .5);
    ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.font = "500 8.5px " + MONO_FONT; if ("letterSpacing" in ctx) ctx.letterSpacing = "1.5px"; ctx.fillText(label[1], x, y + 30); if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    ctx.restore();
  }
  function drawOverlayFx() {
    if (!use3D) {
      const v = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * .42, WIDTH / 2, HEIGHT / 2, WIDTH * .62);
      v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.5)"); ctx.fillStyle = v; ctx.fillRect(0, 0, WIDTH, HEIGHT);
      if (damageFlash > 0) { const d = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * .3, WIDTH / 2, HEIGHT / 2, WIDTH * .6); d.addColorStop(0, "rgba(255,55,95,0)"); d.addColorStop(1, `rgba(255,55,95,${damageFlash * 1.4})`); ctx.fillStyle = d; ctx.fillRect(0, 0, WIDTH, HEIGHT); }
    }
    if (state === "playing" || state === "paused" || state === "upgrade") {
      const y = HEIGHT - 40;
      const dashFrac = pilotDashCooldown > 0 ? 1 - pilotDashCooldown / Math.max(3.1, 6.2 - pilotBuild().evasion * .3) : 1;
      gauge(34, y, ["B", tr("BLAST", "爆破")], energy / 100, energy >= 100, "#ffffff");
      gauge(88, y, ["⇧", tr("DASH", "冲刺")], dashFrac, dashFrac >= 1, "#9ff2c4");
      // power-up chips
      const chips = [];
      if (rapidTimer > 0) chips.push(["#ffffff", tr("RAPID", "连射"), rapidTimer / 6]);
      if (magnetTimer > 0) chips.push(["#ffb4c8", tr("MAGNET", "磁吸"), magnetTimer / 6]);
      if (shieldUp) chips.push(["#9ff2c4", tr("SHIELD", "护盾"), 1]);
      ctx.save(); ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.font = "500 9.5px " + MONO_FONT; if ("letterSpacing" in ctx) ctx.letterSpacing = "1.5px";
      let cx = 130; chips.forEach(([col, text, frac]) => { const w = ctx.measureText(text).width + 30; ctx.fillStyle = "rgba(6,6,7,.62)"; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx, y - 12, w, 24, 12) : ctx.rect(cx, y - 12, w, 24); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.14)"; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx + 12, y, 3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#ffffff"; ctx.fillText(text, cx + 21, y + .5); ctx.fillStyle = col; ctx.fillRect(cx + 12, y + 8, (w - 24) * Math.min(1, frac), 1); cx += w + 8; });
      ctx.restore();
      if (combo >= 5) {
        const mult = comboMult(), hot = mult > 1, a = Math.min(1, comboClock * 2);
        ctx.save(); ctx.globalAlpha = a; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
        ctx.font = "800 44px " + DISPLAY_FONT; if ("letterSpacing" in ctx) ctx.letterSpacing = "-2px"; ctx.fillStyle = "#ffffff"; ctx.fillText(String(combo), WIDTH - 24, HEIGHT - 30);
        if ("letterSpacing" in ctx) ctx.letterSpacing = "1.5px"; ctx.font = "500 9.5px " + MONO_FONT; ctx.fillStyle = hot ? "#9ff2c4" : "rgba(255,255,255,.5)";
        ctx.fillText(hot ? tr(`STREAK · SCORE ×${mult}`, `连击 · 得分 ×${mult}`) : tr("STREAK · 10 FOR ×1.5", "连击 · 10 次得倍率"), WIDTH - 24, HEIGHT - 14);
        ctx.restore();
      }
    }
    if (banner && banner.life > 0) {
      // Title card: kicker in mono, title revealed upward through a mask, a rule that draws itself.
      const t = 1 - banner.life / banner.max, inT = easeOut(Math.min(1, t / .22)), outT = banner.life < .45 ? banner.life / .45 : 1;
      const y = HEIGHT * (banner.boss ? .46 : .4);
      ctx.save(); ctx.globalAlpha = outT; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.font = "500 10px " + MONO_FONT; if ("letterSpacing" in ctx) ctx.letterSpacing = "3px"; ctx.fillStyle = banner.boss ? "#ff7a62" : "rgba(255,255,255,.7)"; ctx.fillText(String(banner.kicker).toUpperCase(), WIDTH / 2, y - 52);
      const ruleW = 260 * easeOut(Math.min(1, t / .4)); ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(WIDTH / 2 - ruleW / 2, y + 16, ruleW, 1);
      ctx.save(); ctx.beginPath(); ctx.rect(0, y - 46, WIDTH, 62); ctx.clip();
      if ("letterSpacing" in ctx) ctx.letterSpacing = "-2.5px"; ctx.font = `800 ${banner.boss ? 58 : 52}px ` + DISPLAY_FONT; ctx.fillStyle = "#ffffff";
      ctx.fillText(String(banner.title).toUpperCase(), WIDTH / 2, y + (1 - inT) * 60);
      ctx.restore(); ctx.restore();
    }
  }

  function currentSkin() { return skinRows.find((skin) => skin.id === serverProfile?.equippedSkin) || skinRows[0]; }
  function currentAmmo() { return ammoTypes.find((ammo) => ammo.id === serverProfile?.equippedAmmo) || ammoTypes[0]; }

  function drawPlayer() {
    const skin=currentSkin(), color=skin.color, move=Math.hypot(player.vx,player.vy)>25, wobble=Math.sin(elapsed*18)*(move?1.8:.45), bank=Math.max(-.35,Math.min(.35,player.vy/850));
    const direction=Math.atan2(player.vy,player.vx||1)+Math.PI/2, pulse=1+Math.sin(elapsed*6)*.035;
    glow(player.x, player.y, pilotDashTimer > 0 ? 70 : 52, color, pilotDashTimer > 0 ? .7 : .38);
    ctx.save(); if(invulnerable>0&&Math.floor(elapsed*17)%2)ctx.globalAlpha=.42;
    ctx.fillStyle="#02040b90";ctx.beginPath();ctx.ellipse(player.x,player.y+17,25,9,0,0,Math.PI*2);ctx.fill();
    ctx.translate(player.x,player.y);ctx.rotate(direction+bank);ctx.scale(pulse,pulse);
    const activeShip = skinSprites[skin.index - 1];
    if ((activeShip?.complete && activeShip.naturalWidth) || (fighterArt.complete && fighterArt.naturalWidth)) {
      ctx.save();
      ctx.drawImage(activeShip?.complete && activeShip.naturalWidth ? activeShip : fighterArt, -43, -43 + wobble * .35, 86, 86);
      ctx.restore();
      const flare = 10 + Math.sin(elapsed * 28) * 3;
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.shadowColor = color; ctx.shadowBlur = 18; ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(-8, 24, 2.2, flare * .55, 0, 0, Math.PI * 2); ctx.ellipse(8, 24, 2.2, flare * .55, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      if (skin.index % 5 === 0 || ["orbiter","singularity","crown"].includes(skin.form)) {
        ctx.save(); ctx.rotate(elapsed * .48); ctx.strokeStyle = `${color}bd`; ctx.lineWidth = 1.5; ctx.shadowColor = color; ctx.shadowBlur = 9;
        ctx.beginPath(); ctx.ellipse(0, 0, 35, 12, .3, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(34, 2, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      if (skin.form === "wing" || skin.form === "monarch" || skin.form === "fracture" || skin.form === "cathedral") {
        ctx.strokeStyle = `${color}d9`; ctx.lineWidth = 2; ctx.shadowColor = color; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(-22, -2); ctx.lineTo(-37, -12 + wobble); ctx.moveTo(22, -2); ctx.lineTo(37, -12 - wobble); ctx.stroke();
      }
    } else {
      ctx.scale(1.48*pulse,1.48/pulse);
    const flame=12+Math.sin(elapsed*29)*4;
    ctx.shadowColor=color;ctx.shadowBlur=18;ctx.fillStyle=`${color}cc`;ctx.beginPath();ctx.moveTo(-4,9);ctx.lineTo(0,9+flame);ctx.lineTo(4,9);ctx.closePath();ctx.fill();
    ctx.fillStyle="#fff1ad";ctx.beginPath();ctx.moveTo(-1.5,10);ctx.lineTo(0,10+flame*.65);ctx.lineTo(1.5,10);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
    if(skin.index%4===0||skin.form==="comet"||skin.form==="afterburn"||skin.form==="wildfire"){
      ctx.strokeStyle=`${color}70`;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-4,7);ctx.quadraticCurveTo(-11,20+wobble,-2,29);ctx.moveTo(4,7);ctx.quadraticCurveTo(11,20-wobble,2,29);ctx.stroke();
    }
    ctx.beginPath();
    if(["wing","finch","mantis","saw","fracture","cathedral","monarch","howl","breaker"].includes(skin.form)){
      ctx.moveTo(0,-20);ctx.lineTo(5,-5);ctx.lineTo(17,-1);ctx.lineTo(8,4);ctx.lineTo(12,12);ctx.lineTo(3,9);ctx.lineTo(0,14);ctx.lineTo(-3,9);ctx.lineTo(-12,12);ctx.lineTo(-8,4);ctx.lineTo(-17,-1);ctx.lineTo(-5,-5);
    }else if(["comet","afterburn","dancer","drifter","wildfire","lastlight","current","hour"].includes(skin.form)){
      ctx.moveTo(0,-23);ctx.lineTo(7,-4);ctx.lineTo(5,7);ctx.lineTo(2,11);ctx.lineTo(0,8);ctx.lineTo(-2,11);ctx.lineTo(-5,7);ctx.lineTo(-7,-4);
    }else if(["singularity","oracle","mirage","crown","eater","archive","prime","obsidian"].includes(skin.form)){
      ctx.moveTo(0,-18);ctx.lineTo(12,-7);ctx.lineTo(14,3);ctx.lineTo(7,13);ctx.lineTo(-7,13);ctx.lineTo(-14,3);ctx.lineTo(-12,-7);
    }else{
      ctx.moveTo(0,-21);ctx.lineTo(8,-4);ctx.lineTo(7,7);ctx.lineTo(4,12);ctx.lineTo(-4,12);ctx.lineTo(-7,7);ctx.lineTo(-8,-4);
    }
    ctx.closePath();const gradient=ctx.createLinearGradient(-12,-12,13,14);gradient.addColorStop(0,"#f5fff2");gradient.addColorStop(.19,color);gradient.addColorStop(1,"#15242b");ctx.fillStyle=gradient;ctx.strokeStyle=color;ctx.lineWidth=1.7;ctx.shadowColor=color;ctx.shadowBlur=15;ctx.fill();ctx.stroke();ctx.shadowBlur=0;
    ctx.fillStyle="#f8ffff";ctx.globalAlpha=.78;ctx.beginPath();ctx.moveTo(-5,-9);ctx.lineTo(-1,-17);ctx.lineTo(1,-14);ctx.lineTo(-2,-4);ctx.closePath();ctx.fill();ctx.globalAlpha=1;
    ctx.fillStyle="#061016";ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(4,-2);ctx.lineTo(0,3);ctx.lineTo(-4,-2);ctx.closePath();ctx.fill();ctx.fillStyle="#edffff";ctx.shadowColor="#eaffff";ctx.shadowBlur=10;ctx.beginPath();ctx.ellipse(0,-3,2.7,4.8,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    ctx.strokeStyle=`${color}de`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-5,4);ctx.lineTo(-2,8+wobble);ctx.moveTo(5,4);ctx.lineTo(2,8-wobble);ctx.stroke();
    for(let i=0;i<1+skin.index%3;i++){const y=-1+i*4;ctx.fillStyle=i%2?"#efffc9":color;ctx.fillRect(-1.1,y,2.2,1.4)}
    if(skin.index%5===0||skin.form==="orbiter"||skin.form==="singularity"||skin.form==="crown"){
      ctx.rotate(elapsed*.45);ctx.strokeStyle=`${color}99`;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,0,22,8,.3,0,Math.PI*2);ctx.stroke();ctx.fillStyle="#f7ffe3";ctx.beginPath();ctx.arc(21,2,2,0,Math.PI*2);ctx.fill();
    }
    if(serverProfile?.inventory.includes("aurora")){ctx.strokeStyle="#83efff99";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-6,12);ctx.lineTo(-11,21+wobble);ctx.moveTo(6,12);ctx.lineTo(11,21-wobble);ctx.stroke()}
    }
    ctx.restore();
    if (shieldUp) { ctx.save(); ctx.beginPath(); ctx.arc(player.x, player.y, 40 + Math.sin(elapsed * 6) * 2, 0, Math.PI * 2); ctx.strokeStyle = "#7fe0c5"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = .1; ctx.fillStyle = "#7fe0c5"; ctx.fill(); ctx.restore(); glow(player.x, player.y, 48, "#7fe0c5", .25); }
    if (pilotDashTimer > 0) { ctx.save(); ctx.globalAlpha = .5; ctx.strokeStyle = GOLD_HI; ctx.lineWidth = 2; for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(player.x - pilotDashX * 22 * k + pilotDashY * 14, player.y - pilotDashY * 22 * k - pilotDashX * 14); ctx.lineTo(player.x - pilotDashX * 22 * k - pilotDashX * 16 + pilotDashY * 14, player.y - pilotDashY * 22 * k - pilotDashY * 16 - pilotDashX * 14); ctx.stroke(); } ctx.restore(); }
    const droneCount=droneLevel+(serverProfile?.inventory.includes("drone")?1:0);
    for(let i=0;i<droneCount;i++){const a=elapsed*1.8+i*Math.PI*2/droneCount,x=player.x+Math.cos(a)*30,y=player.y+Math.sin(a)*23;ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fillStyle=color;ctx.shadowBlur=12;ctx.shadowColor=color;ctx.fill();ctx.shadowBlur=0;}
  }

  function hexHue(hex) {
    const value = hex.replace("#", "");
    const r = parseInt(value.slice(0, 2), 16) / 255, g = parseInt(value.slice(2, 4), 16) / 255, b = parseInt(value.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (!d) return 0;
    let h = max === r ? (g - b) / d % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return Math.round((h * 60 + 360) % 360);
  }

  function drawProjectile(bullet) {
    const color = bullet.color || "#c6fa70", r = bullet.radius || 4;
    // short motion streak
    const speed = Math.hypot(bullet.vx, bullet.vy) || 1, tail = 16;
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = color; ctx.globalAlpha = .45; ctx.lineWidth = r * 1.3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(bullet.x, bullet.y); ctx.lineTo(bullet.x - bullet.vx / speed * tail, bullet.y - bullet.vy / speed * tail); ctx.stroke(); ctx.restore();
    glow(bullet.x, bullet.y, r * 4, color, .75);
    ctx.save(); ctx.translate(bullet.x, bullet.y); ctx.rotate(Math.atan2(bullet.vy, bullet.vx)); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 1.8;
    if (bullet.shape === "diamond") { ctx.beginPath(); ctx.moveTo(r * 1.8, 0); ctx.lineTo(0, -r); ctx.lineTo(-r * 1.8, 0); ctx.lineTo(0, r); ctx.closePath(); ctx.fill(); }
    else if (bullet.shape === "flare") { ctx.beginPath(); ctx.ellipse(0, 0, r * 2.4, r * .85, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#fff2cf"; ctx.fillRect(-r * .55, -r * .38, r * 1.15, r * .76); }
    else if (bullet.shape === "ring") { ctx.beginPath(); ctx.arc(0, 0, r * 1.25, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * .48, 0, Math.PI * 2); ctx.fill(); }
    else if (bullet.shape === "triangle") { ctx.beginPath(); ctx.moveTo(r * 1.5, 0); ctx.lineTo(-r, -r); ctx.lineTo(-r, r); ctx.closePath(); ctx.fill(); }
    else if (bullet.shape === "star") { ctx.rotate(elapsed * 9); ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * .55 : r * 1.45; i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }
    else if (bullet.shape === "sun") { ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, rr = i % 2 ? r : r * 1.6; i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }
    else if (bullet.shape === "square") { ctx.rotate(Math.PI / 4 + elapsed * 6); ctx.fillRect(-r, -r, r * 2, r * 2); }
    else { ctx.beginPath(); ctx.ellipse(0, 0, r * 1.55, r * .8, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#ffffff"; ctx.globalAlpha = .85; ctx.beginPath(); ctx.arc(0, 0, r * .42, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function enemyColor(type) { return type === "ELITE" ? "#ffc65a" : type === "SPOOF" ? "#ff5a4f" : type === "LEECH" ? "#b07cff" : "#3fe0c5"; }

  function drawEnemy(mob) {
    const color = enemyColor(mob.type);
    const archetype = mob.type === "ELITE" ? 3 : mob.type === "SPOOF" ? 4 : mob.type === "LEECH" ? 2 : Math.abs(mob.id || 0) % 2;
    const art = enemySprites[archetype], r = mob.radius;
    if (mob.lungeWarn > 0) { ctx.save(); ctx.strokeStyle = "#ff6a5a"; ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]); ctx.globalAlpha = .9; ctx.beginPath(); ctx.moveTo(mob.x, mob.y); ctx.lineTo(mob.x + Math.cos(mob.lungeAngle) * 150, mob.y + Math.sin(mob.lungeAngle) * 150); ctx.stroke(); ctx.restore(); }
    if (mob.type === "LEECH" && mob.draining) { ctx.save(); ctx.strokeStyle = "#b07cff"; ctx.globalAlpha = .55 + Math.sin(elapsed * 20) * .2; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(mob.x, mob.y); ctx.quadraticCurveTo((mob.x + player.x) / 2 + Math.sin(elapsed * 9) * 20, (mob.y + player.y) / 2, player.x, player.y); ctx.stroke(); ctx.restore(); }
    const spawnIn = Math.min(1, (mob.age || 0) / .35), pop = spawnIn < 1 ? .4 + spawnIn * .6 : 1;
    glow(mob.x, mob.y, r * (mob.type === "ELITE" ? 3.2 : 2.6), color, .55 * spawnIn);
    if (art?.complete && art.naturalWidth) {
      const pulse = (1 + Math.sin(elapsed * 12 + mob.id) * .04) * pop;
      ctx.save(); ctx.translate(mob.x, mob.y); ctx.rotate(mob.rotation); ctx.scale(pulse, pulse); ctx.globalAlpha = spawnIn;
      ctx.drawImage(art, -r * 1.85, -r * 1.85, r * 3.7, r * 3.7);
      if (mob.hit > 0) { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = Math.min(1, mob.hit * 9); ctx.drawImage(art, -r * 1.85, -r * 1.85, r * 3.7, r * 3.7); ctx.globalCompositeOperation = "source-over"; }
      if (mob.type === "ELITE") { ctx.globalAlpha = 1; ctx.strokeStyle = `${color}dc`; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(0, 0, r * 2.15, elapsed, elapsed + Math.PI * 1.18); ctx.stroke(); }
      ctx.restore();
      if (mob.type === "ELITE" && mob.maxHp > 1 && mob.hp < mob.maxHp) {
        ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(mob.x - 16, mob.y - r - 14, 32, 3);
        ctx.fillStyle = color; ctx.fillRect(mob.x - 16, mob.y - r - 14, 32 * Math.max(0, mob.hp / mob.maxHp), 3);
      }
      return;
    }
    const elite = mob.type === "ELITE", beat = Math.sin(elapsed * 13 + mob.id) * 1.5;
    ctx.save(); ctx.translate(mob.x, mob.y); ctx.rotate(mob.rotation); ctx.scale(pop, pop);
    ctx.globalAlpha = .72; ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(-r * .25, r * .45); ctx.lineTo(-r * .12, r * (1.15 + beat * .04)); ctx.lineTo(0, r * .72); ctx.lineTo(r * .12, r * (1.15 - beat * .04)); ctx.lineTo(r * .25, r * .45); ctx.fill();
    ctx.globalAlpha = 1;
    const hull = ctx.createLinearGradient(-r, -r, r, r); hull.addColorStop(0, "#ffffff"); hull.addColorStop(.2, mob.hit > 0 ? "#ffffff" : color); hull.addColorStop(1, "#171929");
    ctx.fillStyle = hull; ctx.strokeStyle = `${color}f2`; ctx.lineWidth = elite ? 2.5 : 1.4;
    ctx.beginPath(); ctx.moveTo(0, -r * 1.2); ctx.lineTo(r * .33, -r * .38); ctx.lineTo(r * 1.2, -r * .06);
    ctx.lineTo(r * .72, r * .35); ctx.lineTo(r * .4, r * .25); ctx.lineTo(r * .2, r * .68);
    ctx.lineTo(0, r * .46); ctx.lineTo(-r * .2, r * .68); ctx.lineTo(-r * .4, r * .25); ctx.lineTo(-r * .72, r * .35);
    ctx.lineTo(-r * 1.2, -r * .06); ctx.lineTo(-r * .33, -r * .38); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#101225"; ctx.beginPath(); ctx.ellipse(0, -r * .18, r * .31, r * .39, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = elite ? "#fff3a8" : "#f5fbff"; ctx.beginPath(); ctx.ellipse(0, -r * .22, r * .13, r * .2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawBoss(boss) {
    const color = boss.type.color, size = boss.size || 204;
    if (boss.telegraph > 0) {
      // Locked charge lane: the boss commits to this line, so the player can sidestep it.
      const a = boss.chargeAngle ?? 0, len = 900, k = 1 - boss.telegraph / .9;
      ctx.save(); ctx.translate(boss.x, boss.y); ctx.rotate(a);
      ctx.fillStyle = `rgba(255,55,95,${.08 + k * .14})`; ctx.fillRect(0, -boss.radius, len, boss.radius * 2);
      ctx.strokeStyle = `rgba(255,120,140,${.4 + Math.sin(elapsed * 30) * .2})`; ctx.lineWidth = 2; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -elapsed * 120;
      ctx.beginPath(); ctx.moveTo(0, -boss.radius); ctx.lineTo(len, -boss.radius); ctx.moveTo(0, boss.radius); ctx.lineTo(len, boss.radius); ctx.stroke(); ctx.restore();
    }
    const enter = boss.enter > 0 ? 1 - boss.enter / 1.1 : 1;
    if (boss.rage) glow(boss.x, boss.y, size * (1 + Math.sin(elapsed * 10) * .05), "#ff6a5a", .3);
    glow(boss.x, boss.y, size * .9, color, .45 * enter);
    ctx.save(); ctx.translate(boss.x, boss.y + Math.sin(elapsed * 2.1 + boss.id) * 5); ctx.rotate(Math.sin(elapsed * .8 + boss.id) * .035);
    if (boss.charge > 0) ctx.scale(1.06, .94);
    const r = boss.radius;
    ctx.strokeStyle = `${color}aa`; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(0, 0, size * .59 + Math.sin(elapsed * 3) * 4, size * .39, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = .5; ctx.setLineDash([9, 8]); ctx.lineDashOffset = elapsed * 20; ctx.beginPath(); ctx.ellipse(0, 0, size * .68, size * .45, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = enter;
    const art = bossImage(boss.type);
    if (art.complete && art.naturalWidth) {
      if (boss.hit > 0) ctx.filter = "brightness(1.7)";
      ctx.drawImage(art, -size * .75, -size * .5, size * 1.5, size);
      ctx.filter = "none";
    } else {
      ctx.rotate(boss.spin);
      polygon(0, 0, r, boss.type.style === "siphon" ? 7 : 9, 0); ctx.fillStyle = boss.hit > 0 ? "#fff" : "#151015"; ctx.fill(); ctx.strokeStyle = color; ctx.stroke();
      ctx.fillStyle = `${color}77`; polygon(0, 0, r * .76, 8, Math.PI / 8); ctx.fill();
    }
    ctx.restore();
    // compact HP arc under each boss (the floating bar tracks the lead boss)
    if (bosses.length > 1) {
      ctx.save(); ctx.lineCap = "round"; ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,.45)";
      ctx.beginPath(); ctx.arc(boss.x, boss.y, size * .58, Math.PI * .65, Math.PI * .35, true); ctx.stroke();
      ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(boss.x, boss.y, size * .58, Math.PI * .65, Math.PI * .65 - Math.PI * 1.7 * Math.max(0, boss.hp / boss.maxHp), true); ctx.stroke(); ctx.restore();
    }
  }

  function updateBossHud() {
    const boss = bosses[0];
    const bar = $("bossStatus");
    if (!boss) { if (bar.classList.contains("active")) bar.classList.remove("active"); return; }
    if (!bar.classList.contains("active")) bar.classList.add("active");
    setText("bossName", `LV ${String(boss.level).padStart(2, "0")} · ${boss.type.name}${bosses.length > 1 ? ` +${bosses.length - 1}` : ""}`);
    const pct = `${Math.max(0, boss.hp / boss.maxHp * 100).toFixed(1)}%`;
    if (hudCache.get("bossFill") !== pct) { hudCache.set("bossFill", pct); $("bossFill").style.width = pct; }
    setText("bossHp", `${Math.max(0, Math.ceil(boss.hp))} / ${boss.maxHp}`);
  }

  function updateHud() {
    const whole = Math.floor(elapsed), minutes = Math.floor(whole / 60), seconds = whole % 60;
    setText("time", `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`);
    setText("levelLabel", `/ ${tr("LEVEL", "等级")} ${String(level).padStart(2, "0")}`);
    setText("score", String(score).padStart(5, "0"));
    setText("hp", `${"♥ ".repeat(Math.max(0, health)).trim()} ${"♡ ".repeat(Math.max(0, maxHealth - health)).trim()}`.trim() || "♡");
    setText("hint", `HEAT ${Math.round(energy)}% · ${weaponName.toUpperCase()}`);
    updateBossHud();
  }

  function spawnEnemy() {
    if (enemies.length >= Math.min(52, 14 + level * 5)) return;
    const side = Math.floor(rng() * 4), pad = 15;
    const x = side === 0 ? pad : side === 1 ? WIDTH - pad : rng() * WIDTH;
    const y = side === 2 ? pad : side === 3 ? HEIGHT - pad : rng() * HEIGHT;
    const roll = rng(); let type = roll < .48 ? "NOISE" : roll < .78 ? "SPOOF" : "LEECH";
    const base = type === "SPOOF" ? 15 : 11;
    if (level >= 5 && roll > .9) type = "ELITE";
    const hp = type === "ELITE" ? 5 + Math.floor(level / 2) : type === "SPOOF" ? 2 + Math.floor(level / 3) : 1 + Math.floor(level / 6);
    enemies.push({ id: ++now, x, y, type, radius: type === "ELITE" ? 21 : base, hp, maxHp: hp, speed: (type === "ELITE" ? 82 : type === "SPOOF" ? 72 : type === "LEECH" ? 58 : 62) + Math.min(level * 7, 115), rotation: rng() * 6.2, hit: 0, age: 0 });
  }

  function spawnBoss(bossLevel) {
    const extra = Math.min(3, Math.floor((bossLevel - 2) / 3));
    const count = 1 + extra;
    const size = count > 1 ? 138 : 204;
    for (let i = 0; i < count; i++) {
      const healthPoints = 48 + bossLevel * 24 + i * 18;
      // Hitbox now matches the painted silhouette (it used to be ~1/3 of the art).
      bosses.push({ x: WIDTH / 2 + (i - (count - 1) / 2) * 150, y: -size * .6, ty: 110 + i * 24, enter: 1.1, size, radius: size * .34, hp: healthPoints, maxHp: healthPoints, type: bossTypes[(bossLevel - 2 + i) % bossTypes.length], level: bossLevel, fireClock: 1.4 + i * .4 + 1.1, chargeClock: 3.8 + 1.1, telegraph: 0, charge: 0, chargeAngle: 0, spin: rng() * 6, contact: 0, summonClock: 4.6, hit: 0, id: ++now });
    }
    const lead = bosses[bosses.length - count] || bosses[0];
    banner = { kicker: tr(`LEVEL ${String(bossLevel).padStart(2, "0")} · BOSS${count > 1 ? ` ×${count}` : ""}`, `等级 ${String(bossLevel).padStart(2, "0")} · 首领${count > 1 ? ` ×${count}` : ""}`), title: lead ? lead.type.name : "BOSS", color: lead ? lead.type.color : "#ff4a2e", life: 2.6, max: 2.6, boss: true };
    fx3d("boss-spawn", { count });
    sfx("boss");
    announce(`LEVEL ${String(bossLevel).padStart(2, "0")} · BOSS INBOUND`);
  }

  function setOverlayMode(mode) { $("overlay").dataset.mode = mode; }

  function chooseUpgrades() {
    const shuffled = [...upgradePool].sort(() => rng() - .5);
    selectedReward = shuffled.slice(0, 3);
    state = "upgrade"; input.clear(); touchStick = null;
    renderUpgradeChoices();
    $("mainAction").hidden = true;
    setOverlayMode("upgrade");
    $("overlay").classList.remove("off");
    sfx("levelup");
  }

  function renderUpgradeChoices() {
    $("modalKicker").textContent = language === "zh" ? `等级 ${String(level).padStart(2, "0")} · 武器实验室` : `LEVEL ${String(level).padStart(2, "0")} · FORGE BENCH`;
    $("modalSeed").textContent = language === "zh" ? `${bosses.length} 个首领即将出现` : `${bosses.length} BOSS${bosses.length === 1 ? "" : "ES"} INBOUND`;
    $("modalTitle").textContent = tr("Bolt something on.", "装上新部件。");
    $("modalCopy").textContent = tr("The swarm just got faster. Pick one upgrade for the rest of this run.", "蜂群又变快了。为本局剩余时间选择一项强化。");
    $("rigOptions").innerHTML = selectedReward.map((upgrade, i) => `<button type="button" class="upgrade" data-upgrade="${upgrade.id}" aria-keyshortcuts="${i + 1}"><span class="glyph">${upgrade.icon}</span><span><b>${language === "zh" ? upgrade.nameZh : upgrade.name}</b><small>${language === "zh" ? upgrade.textZh : upgrade.text}</small></span><em>${i + 1} · ${upgrade.tag}</em></button>`).join("");
    document.querySelectorAll("[data-upgrade]").forEach((button) => button.addEventListener("click", () => takeUpgrade(button.dataset.upgrade)));
  }

  function takeUpgrade(id) {
    if (state !== "upgrade") return;
    if (id === "split") { splitLevel = Math.min(4, splitLevel + 1); weaponName = "Forked Lancer"; }
    if (id === "overclock") { overclockLevel = Math.min(5, overclockLevel + 1); weaponName = "Hot Barrel"; }
    if (id === "pierce") { pierceLevel = Math.min(4, pierceLevel + 1); weaponName = "Rail Rounds"; }
    if (id === "drone") { droneLevel = Math.min(3, droneLevel + 1); weaponName = "Orbit Array"; }
    if (id === "hull") { maxHealth = Math.min(7, maxHealth + 1); health = Math.min(maxHealth, health + 1); weaponName = "Reinforced Shell"; }
    state = "playing"; $("overlay").classList.add("off"); invulnerable = Math.max(invulnerable, 1); fx3d("upgrade", { x: player.x, y: player.y, id });
    const upgrade = upgradePool.find((u) => u.id === id);
    showToast(`${(language === "zh" ? upgrade?.nameZh : upgrade?.name) || "UPGRADE"} ${tr("ONLINE", "已启用")}`);
    shockwave(player.x, player.y, "#d8b468", 90, .6, 4); sfx("power"); updateHud();
  }

  function announce(message) {
    const old = $("modalTitle").textContent;
    $("modalTitle").textContent = message;
    setTimeout(() => { if (state === "playing" && $("modalTitle").textContent === message) $("modalTitle").textContent = old; }, 1800);
    showToast(message);
    if ($("terminalText")) $("terminalText").textContent = message.includes("BOSS") ? tr("Boss in the sector. Read its pattern and save your pulse.","首领已进入区域。观察攻击规律，保留你的脉冲能量。") : message;
  }

  // Cosmetic randomness uses Math.random so it never disturbs the seeded gameplay RNG.
  function spark(x, y, color, amount = 9, power = 1) {
    for (let i = 0; i < amount; i++) { const a = Math.random() * Math.PI * 2, speed = (40 + Math.random() * 170) * power; sparks.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: .25 + Math.random() * .45, max: .7, size: 1.2 + Math.random() * 2.4, color }); }
    if (sparks.length > 420) sparks.splice(0, sparks.length - 420);
  }
  function addShake(amount) { shake = Math.max(shake, amount); }

  function fireAt(target, source = "player") {
    const angle = Math.atan2(target.y - player.y, target.x - player.x);
    // Forked Lancer now scales through all four ranks (ranks 3–4 previously did nothing).
    const count = 1 + Math.min(4, splitLevel);
    const spread = count === 1 ? 0 : count > 3 ? .13 : .17;
    const ammo = currentAmmo();
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * spread, a = angle + offset;
      bullets.push({ x: player.x + Math.cos(a) * 16, y: player.y + Math.sin(a) * 16, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, life: 1.1, damage: 1 + Math.floor(pierceLevel / 2), pierce: pierceLevel, radius: ammo.id === "ammo-glitch" ? 4.2 : 3.5, color: ammo.color, shape: ammo.shape, hits: new Set(), source });
    }
    if (source === "player") { sfx("shoot"); fx3d("shoot"); }
  }

  function targetNearest() {
    let target = null, best = Infinity;
    for (const mob of enemies) { const d = (mob.x - player.x) ** 2 + (mob.y - player.y) ** 2; if (d < best) { best = d; target = mob; } }
    for (const boss of bosses) { if (boss.enter > 0) continue; const d = (boss.x - player.x) ** 2 + (boss.y - player.y) ** 2 - boss.radius ** 2; if (d < best) { best = d; target = boss; } }
    return target;
  }

  function enemyBullet(x, y, angle, speed = 160, radius = 5) { hostileShots.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 5, radius }); }

  function bossAttack(boss, dt) {
    boss.hit = Math.max(0, boss.hit - dt);
    if (boss.enter > 0) { boss.enter -= dt; boss.y += (boss.ty - boss.y) * Math.min(1, dt * 3.2); return; }
    boss.fireClock -= dt; boss.chargeClock -= dt; boss.summonClock -= dt; boss.contact = Math.max(0, boss.contact - dt);
    const angle = Math.atan2(player.y - boss.y, player.x - boss.x);
    if (boss.type.style === "charge" && boss.chargeClock <= 0 && boss.charge <= 0 && boss.telegraph <= 0) { boss.telegraph = .9; boss.chargeAngle = angle; boss.chargeClock = Math.max(1.8, 4.1 - level * .08) * (boss.rage ? .6 : 1); }
    if (boss.telegraph > 0) { boss.telegraph -= dt; if (boss.telegraph <= 0) { boss.charge = .52; addShake(.12); } }
    if (boss.charge > 0) {
      // Charge commits to the telegraphed lane instead of homing on the player.
      boss.charge -= dt; boss.x += Math.cos(boss.chargeAngle) * (380 + level * 12) * dt; boss.y += Math.sin(boss.chargeAngle) * (380 + level * 12) * dt;
      if (Math.random() < .6) spark(boss.x - Math.cos(boss.chargeAngle) * boss.radius, boss.y - Math.sin(boss.chargeAngle) * boss.radius, boss.type.color, 1, .5);
    } else if (boss.telegraph <= 0) {
      const dist = Math.hypot(player.x - boss.x, player.y - boss.y) || 1;
      const desired = boss.type.style === "siphon" ? 182 : 230;
      boss.x += (Math.cos(angle) * (dist - desired) * .28 + Math.cos(elapsed * 1.4 + boss.id) * 26) * dt;
      boss.y += (Math.sin(angle) * (dist - desired) * .28 + Math.sin(elapsed * 1.6 + boss.id) * 26) * dt;
    }
    if (!boss.rage && boss.hp < boss.maxHp / 2) {
      boss.rage = true; boss.fireClock = .4; boss.chargeClock = Math.min(boss.chargeClock, 1); boss.summonClock = Math.min(boss.summonClock, 1);
      shockwave(boss.x, boss.y, "#ff6a5a", boss.size, .7, 4); addShake(.3); hitStop = Math.max(hitStop, .08); sfx("boss");
      floatText(boss.x, boss.y - boss.size * .45, tr("ENRAGED", "暴怒"), "#ff6a5a", 22); fx3d("boss-rage", { x: boss.x, y: boss.y });
      banner = { kicker: boss.type.name, title: tr("Enraged", "暴怒"), color: "#ff6a5a", life: 1.3, max: 1.3 };
    }
    const m = boss.size * .45;
    boss.x = Math.max(m, Math.min(WIDTH - m, boss.x)); boss.y = Math.max(m * .7, Math.min(HEIGHT - m * .7, boss.y)); boss.spin += dt * .7;
    if (boss.fireClock <= 0 && boss.telegraph <= 0) {
      const shots = boss.type.style === "volley" ? 5 : 3, spread = boss.type.style === "charge" ? .32 : .2;
      for (let i = 0; i < shots; i++) enemyBullet(boss.x, boss.y, angle + (i - (shots - 1) / 2) * spread, 142 + level * 4, 5.2);
      boss.volleys = (boss.volleys || 0) + 1;
      // angry volley bosses also spin out a ring with a gap you can slip through
      if (boss.rage && boss.type.style === "volley" && boss.volleys % 2 === 0) { const gap = rng() * Math.PI * 2; for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; if (Math.abs(Math.atan2(Math.sin(a - gap), Math.cos(a - gap))) < .45) continue; enemyBullet(boss.x, boss.y, a, 120 + level * 3, 5); } }
      boss.fireClock = Math.max(.5, 1.55 - level * .035) * (boss.rage ? .7 : 1);
    }
    if (boss.type.style === "siphon" && boss.summonClock <= 0) {
      for (let i = 0; i < Math.min(4, 1 + Math.floor(level / 3)); i++) { const a = rng() * 6.28, hp = 1 + Math.floor(level / 9); enemies.push({ id: ++now, x: boss.x + Math.cos(a) * 45, y: boss.y + Math.sin(a) * 45, type: "LEECH", radius: 10, hp, maxHp: hp, speed: 64 + level * 3, rotation: rng() * 6, hit: 0, age: 0 }); }
      shockwave(boss.x, boss.y, boss.type.color, 70, .5, 3);
      boss.summonClock = Math.max(2, 5.5 - level * .12);
    }
    if (Math.hypot(boss.x - player.x, boss.y - player.y) < boss.radius + 14 && boss.contact <= 0) { damagePlayer(); boss.contact = .8; }
  }

  function damagePlayer() {
    if (invulnerable > 0 || state !== "playing") return;
    if (shieldUp) { fx3d("shield-pop", { x: player.x, y: player.y }); shieldUp = false; invulnerable = .9; collisionClock = .6; addShake(.15); shockwave(player.x, player.y, "#7fe0c5", 90, .5, 5); spark(player.x, player.y, "#7fe0c5", 16, 1); floatText(player.x, player.y - 46, tr("SHIELD POP", "护盾抵挡"), "#7fe0c5", 16); sfx("power"); return; }
    health--; invulnerable = .95; collisionClock = .7; addShake(.28); damageFlash = .45; hitStop = .06; combo = 0; fx3d("player-hit", { x: player.x, y: player.y });
    spark(player.x, player.y, "#ff375f", 18, 1.2); shockwave(player.x, player.y, "#ff375f", 70, .4, 4);
    sfx("hurt"); window.SFX?.haptic(40); updateHud();
    if (health <= 0) finishRun();
  }

  function killEnemy(index, points, color) {
    const mob = enemies[index];
    combo++; comboClock = 2.2; bestCombo = Math.max(bestCombo, combo);
    const mult = comboMult(); points = Math.round(points * mult);
    if (combo % 10 === 0 && combo <= 30) { floatText(player.x, player.y - 54, `SCORE ×${mult}`, "#f3e3b3", 20); sfx("power"); }
    gainScore(points); kills++; energy = Math.min(100, energy + 4);
    if (rng() < (mob.type === "ELITE" ? .45 : .045)) { const roll = rng(); drops.push({ x: mob.x, y: mob.y, power: roll < .4 ? "rapid" : roll < .72 ? "shield" : "magnet", offset: rng() * 6.28, life: 9 }); }
    spark(mob.x, mob.y, color, mob.type === "ELITE" ? 22 : 11); shockwave(mob.x, mob.y, color, mob.radius * 3, .32, 2.5);
    floatText(mob.x, mob.y - mob.radius - 4, `+${points}`, mob.type === "ELITE" ? "#d8b468" : "#ffffff", mob.type === "ELITE" ? 17 : 13);
    if (mob.type === "ELITE") { addShake(.12); hitStop = Math.max(hitStop, .035); }
    fx3d("kill", { x: mob.x, y: mob.y, type: mob.type, radius: mob.radius, color: enemyColor(mob.type) });
    sfx("kill"); enemies.splice(index, 1);
  }

  function activatePulse() {
    if (state !== "playing" || energy < 100 || pulseTimer > 0) return;
    energy = 0; pulseTimer = .55; invulnerable = Math.max(invulnerable, .8); let destroyed = 0;
    const pulseRadius = selectedRig.pulse * (owns("nova") ? 1.25 : 1) * (1 + pilotBuild().nova * .1);
    for (let i = enemies.length - 1; i >= 0; i--) { const mob = enemies[i]; if (Math.hypot(mob.x - player.x, mob.y - player.y) < pulseRadius) { gainScore(45); spark(mob.x, mob.y, "#d8b468", 8); fx3d("kill", { x: mob.x, y: mob.y, type: mob.type, radius: mob.radius, color: enemyColor(mob.type) }); enemies.splice(i, 1); destroyed++; kills++; } }
    for (let b = bosses.length - 1; b >= 0; b--) { const boss = bosses[b]; if (boss.enter <= 0 && Math.hypot(boss.x - player.x, boss.y - player.y) < pulseRadius + boss.radius) { boss.hp -= 7 + pierceLevel * 2; boss.hit = .15; if (boss.hp <= 0) defeatBoss(b); } }
    // hostile shots inside the pulse are erased — the pulse is now a real panic button
    hostileShots = hostileShots.filter((shot) => Math.hypot(shot.x - player.x, shot.y - player.y) > pulseRadius);
    shockwave(player.x, player.y, GOLD, pulseRadius, .55, 4); shockwave(player.x, player.y, GOLD_HI, pulseRadius * .7, .45, 2);
    addShake(.2); sfx("pulse"); window.SFX?.haptic(30); fx3d("pulse", { x: player.x, y: player.y, radius: pulseRadius });
    if (destroyed) { combo += destroyed; comboClock = 2.2; floatText(player.x, player.y - 40, `${destroyed} ×`, "#e5ccff", 18); }
    if (destroyed) showToast(`FORGE BLAST · ${destroyed} CLEARED`); else showToast("FORGE BLAST · BULLETS WIPED");
    updateHud();
  }

  function activatePilotDash() {
    if (state !== "playing" || pilotDashCooldown > 0) return;
    let rawX = (input.has("KeyD") || input.has("ArrowRight") ? 1 : 0) - (input.has("KeyA") || input.has("ArrowLeft") ? 1 : 0);
    let rawY = (input.has("KeyS") || input.has("ArrowDown") ? 1 : 0) - (input.has("KeyW") || input.has("ArrowUp") ? 1 : 0);
    if (touchStick && (touchStick.dx || touchStick.dy)) { rawX = touchStick.dx; rawY = touchStick.dy; }
    const mag = Math.hypot(rawX, rawY) || 1; pilotDashX = rawX / mag; pilotDashY = rawY / mag; if (!rawX && !rawY) { pilotDashX = player.vx < 0 ? -1 : 1; pilotDashY = 0; }
    pilotDashTimer = .19; pilotDashCooldown = Math.max(3.1, 6.2 - pilotBuild().evasion * .3); invulnerable = Math.max(invulnerable, .38);
    spark(player.x, player.y, selectedRig.tint, 12, .8); shockwave(player.x, player.y, selectedRig.tint, 40, .3, 2); sfx("dash"); fx3d("dash", { x: player.x, y: player.y });
  }

  function spawnPickup(x, y, cache = false) { drops.push({ x, y, cache, offset: rng() * 6.28, life: cache ? 18 : 12 }); }

  function defeatBoss(index) {
    const boss = bosses[index]; if (!boss) return;
    const points = 900 + boss.level * 130;
    gainScore(points); bossesDefeated++; energy = Math.min(100, energy + 35); health = Math.min(maxHealth, health + (owns("leech") ? 2 : 1));
    spawnPickup(boss.x, boss.y, true);
    spark(boss.x, boss.y, boss.type.color, 60, 1.8); spark(boss.x, boss.y, "#ffffff", 24, 1.2);
    shockwave(boss.x, boss.y, boss.type.color, boss.size, .9, 8); shockwave(boss.x, boss.y, "#ffffff", boss.size * .6, .6, 4);
    floatText(boss.x, boss.y - 30, `+${points.toLocaleString()}`, "#d8b468", 30);
    hitStop = .14; addShake(.5); sfx("bigkill"); window.SFX?.haptic(80); fx3d("boss-down", { x: boss.x, y: boss.y, color: boss.type.color, size: boss.size || 204 });
    bosses.splice(index, 1); showToast("BOSS DOWN · STAR CACHE DROPPED");
    if (!bosses.length) banner = { kicker: tr("THE FORGE HOLDS", "熔炉守住了"), title: tr("Boss down", "首领击破"), color: "#eef3f8", life: 1.8, max: 1.8 };
    profile.rewardMarks = [...new Set([...(profile.rewardMarks || []), boss.type.name])].slice(-20); persist();
  }

  function beginRun() {
    profile.callsign = cleanCallsign($("callsign").value); persist(); syncProfile();
    randomSeed = (dayNo + Date.now() % 100000) % 2147483647 || 1;
    pilotBuildCache = null;
    state = "playing"; elapsed = 0; nextLevelAt = STEP_SECONDS; level = 1; score = 0; kills = 0; maxHealth = selectedRig.hp + (owns("phantom") ? 1 : 0); health = maxHealth; energy = selectedRig.id === "echo" ? 115 : 100; bossesDefeated = 0;
    fireClock = 0; spawnClock = .7; pickupClock = 2.5; collisionClock = 0; pulseTimer = 0; invulnerable = 1.2; shake = 0; hitStop = 0; damageFlash = 0; combo = 0; comboClock = 0; bestCombo = 0; droneShotAt = 0; pilotDashTimer = 0; pilotDashCooldown = 0;
    bullets = []; hostileShots = []; enemies = []; bosses = []; drops = []; sparks = []; floaters = []; rings = []; rapidTimer = 0; magnetTimer = 0; shieldUp = false; grazeCount = 0;
    splitLevel = 0; overclockLevel = 0; pierceLevel = owns("kinetic") ? 1 : 0; droneLevel = owns("drone") ? 1 : 0; weaponName = owns("overdrive") ? "Overdrive Array" : "Spark Repeater"; mapHazardClock = 7; mapHazardFlash = 0; trailClock = 0;
    player.x = WIDTH / 2; player.y = HEIGHT / 2; player.vx = 1; player.vy = 0;
    $("modalKicker").textContent = tr("SECTOR 01 · SWARM INBOUND","区域 01 · 蜂群来袭"); $("modalTitle").textContent = tr("The forge needs a pilot.","熔炉需要一名飞行员。");
    $("modalCopy").textContent = tr("Scrap swarms are coming for the forge. A new boss arrives every 40 seconds. Grab star shards, pick upgrades and keep moving.","废铁蜂群正冲向熔炉。每 40 秒出现新首领。收集星屑、选择强化并保持移动。");
    $("mainAction").textContent = tr("LAUNCH","出发"); $("mainAction").hidden = false; createRigOptions(); $("overlay").classList.add("off"); $("bossStatus").classList.remove("active");
    const map = maps.find((entry) => entry.id === activeMap) || maps[0];
    banner = { kicker: language === "zh" ? map.biomeZh : map.biome, title: language === "zh" ? map.localZh : map.local, color: map.palette[2], life: 2, max: 2 };
    shockwave(player.x, player.y, selectedRig.tint, 120, .8, 5); sfx("power"); fx3d("run-start");
    runMode = pendingMode; pendingMode = null;
    if (runMode) {
      if (runMode.mode === "hardcore") { maxHealth = 1; health = 1; }
      if (runMode.mode === "bossrush") nextLevelAt = 14;
      if (runMode.mode === "raid") { level = runMode.bossLevel; nextLevelAt = STEP_SECONDS; spawnBoss(runMode.bossLevel); }
      banner = { kicker: runMode.kicker || "SPECIAL MODE", title: runMode.title || "", color: "#ff4a2e", life: 2.4, max: 2.4 };
    }
    window.dispatchEvent(new CustomEvent("forge-run-start", { detail: { mode: runMode } }));
    updateHud(); announce(`${selectedRig.name} LAUNCHED`);
  }

  async function finishRun() {
    if (state === "over") return;
    state = "over"; input.clear(); touchStick = null;
    window.dispatchEvent(new CustomEvent("forge-run-end", { detail: { score, level, bosses: bossesDefeated, seconds: Math.floor(elapsed), combo: bestCombo, kills, mode: runMode } }));
    profile.best = Math.max(profile.best, score); profile.daily = Math.max(profile.daily || 0, score); profile.xp = (profile.xp || 0) + score; persist(); syncProfile();
    spark(player.x, player.y, currentSkin().color, 50, 1.6); shockwave(player.x, player.y, "#ff375f", 160, .9, 6); sfx("lose"); if (health <= 0) fx3d("death", { x: player.x, y: player.y });
    setOverlayMode("over");
    $("modalKicker").textContent = tr("RUN ENDED · FIELD REPORT","挑战结束 · 战场报告"); $("modalSeed").textContent = `${tr("LEVEL","等级")} ${String(level).padStart(2, "0")}`;
    $("modalTitle").textContent = health > 0 ? tr("Run complete.","挑战完成。") : tr("Ship down.","战舰坠毁。");
    $("modalCopy").textContent = language==="zh"?`生存 ${Math.floor(elapsed)} 秒 · 等级 ${level} · 击败 ${bossesDefeated} 个首领 · ${score.toLocaleString()} 分。`:`${Math.floor(elapsed)} sec survived · level ${level} · ${bossesDefeated} boss${bossesDefeated === 1 ? "" : "es"} defeated · ${score.toLocaleString()} points. `;
    const stat = (label, value) => `<div class="run-stat"><b>${value}</b><small>${label}</small></div>`;
    $("rigOptions").innerHTML = `<div class="run-stats">${stat(tr("SCORE","得分"), score.toLocaleString())}${stat(tr("TIME","时间"), $("time").textContent)}${stat(tr("BOSSES","首领"), bossesDefeated)}${stat(tr("BEST STREAK","最高连击"), `${bestCombo}`)}${stat(tr("GRAZES","擦弹"), grazeCount)}</div><div class="statusline" style="grid-column:1/-1">${tr("WEAPON BUILD","武器配置")} · ${escapeText(weaponName.toUpperCase())}<br>${escapeText(profile.rewardMarks.at(-1) || "STAR CACHE UNLOCKED")}</div>`;
    $("mainAction").textContent = tr("RUN IT BACK","再来一局"); $("mainAction").hidden = false;
    setTimeout(() => { if (state === "over") $("overlay").classList.remove("off"); }, 650);
    updateHud();
    await postRun();
  }

  function newLevel() {
    level++; nextLevelAt += runMode?.mode === "bossrush" ? 22 : STEP_SECONDS; fx3d("level", { x: player.x, y: player.y }); spawnBoss(level); chooseUpgrades(); updateHud();
  }

  function firePlayer(dt) {
    fireClock -= dt;
    const held = input.has("Space") || input.has("Mouse0") || !!touchStick;
    const flightSchool = pilotBuild();
    if (held && fireClock <= 0) { const target = targetNearest(); if (target) fireAt(target); fireClock = Math.max(.05, (rapidTimer > 0 ? .5 : 1) * selectedRig.fire * Math.pow(.82, overclockLevel) * (owns("overdrive") ? .85 : 1) * (1 - flightSchool.arsenal * .022)); }
    if (droneLevel > 0 && elapsed - droneShotAt > Math.max(.35, 1.2 - droneLevel * .16)) { const target = targetNearest(); if (target) { fireAt(target, "drone"); droneShotAt = elapsed; } }
  }

  function updateFx(dt) {
    for (let i = sparks.length - 1; i >= 0; i--) { const p = sparks[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .955; p.vy *= .955; p.life -= dt; if (p.life <= 0) sparks.splice(i, 1); }
    for (let i = rings.length - 1; i >= 0; i--) { rings[i].life -= dt; if (rings[i].life <= 0) rings.splice(i, 1); }
    for (let i = floaters.length - 1; i >= 0; i--) { const f = floaters[i]; f.life -= dt; f.y -= 34 * dt; if (f.life <= 0) floaters.splice(i, 1); }
    damageFlash = Math.max(0, damageFlash - dt); shake = Math.max(0, shake - dt);
    if (banner) { banner.life -= dt; if (banner.life <= 0) banner = null; }
    if (comboClock > 0) { comboClock -= dt; if (comboClock <= 0) combo = 0; }
  }

  function update(dt) {
    if (state !== "playing") return;
    elapsed += dt;
    if (elapsed >= nextLevelAt) { newLevel(); return; }
    spawnClock -= dt; pickupClock -= dt; collisionClock -= dt; invulnerable = Math.max(0, invulnerable - dt); pulseTimer = Math.max(0, pulseTimer - dt); pilotDashTimer = Math.max(0, pilotDashTimer - dt); pilotDashCooldown = Math.max(0, pilotDashCooldown - dt); rapidTimer = Math.max(0, rapidTimer - dt); magnetTimer = Math.max(0, magnetTimer - dt);
    const build = pilotBuild();
    let rawDx = (input.has("KeyD") || input.has("ArrowRight") ? 1 : 0) - (input.has("KeyA") || input.has("ArrowLeft") ? 1 : 0);
    let rawDy = (input.has("KeyS") || input.has("ArrowDown") ? 1 : 0) - (input.has("KeyW") || input.has("ArrowUp") ? 1 : 0);
    if (touchStick && !rawDx && !rawDy) { rawDx = touchStick.dx; rawDy = touchStick.dy; }
    const dx = pilotDashTimer > 0 ? pilotDashX : rawDx, dy = pilotDashTimer > 0 ? pilotDashY : rawDy;
    const mag = Math.hypot(dx, dy), norm = Math.max(1, mag);
    const speedBoost = (owns("chrono") ? 1.12 : 1) * (owns("rift") ? 1.08 : 1) * (1 + build.flight * .02) * (pilotDashTimer > 0 ? 2.5 : 1);
    // Light acceleration smoothing gives the ship weight without making it sluggish.
    const targetVx = dx / norm * selectedRig.speed * speedBoost, targetVy = dy / norm * selectedRig.speed * speedBoost;
    const blend = pilotDashTimer > 0 ? 1 : Math.min(1, dt * 18);
    player.vx += (targetVx - player.vx) * blend; player.vy += (targetVy - player.vy) * blend;
    if (activeMap === "orbit") { player.vx += (WIDTH / 2 - player.x) * .055; player.vy += (HEIGHT / 2 - player.y) * .055; }
    player.x = Math.max(16, Math.min(WIDTH - 16, player.x + player.vx * dt)); player.y = Math.max(16, Math.min(HEIGHT - 16, player.y + player.vy * dt));
    if (mag > 0) { trailClock -= dt; if (trailClock <= 0) { sparks.push({ x: player.x - player.vx * .03 + (Math.random() - .5) * 6, y: player.y - player.vy * .03 + (Math.random() - .5) * 6, vx: -player.vx * .25, vy: -player.vy * .25, life: .35, max: .45, size: 2.2, color: owns("aurora") ? "#83efff" : currentSkin().color }); trailClock = .03; } }
    firePlayer(dt);
    if (activeMap !== "rust") {
      mapHazardClock -= dt;
      if (mapHazardClock < 1.25 && mapHazardClock > 0) mapHazardFlash = mapHazardClock;
      if (mapHazardClock <= 0) { mapHazardFlash = -.58; mapHazardClock = 8.3; }
      if (mapHazardFlash < 0) { const hx = activeMap === "abyss" ? (elapsed % 16 < 8 ? 170 : WIDTH - 170) : WIDTH / 2; const hy = activeMap === "abyss" ? HEIGHT / 2 : (activeMap === "orbit" ? HEIGHT / 2 + 120 : HEIGHT / 2); const d = Math.hypot(player.x - hx, player.y - hy); const hazard = activeMap === "abyss" ? d < 82 : Math.abs(d - (activeMap === "orbit" ? 122 : 180)) < 32; if (hazard && collisionClock <= 0) { damagePlayer(); collisionClock = .7; } mapHazardFlash = Math.min(0, mapHazardFlash + dt); }
    }
    const spawnEvery = Math.max(.12, .84 * Math.pow(.87, level - 1));
    if (spawnClock <= 0) { spawnEnemy(); spawnClock = spawnEvery * (.7 + rng() * .55); }
    if (pickupClock <= 0) { spawnPickup(34 + rng() * (WIDTH - 68), 32 + rng() * (HEIGHT - 64)); pickupClock = 4.2 + rng() * 3.2; }

    for (const boss of bosses) bossAttack(boss, dt);
    for (let i = enemies.length - 1; i >= 0; i--) {
      const mob = enemies[i], angle = Math.atan2(player.y - mob.y, player.x - mob.x);
      mob.age = (mob.age || 0) + dt; mob.hit = Math.max(0, (mob.hit || 0) - dt);
      const ramp = Math.min(1, mob.age / .35), dist = Math.hypot(player.x - mob.x, player.y - mob.y);
      let moveAngle = angle, moveSpeed = mob.speed * ramp;
      if (mob.type === "SPOOF") { // Rams: lock a line, flash, then lunge along it
        mob.lungeClock = (mob.lungeClock ?? (1.6 + rng() * 1.4)) - dt;
        if (mob.lungeWarn > 0) { mob.lungeWarn -= dt; moveSpeed *= .15; if (mob.lungeWarn <= 0) mob.lunge = .42; }
        else if (mob.lunge > 0) { mob.lunge -= dt; moveAngle = mob.lungeAngle; moveSpeed = mob.speed * 3.6; }
        else if (mob.lungeClock <= 0 && dist < 300) { mob.lungeWarn = .45; mob.lungeAngle = angle; mob.lungeClock = 2.4 + rng() * 1.4; }
      }
      mob.draining = mob.type === "LEECH" && dist < 120;
      if (mob.draining) energy = Math.max(0, energy - 9 * dt);
      mob.x += Math.cos(moveAngle) * moveSpeed * dt; mob.y += Math.sin(moveAngle) * moveSpeed * dt; mob.rotation += dt * (mob.type === "SPOOF" ? 1.5 : -.9);
      if (dist < player.radius + mob.radius + (pilotDashTimer > 0 ? 10 : 0)) {
        if (pilotDashTimer > 0) { // dash-strike: ramming through small enemies breaks them
          mob.hp -= 3; mob.hit = .1;
          if (mob.hp <= 0) { killEnemy(i, mob.type === "ELITE" ? 220 : mob.type === "SPOOF" ? 90 : mob.type === "LEECH" ? 105 : 60, enemyColor(mob.type)); floatText(player.x, player.y - 30, tr("RAM!", "撞碎！"), "#f3e3b3", 15); continue; }
          continue;
        }
        if (collisionClock <= 0) { damagePlayer(); collisionClock = .55; }
        mob.x -= Math.cos(angle) * 38 * dt; mob.y -= Math.sin(angle) * 38 * dt;
      }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i]; bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt; bullet.life -= dt;
      if (bullet.life <= 0 || bullet.x < 0 || bullet.y < 0 || bullet.x > WIDTH || bullet.y > HEIGHT) { bullets.splice(i, 1); continue; }
      let consumed = false;
      for (let b = bosses.length - 1; b >= 0; b--) {
        const boss = bosses[b]; if (boss.enter > 0 || bullet.hits.has(boss.id)) continue;
        if (Math.hypot(bullet.x - boss.x, bullet.y - boss.y) < boss.radius + 4) {
          boss.hp -= bullet.damage; boss.hit = .07; spark(bullet.x, bullet.y, boss.type.color, 3, .6); sfx("hit"); fx3d("boss-hit", { x: bullet.x, y: bullet.y, color: boss.type.color, angle: Math.atan2(bullet.vy, bullet.vx) });
          if (bullet.pierce > 0) { bullet.pierce--; bullet.hits.add(boss.id); } else { bullets.splice(i, 1); consumed = true; }
          if (boss.hp <= 0) defeatBoss(b);
          break;
        }
      }
      if (consumed) continue;
      for (let e = enemies.length - 1; e >= 0; e--) {
        const mob = enemies[e]; if (bullet.hits.has(mob.id) || Math.hypot(bullet.x - mob.x, bullet.y - mob.y) > mob.radius + 5) continue;
        mob.hp -= bullet.damage; mob.hit = .09; bullet.hits.add(mob.id);
        // tiny knockback sells the impact
        mob.x += bullet.vx / 560 * 5; mob.y += bullet.vy / 560 * 5;
        if (mob.hp <= 0) killEnemy(e, mob.type === "ELITE" ? 220 : mob.type === "SPOOF" ? 90 : mob.type === "LEECH" ? 105 : 60, enemyColor(mob.type));
        else { spark(bullet.x, bullet.y, enemyColor(mob.type), 3, .5); sfx("hit"); fx3d("hit", { x: bullet.x, y: bullet.y, color: enemyColor(mob.type), angle: Math.atan2(bullet.vy, bullet.vx) }); }
        if (bullet.pierce > 0) bullet.pierce--; else { bullets.splice(i, 1); break; }
      }
    }

    for (let i = hostileShots.length - 1; i >= 0; i--) { const shot = hostileShots[i]; shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt; if (shot.life <= 0 || shot.x < -15 || shot.y < -15 || shot.x > WIDTH + 15 || shot.y > HEIGHT + 15) { hostileShots.splice(i, 1); continue; } const sd = Math.hypot(player.x - shot.x, player.y - shot.y); if (sd < player.radius + shot.radius) { hostileShots.splice(i, 1); damagePlayer(); continue; } if (!shot.grazed && sd < player.radius + shot.radius + 18 && invulnerable <= 0) { shot.grazed = true; grazeCount++; fx3d("graze", { x: shot.x, y: shot.y }); energy = Math.min(100, energy + 6); gainScore(10); spark(shot.x, shot.y, "#f3e3b3", 4, .5); if (grazeCount % 3 === 1) floatText(player.x + 26, player.y - 20, tr("GRAZE", "擦弹"), "#f3e3b3", 12); } }
    for (let i = drops.length - 1; i >= 0; i--) {
      const drop = drops[i]; drop.life -= dt; const d = Math.hypot(player.x - drop.x, player.y - drop.y);
      const magnet = magnetTimer > 0 && !drop.power ? 2000 : owns("magnet") ? 125 : 46;
      if (d < magnet && d > 1) { const pull = magnetTimer > 0 ? 520 : owns("magnet") ? 150 : 90; drop.x += (player.x - drop.x) / d * pull * dt; drop.y += (player.y - drop.y) / d * pull * dt; }
      if (drop.life <= 0) { drops.splice(i, 1); continue; }
      if (drop.power && d < 30) {
        if (drop.power === "rapid") { rapidTimer = 6; showToast(tr("RAPID FIRE · 6 SEC", "连射 · 6 秒")); }
        else if (drop.power === "shield") { shieldUp = true; showToast(tr("SHIELD UP · BLOCKS ONE HIT", "护盾 · 抵挡一次伤害")); }
        else { magnetTimer = 6; showToast(tr("MAGNET · ALL SHARDS INCOMING", "磁吸 · 吸取全部星屑")); }
        shockwave(drop.x, drop.y, "#f3e3b3", 60, .4, 4); spark(drop.x, drop.y, "#f3e3b3", 14); sfx("power"); fx3d("power", { x: drop.x, y: drop.y }); drops.splice(i, 1); continue;
      }
      if (drop.power) continue;
      if (d < (owns("magnet") ? 36 : 23)) {
        const points = drop.cache ? 260 : 30;
        gainScore(points); energy = Math.min(100, energy + (drop.cache ? 55 : 23)); if (drop.cache) health = Math.min(maxHealth, health + 1);
        spark(drop.x, drop.y, drop.cache ? "#f3e3b3" : "#7fe0c5", drop.cache ? 22 : 10); shockwave(drop.x, drop.y, drop.cache ? "#f3e3b3" : "#7fe0c5", drop.cache ? 60 : 32, .35, 2);
        floatText(drop.x, drop.y - 14, `+${points}`, drop.cache ? "#d8b468" : "#f3e3b3", drop.cache ? 18 : 12);
        sfx(drop.cache ? "power" : "pickup"); fx3d("pickup", { x: drop.x, y: drop.y, cache: !!drop.cache }); drops.splice(i, 1);
      }
    }
    energy = Math.min(100, energy + dt * (owns("ion") ? .35 : .28));
  }

  let hudClock = 0;
  const arenaPage = document.getElementById("page-arena");
  function frame(time) {
    let dt = Math.min(.035, (time - lastFrame) / 1000 || 0); lastFrame = time;
    // Off the arena page the run is paused: skip simulation, HUD writes and rendering entirely so other modes get a clean frame budget.
    if (arenaPage && !arenaPage.classList.contains("active") && state !== "playing") { requestAnimationFrame(frame); return; }
    // Hit-stop: freeze the simulation for a few frames on big impacts.
    if (hitStop > 0) { hitStop -= dt; updateFx(dt * .25); }
    else { update(dt); updateFx(dt); }
    hudClock += dt; if (hudClock > .08 || state !== "playing") { hudClock = 0; updateHud(); }
    // The arena only renders while its page is on screen, so the pilot campaign and menus get the whole GPU budget.
    const arenaVisible = !arenaPage || arenaPage.classList.contains("active");
    if (arenaVisible) { if (shake > 0 && !use3D) { const k = Math.min(1, shake * 4) * 9; ctx.save(); ctx.translate((Math.random() - .5) * k, (Math.random() - .5) * k); draw(); ctx.restore(); } else draw(); }
    requestAnimationFrame(frame);
  }

  function pauseRun(kicker = "RUN PAUSED") {
    if (state !== "playing") return;
    state = "paused"; input.clear(); touchStick = null; setOverlayMode("paused");
    $("modalKicker").textContent = tr(kicker, "已暂停"); $("modalTitle").textContent = tr("The forge is holding.", "熔炉还撑得住。"); $("modalCopy").textContent = tr("Resume when you return to the arena.", "回到竞技场后即可继续。");
    $("mainAction").textContent = tr("RESUME RUN", "继续挑战"); $("mainAction").hidden = false; $("overlay").classList.remove("off");
  }
  function resumeRun() { if (state !== "paused") return; state = "playing"; $("overlay").classList.add("off"); lastFrame = performance.now(); }

  document.addEventListener("keydown", (event) => {
    const arenaOpen = $("page-arena").classList.contains("active");
    if (!arenaOpen) return;
    const typing = event.target instanceof HTMLInputElement;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code) && !typing) event.preventDefault();
    if ((event.code === "Escape" || event.code === "KeyP") && !event.repeat && !typing) { if (state === "playing") pauseRun(); else if (state === "paused") resumeRun(); return; }
    if (state === "upgrade" && /^Digit[1-3]$/.test(event.code)) { const pick = selectedReward[Number(event.code.slice(5)) - 1]; if (pick) takeUpgrade(pick.id); return; }
    if ((event.code === "Enter") && !typing && (state === "menu" || state === "over")) { $("mainAction").click(); return; }
    if (event.code === "KeyB" && !event.repeat) { activatePulse(); return; }
    if ((event.code === "ShiftLeft" || event.code === "ShiftRight") && !event.repeat) { activatePilotDash(); return; }
    if (state === "playing") input.add(event.code);
  });
  document.addEventListener("keyup", (event) => input.delete(event.code));
  window.addEventListener("blur", () => { input.clear(); touchStick = null; });

  // Touch / pen: drag anywhere on the playfield as a floating joystick; the ship auto-fires while you steer.
  const arenaWrap = canvas.parentElement;
  arenaWrap.addEventListener("pointerdown", (event) => {
    if (state !== "playing" || event.target !== canvas) return;
    if (event.pointerType === "mouse") { input.add("Space"); return; }
    event.preventDefault(); canvas.setPointerCapture?.(event.pointerId);
    touchStick = { id: event.pointerId, ox: event.clientX, oy: event.clientY, dx: 0, dy: 0 };
  });
  arenaWrap.addEventListener("pointermove", (event) => {
    if (!touchStick || event.pointerId !== touchStick.id) return;
    const rect = canvas.getBoundingClientRect(), scale = WIDTH / rect.width;
    const vx = (event.clientX - touchStick.ox) * scale, vy = (event.clientY - touchStick.oy) * scale, len = Math.hypot(vx, vy);
    const dead = 10, full = 70;
    if (len < dead) { touchStick.dx = touchStick.dy = 0; return; }
    const k = Math.min(1, (len - dead) / (full - dead)) / len;
    touchStick.dx = vx * k; touchStick.dy = vy * k;
    if (len > full) { touchStick.ox = event.clientX - vx / len * full / scale; touchStick.oy = event.clientY - vy / len * full / scale; }
  });
  for (const name of ["pointerup", "pointercancel"]) arenaWrap.addEventListener(name, (event) => { if (touchStick && event.pointerId === touchStick.id) touchStick = null; });
  window.addEventListener("pointerup", (event) => { if (event.pointerType === "mouse") input.delete("Space"); });
  document.querySelectorAll("[data-key]").forEach((button) => {
    const key = button.dataset.key;
    button.addEventListener("pointerdown", (event) => { event.preventDefault(); if (key === "KeyB") activatePulse(); else if (key === "ShiftLeft") activatePilotDash(); else input.add(key); });
    for (const name of ["pointerup", "pointerleave", "pointercancel"]) button.addEventListener(name, (event) => { event.preventDefault(); input.delete(key); });
  });
  $("mainAction").addEventListener("click", () => { if (state === "over" || state === "menu") { setOverlayMode("menu"); beginRun(); } });
  $("callsign").addEventListener("change", () => { profile.callsign = cleanCallsign($("callsign").value); persist(); syncProfile(); });
  $("boardName").addEventListener("change", () => { profile.callsign = cleanCallsign($("boardName").value); persist(); syncProfile(); });
  $("langToggle").addEventListener("click", () => {
    language = language === "en" ? "zh" : "en";
    store.set(LANGUAGE_KEY, language);
    hudCache.clear();
    applyLocale(); loadBoard(); applyOfflineChrome();
    if (state === "upgrade") renderUpgradeChoices(); else if (state !== "over") createRigOptions();
    window.dispatchEvent(new CustomEvent("signal-language", { detail: language }));
  });
  window.addEventListener("resize", resizeCanvas);
  document.addEventListener("visibilitychange", () => { if (document.hidden) pauseRun(); });
  $("mainAction").addEventListener("click", resumeRun);
  $("pauseToggle").addEventListener("click", () => { if (state === "playing") pauseRun(); else if (state === "paused") resumeRun(); });
  const syncSound = () => { const muted = !!window.SFX?.muted; $("soundToggle").setAttribute("aria-pressed", String(muted)); $("soundToggle").setAttribute("aria-label", muted ? "Sound off" : "Sound on"); $("soundToggle").classList.toggle("muted", muted); };
  $("soundToggle").addEventListener("click", () => { window.SFX?.toggle(); syncSound(); });
  window.addEventListener("sfx-change", syncSound);
  setTimeout(syncSound, 0);
  // Appearance: follows the system until the player picks; the choice is shared with the landing page.
  function currentTheme() { return document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); }
  $("themeToggle").addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("signal-theme", next); } catch {}
    sfx("ui");
  });

  document.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll(".page").forEach((page) => page.classList.remove("active"));
    document.querySelectorAll("[data-page]").forEach((nav) => nav.classList.toggle("active", nav === button));
    $(`page-${button.dataset.page}`).classList.add("active");
    if (button.dataset.page !== "arena") pauseRun("FLIGHT PAUSED");
    if (window.scrollY > 0) window.scrollTo(0, 0);
    if (button.dataset.page === "boardpage") loadBoard();
    if (["shop","squad","maps","achievements","hangar"].includes(button.dataset.page)) loadProfile();
    if (button.dataset.page === "squad") refreshRaid();
  }));
  document.querySelectorAll("[data-goto]").forEach((button) => button.addEventListener("click", () => document.querySelector(`[data-page="${button.dataset.goto}"]`)?.click()));
  // Public hooks for the token layer (forge-economy.js). Everything here is optional.
  window.ForgeGame = {
    startMode(opts) { if (state === "playing") return false; pendingMode = opts || null; document.querySelector('[data-page="arena"]')?.click(); setOverlayMode("menu"); beginRun(); return true; },
    refreshProfile() { loadProfile?.(); },
    isPlaying() { return state === "playing"; },
  };
  function openHashPage() {
    const route = { hangar: "hangar", sectors: "maps", leaderboard: "boardpage" }[location.hash.slice(1)];
    if (route) document.querySelector(`[data-page="${route}"]`)?.click();
  }
  window.addEventListener("hashchange", openHashPage);
  window.addEventListener("load", openHashPage, { once: true });
  $("saveCallsign").addEventListener("click", async () => {
    const callsign = cleanCallsign($("profileCallsign").value);
    if (!ONLINE) { profile.callsign = callsign; if (serverProfile?.guest) { serverProfile.callsign = callsign; saveGuestProfile(); } persist(); syncProfile(); drawLocalBoard(); showToast(tr("Callsign saved", "代号已保存")); return; }
    try { const response = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "callsign", callsign }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); profile.callsign = callsign; persist(); syncProfile(); showToast("Callsign synced"); }
    catch(error) { showToast(error.message || "Could not save callsign"); }
  });
  $("copyRef").addEventListener("click", async () => { try { await navigator.clipboard.writeText($("refLink").textContent); showToast("Referral link copied"); } catch { showToast("Select and copy your link"); } });
  $("createRoom").addEventListener("click", async () => {
    try { const body = await raidAction("room-create"); raidCode = body.code; $("roomInvite").hidden = false; $("roomInvite").textContent = tr(`RAID CODE: ${raidCode} · CLICK TO COPY`, `突袭代码：${raidCode} · 点击复制`); $("roomInvite").onclick = () => navigator.clipboard.writeText(raidCode); await refreshRaid(); showToast(`${tr("Raid","突袭")} ${raidCode} ${tr("created","已创建")}`); }
    catch(error) { showToast(error.message); }
  });
  $("joinRoom").addEventListener("click", async () => {
    try { const code = $("joinCode").value.trim().toUpperCase(); await raidAction("room-join", { code }); raidCode = code; await refreshRaid(); showToast(`Joined raid ${raidCode}`); }
    catch(error) { showToast(error.message); }
  });
  $("raidAttack").addEventListener("click", async () => {
    try { await raidAction("room-hit", { code: raidCode, damage: 120 + Math.floor(Math.random() * 61) }); await refreshRaid(); await loadProfile(); }
    catch(error) { showToast(error.message); }
  });
  setInterval(refreshRaid, 2500);

  if ($("daylabel")) $("daylabel").textContent = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", timeZone: "UTC" }).toUpperCase();
  $("modalSeed").textContent = `SECTOR ${String(dayNo % 999 + 1).padStart(3, "0")}`;
  function renderLedger() {
    const box = document.querySelector(".prizes"); if (!box || ONLINE) return;
    const g = serverProfile || {};
    const rows = [[tr("Runs flown", "飞行局数"), g.totalRuns || 0], [tr("Bosses broken", "击败首领"), g.totalBosses || 0], [tr("Enemies down", "击败敌人"), g.totalKills || 0], [tr("Highest level", "最高等级"), g.highestLevel || 1], [tr("Coins", "金币"), g.credits || 0]];
    box.innerHTML = rows.map(([k, v]) => `<div class="ledger-row"><span>${k}</span><b>${Number(v).toLocaleString()}</b></div>`).join("");
    const head = box.parentElement?.querySelector(".card-head");
    if (head) { const h = head.querySelector("h3"); h.removeAttribute("data-locale"); h.textContent = tr("Pilot ledger", "飞行员账本"); head.querySelector("small").textContent = tr("THIS DEVICE", "本设备"); }
  }
  function applyOfflineChrome() {
    if (ONLINE) return;
    document.querySelector('[data-page="squad"]')?.setAttribute("hidden", "");
    document.querySelector('[data-page="rewards"]')?.setAttribute("hidden", "");
    renderLedger();
    if ($("boardPageState")) $("boardPageState").textContent = tr("THIS DEVICE", "本设备");
    if ($("boardEyebrow")) $("boardEyebrow").textContent = tr("PILOT RECORD", "飞行记录");
    const dbest = document.querySelector('[data-locale="dailyBest"]'); if (dbest) { dbest.dataset.en = "Ten best runs"; dbest.textContent = tr("Ten best runs", "十次最佳"); }
    const bt = document.querySelector('[data-locale="boardTitle"]'); if (bt) { bt.dataset.en = "Personal bests"; bt.textContent = tr("Personal bests", "个人最佳"); }
    const tl = document.querySelector('[data-locale="todayLeaders"]'); if (tl) { tl.dataset.en = "Your top ten runs"; tl.textContent = tr("Your top ten runs", "你的前十成绩"); }
    const db = document.querySelector('[data-locale="dailyBoard"]'); if (db) { db.dataset.en = "Your best runs"; db.textContent = tr("Your best runs", "你的最佳成绩"); }
    document.querySelectorAll(".leader-full .card-head small").forEach((el) => { el.textContent = tr("SAVED ON THIS DEVICE", "保存在本设备"); });
    const dbt = document.querySelector('[data-locale="dailyBestText"]'); if (dbt) { dbt.dataset.en = "Your ten best runs are kept on this device. Coins are earned after every completed run."; dbt.textContent = tr(dbt.dataset.en, "你的十次最佳成绩保存在本设备。每完成一局都能获得金币。"); }
  }
  applyOfflineChrome();
  use3D = !!(window.Forge3D && window.Forge3D.init && !/[?&]flat\b/.test(location.search) && window.Forge3D.init(canvas.parentElement));
  if (use3D) document.documentElement.classList.add("arena-3d");
  setOverlayMode("menu"); applyLocale(); createRigOptions(); syncProfile(); resizeCanvas(); updateHud(); drawBoard(); loadBoard(); profileReadyPromise=loadProfile(); openHashPage(); requestAnimationFrame((time) => { openHashPage(); frame(time); });
})();
