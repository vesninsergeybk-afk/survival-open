/**
 * Four deliberately authored, deterministic campaign spaces.
 * Coordinates are relative to the player's launch point; all rocks remain
 * destructible through the existing world-obstacle physics and rewards.
 * No network requests, WebGL, or new runtime dependencies.
 */
const SCENES = {
    1: {
        name:'Первая искра',sub:'Операция «Цепь света» — запустить и удержать три маяка',
        tint:'#6ce4f8',secondary:'#a88fff',
        // The three defense outposts form a compact final siege triangle.
        // Their turrets are real FriendlyBases equipment, not background art.
        stations:[
            {dx:-300,dy:-120,type:'dock',name:'Стартовая верфь «Луч»'},
            {dx:2380,dy:-405,type:'outpost',name:'Бастион «Север»'},
            {dx:2620,dy:390,type:'outpost',name:'Бастион «Юг»'},
            {dx:3100,dy:-60,type:'outpost',name:'Бастион «Восток»'}
        ],
        props:[
            {id:'beacon-1',dx:660,dy:-250,type:'beacon',name:'Маяк «Альфа»'},
            {id:'beacon-2',dx:1730,dy:130,type:'beacon',name:'Маяк «Бета»'},
            {id:'beacon-3',dx:2710,dy:-40,type:'beacon',name:'Маяк «Гамма»'},
            {id:'cache-a',dx:160,dy:290,type:'cache',name:'Контейнер с ломом'},
            {id:'cache-b',dx:970,dy:330,type:'cache',name:'Разбитый склад верфи'},
            {id:'cache-c',dx:1480,dy:-360,type:'cache',name:'Капсула геологов'},
            {id:'cache-d',dx:2080,dy:420,type:'cache',name:'Аварийная батарея'},
            {id:'cache-e',dx:2830,dy:500,type:'cache',name:'Резерв оборонной сети'},
            {id:'cache-f',dx:3100,dy:-485,type:'cache',name:'Арсенал последнего рубежа'}
        ],
        // Long, visually differentiated route with real cover and side quests.
        platforms:[
            {dx:-500,dy:-190,angle:-.24,length:440,width:115},
            {dx:560,dy:-265,angle:.16,length:310,width:95},
            {dx:1380,dy:-160,angle:-.38,length:280,width:88},
            {dx:1830,dy:190,angle:.38,length:380,width:110},
            {dx:2470,dy:-260,angle:-.18,length:420,width:106},
            {dx:2740,dy:250,angle:.35,length:460,width:122},
            {dx:3110,dy:-140,angle:-.3,length:430,width:105}
        ],
        // Three memorable districts: abandoned dockyard, ion-link ruins,
        // and the fortified Gamma crown. Background silhouettes have no
        // collision and remain clearly separate from shootable obstacles.
        landmarks:[
            {id:'drydock',kind:'dockyard',dx:-510,dy:-455,span:365,angle:-.23,onAt:0},
            {id:'broken-arch',kind:'arch',dx:390,dy:415,span:300,angle:.20,onAt:1},
            {id:'ion-array',kind:'relay',dx:1110,dy:-615,span:335,angle:-.15,onAt:1},
            {id:'split-array',kind:'relay',dx:2130,dy:595,span:325,angle:.29,onAt:2},
            {id:'gamma-crown',kind:'bastion',dx:2750,dy:10,span:405,angle:0,onAt:3},
            {id:'outer-yard',kind:'dockyard',dx:3400,dy:-525,span:285,angle:.35,onAt:3}
        ],
        // Large setpieces are genuine locally bundled GLBs. Small mobile
        // selection is intentional; near-camera culling remains in Hybrid3D.
        scenery3d:[
            {id:'dock-crane',model:19192,dx:-810,dy:-470,span:205,yaw:-.3,tint:'#809db6',mobile:true,onAt:0},
            {id:'dock-depot',model:19193,dx:-590,dy:390,span:175,yaw:.2,tint:'#708fa1',onAt:0},
            {id:'dock-hull',model:19194,dx:50,dy:-545,span:188,yaw:.5,tint:'#91a6ba',onAt:0},
            {id:'alpha-array',model:19178,dx:330,dy:-600,span:160,yaw:.15,tint:'#7eabbf',mobile:true,onAt:1},
            {id:'alpha-sensor',model:19167,dx:985,dy:255,span:104,yaw:-.4,tint:'#82b4b9',onAt:1},
            {id:'ion-coupler',model:19203,dx:1170,dy:-700,span:200,yaw:.5,tint:'#8aa6c7',onAt:1},
            {id:'beta-platform',model:19194,dx:1450,dy:530,span:200,yaw:-.6,tint:'#9ba3c9',onAt:2},
            {id:'beta-vault',model:19189,dx:2030,dy:-550,span:205,yaw:.2,tint:'#8c98c9',mobile:true,onAt:2},
            {id:'beta-tank',model:19168,dx:2190,dy:560,span:125,yaw:.7,tint:'#97aec4',onAt:2},
            {id:'gamma-defense',model:19189,dx:2480,dy:-800,span:215,yaw:0,tint:'#83c4c6',mobile:true,onAt:3},
            {id:'gamma-crane',model:19192,dx:3190,dy:455,span:185,yaw:-.3,tint:'#8caec1',onAt:3},
            {id:'outer-depot',model:19193,dx:3410,dy:-580,span:190,yaw:.3,tint:'#92abb7',onAt:3}
        ],
        lights:[[-460,-260,490,'#3d98ac'],[660,-250,390,'#2aa4a3'],
            [1370,-280,590,'#4650a6'],[1730,130,460,'#4fbeaf'],
            [2500,-310,660,'#7869cc'],[2910,240,680,'#209caa'],
            [3110,-180,570,'#54bcdf']]
    },
    2: {
        name:'Каменный пролив',sub:'Разлом между дрейфующими астероидами',
        tint:'#f5b46d',secondary:'#74ddfb',
        stations:[
            {dx:-680,dy:20,type:'dock',name:'Укрытие геологов'},
            {dx:1610,dy:-370,type:'arsenal',name:'Арсенал «Прометей»'}
        ],
        enemySites:[{id:'quarry',dx:4070,dy:460,name:'Форпост «Шлак»',hp:820,range:470}],
        props:[
            {id:'cache-a',dx:-280,dy:120,type:'cache',name:'Геологическая капсула'},
            {id:'cache-b',dx:630,dy:710,type:'cache',name:'Залежь энергоядер'},
            {id:'cache-c',dx:1450,dy:-790,type:'cache',name:'Резерв арсенала'},
            {id:'rig',dx:1870,dy:-370,type:'rig',name:'Самоходная буровая «Крот»'},
            {id:'route-direct',dx:2250,dy:-500,type:'route-choice',
                route:'direct',name:'Навигационный узел · Быстрый проход'},
            {id:'route-shelter',dx:2250,dy:120,type:'route-choice',
                route:'shelter',name:'Навигационный узел · Укрытия'},
            {id:'cache-d',dx:2560,dy:1050,type:'cache',name:'Запас буровых зарядов'},
            {id:'cache-e',dx:3500,dy:-410,type:'cache',name:'Заброшенный склад шахтёров'},
            {id:'cache-f',dx:4660,dy:1040,type:'cache',name:'Энергоблок карьера'},
            {id:'escape-gate',dx:5680,dy:-750,type:'gate',name:'Аварийный шлюз'}
        ],
        minerGoal:{dx:3230,dy:510},
        quarryFork:{dx:2080,dy:-210},
        quarryRoutes:{
            direct:[{dx:2480,dy:-170},{dx:2840,dy:180},{dx:3230,dy:510}],
            shelter:[{dx:2230,dy:380},{dx:2680,dy:770},{dx:3230,dy:510}]
        },
        platforms:[
            {dx:-860,dy:0,angle:-.1,length:300,width:110},
            {dx:1610,dy:-370,angle:.05,length:390,width:150},
            {dx:1870,dy:-370,angle:-.24,length:320,width:112},
            {dx:3230,dy:510,angle:.28,length:420,width:125},
            {dx:4070,dy:460,angle:-.32,length:510,width:150},
            {dx:4820,dy:320,angle:.45,length:310,width:92},
            {dx:5680,dy:-750,angle:-.22,length:570,width:158}
        ],
        // A hostile quarry should read as a journey across geological zones:
        // tectonic walls, the working mine, a slag refinery and the exit lock.
        landmarks:[
            {id:'rift-north',kind:'cliff',dx:320,dy:-640,span:500,angle:-.34,onAt:0},
            {id:'rift-south',kind:'cliff',dx:470,dy:780,span:455,angle:.28,onAt:0},
            {id:'miners-cradle',kind:'mine',dx:1870,dy:290,span:365,angle:.14,onAt:1},
            {id:'ore-spine',kind:'mine',dx:3100,dy:990,span:430,angle:-.3,onAt:2},
            {id:'slag-refinery',kind:'refinery',dx:4200,dy:-160,span:490,angle:-.25,onAt:2},
            {id:'exit-works',kind:'gateyard',dx:5410,dy:-1160,span:370,angle:.31,onAt:3}
        ],
        scenery3d:[
            {id:'rift-gantry',model:19192,dx:-1100,dy:-700,span:220,yaw:-.4,tint:'#bd9876',mobile:true,onAt:0},
            {id:'survey-outpost',model:19167,dx:-480,dy:780,span:155,yaw:.2,tint:'#8e9fa5',onAt:0},
            {id:'cliff-depot',model:19193,dx:710,dy:-650,span:175,yaw:.3,tint:'#b8a38d',onAt:0},
            {id:'ore-conveyor',model:19203,dx:1200,dy:600,span:240,yaw:-.4,tint:'#bf9975',mobile:true,onAt:1},
            {id:'miner-yard',model:19194,dx:2310,dy:-880,span:185,yaw:.5,tint:'#b9a88e',onAt:1},
            {id:'pressure-tank',model:19168,dx:2810,dy:-830,span:175,yaw:.1,tint:'#ba8d72',onAt:2},
            {id:'slag-frame',model:19192,dx:3500,dy:1160,span:270,yaw:-.6,tint:'#ad7769',mobile:true,onAt:2},
            {id:'refinery-vault',model:19189,dx:3830,dy:-260,span:210,yaw:.3,tint:'#b47864',onAt:2},
            {id:'slag-store',model:19193,dx:4670,dy:-550,span:200,yaw:-.2,tint:'#a68185',onAt:2},
            {id:'escape-telescope',model:19178,dx:5200,dy:190,span:225,yaw:.1,tint:'#78b7bd',mobile:true,onAt:3},
            {id:'exit-rigging',model:19190,dx:5530,dy:-1380,span:235,yaw:.32,tint:'#769da8',onAt:3}
        ],
        lights:[[-900,-330,390,'#78502b'],[320,370,490,'#b05d28'],
            [1530,-460,620,'#178bb1'],[2640,950,660,'#96582f'],
            [3440,320,540,'#a16138'],[4070,460,750,'#be603e'],
            [5050,320,650,'#704d99'],[5680,-750,730,'#317d96']]
    },
    3: {
        name:'Разорванная сеть',sub:'Кладбище ретрансляторов',
        tint:'#b29eff',secondary:'#6ef7df',
        stations:[
            {dx:-600,dy:-40,type:'dock',name:'Центральный док «Нить»'},
            {dx:1450,dy:-1230,type:'outpost',name:'Ретранслятор «Север»'},
            {dx:2670,dy:1320,type:'lab',name:'Лаборатория «Пульс»'},
            {dx:3910,dy:-1050,type:'outpost',name:'Резервный ретранслятор «Край», необязательный',optional:true}
        ],
        enemySites:[{id:'relay',dx:4840,dy:540,name:'Узел перехвата «Эхо»',hp:980,range:500}],
        props:[
            {id:'decoy',dx:3500,dy:-480,type:'decoy',name:'Неизвестный аварийный сигнал'},
            {id:'jammer',dx:4470,dy:900,type:'jammer',name:'Вражеский подавитель'},
            {id:'cache-a',dx:-190,dy:360,type:'cache',name:'Аварийный запас'},
            {id:'cache-b',dx:1120,dy:-1730,type:'cache',name:'Контейнер с деталями'},
            {id:'cache-c',dx:1960,dy:730,type:'cache',name:'Склад старой сети'},
            {id:'cache-d',dx:2950,dy:-220,type:'cache',name:'Груз аварийной связи'},
            {id:'cache-e',dx:3780,dy:-1490,type:'cache',name:'Резервные батареи'},
            {id:'cache-f',dx:4790,dy:1230,type:'cache',name:'Запас захваченного узла'}
        ],
        platforms:[
            {dx:-680,dy:-120,angle:.12,length:460,width:145},
            {dx:1450,dy:-1230,angle:-.4,length:420,width:125},
            {dx:2670,dy:1320,angle:.65,length:460,width:130},
            {dx:3910,dy:-1050,angle:.13,length:400,width:120},
            {dx:3500,dy:-480,angle:-.12,length:310,width:108},
            {dx:4470,dy:900,angle:.42,length:380,width:125},
            {dx:4840,dy:540,angle:-.2,length:460,width:160}
        ],
        // The ruined network consists of separated signal islands and an
        // increasingly threatening interception complex.
        landmarks:[
            {id:'dead-array',kind:'graveyard',dx:-350,dy:-520,span:405,angle:.11,onAt:0},
            {id:'north-spires',kind:'antenna',dx:1550,dy:-1700,span:370,angle:-.31,onAt:1},
            {id:'pulse-ring',kind:'lab',dx:2400,dy:1850,span:420,angle:.29,onAt:2},
            {id:'dead-ships',kind:'graveyard',dx:3900,dy:-1770,span:430,angle:.6,onAt:0},
            {id:'echo-fortress',kind:'citadel',dx:4600,dy:-50,span:510,angle:-.18,onAt:3}
        ],
        scenery3d:[
            {id:'dead-carrier',model:19194,dx:-920,dy:540,span:225,yaw:.4,tint:'#7673a1',mobile:true,onAt:0},
            {id:'silent-telescope',model:19178,dx:350,dy:-940,span:200,yaw:-.3,tint:'#8d91ba',onAt:0},
            {id:'north-observer',model:19167,dx:980,dy:-1860,span:160,yaw:.1,tint:'#799bb5',onAt:1},
            {id:'derelict-frame',model:19203,dx:2050,dy:-220,span:235,yaw:-.5,tint:'#7886aa',mobile:true,onAt:1},
            {id:'pulse-warehouse',model:19193,dx:2470,dy:2050,span:210,yaw:.4,tint:'#a198c5',onAt:2},
            {id:'broken-link',model:19190,dx:3170,dy:-550,span:195,yaw:.5,tint:'#9f8ac5',onAt:0},
            {id:'ghost-platform',model:19194,dx:3600,dy:-1800,span:210,yaw:-.2,tint:'#777ea5',onAt:0},
            {id:'reserve-telescope',model:19178,dx:4180,dy:-430,span:165,yaw:-.4,tint:'#9584b3',mobile:true,onAt:2},
            {id:'echo-vault',model:19189,dx:4860,dy:1450,span:220,yaw:.35,tint:'#9f6d9d',onAt:3},
            {id:'echo-frame',model:19192,dx:5160,dy:-140,span:220,yaw:-.25,tint:'#a56b9d',mobile:true,onAt:3}
        ],
        lights:[[-700,-150,520,'#385cd0'],[780,-780,750,'#3556a2'],
            [1450,-1230,700,'#1bb99f'],[2190,440,860,'#5858bc'],
            [2670,1320,800,'#8463e5'],[3500,-480,690,'#cb426a'],
            [3910,-1050,640,'#288fb0'],[4720,700,820,'#a74f8b']]
    },
    4: {
        name:'Путь через туманность',sub:'Эвакуация каравана сквозь ионный рукав',
        tint:'#76f5df',secondary:'#f3adff',
        stations:[
            {dx:-280,dy:-80,type:'dock',name:'Стартовый док «Пилигрим»'},
            {dx:1020,dy:-420,type:'outpost',name:'Реле «Аврора»'},
            {dx:2670,dy:760,type:'lab',name:'Реле «Вектор»'}
        ],
        convoyStart:{dx:-80,dy:-40},
        route:[
            {dx:1020,dy:-420,hold:70},
            {dx:2670,dy:760,hold:85},
            {dx:4800,dy:-180,hold:0}
        ],
        props:[
            {id:'exit-gate',dx:4800,dy:-180,type:'gate',name:'Врата эвакуации'},
            {id:'cache-a',dx:-185,dy:270,type:'cache',name:'Аварийный груз'},
            {id:'cache-b',dx:820,dy:-760,type:'cache',name:'Ремонтная капсула'},
            {id:'cache-c',dx:1980,dy:280,type:'cache',name:'Склад ионных катушек'},
            {id:'cache-d',dx:3410,dy:1050,type:'cache',name:'Станция аварийной связи'},
            {id:'cache-e',dx:4430,dy:240,type:'cache',name:'Запас защитных пластин'}
        ],
        platforms:[
            {dx:-355,dy:-110,angle:-.12,length:400,width:145},
            {dx:1020,dy:-420,angle:-.29,length:440,width:125},
            {dx:2670,dy:760,angle:.4,length:460,width:135},
            {dx:4800,dy:-180,angle:-.32,length:630,width:160},
            {dx:1900,dy:150,angle:.7,length:280,width:86},
            {dx:3540,dy:420,angle:-.25,length:320,width:92},
            {dx:4200,dy:-830,angle:.32,length:270,width:94}
        ],
        // Escort lane has three different horizons: cargo docks, turbulent
        // ion fields, then the enormous abandoned evacuation arch.
        landmarks:[
            {id:'pilgrim-docks',kind:'cargo',dx:-520,dy:580,span:365,angle:-.2,onAt:0},
            {id:'ion-storm-west',kind:'storm',dx:690,dy:620,span:440,angle:.4,onAt:0},
            {id:'ion-storm-east',kind:'storm',dx:2180,dy:-690,span:495,angle:-.32,onAt:1},
            {id:'last-wrecks',kind:'wreck',dx:3470,dy:1280,span:435,angle:.1,onAt:2},
            {id:'evacuation-ring',kind:'evac',dx:4800,dy:-820,span:515,angle:.1,onAt:3}
        ],
        scenery3d:[
            {id:'pilgrim-crane',model:19192,dx:-580,dy:410,span:195,yaw:-.3,tint:'#7faeaf',mobile:true,onAt:0},
            {id:'cargo-depot',model:19193,dx:390,dy:-820,span:215,yaw:.1,tint:'#7f9eaa',onAt:0},
            {id:'storm-sensor',model:19167,dx:880,dy:270,span:170,yaw:.15,tint:'#7da6bd',onAt:1},
            {id:'storm-bridge',model:19203,dx:1580,dy:-970,span:225,yaw:-.25,tint:'#9d91c5',mobile:true,onAt:1},
            {id:'ion-vault',model:19189,dx:2140,dy:1150,span:200,yaw:.4,tint:'#927ab7',onAt:1},
            {id:'vector-tank',model:19168,dx:2850,dy:-30,span:180,yaw:-.3,tint:'#a08abb',onAt:2},
            {id:'drift-platform',model:19194,dx:3360,dy:-450,span:210,yaw:.2,tint:'#838bae',mobile:true,onAt:2},
            {id:'wreck-depot',model:19193,dx:3960,dy:780,span:200,yaw:-.1,tint:'#928ab1',onAt:2},
            {id:'evac-telescope',model:19178,dx:4610,dy:-670,span:185,yaw:.45,tint:'#77a7bc',mobile:true,onAt:3},
            {id:'evac-frame',model:19190,dx:5140,dy:320,span:235,yaw:-.4,tint:'#79afba',onAt:3}
        ],
        lights:[[-160,-430,520,'#2b86a0'],[920,-470,490,'#35c9b7'],
            [1890,360,600,'#5c48ab'],[2740,720,560,'#a04ec4'],
            [3620,-270,650,'#514c9f'],[4800,-180,720,'#2372c4']]
    }
};
export function getMissionScene(index) {return SCENES[index] || null;}
const frac = x => {const v=Math.sin(x*127.1+78.2)*43758.5453;return v-Math.floor(v);};
export function makeMissionAsteroids(index,cx,cy) {
    const rocks=[];
    function add(dx,dy,rad=23,tag='field',special=false,volatile=false){
        // The collision radius corresponds to the actual sprite footprint.
        // Eight CC0 silhouettes, chosen deterministically for each mission.
        // Amber reactor shells stay recognizable before their detonation.
        const skins=['meteorGrey1','meteorBrown2','meteorGrey3','meteorBrown4',
            'meteorGrey2','meteorBrown1','meteorGrey4','meteorBrown3'];
        const sheet=volatile?'meteorBrown4':special?'meteorGrey3':
            skins[(rocks.length*5+index*3)%skins.length];
        const radius=Math.round(rad);
        const hp=special?205:volatile?74:Math.round(28+radius*2.1);
        rocks.push({id:'mission'+index+':'+tag+':'+rocks.length,x:cx+dx,y:cy+dy,
            sheet,scale:radius/29,radius,hp,maxHp:hp,destroyed:false,
            mass:special?17000:900+radius*radius*3,
            vx:0,vy:0,spin:0,rotation:frac(dx*.1+dy*.7)*Math.PI*2,
            missionSeal:special,missionVolatile:volatile,detonated:false});
    }
    const STATION_CROSS=9, STATION_BRIDGE=8;
    if(index===1){
        // Broken construction ring with safe approaches to the dock and beacon.
        for(let i=0;i<42;i++){
            const angle=i*Math.PI*2/42;
            const radius=690+55*Math.sin(i*1.9);
            if(Math.abs(angle-Math.PI*1.9)<.17)continue;
            add(Math.cos(angle)*radius+80,Math.sin(angle)*radius-10,
                16+Math.floor(frac(i+2)*17),'wreckage');
        }
        for(let i=0;i<22;i++){
            const angle=i*2.39996;
            const r=220+i%6*67;
            const dx=Math.cos(angle)*r+160,dy=Math.sin(angle)*r+25;
            if(Math.hypot(dx+260,dy+100)>150 && Math.hypot(dx-630,dy+245)>150)
                add(dx,dy,13+Math.floor(frac(i*19)*12),'debris');
        }
        // Dense breakable islands create cover, mining detours and navigable
        // gaps between beacons, while the direct signal route stays readable.
        const clusters=[
            [1020,-620,26],[1230,560,23],[1690,-640,26],
            [2160,590,28],[2470,-760,27],[3270,620,28]
        ];
        clusters.forEach(([ox,oy,count],j)=>{
            for(let i=0;i<count;i++){
                const a=i*2.399963+j*.31;
                const d=80+(i%5)*44+frac(i*7+j)*18;
                const x=ox+Math.cos(a)*d,y=oy+Math.sin(a)*d;
                if(Math.hypot(x-660,y+250)<190 ||
                    Math.hypot(x-1730,y-130)<190 ||
                    Math.hypot(x-2710,y+40)<200)continue;
                add(x,y,15+Math.floor(frac(i*13+j)*18),'belt');
            }
        });
    } else if(index===2){
        // Two continuous, breakable canyon walls; alternative passages skirt
        // either ridge, while a shorter central shortcut is blocked by ore.
        for(let side of [-1,1])for(let i=0;i<48;i++){
            const x=-1120+i*48,edge=side*(305+55*Math.sin(x*.006));
            add(x,edge+side*(frac(i*11+side)*27-13),
                24+Math.floor(frac(i*3.7+side)*9),'ridge');
            if(i%3===0)add(x+19,edge+side*(70+frac(i)*30),
                18+Math.floor(frac(i*7.3)*10),'ridge');
        }
        for(let i=0;i<7;i++){
            const y=(i-3)*46;
            add(270+Math.sin(i*1.4)*13,y,30,'seal',true);
        }
        for(let i=0;i<24;i++){
            const angle=i*2.39996,r=420+i%5*106;
            const x=Math.cos(angle)*r,y=Math.sin(angle)*r;
            if(Math.abs(y)>440)add(x,y,16+Math.floor(frac(i)*18),'ore');
        }
        // Separated mining basins give the expedition identifiable landmarks.
        // Leave the burrower's direct route clear of collision rocks.
        const basins=[[1650,620],[2210,-1040],[2920,1290],[3790,-720],
            [4470,1250],[5310,440]];
        basins.forEach(([ox,oy],j)=>{
            for(let i=0;i<30;i++){
                const a=i*2.399963+j*.3,r=115+(i%6)*52;
                const x=ox+Math.cos(a)*r,y=oy+Math.sin(a)*r;
                const f=Math.max(0,Math.min(1,((x-1870)*1360+(y+370)*880)/
                    (1360*1360+880*880)));
                const distanceToRig=Math.hypot(x-(1870+1360*f),y-(-370+880*f));
                if(distanceToRig<190 || Math.hypot(x-4070,y-460)<210)continue;
                add(x,y,15+Math.floor(frac(i*13+j)*17),'quarry-island');
            }
        });
    } else if(index===3){
        // Disconnected islands of debris surround the three power stations.
        const centers=[[-550,-350],[850,-820],[1450,-1770],[2110,700],
            [2670,1760],[3500,-480],[3910,-1460],[4600,1150]];
        centers.forEach(([ox,oy],j)=>{
            for(let i=0;i<23;i++){
                const angle=i*Math.PI/8,dist=165+(i%4)*39;
                add(ox+Math.cos(angle)*dist,oy+Math.sin(angle)*dist,
                    15+Math.floor(frac(j*43+i)*17),'graveyard');
            }
        });
    } else if(index===4){
        // Side islands form a richly layered passage. The main convoy lane
        // stays clear except for two deliberately breakable wreck barriers.
        const route=[[-80,-40],...[...SCENES[4].route].map(p=>[p.dx,p.dy])];
        const segmentDistance=(x,y,a,b)=>{
            const vx=b[0]-a[0],vy=b[1]-a[1];
            const f=Math.max(0,Math.min(1,((x-a[0])*vx+(y-a[1])*vy)/(vx*vx+vy*vy)));
            return Math.hypot(x-a[0]-vx*f,y-a[1]-vy*f);
        };
        for(const [j,[ox,oy]] of [[-350,610],[420,-760],[1150,580],[1910,-840],
            [2630,1300],[3370,-360],[4100,730],[5080,-740]].entries()){
            for(let i=0;i<23;i++){
                const a=i*2.399963+frac(j*31+i)*.27;
                const r=95+(i%5)*57+frac(i*13+j)*35;
                const x=ox+Math.cos(a)*r,y=oy+Math.sin(a)*r;
                if(route.some((v,k)=>k>0&&segmentDistance(x,y,route[k-1],v)<175))continue;
                add(x,y,16+Math.floor(frac(j*71+i)*21),'nebula-debris');
            }
        }
        const roadblocks=[[[410,-205],[468,-218]],[[1840,130],[1895,162]],
            [[3900,190],[3950,220]]];
        roadblocks.forEach((group,groupIndex)=>group.forEach(([dx,dy],j)=>{
            add(dx,dy,32,'route-block');
            const rock=rocks[rocks.length-1];
            rock.missionRoadblock=groupIndex+1;
            rock.missionHull=true;rock.missionHullPart=j?STATION_BRIDGE:STATION_CROSS;
            rock.hp=rock.maxHp=105;
            rock.mass=12000;
        }));
    }
    // Volatile reactor hulks are physical, shootable cover. Destroying them
    // causes an energy blast in the mission director; each position is authored.
    const cores=index===1?[[340,-270],[-650,330],[1240,-570],[2100,520],[3020,420]]:
        index===2?[[-240,-470],[500,470],[2480,-640],[3520,940],[4300,-310]]:
        index===3?[[-240,-270],[970,-1070],[2240,750],[3170,-940],[4310,1190]]:
        [[175,-590],[900,650],[1580,-430],[2300,430]];
    for(const [dx,dy] of cores)add(dx,dy,28,'reactor',false,true);
    // Genuine hull wrecks have asteroid-style collision, durability, and
    // salvage. The Wenrexa modular atlas supplies their shipyard geometry.
    const hulls=index===1?
        [[-870,185,35,10],[735,180,31,8],[970,-490,36,9],[245,-410,29,11],
            [1340,-310,34,8],[2020,-560,37,9],[2300,450,32,11],[3180,300,35,10]]:
        index===2?
        [[-505,-210,33,10],[-95,215,32,8],[710,165,36,9],[1040,155,32,11],
            [2190,480,34,10],[2880,-480,40,8],[3480,940,36,9],[4800,-260,33,11]]:
        index===3?[[ -335,-485,35,11],[650,-810,34,10],[1160,-1540,34,8],
            [2130,820,32,9],[2840,1690,34,11],[3420,170,37,9],
            [4120,-1350,38,8],[4700,1220,34,11]]:
        [[-510,290,39,10],[70,-510,36,11],[810,-570,38,8],[910,460,36,9],
            [1400,-440,41,10],[1790,550,36,8],[2020,-510,42,11],[2350,90,36,9]];
    for(const [dx,dy,r,part] of hulls){
        add(dx,dy,r,'hull');
        const rock=rocks[rocks.length-1];
        rock.missionHull=true;rock.missionHullPart=part;
        rock.hp=rock.maxHp=Math.round(85+r*3.1);
        rock.mass=1350+r*r*3;
    }
    // Guarantee room at launch and around critical station docking radii.
    const scene=getMissionScene(index);
    // The excavator's two authored tracks must actually be traversable.
    // Keep rocks beside the routes for cover; never let a random hull overlap
    // the carrier's chassis or the route-selection consoles.
    const quarryLanes=index===2?Object.values(scene.quarryRoutes).flatMap(path=>{
        const points=[{dx:1870,dy:-370},scene.quarryFork,...path];
        return points.slice(1).map((point,i)=>[points[i],point]);
    }):[];
    const nearQuarryLane=o=>quarryLanes.some(([a,b])=>{
        const vx=b.dx-a.dx,vy=b.dy-a.dy;
        const t=Math.max(0,Math.min(1,
            ((o.x-cx-a.dx)*vx+(o.y-cy-a.dy)*vy)/(vx*vx+vy*vy)));
        return Math.hypot(o.x-cx-a.dx-vx*t,o.y-cy-a.dy-vy*t)<o.radius+83;
    });
    return rocks.filter(o=>Math.hypot(o.x-cx,o.y-cy)>125 &&
        scene.stations.every(s=>Math.hypot(o.x-cx-s.dx,o.y-cy-s.dy)>157) &&
        scene.props.every(s=>Math.hypot(o.x-cx-s.dx,o.y-cy-s.dy)>95) &&
        !nearQuarryLane(o));
}
