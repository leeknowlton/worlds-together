<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ジャンプ！マイクロゲーム</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DotGothic16&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'DotGothic16', monospace;
    overflow: hidden;
    height: 100vh;
    background: #1a1a2a;
    user-select: none;
    -webkit-user-select: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  canvas {
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    cursor: pointer;
  }
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
// ========================
// SETUP
// ========================
const PW = 200, PH = 150;
const buf = document.createElement('canvas');
buf.width = PW; buf.height = PH;
const bx = buf.getContext('2d');
const cv = document.getElementById('c');
const cx = cv.getContext('2d');
cx.imageSmoothingEnabled = false;

function fitCanvas() {
const s = Math.floor(Math.min(window.innerWidth / PW, window.innerHeight / PH));
cv.width = PW _ s; cv.height = PH _ s;
cv.style.width = PW _ s + 'px'; cv.style.height = PH _ s + 'px';
cx.imageSmoothingEnabled = false;
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

function px(x, y, c) { bx.fillStyle = c; bx.fillRect(Math.round(x), Math.round(y), 1, 1); }
function rect(x, y, w, h, c) { bx.fillStyle = c; bx.fillRect(Math.round(x), Math.round(y), w, h); }
function sprite(x, y, data, pal) {
for (let r = 0; r < data.length; r++)
for (let c = 0; c < data[r].length; c++) {
const ch = data[r][c];
if (ch !== '.' && pal[ch]) px(x + c, y + r, pal[ch]);
}
}

const FLOOR_Y = 118;
const MATT_W = 32; // mattress width for collision
const MATT_H = 5;

// ========================
// 3x5 PIXEL FONT
// ========================
const FONT = {
'H':['1.1','1.1','111','1.1','1.1'],'A':['.1.','1.1','111','1.1','1.1'],
'P':['11.','1.1','11.','1..','1..'],'Y':['1.1','1.1','.1.','.1.','.1.'],
'B':['11.','1.1','11.','1.1','11.'],'I':['111','.1.','.1.','.1.','111'],
'R':['11.','1.1','11.','1.1','1.1'],'T':['111','.1.','.1.','.1.','.1.'],
'D':['11.','1.1','1.1','1.1','11.'],
'0':['111','1.1','1.1','1.1','111'],'1':['.1.','11.','.1.','.1.','111'],
'2':['111','..1','111','1..','111'],'3':['111','..1','111','..1','111'],
'4':['1.1','1.1','111','..1','..1'],'5':['111','1..','111','..1','111'],
'6':['111','1..','111','1.1','111'],'7':['111','..1','..1','..1','..1'],
'8':['111','1.1','111','1.1','111'],'9':['111','1.1','111','..1','111'],
'x':['.....','1...1','.1.1.','..1..','.1.1.','1...1'],
};
function drawText(text, sx, y, col) {
let x = sx;
for (let i = 0; i < text.length; i++) {
const g = FONT[text[i]];
if (!g) { x += 3; continue; }
for (let r = 0; r < g.length; r++)
for (let c = 0; c < g[r].length; c++)
if (g[r][c] === '1') px(x + c, y + r, col);
x += g[0].length + 1;
}
}

// ========================
// CHILD SPRITE
// ========================
function drawChild(cx, cy, state, ts) {
const idle = state === 0, jump = state === 1, land = state === 2, fail = state === 3;
const bob = idle ? Math.floor(Math.sin(ts / 250)) : 0;
const skin='#ffd8b0',skinSh='#f0c090',hair='#483020',hairHi='#604838';
const eyeC='#282020',eyeHi='#ffffff',mouthC='#d06060',blush='#f0a0a0';
const shirt='#c0e8b8',shirtLt='#d8f0d0',shirtSh='#98c890',shirtDk='#80b878';
const pants='#f0a8b8',pantsSh='#d890a0',pantsLt='#f8c0d0',foot='#ffd8b0';
const bY = cy + bob;

// Hair
const hy = bY - 22;
rect(cx-6,hy,12,2,hair); rect(cx-7,hy+2,14,1,hair);
px(cx-3,hy,hairHi); px(cx-2,hy,hairHi); px(cx-4,hy+1,hairHi);

// Face
const fy = hy + 3;
rect(cx-5,fy-1,10,1,skin); rect(cx-6,fy,12,7,skin);
rect(cx-5,fy+7,10,1,skin); rect(cx-4,fy+8,8,1,skin);
px(cx-6,fy+5,skinSh); px(cx-6,fy+6,skinSh);
px(cx+5,fy+5,skinSh); px(cx+5,fy+6,skinSh);
rect(cx-5,fy+7,1,1,skinSh); rect(cx+4,fy+7,1,1,skinSh);

// Bangs & sides
rect(cx-6,fy-1,12,1,hair);
px(cx-5,fy,hair); px(cx+4,fy,hair);
rect(cx-7,fy-1,1,4,hair); rect(cx+6,fy-1,1,4,hair);

// Eyes
const ey = fy + 3;
if (land) {
// ^\_^
px(cx-4,ey,eyeC);px(cx-3,ey-1,eyeC);px(cx-2,ey,eyeC);
px(cx+1,ey,eyeC);px(cx+2,ey-1,eyeC);px(cx+3,ey,eyeC);
} else if (fail) {
// X_X dizzy
px(cx-4,ey-1,eyeC);px(cx-2,ey-1,eyeC);px(cx-3,ey,eyeC);px(cx-4,ey+1,eyeC);px(cx-2,ey+1,eyeC);
px(cx+1,ey-1,eyeC);px(cx+3,ey-1,eyeC);px(cx+2,ey,eyeC);px(cx+1,ey+1,eyeC);px(cx+3,ey+1,eyeC);
} else if (idle) {
// Anticipation: sparkly + raised brows
px(cx-4,ey-3,hair);px(cx-3,ey-3,hair);px(cx+1,ey-3,hair);px(cx+2,ey-3,hair);
const bl = Math.floor(ts/2800)%15===0;
if (bl) { rect(cx-4,ey,3,1,eyeC); rect(cx+1,ey,3,1,eyeC); }
else {
rect(cx-4,ey-1,3,3,eyeC); px(cx-3,ey-1,eyeHi); px(cx-4,ey+1,eyeHi);
rect(cx+1,ey-1,3,3,eyeC); px(cx+2,ey-1,eyeHi); px(cx+3,ey+1,eyeHi);
}
} else {
// Jump: wide eyes
rect(cx-4,ey-1,3,3,eyeC); px(cx-3,ey-1,eyeHi);
rect(cx+1,ey-1,3,3,eyeC); px(cx+2,ey-1,eyeHi);
}

// Blush
px(cx-5,ey+1,blush);px(cx-5,ey+2,blush);px(cx+4,ey+1,blush);px(cx+4,ey+2,blush);

// Mouth
const my = fy + 6;
if (fail) {
// Wavy sad mouth
px(cx-2,my+1,mouthC);px(cx-1,my,mouthC);px(cx,my+1,mouthC);px(cx+1,my,mouthC);
} else if (jump) {
rect(cx-1,my,2,2,mouthC);
} else if (land) {
rect(cx-2,my,4,1,mouthC); px(cx-2,my+1,mouthC); px(cx+1,my+1,mouthC);
} else {
px(cx-1,my,mouthC);px(cx,my,mouthC);px(cx,my+1,mouthC);
}

// Neck
rect(cx-1,fy+9,2,1,skin);

// Body
const by = fy + 10;
const bh = (land||fail) ? 5 : 6;
rect(cx-5,by,10,bh,shirt); rect(cx-5,by,2,bh,shirtLt);
rect(cx-1,by+1,2,bh-1,shirtSh); px(cx-2,by,shirtDk); px(cx+1,by,shirtDk);
rect(cx-5,by+bh-1,10,1,shirtDk);
if(bh>4){px(cx-3,by+2,shirtLt);px(cx+2,by+2,shirtLt);px(cx-1,by+4,shirtLt);px(cx+3,by+3,shirtLt);}

// Arms
const ay = by + 1;
if (jump) {
const w = Math.floor(ts/100)%2;
px(cx-6,ay-1,skin);px(cx-7,ay-2,skin);px(cx-7,ay-(w?4:3),skin);
px(cx+5,ay-1,skin);px(cx+6,ay-2,skin);px(cx+6,ay-(w?3:4),skin);
} else if (land) {
px(cx-6,ay-1,skin);px(cx-7,ay-2,skin);px(cx-8,ay-3,skin);
px(cx+5,ay-1,skin);px(cx+6,ay-2,skin);px(cx+7,ay-3,skin);
} else if (fail) {
// Arms limp
rect(cx-6,ay,1,5,skin); rect(cx+5,ay,1,5,skin);
} else {
rect(cx-6,ay,1,4,skin);px(cx-6,ay+4,skin);
rect(cx+5,ay,1,4,skin);px(cx+5,ay+4,skin);
}

// Legs
const ly = by + bh;
if (jump) {
rect(cx-4,ly,3,4,pants);px(cx-4,ly,pantsLt);
rect(cx+1,ly,3,4,pants);px(cx+1,ly,pantsLt);
rect(cx-4,ly+4,3,1,foot); rect(cx+1,ly+4,3,1,foot);
} else if (land || fail) {
rect(cx-5,ly,3,3,pants);px(cx-5,ly,pantsLt);
rect(cx+2,ly,3,3,pants);px(cx+2,ly,pantsLt);
rect(cx-6,ly+3,4,1,foot); rect(cx+2,ly+3,4,1,foot);
} else {
rect(cx-3,ly,3,5,pants);px(cx-3,ly,pantsLt);
rect(cx,ly,3,5,pants);px(cx,ly,pantsLt);
px(cx-2,ly+2,pantsSh);px(cx+1,ly+2,pantsSh);
rect(cx-4,ly+5,4,1,foot); rect(cx,ly+5,4,1,foot);
}
}

// ========================
// SCENE ELEMENTS
// ========================
const couchPal = {}; // unused now

// Procedural sofa - cream/off-white, puffy cushions, proper proportions
function drawCouch() {
const sx = 10, sy = 85; // anchor: top-left of the back rest

// COLORS
const frame = '#c0b8ae'; // frame/structure
const frameDk= '#a8a098';
const backC = '#ddd6ce'; // back cushion fill
const backHi = '#ece6de'; // back highlight
const backSh = '#c8c0b8'; // back shadow
const seatC = '#e8e2da'; // seat cushion fill
const seatHi = '#f4f0e8'; // seat highlight (top lip)
const seatSh = '#d0c8c0'; // seat shadow
const seatFr = '#c8c0b6'; // seat front face
const armC = '#d8d0c6'; // armrest fill
const armHi = '#e8e0d8'; // armrest highlight
const armSh = '#b8b0a6'; // armrest shadow
const legC = '#685848'; // legs
const legHi = '#786858';

const W = 62; // total sofa width
const backH = 12; // back cushion height
const seatH = 10; // seat cushion height
const armW = 8; // armrest width
const seatTop = sy + backH;

// ====== BACK FRAME (visible above back cushions) ======
rect(sx + armW - 2, sy - 3, W - armW _ 2 + 4, 4, frame);
rect(sx + armW, sy - 4, W - armW _ 2, 2, frame);
// Rounded top edge
rect(sx + armW + 2, sy - 5, W - armW \* 2 - 4, 1, frameDk);

// ====== BACK CUSHIONS (3 puffy pillows) ======
const cushW = Math.floor((W - armW _ 2 - 4) / 3);
for (let i = 0; i < 3; i++) {
const cx = sx + armW + 1 + i _ (cushW + 1);
const cy = sy;

    // Main cushion body
    rect(cx, cy, cushW, backH, backC);
    // Puffy rounded top (bulges up 2px)
    rect(cx + 1, cy - 1, cushW - 2, 1, backC);
    rect(cx + 2, cy - 2, cushW - 4, 1, backHi);
    // Highlight on upper portion
    rect(cx + 1, cy, cushW - 2, 3, backHi);
    // Shadow at bottom
    rect(cx, cy + backH - 2, cushW, 2, backSh);
    // Center puffy highlight
    rect(cx + 3, cy + 3, cushW - 6, 2, backHi);

}

// ====== SEAT CUSHIONS (3 wide pads) ======
// Front face of the seat (the vertical bit you see)
const frontH = 5;
rect(sx + armW - 2, seatTop + seatH - 1, W - armW _ 2 + 4, frontH, seatFr);
rect(sx + armW - 2, seatTop + seatH - 1, W - armW _ 2 + 4, 1, seatSh);
// Bottom edge
rect(sx + armW - 2, seatTop + seatH + frontH - 1, W - armW \* 2 + 4, 1, frameDk);

for (let i = 0; i < 3; i++) {
const cx = sx + armW + 1 + i \* (cushW + 1);
const cy = seatTop;

    // Main seat pad
    rect(cx, cy, cushW, seatH, seatC);
    // Top lip highlight (the rounded front edge of the cushion)
    rect(cx, cy, cushW, 2, seatHi);
    rect(cx + 1, cy - 1, cushW - 2, 1, seatHi);
    // Shadow along back where it meets back cushion
    rect(cx, cy, cushW, 1, seatSh);
    // Center highlight
    rect(cx + 2, cy + 3, cushW - 4, 2, seatHi);
    // Front shadow
    rect(cx, cy + seatH - 1, cushW, 1, seatSh);

}

// Seam lines between seat cushions
for (let i = 1; i < 3; i++) {
const cx = sx + armW + i \* (cushW + 1);
rect(cx, seatTop + 1, 1, seatH - 2, seatSh);
// Front face seams
rect(cx, seatTop + seatH, 1, frontH - 2, frameDk);
}

// ====== LEFT ARMREST ======
const armH = backH + seatH + frontH + 2;
const armTop = sy - 5;

// Left arm body
rect(sx, armTop + 4, armW, armH - 2, armC);
// Rounded top
rect(sx + 1, armTop + 2, armW - 2, 2, armC);
rect(sx + 2, armTop + 1, armW - 4, 1, armHi);
rect(sx + 3, armTop, armW - 6, 1, armHi);
// Inner face (lighter)
rect(sx + armW - 2, armTop + 3, 2, armH - 3, armHi);
// Outer face (shadow)
rect(sx, armTop + 4, 1, armH - 2, armSh);
// Top cushion puff
rect(sx + 2, armTop + 2, armW - 4, 3, armHi);
// Front face of arm
rect(sx, seatTop + seatH - 1, armW, frontH, seatFr);
rect(sx, seatTop + seatH + frontH - 1, armW, 1, frameDk);

// ====== RIGHT ARMREST ======
const rax = sx + W - armW;
rect(rax, armTop + 4, armW, armH - 2, armC);
rect(rax + 1, armTop + 2, armW - 2, 2, armC);
rect(rax + 2, armTop + 1, armW - 4, 1, armHi);
rect(rax + 3, armTop, armW - 6, 1, armHi);
rect(rax, armTop + 3, 2, armH - 3, armHi);
rect(rax + armW - 1, armTop + 4, 1, armH - 2, armSh);
rect(rax + 2, armTop + 2, armW - 4, 3, armHi);
rect(rax, seatTop + seatH - 1, armW, frontH, seatFr);
rect(rax, seatTop + seatH + frontH - 1, armW, 1, frameDk);

// ====== LEGS ======
const legY = seatTop + seatH + frontH;
const legH = FLOOR_Y - legY;
if (legH > 0) {
// 4 legs
rect(sx + 3, legY, 3, legH, legC); px(sx + 3, legY, legHi);
rect(sx + W - 6, legY, 3, legH, legC); px(sx + W - 6, legY, legHi);
rect(sx + 14, legY, 2, legH - 1, legC);
rect(sx + W - 16, legY, 2, legH - 1, legC);
// Base trim between legs
rect(sx + 6, legY, W - 12, 1, frameDk);
}
}

const mattSprite = [
'.eeeeeeeeeeeeeeeeeeeeeeeeeeeeee.',
'eMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMe',
'eMMmmMMmmMMmmMMmmMMmmMMmmMMmmMMe',
'eMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMe',
'.eeeeeeeeeeeeeeeeeeeeeeeeeeeeee.',
];
const mattPal = {'e':'#c8c0b8','M':'#f0ece8','m':'#e0d8d0'};

function drawBanner() {
const c1=['#e05050','#e8a030','#50b850','#4080d0','#d050a0'];
const c2=['#d050a0','#e8c030','#50b0b0','#e05050','#50b850','#e8a030','#4080d0','#d050a0'];
bx.strokeStyle='#807870';bx.lineWidth=0.5;
bx.beginPath();bx.moveTo(10,16);bx.quadraticCurveTo(90,22,170,17);bx.stroke();
bx.beginPath();bx.moveTo(28,28);bx.quadraticCurveTo(100,34,168,29);bx.stroke();
let x=55;
'HAPPY'.split('').forEach((ch,i)=>{const g=FONT[ch];if(!g)return;for(let r=0;r<g.length;r++)for(let c=0;c<g[r].length;c++)if(g[r][c]==='1')px(x+c,12+r,c1[i%c1.length]);x+=4;});
x=36;
'BIRTHDAY'.split('').forEach((ch,i)=>{const g=FONT[ch];if(!g)return;for(let r=0;r<g.length;r++)for(let c=0;c<g[r].length;c++)if(g[r][c]==='1')px(x+c,24+r,c2[i%c2.length]);x+=4;});
const fc=['#e05050','#50b850','#4080d0','#e8c030','#d050a0','#50b0b0'];
for(let i=0;i<6;i++){const fx=52+i*14;bx.fillStyle=fc[i];bx.beginPath();bx.moveTo(fx,18);bx.lineTo(fx+2,18);bx.lineTo(fx+1,21);bx.closePath();bx.fill();}
for(let i=0;i<8;i++){const fx=34+i*12;bx.fillStyle=fc[i%fc.length];bx.beginPath();bx.moveTo(fx,30);bx.lineTo(fx+2,30);bx.lineTo(fx+1,33);bx.closePath();bx.fill();}
}
function drawToys(){const tc=['#d05050','#50b050','#4080d0','#e8c030','#d050a0'];[[70,115],[73,114],[76,115],[155,114],[158,115]].forEach(([x,y],i)=>{rect(x,y,3,3,tc[i%tc.length]);rect(x,y,3,1,'#ffffff30');});}
function drawPillows(){
// Pillows sitting on seat, leaning on back cushions (seatTop ≈ 97)
rect(16,95,6,8,'#887080');rect(17,96,1,6,'#a090a0');rect(19,96,1,6,'#a090a0');rect(21,96,1,6,'#a090a0');
rect(52,95,6,8,'#c0a0a0');rect(53,96,1,6,'#d0b8b8');rect(55,96,1,6,'#d0b8b8');rect(57,96,1,6,'#d0b8b8');
}
function drawTable(){rect(158,104,18,2,'#6a5040');rect(160,106,2,12,'#6a5040');rect(172,106,2,12,'#6a5040');rect(162,101,8,3,'#e0d8e0');rect(165,100,2,1,'#f0f0f0');}
function drawBlanket(){
// Dark armchair to the left of sofa
rect(0,90,9,22,'#606058');rect(0,88,9,4,'#686860');
// Rounded arm top
rect(1,87,7,2,'#6a6860');
// Striped blanket draped over
for(let i=0;i<8;i++)rect(0,92+i\*2,5,2,i%2===0?'#303848':'#e8e0d0');
}

function drawScene() {
// Wall
rect(0,0,PW,FLOOR_Y,'#c8c0b8');
for(let y=0;y<FLOOR_Y;y+=12)rect(0,y,PW,1,'#c0b8b0');
// Floor
rect(0,FLOOR_Y,PW,PH-FLOOR_Y,'#b89878');
for(let x=0;x<PW;x+=25)rect(x,FLOOR_Y,1,PH-FLOOR_Y,'#a88868');
rect(0,FLOOR_Y,PW,1,'#a08060');
// Rug
rect(15,FLOOR_Y+2,40,14,'#c06848');rect(16,FLOOR_Y+3,38,12,'#b05838');rect(18,FLOOR_Y+5,34,8,'#c06848');
// Window
rect(165,38,22,28,'#a8c8e0');
rect(165,38,22,1,'#d8d0c8');rect(165,65,22,1,'#d8d0c8');
rect(165,38,1,28,'#d8d0c8');rect(186,38,1,28,'#d8d0c8');
rect(175,38,1,28,'#d8d0c8');rect(165,52,22,1,'#d8d0c8');
rect(170,43,4,4,'#f0f0d0');
drawBanner(); drawBlanket();
drawCouch();
drawPillows(); drawTable(); drawToys();
}

// Stars
let stars = [];
function spawnStars(sx, sy) {
for(let i=0;i<16;i++){const a=(Math.PI*2/16)*i;
stars.push({x:sx,y:sy,vx:Math.cos(a)*(1.2+Math.random()*0.8),vy:Math.sin(a)*(1.2+Math.random()*0.8)-1.8,
life:30+Math.random()*15,sz:Math.random()>0.5?2:1,
c:['#ffcc00','#ff5599','#55ccff','#88ff88','#ffaa00','#ff88ff']Math.floor(Math.random()*6)]});
}
}
function drawStars() {
stars = stars.filter(s=>{s.x+=s.vx;s.y+=s.vy;s.vy+=0.08;s.life--;
if(s.life>0){px(Math.round(s.x),Math.round(s.y),s.c);
if(s.sz>1&&s.life>10){px(Math.round(s.x+1),Math.round(s.y),s.c);px(Math.round(s.x),Math.round(s.y+1),s.c);px(Math.round(s.x+1),Math.round(s.y+1),s.c);}
return true;}return false;});
}

