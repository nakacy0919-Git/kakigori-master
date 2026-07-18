// js/renderer.js
import { CONFIG, state, BOWL_RADIUS } from './state.js';

export function draw(ctx, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let cell of state.cells) {
        cell.wx = cell.lx * Math.cos(state.bowlAngle) - cell.lz * Math.sin(state.bowlAngle);
        cell.wz = cell.lx * Math.sin(state.bowlAngle) + cell.lz * Math.cos(state.bowlAngle);
        cell.h = state.heightMap[cell.x][cell.z];
    }
    state.cells.sort((a, b) => a.wz - b.wz);

    drawBowlBack(ctx);

    for (let cell of state.cells) {
        if (cell.distSq > BOWL_RADIUS * BOWL_RADIUS || cell.h <= 0) continue;
        let sx = state.cx + cell.wx * CONFIG.PERSPECTIVE_X;
        let base_y = state.cy + cell.wz * CONFIG.PERSPECTIVE_Y;
        let top_y = base_y - cell.h * CONFIG.HEIGHT_SCALE;
        let lighting = (cell.wx - cell.wz) / (BOWL_RADIUS * 2); 
        let brightness = 230 + lighting * 25; 
        
        ctx.fillStyle = `rgba(${brightness-10}, ${brightness+10}, ${brightness+25}, 0.85)`;
        let w = CONFIG.CELL_SIZE * CONFIG.PERSPECTIVE_X * 1.9; 
        ctx.beginPath(); ctx.arc(sx, top_y, w/1.1, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = `rgba(${brightness-30}, ${brightness-15}, ${brightness+10}, 0.7)`;
        ctx.fillRect(sx - w/2, top_y, w, cell.h * CONFIG.HEIGHT_SCALE);
    }

    drawBowlFront(ctx);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    for (let p of state.fallingParticles) {
        let sx = state.cx + p.wx * CONFIG.PERSPECTIVE_X;
        let sy = state.cy + p.wz * CONFIG.PERSPECTIVE_Y - p.wy * CONFIG.HEIGHT_SCALE;
        ctx.beginPath();
        let r = 4 + Math.random()*5;
        ctx.moveTo(sx, sy - r); ctx.lineTo(sx + r, sy); ctx.lineTo(sx, sy + r); ctx.lineTo(sx - r, sy);
        ctx.fill();
    }

    ctx.fillStyle = 'rgba(220, 245, 255, 0.8)';
    for (let ep of state.effectParticles) {
        ctx.beginPath(); ctx.arc(ep.x, ep.y, 4 + Math.random()*3, 0, Math.PI*2); ctx.fill();
    }

    drawMachine(ctx);
    drawSparkles(ctx);
}

