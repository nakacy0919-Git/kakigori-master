import { CONFIG, state, initCells } from './state.js';
import { updatePhysics } from './physics.js';
import { draw } from './renderer.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });

const shaveSound = document.getElementById('shave-sound');
const bgmSound = document.getElementById('bgm-sound');
bgmSound.volume = 0.4; 

const shaveBtn = document.getElementById('shave-btn');
const finishBtn = document.getElementById('finish-btn');
const rotationPad = document.getElementById('rotation-pad');
const bubble = document.getElementById('balance-bubble');

const bgmToggleBtn = document.getElementById('bgm-toggle-btn');
const iconSoundOn = document.getElementById('icon-sound-on');
const iconSoundOff = document.getElementById('icon-sound-off');

let isBgmPlaying = false;
let bgmInitialized = false;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    state.cx = canvas.width / 2;
    state.cy = canvas.height * 0.8;
}
window.addEventListener('resize', resize);
resize();
initCells();

function playSound() { if(shaveSound.paused) { shaveSound.currentTime = 0; shaveSound.play().catch(()=>{}); } }
function stopSound() { shaveSound.pause(); }

function toggleBgm() {
    if (isBgmPlaying) {
        bgmSound.pause();
        isBgmPlaying = false;
        iconSoundOn.classList.add('hidden');
        iconSoundOff.classList.remove('hidden');
    } else {
        bgmSound.play().catch(e => console.log("BGM play failed", e));
        isBgmPlaying = true;
        bgmInitialized = true;
        iconSoundOn.classList.remove('hidden');
        iconSoundOff.classList.add('hidden');
    }
}

bgmToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleBgm();
});

function initAudioOnFirstInteraction() {
    if (!bgmInitialized && !isBgmPlaying) {
        toggleBgm();
    }
    document.body.removeEventListener('click', initAudioOnFirstInteraction);
    document.body.removeEventListener('touchstart', initAudioOnFirstInteraction);
}
document.body.addEventListener('click', initAudioOnFirstInteraction);
document.body.addEventListener('touchstart', initAudioOnFirstInteraction, { passive: true });

function startShave(e) {
    if (e && e.cancelable) e.preventDefault();
    if (state.gameState !== 'PLAYING') return;
    state.isShaving = true;
    shaveBtn.classList.add('shave-btn-active');
    shaveBtn.classList.remove('shave-btn-base');
    playSound();
}

function stopShave(e) {
    if (e && e.cancelable) e.preventDefault();
    state.isShaving = false;
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
    if (state.gameState !== 'PLAYING') return;
    lastTouchX = e.changedTouches[0].clientX;
}, {passive: true});

rotationPad.addEventListener('touchmove', (e) => {
    if (state.gameState !== 'PLAYING' || lastTouchX === null) return;
    e.preventDefault(); 
    let currentX = e.changedTouches[0].clientX;
    let dx = currentX - lastTouchX;
    state.bowlAngle -= dx * 0.02; 
    lastTouchX = currentX;
}, {passive: false});
rotationPad.addEventListener('touchend', () => lastTouchX = null);

finishBtn.addEventListener('click', () => { if (state.gameState === 'PLAYING') finishGame(); });

document.getElementById('start-btn').addEventListener('click', () => {
    shaveSound.play().then(() => shaveSound.pause()).catch(() => {});
    
    const panels = document.querySelectorAll('.noren-panel');
    if (panels.length >= 3) {
        panels[0].classList.add('noren-open-left');
        panels[1].classList.add('noren-open-center');
        panels[2].classList.add('noren-open-right');
    }

    setTimeout(() => {
        const startScreen = document.getElementById('start-screen');
        startScreen.style.opacity = '0';
        startScreen.style.pointerEvents = 'none';
        document.getElementById('ui-layer').classList.remove('hidden');
        
        setTimeout(() => { 
            document.getElementById('ui-layer').style.opacity = '1'; 
            startGame(); 
        }, 600);
    }, 800);
});

document.getElementById('retry-btn').addEventListener('click', () => {
    document.getElementById('result-screen').style.opacity = '0';
    document.getElementById('result-screen').style.pointerEvents = 'none';
    document.getElementById('retry-btn').style.pointerEvents = 'none';
    startGame();
});