// ========================
// GAME STATE MACHINE
// ========================
// States: TITLE → READY → AIRBORNE → FALLING → RESULT → (loop or GAMEOVER)
const G = { TITLE:0, READY:1, LAUNCH:2, AIRBORNE:3, FALLING:4, RESULT:5, GAMEOVER:6 };
let gState = G.TITLE;
let stateT = 0; // time in current state (ms)
let score = 0;
let lives = 3;
let level = 1; // speed level
let mattX = 110; // mattress X position (left edge)
let mattDir = 1; // mattress movement direction
let mattSpeed = 0.4; // px per frame
let childX = 40, childY = 97;
let childVY = 0;
let dropX = 0; // where child will land (x)
let landed = false; // did we hit?
let airX = 100; // child X while airborne (hovers over play area)

// Airborne parameters
const AIR_Y = 55; // hover height
const AIR_LEFT = 75; // left bound of air zone
const AIR_RIGHT = 155; // right bound
let airDir = 1;
let airSpeed = 0.5;

// Mattress bounds
const MATT_MIN_X = 70;
const MATT_MAX_X = 160;

function resetRound() {
mattX = MATT_MIN_X + Math.random() _ (MATT_MAX_X - MATT_MIN_X - MATT_W);
mattDir = Math.random() > 0.5 ? 1 : -1;
mattSpeed = 0.35 + level _ 0.12;
airSpeed = 0.4 + level _ 0.06;
timeLimit = Math.max(1800, 3500 - level _ 200);
childX = 40; childY = 97;
childVY = 0;
airX = AIR_LEFT + 20;
airDir = 1;
landed = false;
}

