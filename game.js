'use strict';
const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d');
let mode='menu',level=0,room=0,time=0,last=0,player,enemies=[],drops=[],effects=[],shots=[],keys={},joy={x:0,y:0},pointer=null,muted=true,audio,score=0;
const realms=['The Mosslight Temple','The Sunken Sanctum'],rooms=['THE OVERGROWN GATE','THE WHISPERING HALL','THE GUARDIAN’S GROVE'];
const maps=[
 [{name:'THE OVERGROWN GATE',doors:{up:1}}, {name:'THE WHISPERING HALL',doors:{down:0,right:2}}, {name:'THE IVY CROSSING',doors:{left:1,up:3}}, {name:'THE FERN GALLERY',doors:{down:2,left:4}}, {name:'THE ANCIENT APPROACH',doors:{right:3,up:5}}, {name:'THE GUARDIAN’S GROVE',boss:true,doors:{down:4}}],
 [{name:'THE TIDAL GATE',doors:{up:1}}, {name:'THE CRYSTAL HALL',doors:{down:0,right:2,left:3}}, {name:'THE KEYKEEPER’S VAULT',key:true,doors:{left:1}}, {name:'THE SEALED PASSAGE',doors:{right:1,left:4}}, {name:'THE SUNKEN GALLERY',doors:{right:3,up:5}}, {name:'THE STORMKEEPER’S CHAMBER',boss:true,doors:{down:4}}]
];
let roomStates={},hasKey=false,doorUnlocked=false,travelCooldown=0;
const opposite={up:'down',down:'up',left:'right',right:'left'};
function roomDef(){return maps[level][room]}
function isLocked(dir){return level===1&&room===1&&dir==='left'&&!doorUnlocked}
function objective(){
 const def=roomDef();
 if(enemies.length)return def.boss?'Defeat the guardian':`Room ${room+1} / 6 · Defeat the enemies`;
 if(def.key&&!hasKey&&!doorUnlocked)return 'Collect the golden key in the center';
 if(level===1&&room===1&&!doorUnlocked)return hasKey?'Take the key to the left doorway ←':'Find the key through the right doorway →';
 const next=Object.entries(def.doors).find(([,target])=>target>room);
 return next?`Room cleared · Head ${next[0]} ${ {up:'↑',down:'↓',left:'←',right:'→'}[next[0]]}`:'Return through the doorway';
}
function refreshRoomUI(){
 $('room-title').textContent=roomDef().name;
 $('room-dots').textContent=maps[level].map((_,i)=>i===room?'◉':roomStates[i]?.cleared?'◆':'◇').join(' · ');
 $('objective').textContent=objective();
 $('key-status').textContent=doorUnlocked?'⚿ DOOR UNLOCKED':hasKey?'⚿ GOLDEN KEY':'';
}
const obstacles=[{x:200,y:210,w:75,h:65},{x:725,y:210,w:75,h:65},{x:200,y:400,w:75,h:65},{x:725,y:400,w:75,h:65}];
function tone(freq=440,d=.1){if(muted)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.value=freq;g.gain.setValueAtTime(.04,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+d)}catch{}}
function toast(t){$('toast').textContent=t;$('toast').style.opacity=1;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').style.opacity=0,2200)}
function reset(l=0){level=l;room=0;roomStates={};hasKey=false;doorUnlocked=false;travelCooldown=0;score=l?score:0;player={x:500,y:480,hp:5,mana:100,face:-Math.PI/2,attack:0,cool:0,inv:0,defend:false};loadRoom();mode='playing';$('overlay').hidden=true;updateHUD();toast('Clear the room to awaken the doorway')}
function loadRoom(entry='down'){
 const def=roomDef();shots=[];effects=[];travelCooldown=.65;
 const spawn={down:[500,490],up:[500,170],left:[145,330],right:[855,330]}[entry];
 [player.x,player.y]=spawn;player.face={down:-Math.PI/2,up:Math.PI/2,left:0,right:Math.PI}[entry];
 if(!roomStates[room]){
  const foes=[];
  for(let i=0;i<(def.boss?1:def.key?3:3+Math.min(room,2));i++){
   const skeleton=!def.boss&&(i%2===1||def.key),hp=def.boss?24+level*12:skeleton?4+level:3+level;
   foes.push({x:340+(i%3)*150,y:220+Math.floor(i/3)*90,hp,max:hp,boss:!!def.boss,type:skeleton?'skeleton':'slime',r:def.boss?34:17,slow:0,hit:0,shoot:2+i*.3,swing:0,windup:0,swingCooldown:1,face:0});
  }
  roomStates[room]={enemies:foes,drops:[],cleared:false};
 }
 enemies=roomStates[room].enemies;drops=roomStates[room].drops;
 $('location').textContent=realms[level];$('level-label').innerHTML=`0${level+1} <span>/ 02</span>`;
 $('bossbar').hidden=!def.boss;$('bossname').textContent=level?'The Stormkeeper':'The Moss Guardian';refreshRoomUI();updateHUD();
}
function tryDoor(dir){
 const target=roomDef().doors[dir];if(target===undefined||enemies.length||travelCooldown>0)return false;
 if(isLocked(dir)){
  if(!hasKey){toast('Locked · Find the golden key through the right door →');travelCooldown=1;return false}
  hasKey=false;doorUnlocked=true;tone(950,.3);toast('Golden key used · The left door is unlocked');
 }
 roomStates[room].enemies=enemies;roomStates[room].drops=drops;
 room=target;loadRoom(opposite[dir]);return true;
}
function updateHUD(){$('hearts').textContent=Array.from({length:5},(_,i)=>i<Math.ceil(player?.hp??5)?'♥':'♡').join(' ');$('mana').style.width=(player?.mana??100)+'%';$('mana-value').textContent=Math.floor(player?.mana??100);const boss=enemies.find(e=>e.boss);if(boss)$('bosshp').style.width=100*boss.hp/boss.max+'%'}
function overlay(title,sub,copy,button,fn,secondary=true){mode='overlay';keys={};joy={x:0,y:0};$('overlay').hidden=false;$('overlay').innerHTML=`<div class="crest">✧<span>${title==='Game over'?'♡':'✦'}</span>✧</div><span class="eyebrow">${sub}</span><h2>${title}</h2><p class="overlay-copy">${copy}</p><button class="primary" id="continue">${button} <span>→</span></button>${secondary?'<button class="secondary" id="menu">Back to main menu</button>':''}`;$('continue').onclick=fn;if(secondary)$('menu').onclick=menu}
function menu(){overlay('Emberwild','THE TWO RELICS','Two forgotten temples. A little courage.<br>Your adventure awaits.','Begin adventure',()=>reset(),false);mode='menu';$('objective').textContent='Your story starts here';$('bossbar').hidden=true}
function action(a){if(mode!=='playing')return;if(a==='attack'){if(player.cool>0)return;player.attack=.25;player.cool=.38;tone(280,.08);effects.push({x:player.x,y:player.y,t:.25,max:.25,type:'sword',angle:player.face});for(const e of [...enemies]){let angle=Math.atan2(e.y-player.y,e.x-player.x),diff=Math.atan2(Math.sin(angle-player.face),Math.cos(angle-player.face));if(Math.hypot(e.x-player.x,e.y-player.y)<90+e.r&&Math.abs(diff)<1.5)hurt(e,1)}return}const cost={fire:20,ice:25,lightning:30}[a];if(!cost||player.cool>0)return;if(player.mana<cost){toast('Find blue crystals to restore mana');return}player.mana-=cost;player.cool=.5;tone(a==='ice'?800:a==='fire'?180:1100,.2);effects.push({x:player.x,y:player.y,t:.5,max:.5,type:a});for(const e of [...enemies])if(Math.hypot(e.x-player.x,e.y-player.y)<(a==='lightning'?600:230)){hurt(e,a==='fire'?4:a==='lightning'?5:2);if(a==='ice')e.slow=4}updateHUD()}
function hurt(e,n){e.hp-=n;e.hit=.18;effects.push({x:e.x,y:e.y-30,t:.65,max:.65,type:'text',text:'−'+n});if(e.hp<=0){enemies=enemies.filter(v=>v!==e);score++;drops.push({x:e.x,y:e.y,type:score%3===0?'heart':'mana'});tone(650,.12);if(!enemies.length){if(roomDef().boss){$('bossbar').hidden=true;if(level===0)overlay('Level complete','THE FIRST RELIC IS YOURS','The forest can breathe again.<br>A second guardian waits in the Sunken Sanctum.','Enter chapter two',()=>reset(1));else overlay('You did it!','BOTH RELICS RESTORED','Two guardians defeated. Two realms renewed.<br>Emberwild will remember your courage.','Play again',()=>reset())}else{roomStates[room].cleared=true;drops.push({x:500,y:300,type:'mana'});if(roomDef().key&&!hasKey&&!doorUnlocked)drops.push({x:500,y:350,type:'key'});refreshRoomUI();toast(objective())}}}updateHUD()}
function damage(n,x,y){if(player.inv>0)return;let facing=Math.cos(Math.atan2(y-player.y,x-player.x)-player.face)>.1;player.hp-=player.defend&&facing?n*.2:n;player.inv=.9;tone(100,.15);effects.push({x:player.x,y:player.y,t:.3,max:.3,type:'damage'});updateHUD();if(player.hp<=0)overlay('Game over','EVEN HEROES NEED ANOTHER TRY','The temple keeps its secrets… for now.<br>Take a breath, and try this level again.','Try level again',()=>reset(level))}
function blocked(x,y){return x<90||x>910||y<116||y>530||obstacles.some(o=>x>o.x-14&&x<o.x+o.w+14&&y>o.y-12&&y<o.y+o.h+12)}
function update(dt){if(mode!=='playing')return;player.cool=Math.max(0,player.cool-dt);player.attack=Math.max(0,player.attack-dt);player.inv=Math.max(0,player.inv-dt);player.defend=!!keys.k||!!keys.shield;let dx=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0)+joy.x,dy=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0)+joy.y;const len=Math.hypot(dx,dy);if(len>.08){dx/=Math.max(1,len);dy/=Math.max(1,len);player.face=Math.atan2(dy,dx);let speed=player.defend?100:195;if(!blocked(player.x+dx*speed*dt,player.y))player.x+=dx*speed*dt;if(!blocked(player.x,player.y+dy*speed*dt))player.y+=dy*speed*dt}travelCooldown=Math.max(0,travelCooldown-dt);
 if(player.y<145&&Math.abs(player.x-500)<55){if(tryDoor('up'))return}
 if(player.y>510&&Math.abs(player.x-500)<55){if(tryDoor('down'))return}
 if(player.x<113&&Math.abs(player.y-330)<55){if(tryDoor('left'))return}
 if(player.x>887&&Math.abs(player.y-330)<55){if(tryDoor('right'))return}
 for(const e of enemies){e.slow=Math.max(0,e.slow-dt);e.hit=Math.max(0,e.hit-dt);let a=Math.atan2(player.y-e.y,player.x-e.x),distance=Math.hypot(e.x-player.x,e.y-player.y),speed=(e.boss?48:e.type==='skeleton'?78:65+level*12)*(e.slow?.3:1);
 e.swing=Math.max(0,e.swing-dt);e.swingCooldown-=dt;
 if(e.type==='skeleton'){
  if(e.windup>0){e.windup-=dt;speed=0;if(e.windup<=0){e.swing=.25;e.swingCooldown=1.25;effects.push({x:e.x,y:e.y,t:.25,max:.25,type:'sword',angle:e.face});const diff=Math.atan2(Math.sin(a-e.face),Math.cos(a-e.face));if(distance<83&&Math.abs(diff)<1.2)damage(1,e.x,e.y)}}
  else{e.face=a;if(distance<75&&e.swingCooldown<=0){e.windup=.55;speed=0}else if(distance<54)speed=0}
 }
const nx=e.x+Math.cos(a)*speed*dt,ny=e.y+Math.sin(a)*speed*dt;if(!blocked(nx,e.y))e.x=nx;if(!blocked(e.x,ny))e.y=ny;if(e.type!=='skeleton'&&Math.hypot(e.x-player.x,e.y-player.y)<e.r+15)damage(e.boss?1.2:.7,e.x,e.y);if(e.boss){e.shoot-=dt;if(e.shoot<=0){e.shoot=level?1.6:2.1;for(let i=-1;i<=1;i++)shots.push({x:e.x,y:e.y,a:a+i*.4,t:5})}}}for(const s of shots){s.x+=Math.cos(s.a)*155*dt;s.y+=Math.sin(s.a)*155*dt;s.t-=dt;if(Math.hypot(s.x-player.x,s.y-player.y)<22){damage(.8,s.x,s.y);s.t=0}}shots=shots.filter(s=>s.t>0&&s.x>70&&s.x<930&&s.y>90&&s.y<550);for(const d of [...drops])if(Math.hypot(d.x-player.x,d.y-player.y)<30){if(d.type==='key'){hasKey=true;toast('Golden key found · Return left to the Crystal Hall');refreshRoomUI()}else if(d.type==='mana')player.mana=Math.min(100,player.mana+30);else player.hp=Math.min(5,player.hp+1);drops=drops.filter(v=>v!==d);tone(900,.1);updateHUD()}for(const e of effects)e.t-=dt;effects=effects.filter(e=>e.t>0)}
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h)}function ellipse(x,y,rx,ry,c){ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,7);ctx.fill()}function poly(points,c){ctx.fillStyle=c;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill()}function line(x,y,x2,y2,c,w=2){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke()}
function leaf(x,y,s,c){ellipse(x,y,s,s*.45,c)}
function drawWorld(){let blue=level===1;rect(0,0,1000,600,blue?'#183e49':'#24483c');for(let y=93;y<560;y+=42)for(let x=65;x<938;x+=48){let v=Math.sin(x*13+y*7);rect(x+1,y+1,46,40,blue?(v>.3?'#37636a':'#305b62'):(v>.3?'#4d6950':'#455f48'));line(x+4,y+40,x+43,y+40,blue?'#244c54':'#38523d');if(v>.5)line(x+8,y+6,x+16,y+10,'#ffffff09')}rect(70,85,860,25,blue?'#51757a':'#72816a');rect(70,110,860,15,'#223c32');rect(65,100,24,455,'#61725a');rect(911,100,24,455,'#61725a');rect(65,540,870,22,'#233e34');for(let x=70;x<930;x+=60){rect(x,62,56,26,blue?'#46656c':'#697760');rect(x+3,65,48,5,'#ffffff0c')}for(let y=118;y<540;y+=54){rect(60,y,28,50,blue?'#425e64':'#596d50');rect(912,y,28,50,blue?'#425e64':'#596d50')}for(const o of obstacles){ellipse(o.x+o.w/2,o.y+o.h,50,13,'#122f294f');rect(o.x-5,o.y+14,o.w+10,o.h-5,blue?'#34525e':'#384f3c');rect(o.x,o.y,o.w,o.h-7,blue?'#6a8b8c':'#849279');rect(o.x+7,o.y+7,o.w-14,o.h-20,blue?'#587c80':'#6e8264');line(o.x+14,o.y+14,o.x+30,o.y+27,'#385f4d');line(o.x+30,o.y+27,o.x+26,o.y+45,'#385f4d');leaf(o.x+8,o.y+8,18,'#5c8b58');leaf(o.x+24,o.y+3,13,'#91a36a');leaf(o.x+o.w,o.y+o.h-14,19,'#4f7b4e')}for(let i=0;i<95;i++){let x=(Math.sin(i*173)*.5+.5)*1000,y=(Math.sin(i*67)*.5+.5)*600;if(x>105&&x<895&&y>115&&y<535)continue;leaf(x,y,13+i%15,blue?'#24565a':'#2c5b40');leaf(x+8,y-6,10+i%11,blue?'#39766d':'#44774d');if(i%7===0){ellipse(x,y,3,3,'#c3ac65');ellipse(x+4,y-3,2,3,'#d8c581')}}for(const x of [135,865]){rect(x-6,152,12,29,'#655f40');ellipse(x,150,8,12,'#eaad56');ellipse(x,147+Math.sin(time*8)*2,4,8,'#ffe5a0');let g=ctx.createRadialGradient(x,151,3,x,151,64);g.addColorStop(0,'#f7c26d33');g.addColorStop(1,'#f7c26d00');ctx.fillStyle=g;ctx.fillRect(x-65,86,130,130)}for(let i=0;i<16;i++)ellipse(110+(i*137)%790,155+(i*71)%370+Math.sin(time+i)*4,1.5,1.5,'#c6d79570');}
function drawDoors(){
 const def=maps[level][room];
 for(const dir of Object.keys(def.doors)){
  const [x,y,rotation]={up:[500,111,0],down:[500,542,Math.PI],left:[76,330,-Math.PI/2],right:[924,330,Math.PI/2]}[dir];
  const locked=isLocked(dir),open=!enemies.length&&!locked;
  ctx.save();ctx.translate(x,y);ctx.rotate(rotation);
  rect(-53,-47,106,64,'#172e2b');rect(-44,-41,88,56,level?'#64878b':'#8b9874');rect(-34,-33,68,48,open?'#d4c783':locked?'#655443':'#30463f');
  for(let i=0;i<3;i++)rect(-50-i*3,16+i*7,100+i*6,6,level?'#63838a':'#85977b');
  if(!open&&!locked)for(let i=-24;i<=24;i+=16)rect(i,-32,4,46,'#8a9981');
  if(locked){ellipse(0,-15,7,7,'#e9c87e');poly([[-3,-13],[3,-13],[6,0],[-6,0]],'#e9c87e')}
  if(open){ctx.fillStyle='#fbf0b8';ctx.font='19px Arial';ctx.textAlign='center';ctx.fillText('↑',0,7)}ctx.restore();
 }
}
function hero(x,y){ctx.save();ctx.translate(x,y);if(player?.inv>0&&Math.sin(time*40)>0)ctx.globalAlpha=.4;ellipse(0,15,18,7,'#102f2866');rect(-9,6,7,13,'#714b32');rect(3,6,7,13,'#714b32');poly([[-14,6],[-11,-13],[10,-13],[15,9]],'#77ac75');rect(-8,2,18,4,'#c4a86b');ellipse(0,-18,11,13,'#e9bf8c');poly([[-14,-22],[-7,-37],[14,-27],[12,-18],[-3,-24]],'#7ab079');rect(-9,-19,4,3,'#4e4835');rect(5,-19,3,3,'#4e4835');poly([[-17,-5],[-7,-7],[-6,12],[-13,18],[-21,10]],player?.defend?'#b5d8d0':'#627e85');line(-16,-3,-13,12,'#c8ce9a',2);ctx.save();ctx.translate(14,0);ctx.rotate((player?.face??-1.5)+1.5+(player?.attack>0?-1:0));rect(-2,-26,4,25,'#e0e8c8');poly([[-2,-26],[0,-32],[2,-26]],'#e0e8c8');rect(-6,-3,12,4,'#d3b76b');rect(-2,1,4,8,'#6c4933');ctx.restore();ctx.restore()}
function enemy(e){ctx.save();ctx.translate(e.x,e.y);const bob=Math.sin(time*5+e.x)*3;ellipse(0,e.r*.8,e.r*1.1,8,'#152b2966');if(e.boss){poly([[-32,8],[-40,-25],[-22,-45],[0,-50],[24,-40],[39,-13],[30,22],[4,33],[-23,26]],level?'#527c97':'#65876b');poly([[-25,-25],[-17,-43],[0,-50],[18,-40],[28,-25]],level?'#8bbfc5':'#9eb06b');rect(-17,-16,10,6,'#ffdc8f');rect(9,-16,10,6,'#ffdc8f');rect(-10,5,22,4,'#344e42');poly([[-30,-25],[-45,-50],[-23,-37]],'#c7c78d');poly([[24,-27],[42,-49],[35,-18]],'#c7c78d');rect(-44,0,15,29,'#7f987b');rect(29,0,15,29,'#7f987b')}else if(e.type==='skeleton'){
 const bone=e.slow?'#b8edf0':'#e6dfc2';
 line(-6,6,-9,19,bone,5);line(6,6,10,19,bone,5);line(0,-7,0,8,bone,5);
 for(let i=0;i<3;i++)line(-9,-5+i*5,9,-5+i*5,bone,3);
 ellipse(0,-20,13,13,bone);rect(-9,-24,6,7,'#293c39');rect(3,-24,6,7,'#293c39');rect(-7,-10,14,4,bone);
 line(-11,-4,-18,6,bone,4);line(11,-4,19,3,bone,4);
 ctx.save();ctx.rotate(e.face+Math.PI/2+(e.windup>0?-.8:e.swing>0?.8:0));rect(17,-34,4,36,'#d8e8e0');poly([[17,-34],[19,-42],[21,-34]],'#f2eee0');rect(12,-1,14,4,'#d4b16a');rect(17,3,4,8,'#765441');ctx.restore();
 if(e.windup>0){ctx.strokeStyle='#edaa73';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,40,e.face-1,e.face+1);ctx.stroke()}
 }else{ellipse(0,bob,19,17,e.slow?'#89d8df':level?'#aa83b1':'#b8b85d');ellipse(-6,-7+bob,9,8,e.slow?'#beedf0':level?'#c9a5ce':'#d8d982');rect(-8,-2+bob,4,5,'#314b3a');rect(6,-2+bob,4,5,'#314b3a');rect(-3,7+bob,7,2,'#64703e')}if(e.hit>0){ctx.globalAlpha=.6;ellipse(0,0,e.r,e.r,'#fff3ca')}ctx.restore();if(!e.boss&&e.hp<e.max){rect(e.x-17,e.y-28,34,3,'#203d32');rect(e.x-17,e.y-28,34*e.hp/e.max,3,'#dab96b')}}
