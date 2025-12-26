const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#1a1a2e',
    scene: { preload, create, update }
};

const game = new Phaser.Game(config);

const GRID_SIZE = 10;
const TILE_SIZE = Math.floor(window.innerWidth / 11);
const OFFSET_Y = 150; // Moved grid up slightly
const ANIMAL_FRAMES = [0, 1, 2, 3, 4, 5];

let grid = [];
let selectedTile = null;
let isProcessing = false;
let gameActive = false;
let score = 0;
let timeLeft = 60;

function preload() {
    this.load.spritesheet('animals', 'candy_sheet.png', { frameWidth: 136, frameHeight: 136 });
    this.load.audio('pop', 'https://actions.google.com/sounds/v1/cartoon/pop.ogg');
}

function create() {
    const style = { fontSize: '24px', fill: '#0fcc', fontStyle: 'bold' };
    
    // 1. HUD (Top)
    this.scoreText = this.add.text(20, 40, 'SCORE: 0', style).setDepth(10).setVisible(false);
    this.timerText = this.add.text(window.innerWidth - 100, 40, '60s', style).setDepth(10).setVisible(false);
    
    // 2. QUIT BUTTON (Bottom Center - completely clear of blocks)
    const quitY = OFFSET_Y + (GRID_SIZE * TILE_SIZE) + 40;
    this.quitBtn = this.add.text(window.innerWidth / 2, quitY, 'QUIT TO MENU', { 
        fontSize: '22px', 
        backgroundColor: '#e74c3c', 
        color: '#ffffff',
        padding: { x: 20, y: 10 }, 
        fontStyle: 'bold' 
    }).setOrigin(0.5).setInteractive().setDepth(10).setVisible(false);

    this.quitBtn.on('pointerdown', () => {
        location.reload(); 
    });

    // 3. Initial Grid Fill
    for (let y = 0; y < GRID_SIZE; y++) {
        grid[y] = [];
        for (let x = 0; x < GRID_SIZE; x++) {
            grid[y][x] = createTile(this, x, y);
        }
    }

    // 4. Menus
    createMenus(this);
}

function createTile(scene, x, y) {
    let frame = Phaser.Utils.Array.GetRandom(ANIMAL_FRAMES);
    let tile = scene.add.sprite(x * TILE_SIZE + TILE_SIZE, y * TILE_SIZE + OFFSET_Y, 'animals', frame);
    tile.setScale((TILE_SIZE / 136) * 0.9);
    tile.setInteractive();
    tile.setData({ x, y, color: frame });
    tile.on('pointerdown', () => handleTap(scene, tile));
    return tile;
}

function handleTap(scene, tile) {
    if (isProcessing || !gameActive) return;

    if (!selectedTile) {
        selectedTile = tile;
        tile.setAlpha(0.5);
    } else {
        let x1 = selectedTile.getData('x'), y1 = selectedTile.getData('y');
        let x2 = tile.getData('x'), y2 = tile.getData('y');

        if (Math.abs(x1 - x2) + Math.abs(y1 - y2) === 1) {
            isProcessing = true;
            selectedTile.setAlpha(1);
            executeSwap(scene, selectedTile, tile);
        } else {
            selectedTile.setAlpha(1);
            selectedTile = tile;
            tile.setAlpha(0.5);
        }
    }
}

function executeSwap(scene, t1, t2) {
    const x1 = t1.getData('x'), y1 = t1.getData('y');
    const x2 = t2.getData('x'), y2 = t2.getData('y');

    scene.tweens.add({ targets: t1, x: x2 * TILE_SIZE + TILE_SIZE, y: y2 * TILE_SIZE + OFFSET_Y, duration: 200 });
    scene.tweens.add({
        targets: t2, x: x1 * TILE_SIZE + TILE_SIZE, y: y1 * TILE_SIZE + OFFSET_Y, duration: 200,
        onComplete: () => {
            grid[y1][x1] = t2; grid[y2][x2] = t1;
            t1.setData({ x: x2, y: y2 }); t2.setData({ x: x1, y: y1 });

            if (!findMatches(scene)) {
                scene.tweens.add({ targets: t1, x: x1 * TILE_SIZE + TILE_SIZE, y: y1 * TILE_SIZE + OFFSET_Y, duration: 200 });
                scene.tweens.add({
                    targets: t2, x: x2 * TILE_SIZE + TILE_SIZE, y: y2 * TILE_SIZE + OFFSET_Y, duration: 200,
                    onComplete: () => {
                        grid[y1][x1] = t1; grid[y2][x2] = t2;
                        t1.setData({ x: x1, y: y1 }); t2.setData({ x: x2, y: y2 });
                        isProcessing = false; selectedTile = null;
                    }
                });
            } else {
                runGravity(scene);
            }
        }
    });
}