function startGame() {
score = 0; lives = 1; level = 1;
gState = G.READY; stateT = 0;
resetRound();
}

// Input
let inputPressed = false;
function onInput() { inputPressed = true; }
cv.addEventListener('click', onInput);
cv.addEventListener('touchstart', e => { e.preventDefault(); onInput(); });
document.addEventListener('keydown', e => { if(e.code==='Space'){e.preventDefault();onInput();} });

// ========================
// HUD
// ========================
let timeLimit = 3500; // will be set per round

function drawHUD() {
// Single heart
const hx = 3, hy = 3;
if (lives > 0) {
px(hx+1,hy,'#ff4060');px(hx+3,hy,'#ff4060');
rect(hx,hy+1,5,1,'#ff4060');rect(hx,hy+2,5,1,'#d03050');
rect(hx+1,hy+3,3,1,'#d03050');px(hx+2,hy+4,'#d03050');
} else {
px(hx+1,hy,'#604050');px(hx+3,hy,'#604050');
rect(hx,hy+1,5,1,'#604050');rect(hx,hy+2,5,1,'#504040');
rect(hx+1,hy+3,3,1,'#504040');px(hx+2,hy+4,'#504040');
}

// Score (top right)
const sc = String(score);
drawText(sc, PW - 4 \* sc.length - 2, 3, '#ffffff');
}