function startGame() {
    state.gameState = 'PLAYING';
    state.isShaving = false;
    state.bowlAngle = 0;
    state.iceBlockAngle = 0;
    state.totalVolume = 0;
    state.hasCollapsed = false;
    state.balanceOffset = 0;
    state.fallingParticles = [];
    state.effectParticles = [];
    state.sparkles = [];
    
    for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
        for (let z = 0; z < CONFIG.GRID_SIZE; z++) { state.heightMap[x][z] = 0; }
    }
    document.getElementById('collapse-warning').style.opacity = '0';
    document.getElementById('penalty-stamp').style.opacity = '0';
}

function updateUI() {
    if (state.gameState !== 'PLAYING') return;
    document.getElementById('volume-text').innerText = `Vol: ${Math.floor(state.totalVolume)}`;
    
    if (bubble) {
        let percentX = 50 + (state.balanceOffset * 50);
        percentX = Math.max(5, Math.min(95, percentX)); 
        bubble.style.left = `${percentX}%`;

        if (Math.abs(state.balanceOffset) > 0.6) {
            bubble.className = "absolute w-6 h-6 rounded-full bg-gradient-to-br from-red-400 to-red-600 shadow-[0_0_15px_rgba(239,68,68,0.9)] top-1/2 transform -translate-y-1/2 -translate-x-1/2 transition-all duration-75 ease-out z-10 border border-white/50";
        } else {
            bubble.className = "absolute w-6 h-6 rounded-full bg-gradient-to-br from-emerald-300 to-emerald-500 shadow-[0_0_10px_rgba(52,211,153,0.8)] top-1/2 transform -translate-y-1/2 -translate-x-1/2 transition-all duration-75 ease-out z-10 border border-white/50";
        }
    }
}

function finishGame() {
    state.gameState = 'RESULT';
    stopSound();
    
    let maxH = 0; let weightX = 0, weightZ = 0, actualVol = 0;
    for (let x=0; x<CONFIG.GRID_SIZE; x++) {
        for(let z=0; z<CONFIG.GRID_SIZE; z++) {
            let h = state.heightMap[x][z];
            if (h > maxH) maxH = h;
            if (h > 0) {
                weightX += (x - CONFIG.GRID_SIZE/2) * h;
                weightZ += (z - CONFIG.GRID_SIZE/2) * h;
                actualVol += h;
            }
        }
    }

    let volScore = 30 - Math.abs(CONFIG.TARGET_VOL - state.totalVolume) * 0.002;
    if (volScore < 0 || state.totalVolume < 1500) volScore = 0;
    let heightScore = Math.min(30, (maxH / 200) * 30);
    
    let centerX = actualVol > 0 ? weightX / actualVol : 0;
    let centerZ = actualVol > 0 ? weightZ / actualVol : 0;
    let offsetDist = Math.sqrt(centerX*centerX + centerZ*centerZ);
    let balanceScore = 40 - (offsetDist * 6);
    if (balanceScore < 0) balanceScore = 0;
    if (state.totalVolume < 3000) balanceScore *= 0.5;

    let totalScore = Math.round(volScore + heightScore + balanceScore);
    if (state.hasCollapsed) {
        totalScore = Math.floor(totalScore * 0.2); 
        document.getElementById('penalty-stamp').style.opacity = '1';
    }

    let rank = 'F';
    if (totalScore >= 95) rank = 'SS'; else if (totalScore >= 85) rank = 'S';
    else if (totalScore >= 70) rank = 'A'; else if (totalScore >= 50) rank = 'B'; else if (totalScore >= 30) rank = 'C';

    document.getElementById('score-vol').innerText = `${Math.round(volScore)} / 30`;
    document.getElementById('score-height').innerText = `${Math.round(heightScore)} / 30`;
    document.getElementById('score-balance').innerText = `${Math.round(balanceScore)} / 40`;
    document.getElementById('score-total').innerText = `${totalScore} 点`;
    document.getElementById('rank-display').innerText = rank;

    const screen = document.getElementById('result-screen');
    const modal = document.getElementById('result-modal');
    screen.style.pointerEvents = 'auto';
    screen.style.opacity = '1';
    modal.style.transform = 'scale(1)';
    document.getElementById('retry-btn').style.pointerEvents = 'auto';
}

function gameLoop() {
    updatePhysics();
    updateUI();
    draw(ctx, canvas);
    requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);