function render(){ctx.clearRect(0,0,1000,600);drawWorld();drawDoors();for(const d of drops){const y=d.y+Math.sin(time*4)*3;if(d.type==='key'){ctx.strokeStyle='#f8d577';ctx.lineWidth=5;ctx.beginPath();ctx.arc(d.x-7,y-5,8,0,7);ctx.stroke();line(d.x,y,d.x+19,y+19,'#f8d577',5);line(d.x+13,y+13,d.x+19,y+7,'#f8d577',5);line(d.x+18,y+18,d.x+24,y+12,'#f8d577',5)}else if(d.type==='mana'){poly([[d.x,y-12],[d.x+8,y],[d.x,y+12],[d.x-8,y]],'#8ad9e1');line(d.x,y-8,d.x-3,y,'#e1ffff',2)}else{ctx.font='24px Georgia';ctx.fillStyle='#f29e8b';ctx.fillText('♥',d.x-10,y+7)}}for(const e of enemies)enemy(e);hero(player?.x??500,player?.y??440);for(const s of shots){ellipse(s.x,s.y,8,8,level?'#a6c4ff':'#ebad69');ellipse(s.x,s.y,4,4,'#fff1bc')}for(const e of effects){ctx.save();ctx.globalAlpha=e.t/e.max;ctx.translate(e.x,e.y);if(e.type==='text'){ctx.font='bold 18px Arial';ctx.fillStyle='#fff2b9';ctx.fillText(e.text,0,-(1-e.t/e.max)*30)}else if(e.type==='sword'){ctx.rotate(e.angle);ctx.strokeStyle='#f9e6aa';ctx.lineWidth=7;ctx.beginPath();ctx.arc(0,0,65,-1.2,1.2);ctx.stroke()}else{ctx.strokeStyle={fire:'#ffac66',ice:'#a5f0f3',lightning:'#f8dd87',damage:'#fa8c79'}[e.type];ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,(1-e.t/e.max)*(e.type==='damage'?35:230),0,7);ctx.stroke();if(e.type==='lightning')for(let i=0;i<6;i++){let a=i*Math.PI/3;line(0,0,Math.cos(a)*250,Math.sin(a)*250,'#fff3af',3)}}ctx.restore()}const vignette=ctx.createRadialGradient(500,300,200,500,300,580);vignette.addColorStop(0,'#082c1c00');vignette.addColorStop(1,'#061e2788');ctx.fillStyle=vignette;ctx.fillRect(0,0,1000,600)}
function loop(t){const dt=Math.min((t-last)/1000,.04);last=t;time+=dt;update(dt);render();requestAnimationFrame(loop)}
$('start').onclick=()=>reset();$('home').onclick=e=>{e.preventDefault();menu()};$('pause').onclick=()=>{if(mode==='playing')overlay('Take a breath','ADVENTURE PAUSED','Your quest will be right here.','Continue adventure',()=>{mode='playing';$('overlay').hidden=true});else if(mode==='overlay'&&$('overlay').textContent.includes('ADVENTURE PAUSED')){mode='playing';$('overlay').hidden=true}};$('sound').onclick=()=>{muted=!muted;$('sound').innerHTML='♫ <span>Sound '+(muted?'off':'on')+'</span>';tone(660)};$('guide-toggle').onclick=()=>{$('guide').hidden=!$('guide').hidden;if(!$('guide').hidden)$('guide').scrollIntoView({behavior:'smooth',block:'nearest'})};
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['w','a','s','d','j','k','u','i','o','arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();keys[k]=true;if(!e.repeat)action({j:'attack',u:'fire',i:'ice',o:'lightning'}[k]);if(k==='escape')$('pause').click()});window.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);window.addEventListener('blur',()=>{keys={};joy={x:0,y:0};if(mode==='playing')$('pause').click()});document.querySelectorAll('[data-action]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);if(b.dataset.action==='defend')keys.shield=true;else action(b.dataset.action)});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>{if(b.dataset.action==='defend')keys.shield=false})});
const joystick=$('joystick');function moveJoy(e){const r=joystick.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2,len=Math.hypot(x,y),scale=Math.min(len,32)/(len||1);joy={x:x*scale/32,y:y*scale/32};$('stick').style.transform=`translate(${joy.x*28}px,${joy.y*28}px)`}joystick.addEventListener('pointerdown',e=>{pointer=e.pointerId;joystick.setPointerCapture(pointer);moveJoy(e)});joystick.addEventListener('pointermove',e=>{if(e.pointerId===pointer)moveJoy(e)});for(const event of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(event,()=>{pointer=null;joy={x:0,y:0};$('stick').style.transform='none'});requestAnimationFrame(loop);