function findMatches(scene) {
    let toDestroy = new Set();
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE - 2; x++) {
            if (grid[y][x].getData('color') === grid[y][x+1].getData('color') && grid[y][x].getData('color') === grid[y][x+2].getData('color')) {
                toDestroy.add(grid[y][x]); toDestroy.add(grid[y][x+1]); toDestroy.add(grid[y][x+2]);
            }
        }
    }
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE - 2; y++) {
            if (grid[y][x].getData('color') === grid[y+1][x].getData('color') && grid[y][x].getData('color') === grid[y+2][x].getData('color')) {
                toDestroy.add(grid[y][x]); toDestroy.add(grid[y+1][x]); toDestroy.add(grid[y+2][x]);
            }
        }
    }
    if (toDestroy.size > 0) {
        toDestroy.forEach(t => { grid[t.getData('y')][t.getData('x')] = null; t.destroy(); score += 10; });
        scene.scoreText.setText('SCORE: ' + score);
        scene.sound.play('pop');
        return true;
    }
    return false;
}

function runGravity(scene) {
    let maxWait = 0;
    for (let x = 0; x < GRID_SIZE; x++) {
        let holes = 0;
        for (let y = GRID_SIZE - 1; y >= 0; y--) {
            if (grid[y][x] === null) { holes++; } 
            else if (holes > 0) {
                let t = grid[y][x];
                grid[y + holes][x] = t; grid[y][x] = null;
                t.setData('y', y + holes);
                scene.tweens.add({ targets: t, y: (y + holes) * TILE_SIZE + OFFSET_Y, duration: 300 });
                maxWait = 350;
            }
        }
        for (let i = 0; i < holes; i++) {
            let t = createTile(scene, x, i);
            grid[i][x] = t; t.y -= 200;
            scene.tweens.add({ targets: t, y: i * TILE_SIZE + OFFSET_Y, duration: 400 });
            maxWait = 450;
        }
    }
    scene.time.delayedCall(maxWait, () => {
        if (findMatches(scene)) runGravity(scene);
        else { isProcessing = false; selectedTile = null; }
    });
}

function createMenus(scene) {
    scene.mainMenu = scene.add.container(0, 0).setDepth(100);
    let bg = scene.add.rectangle(config.width/2, config.height/2, config.width, config.height, 0x1a1a2e, 1);
    let btn1 = scene.add.text(config.width/2, config.height/2 - 60, 'START RUSH', { fontSize: '32px', backgroundColor: '#0fcc', padding: 15, color: '#000', fontStyle: 'bold' }).setOrigin(0.5).setInteractive();
    let btn2 = scene.add.text(config.width/2, config.height/2 + 60, 'ENDLESS', { fontSize: '32px', backgroundColor: '#f1c40f', padding: 15, color: '#000', fontStyle: 'bold' }).setOrigin(0.5).setInteractive();
    
    btn1.on('pointerdown', () => { hideMenu(scene); startTimer(scene); });
    btn2.on('pointerdown', () => { hideMenu(scene); });
    
    scene.mainMenu.add([bg, btn1, btn2]);
}

function hideMenu(scene) {
    scene.mainMenu.setVisible(false);
    gameActive = true;
    scene.scoreText.setVisible(true);
    scene.quitBtn.setVisible(true);
}

function startTimer(scene) {
    scene.timerText.setVisible(true);
    scene.time.addEvent({ delay: 1000, callback: () => { if(gameActive) { timeLeft--; scene.timerText.setText(timeLeft+'s'); if(timeLeft<=0) location.reload(); }}, loop: true });
}

function update() {}
        