// 高級キャストアイアン風 かき氷機
function drawMachine(ctx) {
    ctx.save();
    
    let shakeX = state.isShaving ? (Math.random() - 0.5) * 3 : 0;
    let shakeY = state.isShaving ? (Math.random() - 0.5) * 3 : 0;
    // 皿との距離を出すため大幅に上へ (-480)
    ctx.translate(state.cx + shakeX, state.cy - 480 + shakeY); 
    
    // 1. 本体の奥側・背板 (重厚なマットブラック)
    ctx.fillStyle = '#1e293b'; 
    ctx.beginPath(); ctx.roundRect(-140, -220, 280, 380, 15); ctx.fill();
    ctx.fillStyle = '#020617'; 
    ctx.fillRect(-120, -110, 240, 240);

    // 2. 回転する透明な氷ブロック
    ctx.save();
    let maxIceH = 180;
    let currentIceH = Math.max(10, maxIceH - (state.totalVolume / 100));
    ctx.translate(0, 130 - currentIceH/2); 
    
    let w = 170;
    let cos = Math.cos(state.iceBlockAngle);
    let sin = Math.sin(state.iceBlockAngle);
    
    ctx.fillStyle = 'rgba(220, 245, 255, 0.3)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    
    let w1 = cos * w; let w2 = sin * w;
    ctx.fillRect(-w1/2, -currentIceH/2, w1, currentIceH); ctx.strokeRect(-w1/2, -currentIceH/2, w1, currentIceH);
    ctx.fillRect(-w2/2, -currentIceH/2, w2, currentIceH); ctx.strokeRect(-w2/2, -currentIceH/2, w2, currentIceH);
    
    ctx.beginPath(); ctx.ellipse(0, -currentIceH/2, w/2, 15, 0, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, currentIceH/2, w/2, 15, 0, 0, Math.PI*2); ctx.stroke();
    ctx.restore();

    // 3. 氷を押さえる金属円盤とシャフト (真鍮/ゴールド)
    let diskY = 130 - currentIceH; 
    ctx.fillStyle = '#b45309'; // ブロンズ
    ctx.beginPath(); ctx.ellipse(0, diskY, 80, 25, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#d97706'; // ゴールドハイライト
    ctx.beginPath(); ctx.ellipse(0, diskY - 6, 80, 25, 0, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#334155';
    ctx.fillRect(-12, -250, 24, 250 + diskY);
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 4;
    for(let y = -250; y < diskY; y+=12) {
        ctx.beginPath(); ctx.moveTo(-12, y); ctx.lineTo(12, y+6); ctx.stroke();
    }

    // 4. マシン前面フレーム
    ctx.fillStyle = '#334155'; // キャストアイアングレー
    ctx.beginPath(); ctx.roundRect(-150, -250, 300, 120, {tl: 50, tr: 50, bl: 0, br: 0}); ctx.fill();
    
    // 真鍮のロゴプレート
    ctx.fillStyle = '#ca8a04';
    ctx.beginPath(); ctx.ellipse(0, -190, 90, 35, 0, 0, Math.PI, true); ctx.fill();
    ctx.fillStyle = '#1e3a8a'; 
    ctx.beginPath(); ctx.moveTo(-45, -190); ctx.lineTo(0, -220); ctx.lineTo(45, -190); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(-20, -203); ctx.lineTo(0, -220); ctx.lineTo(20, -203); ctx.fill();

    // スリットガード
    ctx.fillStyle = '#475569';
    ctx.fillRect(-140, -140, 280, 18);
    ctx.fillRect(-140, 130, 280, 18);
    ctx.fillRect(-140, 160, 280, 18);

    // ノズル（氷が出る部分）
    ctx.fillStyle = '#1e293b';
    ctx.beginPath(); ctx.roundRect(-40, 178, 80, 30, {bl: 20, br: 20}); ctx.fill();

    // 5. 巨大サイド手回しホイール (自然な奥行きと立体感)
    ctx.save();
    ctx.translate(-170, -100); 
    // Y軸を中心に回転させたようなパースペクティブを付与
    ctx.scale(0.35, 1.0); 
    if(state.isShaving) ctx.rotate(state.iceBlockAngle * -3);
    
    // 深紅のホイールリム
    ctx.strokeStyle = '#991b1b'; 
    ctx.lineWidth = 30;
    ctx.beginPath(); ctx.arc(0, 0, 120, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = '#ef4444'; // ハイライト
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(0, 0, 120, 0, Math.PI*2); ctx.stroke();
    
    // スポーク (真鍮色)
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 20;
    for(let i=0; i<5; i++) {
        ctx.beginPath(); ctx.moveTo(-120, 0); ctx.lineTo(120, 0); ctx.stroke();
        ctx.rotate(Math.PI/5);
    }
    // 中央ハブ
    ctx.fillStyle = '#475569';
    ctx.beginPath(); ctx.arc(0, 0, 35, 0, Math.PI*2); ctx.fill();
    // 木製のハンドル (手前側に飛び出しているように)
    ctx.fillStyle = '#78350f'; 
    ctx.beginPath(); ctx.roundRect(100, -20, 70, 40, 10); ctx.fill();
    ctx.restore();

    // 6. 上部の締め込みハンドル (ゴールド)
    ctx.fillStyle = '#ca8a04';
    ctx.beginPath(); ctx.ellipse(0, -260, 45, 12, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillRect(-8, -260, 16, 20);

    ctx.restore();
}

function drawBowlBack(ctx) {
    let R_X = BOWL_RADIUS * CONFIG.PERSPECTIVE_X + 25;
    let R_Y = BOWL_RADIUS * CONFIG.PERSPECTIVE_Y + 20;
    ctx.strokeStyle = 'rgba(200, 240, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(state.cx, state.cy - 10, R_X, R_Y, 0, Math.PI, Math.PI*2); ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.beginPath(); ctx.ellipse(state.cx, state.cy - 10, R_X, R_Y, 0, Math.PI, Math.PI*2); ctx.fill();
}

function drawBowlFront(ctx) {
    let R_X = BOWL_RADIUS * CONFIG.PERSPECTIVE_X + 25;
    let R_Y = BOWL_RADIUS * CONFIG.PERSPECTIVE_Y + 20;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(state.cx, state.cy - 10, R_X, R_Y, 0, 0, Math.PI); ctx.stroke();

    let grad = ctx.createLinearGradient(state.cx - R_X, 0, state.cx + R_X, 0);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    grad.addColorStop(0.1, 'rgba(255, 255, 255, 0.0)');
    grad.addColorStop(0.9, 'rgba(255, 255, 255, 0.0)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.4)');
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(state.cx, state.cy - 10, R_X, R_Y, 0, 0, Math.PI);
    ctx.lineTo(state.cx - R_X * 0.4, state.cy + 80);
    ctx.ellipse(state.cx, state.cy + 80, R_X * 0.4, R_Y * 0.4, 0, Math.PI, 0, true);
    ctx.lineTo(state.cx + R_X, state.cy - 10);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(state.cx - R_X*0.6, state.cy + 30, R_X*0.1, R_Y*0.9, Math.PI/8, 0, Math.PI); ctx.stroke();

    ctx.fillStyle = 'rgba(200, 240, 255, 0.15)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(state.cx, state.cy + 80, R_X * 0.4, R_Y * 0.4, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(state.cx, state.cy + 100, R_X * 0.55, R_Y * 0.55, 0, 0, Math.PI*2); ctx.stroke(); ctx.fill();
}

function drawSparkles(ctx) {
    for (let s of state.sparkles) {
        ctx.globalAlpha = s.life / s.maxLife;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - s.size*2); ctx.lineTo(s.x + s.size/2, s.y - s.size/2);
        ctx.lineTo(s.x + s.size*2, s.y); ctx.lineTo(s.x + s.size/2, s.y + s.size/2);
        ctx.lineTo(s.x, s.y + s.size*2); ctx.lineTo(s.x - s.size/2, s.y + s.size/2);
        ctx.lineTo(s.x - s.size*2, s.y); ctx.lineTo(s.x - s.size/2, s.y - s.size/2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;
}