/**
 * 究極のかき氷職人 - ゲームロジック (横回転＆透明ガラス器アップデート版)
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const shaveSound = document.getElementById('shave-sound');

// --- 物理・描画設定 ---
const GRID_SIZE = 40;
const CELL_SIZE = 7;
const BOWL_RADIUS = (GRID_SIZE / 2) * CELL_SIZE - 15; 
const PERSPECTIVE_X = 1.6; 
const PERSPECTIVE_Y = 0.55; 
const HEIGHT_SCALE = 1.5;

let cx, cy;
let gameState = 'START';
let isShaving = false;
let bowlAngle = 0;
let iceBlockAngle = 0; // 氷ブロックの横回転角度
let totalVolume = 0;
let hasCollapsed = false;

let heightMap = new Array(GRID_SIZE).fill(0).map(() => new Float32Array(GRID_SIZE));
let cells = [];
let fallingParticles = [];
let effectParticles = [];
let sparkles = [];

let maxSlope = 0;
let stability = 100;

const shaveBtn = document.getElementById('shave-btn');
const finishBtn = document.getElementById('finish-btn');
const rotationPad = document.getElementById('rotation-pad');

// --- 初期化 ---
function initCells() {
    cells = [];
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let z = 0; z < GRID_SIZE; z++) {
            let lx = (x - GRID_SIZE/2) * CELL_SIZE;
            let lz = (z - GRID_SIZE/2) * CELL_SIZE;
            let distSq = lx*lx + lz*lz;
            cells.push({ x, z, lx, lz, distSq, wx: 0, wz: 0, h: 0 });
        }
    }
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    cx = canvas.width / 2;
    cy = canvas.height * 0.7; // 器の位置
}
window.addEventListener('resize', resize);
resize();
initCells();

function playSound() { if(shaveSound.paused) { shaveSound.currentTime = 0; shaveSound.play().catch(()=>{}); } }
function stopSound() { shaveSound.pause(); }

// --- 入力制御 ---
function startShave(e) {
    if (e && e.cancelable) e.preventDefault();
    if (gameState !== 'PLAYING') return;
    isShaving = true;
    shaveBtn.classList.add('shave-btn-active');
    shaveBtn.classList.remove('shave-btn-base');
    playSound();
}

function stopShave(e) {
    if (e && e.cancelable) e.preventDefault();
    isShaving = false;
    shaveBtn.classList.remove('shave-btn-active');
    shaveBtn.classList.add('shave-btn-base');
    stopSound();
}

shaveBtn.addEventListener('mousedown', startShave);
shaveBtn.addEventListener('touchstart', startShave, {passive: false});
window.addEventListener('mouseup', stopShave);
window.addEventListener('touchend', stopShave);

let lastTouchX = null;
rotationPad.addEventListener('touchstart', (e) => {
    if (gameState !== 'PLAYING') return;
    lastTouchX = e.changedTouches[0].clientX;
}, {passive: true});

rotationPad.addEventListener('touchmove', (e) => {
    if (gameState !== 'PLAYING' || lastTouchX === null) return;
    e.preventDefault(); 
    let currentX = e.changedTouches[0].clientX;
    let dx = currentX - lastTouchX;
    bowlAngle -= dx * 0.015; 
    lastTouchX = currentX;
}, {passive: false});
rotationPad.addEventListener('touchend', () => lastTouchX = null);

finishBtn.addEventListener('click', () => { if (gameState === 'PLAYING') finishGame(); });

document.getElementById('start-btn').addEventListener('click', () => {
    shaveSound.play().then(() => shaveSound.pause()).catch(() => {});
    document.getElementById('start-screen').style.opacity = '0';
    document.getElementById('start-screen').style.pointerEvents = 'none';
    document.getElementById('ui-layer').classList.remove('hidden');
    setTimeout(() => { document.getElementById('ui-layer').style.opacity = '1'; startGame(); }, 100);
});

document.getElementById('retry-btn').addEventListener('click', () => {
    document.getElementById('result-screen').style.opacity = '0';
    document.getElementById('result-screen').style.pointerEvents = 'none';
    document.getElementById('retry-btn').style.pointerEvents = 'none';
    startGame();
});

function startGame() {
    gameState = 'PLAYING';
    isShaving = false;
    bowlAngle = 0;
    iceBlockAngle = 0;
    totalVolume = 0;
    hasCollapsed = false;
    stability = 100;
    fallingParticles = [];
    effectParticles = [];
    sparkles = [];
    
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let z = 0; z < GRID_SIZE; z++) { heightMap[x][z] = 0; }
    }
    document.getElementById('collapse-warning').style.opacity = '0';
    document.getElementById('penalty-stamp').style.opacity = '0';
    updateUI();
}

// --- 物理更新 ---
function updatePhysics() {
    if (gameState !== 'PLAYING') return;

    if (isShaving && !hasCollapsed) {
        iceBlockAngle -= 0.15; // 氷ブロックの横回転を進行させる
        
        for (let i = 0; i < 5; i++) {
            fallingParticles.push({
                wx: (Math.random() - 0.5) * 35, 
                wz: (Math.random() - 0.5) * 35,
                wy: 270, // 刃の真下から発生するように座標を修正
                vx: (Math.random() - 0.5) * 2,
                vz: (Math.random() - 0.5) * 2,
                vy: -8 - Math.random() * 4
            });
        }
        
        if (Math.random() < 0.3) {
            sparkles.push({
                x: cx + (Math.random() - 0.5) * 100,
                y: cy - 100 - Math.random() * 200,
                life: 30, maxLife: 30, size: Math.random() * 3 + 1
            });
        }
    }

    let activeParticles = [];
    const cosA = Math.cos(-bowlAngle);
    const sinA = Math.sin(-bowlAngle);

    for (let p of fallingParticles) {
        p.wx += p.vx;
        p.wz += p.vz;
        p.wy += p.vy;

        let lx = p.wx * cosA - p.wz * sinA;
        let lz = p.wx * sinA + p.wz * cosA;
        let gx = Math.floor(lx / CELL_SIZE) + GRID_SIZE / 2;
        let gz = Math.floor(lz / CELL_SIZE) + GRID_SIZE / 2;

        let landed = false;
        if (gx >= 0 && gx < GRID_SIZE && gz >= 0 && gz < GRID_SIZE) {
            if (cells.find(c => c.x === gx && c.z === gz).distSq <= BOWL_RADIUS * BOWL_RADIUS) {
                if (p.wy <= heightMap[gx][gz]) {
                    heightMap[gx][gz] += 2.0;
                    totalVolume += 2.0;
                    landed = true;
                    if(Math.random() < 0.05) {
                        sparkles.push({ x: cx + p.wx * PERSPECTIVE_X, y: cy + p.wz * PERSPECTIVE_Y - p.wy * HEIGHT_SCALE, life: 20, maxLife: 20, size: 2 });
                    }
                }
            } else if (p.wy <= -50) landed = true;
        } else if (p.wy <= -50) landed = true;

        if (!landed) activeParticles.push(p);
    }
    fallingParticles = activeParticles;

    let newMap = new Array(GRID_SIZE).fill(0).map((_, i) => new Float32Array(heightMap[i]));
    maxSlope = 0; let localMaxHeight = 0;
    for (let x = 1; x < GRID_SIZE - 1; x++) {
        for (let z = 1; z < GRID_SIZE - 1; z++) {
            let h = heightMap[x][z];
            if (h <= 0) continue;
            if (h > localMaxHeight) localMaxHeight = h;

            let reposeAngle = Math.max(3, 22 - (h / 25) - (totalVolume / 8000));
            let neighbors = [[x+1,z], [x-1,z], [x,z+1], [x,z-1]];
            
            for (let [nx, nz] of neighbors) {
                if (cells.find(c => c.x === nx && c.z === nz).distSq > BOWL_RADIUS * BOWL_RADIUS) continue;
                let diff = h - heightMap[nx][nz];
                if (diff > maxSlope) maxSlope = diff;
                
                if (diff > reposeAngle) {
                    let flow = (diff - reposeAngle) * 0.45;
                    newMap[x][z] -= flow;
                    newMap[nx][nz] += flow;
                }
            }
        }
    }
    heightMap = newMap;

    let targetStability = 100 - Math.max(0, (maxSlope - 18) * 8);
    if (localMaxHeight > 250) targetStability -= (localMaxHeight - 250) * 2;
    stability += (targetStability - stability) * 0.1;
    stability = Math.max(0, Math.min(100, stability));

    if (stability <= 5 && !hasCollapsed && totalVolume > 1500) triggerCollapse();

    for (let i = effectParticles.length - 1; i >= 0; i--) {
        let ep = effectParticles[i];
        ep.x += ep.vx; ep.y += ep.vy; ep.vy += 0.8; ep.life--;
        if (ep.life <= 0) effectParticles.splice(i, 1);
    }
    for (let i = sparkles.length - 1; i >= 0; i--) {
        sparkles[i].life--;
        if (sparkles[i].life <= 0) sparkles.splice(i, 1);
    }

    updateUI();
}

function triggerCollapse() {
    hasCollapsed = true;
    stopSound();
    const warning = document.getElementById('collapse-warning');
    warning.style.opacity = '1';
    setTimeout(() => warning.style.opacity = '0', 2000);

    for (let x = 0; x < GRID_SIZE; x++) {
        for (let z = 0; z < GRID_SIZE; z++) {
            let h = heightMap[x][z];
            if (h > 60) {
                heightMap[x][z] = h * 0.4;
                if (Math.random() < 0.2) {
                    let lx = (x - GRID_SIZE/2) * CELL_SIZE;
                    let lz = (z - GRID_SIZE/2) * CELL_SIZE;
                    let wx = lx * Math.cos(bowlAngle) - lz * Math.sin(bowlAngle);
                    let wz = lx * Math.sin(bowlAngle) + lz * Math.cos(bowlAngle);
                    effectParticles.push({
                        x: cx + wx * PERSPECTIVE_X, 
                        y: cy + wz * PERSPECTIVE_Y - h * HEIGHT_SCALE,
                        vx: (Math.random() - 0.5) * 25,
                        vy: -5 - Math.random() * 15,
                        life: 40 + Math.random() * 20
                    });
                }
            }
        }
    }
}

function updateUI() {
    document.getElementById('volume-text').innerText = `Vol: ${Math.floor(totalVolume)}`;
    const bar = document.getElementById('stability-bar');
    bar.style.width = `${stability}%`;
    if (stability > 50) bar.className = 'h-full bg-cyan-400 w-full transition-all duration-200';
    else if (stability > 25) bar.className = 'h-full bg-yellow-400 w-full transition-all duration-200';
    else bar.className = 'h-full bg-red-500 w-full transition-all duration-200';
}

// --- 描画ロジック ---
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let cell of cells) {
        cell.wx = cell.lx * Math.cos(bowlAngle) - cell.lz * Math.sin(bowlAngle);
        cell.wz = cell.lx * Math.sin(bowlAngle) + cell.lz * Math.cos(bowlAngle);
        cell.h = heightMap[cell.x][cell.z];
    }
    cells.sort((a, b) => a.wz - b.wz);

    drawBowlBack(); // 透明な器の奥側を描画

    // 氷の山の描画
    for (let cell of cells) {
        if (cell.distSq > BOWL_RADIUS * BOWL_RADIUS || cell.h <= 0) continue;

        let sx = cx + cell.wx * PERSPECTIVE_X;
        let base_y = cy + cell.wz * PERSPECTIVE_Y;
        let top_y = base_y - cell.h * HEIGHT_SCALE;

        let lighting = (cell.wx - cell.wz) / (BOWL_RADIUS * 2); 
        let brightness = 230 + lighting * 25; 
        
        ctx.fillStyle = `rgba(${brightness-10}, ${brightness+10}, ${brightness+25}, 0.85)`;
        let w = CELL_SIZE * PERSPECTIVE_X * 1.9; 
        
        ctx.beginPath();
        ctx.arc(sx, top_y, w/1.1, 0, Math.PI*2);
        ctx.fill();
        
        ctx.fillStyle = `rgba(${brightness-30}, ${brightness-15}, ${brightness+10}, 0.7)`;
        ctx.fillRect(sx - w/2, top_y, w, cell.h * HEIGHT_SCALE);
    }

    drawBowlFront(); // 透明な器の手前側を描画（氷の上に重なるガラス）

    // 降る氷
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    for (let p of fallingParticles) {
        let sx = cx + p.wx * PERSPECTIVE_X;
        let sy = cy + p.wz * PERSPECTIVE_Y - p.wy * HEIGHT_SCALE;
        
        ctx.beginPath();
        let r = 3 + Math.random()*4;
        ctx.moveTo(sx, sy - r);
        ctx.lineTo(sx + r, sy);
        ctx.lineTo(sx, sy + r);
        ctx.lineTo(sx - r, sy);
        ctx.fill();
    }

    ctx.fillStyle = 'rgba(220, 245, 255, 0.8)';
    for (let ep of effectParticles) {
        ctx.beginPath();
        ctx.arc(ep.x, ep.y, 4 + Math.random()*3, 0, Math.PI*2);
        ctx.fill();
    }

    drawMachine();
    drawSparkles();
}

function drawSparkles() {
    for (let s of sparkles) {
        let alpha = s.life / s.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - s.size*2);
        ctx.lineTo(s.x + s.size/2, s.y - s.size/2);
        ctx.lineTo(s.x + s.size*2, s.y);
        ctx.lineTo(s.x + s.size/2, s.y + s.size/2);
        ctx.lineTo(s.x, s.y + s.size*2);
        ctx.lineTo(s.x - s.size/2, s.y + s.size/2);
        ctx.lineTo(s.x - s.size*2, s.y);
        ctx.lineTo(s.x - s.size/2, s.y - s.size/2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;
}

// リアルな透明ガラス器（背面）
function drawBowlBack() {
    let R_X = BOWL_RADIUS * PERSPECTIVE_X + 25;
    let R_Y = BOWL_RADIUS * PERSPECTIVE_Y + 20;
    
    // 奥のガラスフチ
    ctx.strokeStyle = 'rgba(200, 240, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 10, R_X, R_Y, 0, Math.PI, Math.PI*2);
    ctx.stroke();
    
    // ガラスの奥側の壁（ごく薄い）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 10, R_X, R_Y, 0, Math.PI, Math.PI*2);
    ctx.fill();
}

// リアルな透明ガラス器（前面）
function drawBowlFront() {
    let R_X = BOWL_RADIUS * PERSPECTIVE_X + 25;
    let R_Y = BOWL_RADIUS * PERSPECTIVE_Y + 20;

    // 手前のガラスフチ（白く光る）
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 10, R_X, R_Y, 0, 0, Math.PI);
    ctx.stroke();

    // 器のボディ（透明ベース＋両端の白いハイライト）
    let grad = ctx.createLinearGradient(cx - R_X, 0, cx + R_X, 0);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    grad.addColorStop(0.1, 'rgba(255, 255, 255, 0.0)');
    grad.addColorStop(0.9, 'rgba(255, 255, 255, 0.0)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.4)');
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 10, R_X, R_Y, 0, 0, Math.PI);
    ctx.lineTo(cx - R_X * 0.4, cy + 80);
    ctx.ellipse(cx, cy + 80, R_X * 0.4, R_Y * 0.4, 0, Math.PI, 0, true);
    ctx.lineTo(cx + R_X, cy - 10);
    ctx.fill();

    // ガラス特有のカーブした強いハイライト
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(cx - R_X*0.6, cy + 30, R_X*0.1, R_Y*0.9, Math.PI/8, 0, Math.PI);
    ctx.stroke();

    // ガラスの台座（足）
    ctx.fillStyle = 'rgba(200, 240, 255, 0.15)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 80, R_X * 0.4, R_Y * 0.4, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();
    
    // 底面の接地面
    ctx.beginPath();
    ctx.ellipse(cx, cy + 100, R_X * 0.55, R_Y * 0.55, 0, 0, Math.PI*2);
    ctx.stroke();
    ctx.fill();
}

// リアルなレトロかき氷機（3D横回転対応）
function drawMachine() {
    ctx.save();
    ctx.translate(cx, cy - 400); 
    
    // 奥の支柱
    ctx.fillStyle = '#7a9eab'; 
    ctx.fillRect(-80, -250, 30, 250);
    ctx.fillRect(50, -250, 30, 250);

    // 回転する透明な氷ブロック (Y軸 3D横回転のシミュレート)
    ctx.save();
    ctx.translate(0, -90); // 氷の中心
    
    let w = 140;
    let h = 140;
    let cos = Math.cos(iceBlockAngle);
    let sin = Math.sin(iceBlockAngle);
    
    ctx.fillStyle = 'rgba(200, 240, 255, 0.3)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    
    // 正面と側面の交差で3D回転を表現
    let w1 = cos * w;
    let w2 = sin * w;
    
    ctx.fillRect(-w1/2, -h/2, w1, h);
    ctx.strokeRect(-w1/2, -h/2, w1, h);
    ctx.fillRect(-w2/2, -h/2, w2, h);
    ctx.strokeRect(-w2/2, -h/2, w2, h);

    // 氷の上下のフタ（円形）
    ctx.beginPath();
    ctx.ellipse(0, -h/2, w/2, 15, 0, 0, Math.PI*2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, h/2, w/2, 15, 0, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();

    // 中央のシャフト（ネジ山）
    ctx.fillStyle = '#555';
    ctx.fillRect(-8, -320, 16, 250);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    for(let y = -320; y < -70; y+=8) {
        ctx.beginPath(); ctx.moveTo(-8, y); ctx.lineTo(8, y+4); ctx.stroke();
    }

    // マシン上部アーチ
    ctx.fillStyle = '#a8cdd8'; 
    ctx.beginPath();
    ctx.roundRect(-110, -320, 220, 100, 30);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.roundRect(-110, -250, 220, 30, {bl: 30, br: 30});
    ctx.fill();

    // 赤い回転ハンドル
    ctx.save();
    ctx.translate(0, -320);
    if(isShaving) ctx.rotate(iceBlockAngle * -3); // 回転に連動
    ctx.fillStyle = '#dc2626'; 
    ctx.beginPath();
    ctx.arc(0, 0, 45, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#991b1b';
    for(let i=0; i<6; i++) {
        ctx.rotate(Math.PI/3);
        ctx.beginPath(); ctx.arc(0, 35, 12, 0, Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = '#ccc';
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    // 刃のカバー
    ctx.fillStyle = '#a8cdd8';
    ctx.beginPath();
    ctx.arc(0, -20, 85, Math.PI, 0, true);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(0, -20, 75, Math.PI, Math.PI*1.2, true);
    ctx.lineTo(0, -20);
    ctx.fill();

    ctx.restore();
}

// --- 採点アルゴリズム ---
function finishGame() {
    gameState = 'RESULT';
    stopSound();
    
    let maxH = 0;
    let weightX = 0, weightZ = 0, actualVol = 0;
    
    for (let x=0; x<GRID_SIZE; x++) {
        for(let z=0; z<GRID_SIZE; z++) {
            let h = heightMap[x][z];
            if (h > maxH) maxH = h;
            if (h > 0) {
                weightX += (x - GRID_SIZE/2) * h;
                weightZ += (z - GRID_SIZE/2) * h;
                actualVol += h;
            }
        }
    }

    let targetVol = 9000;
    let volScore = 30 - Math.abs(targetVol - totalVolume) * 0.003;
    if (volScore < 0 || totalVolume < 1000) volScore = 0;

    let heightScore = Math.min(30, (maxH / 180) * 30);

    let centerX = actualVol > 0 ? weightX / actualVol : 0;
    let centerZ = actualVol > 0 ? weightZ / actualVol : 0;
    let offsetDist = Math.sqrt(centerX*centerX + centerZ*centerZ);
    
    let balanceScore = 40 - (offsetDist * 8);
    if (balanceScore < 0) balanceScore = 0;
    if (totalVolume < 3000) balanceScore *= 0.5;

    let totalScore = Math.round(volScore + heightScore + balanceScore);
    
    if (hasCollapsed) {
        totalScore = Math.floor(totalScore * 0.3);
        document.getElementById('penalty-stamp').style.opacity = '1';
    }

    let rank = 'F';
    if (totalScore >= 95) rank = 'SS';
    else if (totalScore >= 85) rank = 'S';
    else if (totalScore >= 70) rank = 'A';
    else if (totalScore >= 50) rank = 'B';
    else if (totalScore >= 30) rank = 'C';

    document.getElementById('score-vol').innerText = `${Math.round(volScore)} / 30`;
    document.getElementById('score-height').innerText = `${Math.round(heightScore)} / 30`;
    document.getElementById('score-balance').innerText = `${Math.round(balanceScore)} / 40`;
    document.getElementById('score-total').innerText = `${totalScore} 点`;
    document.getElementById('rank-display').innerText = rank;

    let colorClass = 'text-stone-400';
    let name = '素朴な みぞれ';
    if (rank === 'SS') { colorClass = 'text-amber-300'; name = '幻の 和三盆きなこ'; }
    else if (rank === 'S') { colorClass = 'text-cyan-400'; name = '究極 宇治抹茶'; }
    else if (rank === 'A') { colorClass = 'text-red-400'; name = '完熟 贅沢いちご'; }
    else if (rank === 'B') { colorClass = 'text-yellow-400'; name = '爽やか 瀬戸内レモン'; }
    else if (rank === 'C') { colorClass = 'text-blue-400'; name = '定番 ブルーハワイ'; }

    const rankEl = document.getElementById('rank-display');
    rankEl.className = `text-9xl font-black mb-2 drop-shadow-[0_0_40px_currentColor] ${colorClass}`;
    document.getElementById('syrup-name').innerText = name;
    document.getElementById('syrup-name').className = `text-3xl mb-8 font-bold tracking-widest ${colorClass}`;

    const screen = document.getElementById('result-screen');
    const modal = document.getElementById('result-modal');
    const btn = document.getElementById('retry-btn');
    
    screen.style.pointerEvents = 'auto';
    screen.style.opacity = '1';
    modal.style.transform = 'scale(1)';
    btn.style.pointerEvents = 'auto';
}

function gameLoop() {
    updatePhysics();
    draw();
    requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);