function drawTimer(ts) {
// Big obvious countdown bar across the full width
const t = Math.min(stateT / timeLimit, 1);
const remaining = 1 - t;

const barY = PH - 8; // bottom of screen
const barH = 7;
const barMaxW = PW - 4; // nearly full width
const barW = Math.ceil(barMaxW \* remaining);
const barX = 2;

// Background (empty track)
rect(barX, barY, barMaxW, barH, '#302828');
// Border
rect(barX, barY, barMaxW, 1, '#504040');
rect(barX, barY + barH - 1, barMaxW, 1, '#504040');
rect(barX, barY, 1, barH, '#504040');
rect(barX + barMaxW - 1, barY, 1, barH, '#504040');

// Bar fill color: green → yellow → red
let col, colDk;
if (remaining > 0.5) {
col = '#50d850'; colDk = '#38a838';
} else if (remaining > 0.25) {
col = '#e8c030'; colDk = '#c0a020';
} else {
col = '#e83030'; colDk = '#c02020';
}

// Flash when critical (< 20%)
if (remaining < 0.2 && Math.floor(ts / 80) % 2 === 0) {
col = '#ff6060'; colDk = '#ff3030';
}

// Fill bar
if (barW > 0) {
rect(barX + 1, barY + 1, barW - 1, barH - 2, col);
// Top highlight
rect(barX + 1, barY + 1, barW - 1, 1, '#ffffff40');
// Bottom shadow
rect(barX + 1, barY + barH - 2, barW - 1, 1, colDk);
}

// Tick marks every 25%
for (let i = 1; i <= 3; i++) {
const tx = barX + Math.floor(barMaxW \* i / 4);
rect(tx, barY, 1, barH, '#504040');
}
}

