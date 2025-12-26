const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#1a1a2e',
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

const GRID_SIZE = 10;
let TILE_SIZE = Math.floor(window.innerWidth / 11);
const ANIMAL_FRAMES = [0, 1, 2, 3, 4, 5];

let grid = [];
let selectedTile = null;
let isProcessing = false;
let score = 0;
let timeLeft = 60;
let gameActive = false;
let gameMode = 'rush';
let lastMoveTime = 0;
let timerEvent;

function preload() {
    this.load.spritesheet('animals', 'candy_sheet.png', { frameWidth: 136, frameHeight: 136 });
    this.load.audio('pop', 'https://actions.google.com/sounds/v1/cartoon/pop.ogg');
    this.load.audio('bomb', 'https://actions.google.com/sounds/v1/science_fiction/stinger_ray_gun.ogg');
}

function create() {
    const style = { fontSize: '28px', fill: '#00ffcc', fontStyle: 'bold' };
    this.scoreText = this.add.text(20, 20, 'SCORE: 0', style).setDepth(50).setVisible(false);
    this.timerText = this.add.text(window.innerWidth - 120, 20, '60s', style).setDepth(50).setVisible(false);

    // PAUSE BUTTON (In-Game)
    this.pauseBtn = this.add.text(window.innerWidth / 2, 35, 'PAUSE', { fontSize: '24px', backgroundColor: '#e74c3c', padding: 8 })
        .setOrigin(0.5).setInteractive().setDepth(50).setVisible(false)
        .on('pointerdown', () => showPauseMenu(this));

    createGrid(this);
    createMainMenu(this);
    createPauseMenu(this);
}

// --- MENUS ---

function createMainMenu(scene) {
    scene.menuGroup = scene.add.container(0, 0).setDepth(100);
    let bg = scene.add.rectangle(config.width/2, config.height/2, config.width, config.height, 0x1a1a2e, 1);
    let title = scene.add.text(config.width/2, config.height/4, 'ANIMAL POP', { fontSize: '64px', fill: '#ff0066', fontStyle: 'bold' }).setOrigin(0.5);
    
    let rushBtn = createBtn(scene, config.height/2 - 50, '1 MIN RUSH', '#00ffcc', () => startLevel(scene, 'rush'));
    let endlessBtn = createBtn(scene, config.height/2 + 50, 'ENDLESS MODE', '#f1c40f', () => startLevel(scene, 'endless'));

    scene.menuGroup.add([bg, title, rushBtn, endlessBtn]);
}

function createPauseMenu(scene) {
    scene.pauseGroup = scene.add.container(0, 0).setDepth(101).setVisible(false);
    let bg = scene.add.rectangle(config.width/2, config.height/2, config.width, config.height, 0x000000, 0.8);
    
    let resumeBtn = createBtn(scene, config.height/2 - 50, 'RESUME', '#2ecc71', () => hidePauseMenu(scene));
    let quitBtn = createBtn(scene, config.height/2 + 50, 'QUIT GAME', '#e74c3c', () => location.reload());

    scene.pauseGroup.add([bg, resumeBtn, quitBtn]);
}

function createBtn(scene, y, label, color, callback) {
    return scene.add.text(config.width/2, y, label, { fontSize: '32px', backgroundColor: color, color: '#000', padding: 15 })
        .setOrigin(0.5).setInteractive().on('pointerdown', callback);
}

// --- GAME CONTROLS ---

function startLevel(scene, mode) {
    gameMode = mode;
    score = 0;
    timeLeft = 60;
    gameActive = true;
    scene.menuGroup.setVisible(false);
    scene.scoreText.setVisible(true).setText('SCORE: 0');
    scene.pauseBtn.setVisible(true);
    
    if (mode === 'rush') {
        scene.timerText.setVisible(true).setText('60s');
        if (timerEvent) timerEvent.remove();
        timerEvent = scene.time.addEvent({
            delay: 1000,
            callback: () => { if(gameActive) { timeLeft--; scene.timerText.setText(timeLeft + 's'); if(timeLeft <= 0) location.reload(); }},
            loop: true
        });
    } else {
        scene.timerText.setVisible(false);
    }
    
    spawnColorBomb(scene);
}

function showPauseMenu(scene) {
    gameActive = false;
    scene.pauseGroup.setVisible(true);
}

function hidePauseMenu(scene) {
    gameActive = true;
    scene.pauseGroup.setVisible(false);
}

// --- TILE LOGIC ---

function spawnTile(x, y, scene) {
    let frame = Phaser.Utils.Array.GetRandom(ANIMAL_FRAMES);
    let tile = scene.add.sprite(x * TILE_SIZE + TILE_SIZE, y * TILE_SIZE + 200, 'animals', frame);
    tile.setScale((TILE_SIZE / 136) * 0.9).setInteractive();
    tile.setData({ color: frame, gridX: x, gridY: y });
    tile.on('pointerdown', () => handleSelect(tile, scene));
    return tile;
}

function createGrid(scene) {
    for (let y = 0; y < GRID_SIZE; y++) {
        grid[y] = [];
        for (let x = 0; x < GRID_SIZE; x++) {
            grid[y][x] = spawnTile(x, y, scene);
        }
    }
}

