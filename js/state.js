// js/state.js

export const CONFIG = {
    GRID_SIZE: 40,
    CELL_SIZE: 7,
    PERSPECTIVE_X: 1.6,
    PERSPECTIVE_Y: 0.55,
    HEIGHT_SCALE: 1.5,
    TARGET_VOL: 12000 // ボリューム上限を増加
};

export const BOWL_RADIUS = (CONFIG.GRID_SIZE / 2) * CONFIG.CELL_SIZE - 15;

export const state = {
    cx: 0, 
    cy: 0,
    gameState: 'START',
    isShaving: false,
    bowlAngle: 0,
    iceBlockAngle: 0,
    totalVolume: 0,
    hasCollapsed: false,
    maxSlope: 0,
    balanceOffset: 0, // 新規：-1.0 (左) 〜 1.0 (右) の重心ズレ
    
    heightMap: [],
    cells: [],
    fallingParticles: [],
    effectParticles: [],
    sparkles: []
};

export function initCells() {
    state.heightMap = new Array(CONFIG.GRID_SIZE).fill(0).map(() => new Float32Array(CONFIG.GRID_SIZE));
    state.cells = [];
    for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
        for (let z = 0; z < CONFIG.GRID_SIZE; z++) {
            let lx = (x - CONFIG.GRID_SIZE/2) * CONFIG.CELL_SIZE;
            let lz = (z - CONFIG.GRID_SIZE/2) * CONFIG.CELL_SIZE;
            let distSq = lx*lx + lz*lz;
            state.cells.push({ x, z, lx, lz, distSq, wx: 0, wz: 0, h: 0 });
        }
    }
}