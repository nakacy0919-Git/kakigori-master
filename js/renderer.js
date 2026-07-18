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
        let brightness = 235 + lighting * 20; 
        
        let w = CONFIG.CELL_SIZE * CONFIG.PERSPECTIVE_X * 1.5; 
        
        let radGrad = ctx.createRadialGradient(sx, top_y, 0, sx, top_y, w/1.2);
        radGrad.addColorStop(0, `rgba(${brightness}, ${brightness+5}, 255, 0.95)`);
        radGrad.addColorStop(1, `rgba(${brightness-15}, ${brightness}, 255, 0.1)`);
        
        ctx.fillStyle = radGrad;
        ctx.beginPath(); ctx.arc(sx, top_y, w/1.2, 0, Math.PI*2); ctx.fill();
        
        ctx.fillStyle = `rgba(${brightness-20}, ${brightness-10}, ${brightness+10}, 0.5)`;
        ctx.fillRect(sx - w/2.5, top_y, w/1.25, cell.h * CONFIG.HEIGHT_SCALE);

        if (Math.random() < 0.15) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(sx + (Math.random()-0.5)*w, top_y + (Math.random()-0.5)*w, 1.5, 1.5);
        }
    }

    drawBowlFront(ctx);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    for (let p of state.fallingParticles) {
        let sx = state.cx + p.wx * CONFIG.PERSPECTIVE_X;
        let sy = state.cy + p.wz * CONFIG.PERSPECTIVE_Y - p.wy * CONFIG.HEIGHT_SCALE;
        ctx.beginPath();
        let r = 1.5 + Math.random()*2;
        ctx.arc(sx, sy, r, 0, Math.PI*2);
        ctx.fill();
    }

    ctx.fillStyle = 'rgba(220, 245, 255, 0.8)';
    for (let ep of state.effectParticles) {
        ctx.beginPath(); ctx.arc(ep.x, ep.y, 3 + Math.random()*2, 0, Math.PI*2); ctx.fill();
    }

    drawMachine(ctx);
    drawSparkles(ctx);
}

function drawMachine(ctx) {
    ctx.save();
    
    let shakeX = state.isShaving ? (Math.random() - 0.5) * 3 : 0;
    let shakeY = state.isShaving ? (Math.random() - 0.5) * 3 : 0;
    ctx.translate(state.cx + shakeX, state.cy - 480 + shakeY); 
    
    ctx.fillStyle = '#1e293b'; 
    ctx.beginPath(); ctx.roundRect(-140, -220, 280, 380, 15); ctx.fill();
    ctx.fillStyle = '#020617'; 
    ctx.fillRect(-120, -110, 240, 240);

    ctx.save();
    let iceH = 170; 
    ctx.translate(0, 130 - iceH/2); 
    
    let w = 170;
    let cos = Math.cos(state.iceBlockAngle);
    let sin = Math.sin(state.iceBlockAngle);
    
    let w1 = cos * w; let w2 = sin * w;

    let grad1 = ctx.createLinearGradient(-w1/2, 0, w1/2, 0);
    grad1.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
    grad1.addColorStop(0.2, 'rgba(200, 240, 255, 0.15)');
    grad1.addColorStop(0.8, 'rgba(200, 240, 255, 0.05)');
    grad1.addColorStop(1, 'rgba(255, 255, 255, 0.8)');
    
    let grad2 = ctx.createLinearGradient(-w2/2, 0, w2/2, 0);
    grad2.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    grad2.addColorStop(0.5, 'rgba(200, 240, 255, 0.2)');
    grad2.addColorStop(1, 'rgba(255, 255, 255, 0.5)');

    ctx.fillStyle = grad1; ctx.fillRect(-w1/2, -iceH/2, w1, iceH);
    ctx.fillStyle = grad2; ctx.fillRect(-w2/2, -iceH/2, w2, iceH);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-30, -50); ctx.lineTo(10, 20); ctx.lineTo(-20, 60); ctx.lineTo(15, 80);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(-w1/2 + 8, -iceH/2 + 10, 10, iceH - 20);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(-w2/2 + 20, -iceH/2 + 15, 4, iceH - 30);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-w1/2, -iceH/2, w1, iceH);
    ctx.strokeRect(-w2/2, -iceH/2, w2, iceH);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath(); ctx.ellipse(0, -iceH/2, w/2, 15, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, iceH/2, w/2, 15, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.restore();

    let diskY = 130 - iceH; 
    ctx.fillStyle = '#b45309'; 
    ctx.beginPath(); ctx.ellipse(0, diskY, 80, 25, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#d97706'; 
    ctx.beginPath(); ctx.ellipse(0, diskY - 6, 80, 25, 0, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#334155';
    ctx.fillRect(-12, -250, 24, 250 + diskY);
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 4;
    for(let y = -250; y < diskY; y+=12) {
        ctx.beginPath(); ctx.moveTo(-12, y); ctx.lineTo(12, y+6); ctx.stroke();
    }

    ctx.fillStyle = '#334155'; 
    ctx.beginPath(); ctx.roundRect(-150, -250, 300, 120, {tl: 50, tr: 50, bl: 0, br: 0}); ctx.fill();
    
    ctx.fillStyle = '#ca8a04';
    ctx.beginPath(); ctx.ellipse(0, -190, 90, 35, 0, 0, Math.PI, true); ctx.fill();
    ctx.fillStyle = '#1e3a8a'; 
    ctx.beginPath(); ctx.moveTo(-45, -190); ctx.lineTo(0, -220); ctx.lineTo(45, -190); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(-20, -203); ctx.lineTo(0, -220); ctx.lineTo(20, -203); ctx.fill();

    ctx.fillStyle = '#475569';
    ctx.fillRect(-140, -140, 280, 18);
    ctx.fillRect(-140, 130, 280, 18);
    ctx.fillRect(-140, 160, 280, 18);

    ctx.fillStyle = '#1e293b';
    ctx.beginPath(); ctx.roundRect(-40, 178, 80, 30, {bl: 20, br: 20}); ctx.fill();

    ctx.save();
    ctx.translate(-170, -100); 
    ctx.scale(0.35, 1.0); 
    if(state.isShaving) ctx.rotate(state.iceBlockAngle * -3);
    
    ctx.strokeStyle = '#991b1b'; 
    ctx.lineWidth = 30;
    ctx.beginPath(); ctx.arc(0, 0, 120, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = '#ef4444'; 
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(0, 0, 120, 0, Math.PI*2); ctx.stroke();
    
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 20;
    for(let i=0; i<5; i++) {
        ctx.beginPath(); ctx.moveTo(-120, 0); ctx.lineTo(120, 0); ctx.stroke();
        ctx.rotate(Math.PI/5);
    }
    ctx.fillStyle = '#475569';
    ctx.beginPath(); ctx.arc(0, 0, 35, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#78350f'; 
    ctx.beginPath(); ctx.roundRect(100, -20, 70, 40, 10); ctx.fill();
    ctx.restore();

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