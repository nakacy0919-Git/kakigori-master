import { CONFIG, state, BOWL_RADIUS } from './state.js';

export function updatePhysics() {
    if (state.gameState !== 'PLAYING') return;

    if (state.isShaving && !state.hasCollapsed) {
        state.iceBlockAngle -= 0.15; 
        
        for (let i = 0; i < 20; i++) {
            let r = Math.random() * 25;
            let theta = (Math.random() - 0.5) * Math.PI; 
            let offsetX = 25 + r * Math.cos(theta); 
            let offsetZ = 15 + r * Math.sin(theta);
            
            state.fallingParticles.push({
                wx: offsetX,
                wz: offsetZ,
                wy: 450, 
                vx: (Math.random() - 0.5) * 2,
                vz: (Math.random() - 0.5) * 2,
                vy: -15 - Math.random() * 8
            });
        }
        
        if (Math.random() < 0.4) {
            state.sparkles.push({
                x: state.cx + (Math.random() - 0.5) * 120,
                y: state.cy - 100 - Math.random() * 200,
                life: 30, maxLife: 30, size: Math.random() * 3 + 1
            });
        }
    }

    let activeParticles = [];
    const cosA = Math.cos(-state.bowlAngle);
    const sinA = Math.sin(-state.bowlAngle);

    for (let p of state.fallingParticles) {
        p.wx += p.vx; p.wz += p.vz; p.wy += p.vy;

        let lx = p.wx * cosA - p.wz * sinA;
        let lz = p.wx * sinA + p.wz * cosA;
        let gx = Math.floor(lx / CONFIG.CELL_SIZE) + CONFIG.GRID_SIZE / 2;
        let gz = Math.floor(lz / CONFIG.CELL_SIZE) + CONFIG.GRID_SIZE / 2;

        let landed = false;
        if (gx >= 0 && gx < CONFIG.GRID_SIZE && gz >= 0 && gz < CONFIG.GRID_SIZE) {
            if (state.cells.find(c => c.x === gx && c.z === gz).distSq <= BOWL_RADIUS * BOWL_RADIUS) {
                if (p.wy <= state.heightMap[gx][gz]) {
                    state.heightMap[gx][gz] += 2.5;
                    state.totalVolume += 2.5;
                    landed = true;
                }
            } else if (p.wy <= -50) landed = true;
        } else if (p.wy <= -50) landed = true;

        if (!landed) activeParticles.push(p);
    }
    state.fallingParticles = activeParticles;

    let newMap = new Array(CONFIG.GRID_SIZE).fill(0).map((_, i) => new Float32Array(state.heightMap[i]));
    state.maxSlope = 0; 
    let localMaxHeight = 0;
    let weightX = 0;
    
    for (let x = 1; x < CONFIG.GRID_SIZE - 1; x++) {
        for (let z = 1; z < CONFIG.GRID_SIZE - 1; z++) {
            let h = state.heightMap[x][z];
            if (h <= 0) continue;
            
            if (h > localMaxHeight) localMaxHeight = h;
            weightX += (x - CONFIG.GRID_SIZE/2) * h;

            let reposeAngle = Math.max(4, 25 - (h / 30));
            let neighbors = [[x+1,z], [x-1,z], [x,z+1], [x,z-1]];
            
            for (let [nx, nz] of neighbors) {
                if (state.cells.find(c => c.x === nx && c.z === nz).distSq > BOWL_RADIUS * BOWL_RADIUS) continue;
                let diff = h - state.heightMap[nx][nz];
                if (diff > state.maxSlope) state.maxSlope = diff;
                
                if (diff > reposeAngle) {
                    let flow = (diff - reposeAngle) * 0.5;
                    newMap[x][z] -= flow;
                    newMap[nx][nz] += flow;
                }
            }
        }
    }
    state.heightMap = newMap;

    let cmX = state.totalVolume > 0 ? (weightX / state.totalVolume) : 0;
    state.balanceOffset = cmX / 12.0; 
    state.balanceOffset = Math.max(-1, Math.min(1, state.balanceOffset));

    if (!state.hasCollapsed && state.totalVolume > 2000) {
        if (Math.abs(cmX) > 6.0 || localMaxHeight > 300) {
            triggerCollapse();
        }
    }

    for (let i = state.effectParticles.length - 1; i >= 0; i--) {
        let ep = state.effectParticles[i];
        ep.x += ep.vx; ep.y += ep.vy; ep.vy += 0.8; ep.life--;
        if (ep.life <= 0) state.effectParticles.splice(i, 1);
    }
    for (let i = state.sparkles.length - 1; i >= 0; i--) {
        state.sparkles[i].life--;
        if (state.sparkles[i].life <= 0) state.sparkles.splice(i, 1);
    }
}

export function triggerCollapse() {
    state.hasCollapsed = true;
    const sound = document.getElementById('shave-sound');
    if(sound) sound.pause();
    
    const warning = document.getElementById('collapse-warning');
    if(warning) {
        warning.style.opacity = '1';
        setTimeout(() => warning.style.opacity = '0', 2000);
    }

    for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
        for (let z = 0; z < CONFIG.GRID_SIZE; z++) {
            let h = state.heightMap[x][z];
            if (h > 40) {
                state.heightMap[x][z] = h * 0.3;
                if (Math.random() < 0.3) {
                    let lx = (x - CONFIG.GRID_SIZE/2) * CONFIG.CELL_SIZE;
                    let lz = (z - CONFIG.GRID_SIZE/2) * CONFIG.CELL_SIZE;
                    let wx = lx * Math.cos(state.bowlAngle) - lz * Math.sin(state.bowlAngle);
                    let wz = lx * Math.sin(state.bowlAngle) + lz * Math.cos(state.bowlAngle);
                    state.effectParticles.push({
                        x: state.cx + wx * CONFIG.PERSPECTIVE_X, 
                        y: state.cy + wz * CONFIG.PERSPECTIVE_Y - h * CONFIG.HEIGHT_SCALE,
                        vx: (Math.random() - 0.5) * 35,
                        vy: -5 - Math.random() * 20,
                        life: 40 + Math.random() * 20
                    });
                }
            }
        }
    }
}