// ========================
// DRAW BIG TEXT (centered, double-size)
// ========================
function drawBigText(text, y, col) {
// Calculate width
let w = 0;
for (const ch of text) { const g = FONT[ch]; w += g ? g[0].length + 1 : 3; }
w -= 1;
const sx = Math.floor((PW - w * 2) / 2);
let x = sx;
for (const ch of text) {
const g = FONT[ch];
if (!g) { x += 6; continue; }
for (let r = 0; r < g.length; r++)
for (let c = 0; c < g[r].length; c++)
if (g[r][c] === '1') rect(x + c*2, y + r*2, 2, 2, col);
x += (g[0].length + 1) * 2;
}
}

// ========================
// Japanese text with canvas (for non-pixel text)
// ========================
function drawJPText(text, y, size, col) {
bx.fillStyle = col;
bx.font = `bold ${size}px DotGothic16, monospace`;
bx.textAlign = 'center';
bx.fillText(text, PW/2, y);
bx.textAlign = 'start';
}

// ========================
// MAIN LOOP
// ========================
let lastT = 0;
function loop(ts) {
const dt = Math.min(ts - lastT, 50); // cap dt
lastT = ts;
stateT += dt;

bx.clearRect(0, 0, PW, PH);

// ---- TITLE ----
if (gState === G.TITLE) {
drawScene();
// Draw child idle on couch
drawChild(40, 97, 0, ts);
// Dim overlay
rect(0, 0, PW, PH, 'rgba(0,0,0,0.35)');
// Title
drawJPText('ジャンプ！', 58, 16, '#ffcc00');
drawJPText('タップでスタート', 78, 8, '#ffffff');
// Blinking arrow
if (Math.floor(ts/500) % 2 === 0) {
drawJPText('▼', 90, 8, '#ffcc00');
}
if (inputPressed) { inputPressed = false; startGame(); }
}

// ---- READY (flash instruction) ----
else if (gState === G.READY) {
drawScene();
// Mattress at position
sprite(Math.round(mattX), 112, mattSprite, mattPal);
// Child on couch anticipating
drawChild(40, 97, 0, ts);
drawHUD();

    // Flash 頑張れ
    if (stateT < 800) {
      const flash = Math.floor(stateT / 100) % 2 === 0;
      if (flash) drawJPText('頑張れ！', 55, 14, '#ffcc00');
    }

    // Auto-transition to LAUNCH after flash
    if (stateT > 900) {
      gState = G.LAUNCH; stateT = 0;
      airX = 90 + Math.random() * 30;
    }
    inputPressed = false; // eat inputs during ready

}

// ---- LAUNCH (child jumps off couch in an arc) ----
else if (gState === G.LAUNCH) {
const LAUNCH_MS = 450;
const t = Math.min(stateT / LAUNCH_MS, 1);

    // Arc from couch to hover position
    const startX = 40, startY = 97;
    const endX = airX, endY = AIR_Y;
    const arcH = 35; // extra height above the line

    childX = startX + (endX - startX) * t;
    childY = startY + (endY - startY) * t - arcH * Math.sin(t * Math.PI);

    // Mattress is already moving during launch
    mattX += mattDir * mattSpeed;
    if (mattX <= MATT_MIN_X) { mattX = MATT_MIN_X; mattDir = 1; }
    if (mattX >= MATT_MAX_X - MATT_W) { mattX = MATT_MAX_X - MATT_W; mattDir = -1; }

    drawScene();
    sprite(Math.round(mattX), 112, mattSprite, mattPal);

    // Motion trail behind the child
    if (t > 0.05 && t < 0.95) {
      for (let i = 1; i <= 3; i++) {
        const trailT = Math.max(0, t - i * 0.06);
        const tx = startX + (endX - startX) * trailT;
        const ty = startY + (endY - startY) * trailT - arcH * Math.sin(trailT * Math.PI);
        const alpha = Math.max(0, 0.3 - i * 0.1);
        bx.fillStyle = `rgba(255,216,176,${alpha})`;
        bx.fillRect(Math.round(tx) - 2, Math.round(ty) - 10, 4, 8);
      }
    }

    drawChild(Math.round(childX), Math.round(childY), 1, ts);
    drawHUD();

    // 頑張れ stays visible during launch
    drawJPText('頑張れ！', 55, 14, '#ffcc00');

    inputPressed = false; // eat inputs during launch

    if (t >= 1) {
      gState = G.AIRBORNE; stateT = 0;
    }

}

// ---- AIRBORNE (child hovers, mattress slides, tap to drop) ----
else if (gState === G.AIRBORNE) {
// Move mattress
mattX += mattDir \* mattSpeed;
if (mattX <= MATT_MIN_X) { mattX = MATT_MIN_X; mattDir = 1; }
if (mattX >= MATT_MAX_X - MATT_W) { mattX = MATT_MAX_X - MATT_W; mattDir = -1; }

    // Move child L/R in air
    airX += airDir * airSpeed;
    if (airX <= AIR_LEFT) { airX = AIR_LEFT; airDir = 1; }
    if (airX >= AIR_RIGHT) { airX = AIR_RIGHT; airDir = -1; }

    // Draw
    drawScene();
    sprite(Math.round(mattX), 112, mattSprite, mattPal);

    // Shadow on ground under child
    const shadowW = 8;
    rect(Math.round(airX) - shadowW/2, FLOOR_Y - 1, shadowW, 1, 'rgba(0,0,0,0.15)');

    // Child hovering
    const hoverBob = Math.sin(ts / 150) * 2;
    drawChild(Math.round(airX), Math.round(AIR_Y + hoverBob), 1, ts);

    // Crosshair / drop indicator
    const indY = FLOOR_Y - 4;
    px(Math.round(airX), indY, '#ff606080');
    px(Math.round(airX)-1, indY, '#ff606060');
    px(Math.round(airX)+1, indY, '#ff606060');

    drawHUD();
    drawTimer(ts);

    // Tap to drop!
    if (stateT > 100 && inputPressed) {
      inputPressed = false;
      gState = G.FALLING; stateT = 0;
      dropX = Math.round(airX);
      childX = dropX;
      childY = AIR_Y;
      childVY = 0;
    }
    inputPressed = false;

    // Auto-fail if time runs out
    if (stateT > timeLimit) {
      inputPressed = false;
      gState = G.FALLING; stateT = 0;
      dropX = Math.round(airX);
      childX = dropX; childY = AIR_Y; childVY = 0;
    }

}

// ---- FALLING ----
else if (gState === G.FALLING) {
childVY += 0.25;
childY += childVY;

    // Move mattress still (it doesn't stop!)
    mattX += mattDir * mattSpeed;
    if (mattX <= MATT_MIN_X) { mattX = MATT_MIN_X; mattDir = 1; }
    if (mattX >= MATT_MAX_X - MATT_W) { mattX = MATT_MAX_X - MATT_W; mattDir = -1; }

    drawScene();
    sprite(Math.round(mattX), 112, mattSprite, mattPal);

    // Motion lines
    for (let i = 1; i <= 3; i++) {
      px(childX, Math.round(childY) - 24 - i * 3, '#d0c0a060');
    }

    drawChild(childX, Math.round(childY), 1, ts);
    drawHUD();

    // Check landing
    const feetY = Math.round(childY);
    if (feetY >= 112) {
      // Check if on mattress
      const mattLeft = Math.round(mattX);
      const mattRight = mattLeft + MATT_W;
      const onMatt = childX >= mattLeft - 2 && childX <= mattRight + 2;
      landed = onMatt;
      childY = 112;
      gState = G.RESULT; stateT = 0;

      if (onMatt) {
        spawnStars(childX, 100);
        score++;
      } else {
        lives--;
      }
    }

}

// ---- RESULT ----
else if (gState === G.RESULT) {
drawScene();
sprite(Math.round(mattX), 112, mattSprite, mattPal);
drawChild(childX, 112, landed ? 2 : 3, ts);
drawStars();
drawHUD();

    if (stateT < 1000) {
      if (landed) {
        drawJPText('すごい！', 55, 14, '#ff5599');
      } else {
        drawJPText('ドンマイ！', 55, 14, '#6688cc');
      }
    }

    if (stateT > 1200) {
      if (lives <= 0) {
        gState = G.GAMEOVER; stateT = 0;
      } else {
        // Next round
        if (landed && score % 2 === 0) level++; // speed up every 2 successes
        gState = G.READY; stateT = 0;
        resetRound();
      }
    }
    inputPressed = false;

}

// ---- GAME OVER ----
else if (gState === G.GAMEOVER) {
drawScene();
sprite(Math.round(mattX), 112, mattSprite, mattPal);
drawChild(childX, 112, 3, ts);

    rect(0, 0, PW, PH, 'rgba(0,0,0,0.4)');

    drawJPText('おわり！', 52, 14, '#ff5599');

    // Score display
    const sc = String(score);
    drawBigText(sc, 62, '#ffcc00');

    if (stateT > 600) {
      drawJPText('もう一回？', 95, 8, '#ffffff');
      if (Math.floor(ts/500) % 2 === 0) drawJPText('▼', 107, 8, '#ffcc00');
    }

    if (stateT > 800 && inputPressed) {
      inputPressed = false;
      startGame();
    }

}

// Blit
cx.clearRect(0, 0, cv.width, cv.height);
cx.drawImage(buf, 0, 0, PW, PH, 0, 0, cv.width, cv.height);
requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
</script>

</body>
</html>