async function handleSelect(tile, scene) {
    if (isProcessing || !gameActive) return;
    lastMoveTime = scene.time.now;

    // --- COLOR BOMB LOGIC (Instant Touch) ---
    if (tile.getData('special') === 'colorBomb') {
        isProcessing = true;
        scene.sound.play('bomb');
        await explodeColor(scene, tile.getData('color'));
        grid[tile.getData('gridY')][tile.getData('gridX')] = null;
        tile.destroy();
        isProcessing = false;
        return;
    }

    if (!selectedTile) {
        selectedTile = tile;
        tile.setAlpha(0.5);
    } else {
        let x1 = selectedTile.getData('gridX'), y1 = selectedTile.getData('gridY');
        let x2 = tile.getData('gridX'), y2 = tile.getData('gridY');

        if (Math.abs(x1 - x2) + Math.abs(y1 - y2) === 1) {
            isProcessing = true;
            selectedTile.setAlpha(1);
            swapTiles(selectedTile, tile, scene, true);
        } else {
            selectedTile.setAlpha(1);
            selectedTile = tile;
            tile.setAlpha(0.5);
        }
    }
}

// --- MOVEMENT & PHYSICS ---

function swapTiles(tile1, tile2, scene, check) {
    const x1 = tile1.getData('gridX'), y1 = tile1.getData('gridY');
    const x2 = tile2.getData('gridX'), y2 = tile2.getData('gridY');

    grid[y1][x1] = tile2; grid[y2][x2] = tile1;
    tile1.setData({gridX: x2, gridY: y2});
    tile2.setData({gridX: x1, gridY: y1});

    scene.tweens.add({
        targets: [tile1, tile2],
        x: (t) => t.getData('gridX') * TILE_SIZE + TILE_SIZE,
        y: (t) => t.getData('gridY') * TILE_SIZE + 200,
        duration: 200,
        onComplete: () => {
            if (check) {
                if (!checkMatches(scene)) {
                    swapTiles(tile1, tile2, scene, false);
                    isProcessing = false;
                    selectedTile = null;
                } else {
                    processMatches(scene);
                }
            } else {
                isProcessing = false;
                selectedTile = null;
            }
        }
    });
}

function checkMatches(scene) {
    let matchedSet = new Set();
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE - 2; x++) {
            let t1 = grid[y][x], t2 = grid[y][x+1], t3 = grid[y][x+2];
            if (t1 && t2 && t3 && t1.getData('color') === t2.getData('color') && t1.getData('color') === t3.getData('color')) {
                matchedSet.add(t1); matchedSet.add(t2); matchedSet.add(t3);
            }
        }
    }
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE - 2; y++) {
            let t1 = grid[y][x], t2 = grid[y+1][x], t3 = grid[y+2][x];
            if (t1 && t2 && t3 && t1.getData('color') === t2.getData('color') && t1.getData('color') === t3.getData('color')) {
                matchedSet.add(t1); matchedSet.add(t2); matchedSet.add(t3);
            }
        }
    }

    if (matchedSet.size > 0) {
        score += matchedSet.size * 10;
        scene.scoreText.setText('SCORE: ' + score);
        scene.sound.play('pop');
        matchedSet.forEach(t => {
            if (grid[t.getData('gridY')][t.getData('gridX')]) {
                grid[t.getData('gridY')][t.getData('gridX')] = null;
                t.destroy();
            }
        });
        return true;
    }
    return false;
}

function processMatches(scene) {
    for (let x = 0; x < GRID_SIZE; x++) {
        let emptySpots = 0;
        for (let y = GRID_SIZE - 1; y >= 0; y--) {
            if (grid[y][x] === null) emptySpots++;
            else if (emptySpots > 0) {
                let tile = grid[y][x];
                grid[y + emptySpots][x] = tile;
                grid[y][x] = null;
                tile.setData('gridY', y + emptySpots);
                scene.tweens.add({ targets: tile, y: (y + emptySpots) * TILE_SIZE + 200, duration: 250 });
            }
        }
        for (let i = 0; i < emptySpots; i++) {
            let tile = spawnTile(x, i, scene);
            grid[i][x] = tile;
            tile.y = -50;
            scene.tweens.add({ targets: tile, y: i * TILE_SIZE + 200, duration: 300 });
        }
    }
    scene.time.delayedCall(400, () => {
        if (checkMatches(scene)) processMatches(scene);
        else { isProcessing = false; selectedTile = null; }
    });
}

async function explodeColor(scene, color) {
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (grid[y][x] && grid[y][x].getData('color') === color) {
                grid[y][x].destroy();
                grid[y][x] = null;
            }
        }
    }
    processMatches(scene);
}

function spawnColorBomb(scene) {
    let rx = Phaser.Math.Between(0, 9), ry = Phaser.Math.Between(0, 9);
    let bomb = grid[ry][rx];
    if (bomb) {
        bomb.setTint(0x000000);
        bomb.setData('special', 'colorBomb');
        scene.tweens.add({ targets: bomb, scale: 0.6, duration: 600, yoyo: true, repeat: -1 });
    }
}

function update(time) {
    if (gameActive && time - lastMoveTime > 4000) {
        let t = grid[Phaser.Math.Between(0,9)][Phaser.Math.Between(0,9)];
        if (t) { this.tweens.add({ targets: t, angle: 10, yoyo: true, duration: 80, repeat: 4 }); lastMoveTime = time; }
    }
                   }
                
