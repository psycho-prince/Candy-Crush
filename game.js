const config = {
    type: Phaser.AUTO,
    width: 600, // Wider for mobile
    height: 900, // Taller for mobile
    backgroundColor: '#2c3e50',
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

const GRID_SIZE = 10; // Increased from 8 to 10
const TILE_SIZE = 58; // Adjusted for the new screen width
const ANIMAL_FRAMES = [0, 1, 2, 3, 4, 5]; 

let grid = [];
let selectedTile = null;
let isProcessing = false;
let score = 0;
let timeLeft = 60;
let gameMode = 'rush';
let gameActive = false;
let lastMoveTime = 0;
let timerEvent;
let hintTween = null;

let scoreText, timerText, menuContainer;

function preload() {
    this.load.spritesheet('animals', 'candy_sheet.png', {
        frameWidth: 136, 
        frameHeight: 136
    });
}

function create() {
    scoreText = this.add.text(40, 840, 'SCORE: 0', { fontSize: '36px', fill: '#fff', fontStyle: 'bold' });
    timerText = this.add.text(380, 840, 'TIME: 60', { fontSize: '36px', fill: '#fff', fontStyle: 'bold' });

    createGrid(this);
    createMenu(this);
}

function createMenu(scene) {
    menuContainer = scene.add.container(0, 0).setDepth(100);
    let overlay = scene.add.rectangle(300, 450, 600, 900, 0x000000, 0.9);
    let title = scene.add.text(300, 250, 'ANIMAL MATCH', { fontSize: '64px', fill: '#f1c40f', fontStyle: 'bold' }).setOrigin(0.5);
    
    let rushBtn = scene.add.text(300, 450, '1 MIN RUSH', { fontSize: '40px', backgroundColor: '#e74c3c', padding: 20 })
        .setOrigin(0.5).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => startLevel(scene, 'rush'));

    let endlessBtn = scene.add.text(300, 600, 'ENDLESS MODE', { fontSize: '40px', backgroundColor: '#2ecc71', padding: 20 })
        .setOrigin(0.5).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => startLevel(scene, 'endless'));

    menuContainer.add([overlay, title, rushBtn, endlessBtn]);
}

function startLevel(scene, mode) {
    gameMode = mode;
    score = 0;
    timeLeft = 60;
    gameActive = true;
    menuContainer.setVisible(false);
    scoreText.setText('SCORE: 0');
    lastMoveTime = scene.time.now;

    if (mode === 'rush') {
        timerText.setVisible(true);
        if (timerEvent) timerEvent.remove();
        timerEvent = scene.time.addEvent({
            delay: 1000,
            callback: () => {
                timeLeft--;
                timerText.setText('TIME: ' + timeLeft);
                if (timeLeft <= 0) {
                    gameActive = false;
                    menuContainer.setVisible(true);
                }
            },
            loop: true
        });
        // OG Black Ball Color Bomb
        let rx = Phaser.Math.Between(0, 9), ry = Phaser.Math.Between(0, 9);
        makeSpecial(grid[ry][rx], 'colorBomb');
    } else {
        timerText.setVisible(false);
    }
}

function makeSpecial(tile, type) {
    if (!tile) return;
    tile.setData('special', type);
    if (type === 'colorBomb') {
        tile.setTint(0x444444); // Dark "Black Ball" effect
        // Add a glow/pulse to make it obvious
        game.scene.scenes[0].tweens.add({
            targets: tile,
            scale: 0.45,
            duration: 500,
            yoyo: true,
            repeat: -1
        });
    }
}

function createGrid(scene) {
    for (let y = 0; y < GRID_SIZE; y++) {
        grid[y] = [];
        for (let x = 0; x < GRID_SIZE; x++) {
            spawnTile(x, y, scene);
        }
    }
}

function spawnTile(x, y, scene) {
    let frame = Phaser.Utils.Array.GetRandom(ANIMAL_FRAMES);
    let tile = scene.add.sprite(x * TILE_SIZE + 40, y * TILE_SIZE + 120, 'animals', frame);
    tile.setScale(0.4).setInteractive();
    tile.setData({ color: frame, gridX: x, gridY: y });
    tile.on('pointerdown', () => { if(gameActive) handleSelect(tile, scene); });
    grid[y][x] = tile;
    return tile;
}

async function handleSelect(tile, scene) {
    if (isProcessing) return;
    clearHint(); // Stop hint if player acts
    lastMoveTime = scene.time.now;

    if (!selectedTile) {
        selectedTile = tile;
        tile.setAlpha(0.6);
    } else {
        let x1 = selectedTile.getData('gridX'), y1 = selectedTile.getData('gridY');
        let x2 = tile.getData('gridX'), y2 = tile.getData('gridY');

        if (Math.abs(x1 - x2) + Math.abs(y1 - y2) === 1) {
            isProcessing = true;
            selectedTile.setAlpha(1);

            // COLOR BOMB LOGIC: If either tile is the black ball
            if (selectedTile.getData('special') === 'colorBomb' || tile.getData('special') === 'colorBomb') {
                let colorToClear = (selectedTile.getData('special') === 'colorBomb') ? tile.getData('color') : selectedTile.getData('color');
                await clearAllOfColor(scene, colorToClear);
                
                // Destroy the bomb itself
                if (selectedTile.getData('special') === 'colorBomb') {
                    grid[y1][x1] = null;
                    selectedTile.destroy();
                } else {
                    grid[y2][x2] = null;
                    tile.destroy();
                }
            } else {
                await swapTiles(selectedTile, tile, scene);
                if (checkMatches(scene)) {
                    await processMatches(scene);
                } else {
                    await swapTiles(selectedTile, tile, scene);
                }
            }
            selectedTile = null;
            isProcessing = false;
        } else {
            selectedTile.setAlpha(1);
            selectedTile = tile;
            tile.setAlpha(0.6);
        }
    }
}

async function clearAllOfColor(scene, color) {
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (grid[y][x] && grid[y][x].getData('color') === color) {
                scene.tweens.add({ targets: grid[y][x], scale: 0, alpha: 0, duration: 200 });
                grid[y][x] = null;
            }
        }
    }
    await processMatches(scene);
}

function swapTiles(tile1, tile2, scene) {
    return new Promise(resolve => {
        const x1 = tile1.getData('gridX'), y1 = tile1.getData('gridY');
        const x2 = tile2.getData('gridX'), y2 = tile2.getData('gridY');
        grid[y1][x1] = tile2; grid[y2][x2] = tile1;
        tile1.setData({gridX: x2, gridY: y2});
        tile2.setData({gridX: x1, gridY: y1});
        scene.tweens.add({
            targets: [tile1, tile2],
            x: (t) => t.getData('gridX') * TILE_SIZE + 40,
            y: (t) => t.getData('gridY') * TILE_SIZE + 120,
            duration: 250, onComplete: resolve
        });
    });
}

function checkMatches(scene) {
    let toDestroy = new Set();
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (x < GRID_SIZE - 2 && grid[y][x] && grid[y][x+1] && grid[y][x+2]) {
                if (grid[y][x].getData('color') === grid[y][x+1].getData('color') && 
                    grid[y][x].getData('color') === grid[y][x+2].getData('color')) {
                    toDestroy.add(grid[y][x]); toDestroy.add(grid[y][x+1]); toDestroy.add(grid[y][x+2]);
                }
            }
            if (y < GRID_SIZE - 2 && grid[y][x] && grid[y+1][x] && grid[y+2][x]) {
                if (grid[y][x].getData('color') === grid[y+1][x].getData('color') && 
                    grid[y][x].getData('color') === grid[y+2][x].getData('color')) {
                    toDestroy.add(grid[y][x]); toDestroy.add(grid[y+1][x]); toDestroy.add(grid[y+2][x]);
                }
            }
        }
    }

    if (toDestroy.size > 0) {
        score += toDestroy.size * 10;
        scoreText.setText('SCORE: ' + score);
        toDestroy.forEach(t => {
            grid[t.getData('gridY')][t.getData('gridX')] = null;
            scene.tweens.add({ targets: t, scale: 0, duration: 200, onComplete: () => t.destroy() });
        });
        return true;
    }
    return false;
}

async function processMatches(scene) {
    await new Promise(r => setTimeout(r, 300));
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = GRID_SIZE - 1; y >= 0; y--) {
            if (grid[y][x] === null) {
                for (let k = y - 1; k >= 0; k--) {
                    if (grid[k][x]) {
                        grid[y][x] = grid[k][x]; grid[k][x] = null;
                        grid[y][x].setData('gridY', y);
                        scene.tweens.add({ targets: grid[y][x], y: y * TILE_SIZE + 120, duration: 400, ease: 'Bounce' });
                        break;
                    }
                }
            }
        }
    }
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
            if (grid[y][x] === null) {
                let tile = spawnTile(x, y, scene);
                tile.y = -50;
                scene.tweens.add({ targets: tile, y: y * TILE_SIZE + 120, duration: 400 });
            }
        }
    }
    await new Promise(r => setTimeout(r, 600));
    if (checkMatches(scene)) await processMatches(scene);
}

function update(time) {
    if (gameActive && time - lastMoveTime > 5000) {
        showHint(this);
        lastMoveTime = time; 
    }
}

function showHint(scene) {
    if (hintTween) return;
    let rx = Phaser.Math.Between(0, 9), ry = Phaser.Math.Between(0, 9);
    if (grid[ry][rx]) {
        hintTween = scene.tweens.add({ 
            targets: grid[ry][rx], 
            alpha: 0.3, 
            yoyo: true, 
            repeat: 2, 
            duration: 400,
            onComplete: () => { hintTween = null; }
        });
    }
}

function clearHint() {
    if (hintTween) {
        hintTween.stop();
        hintTween = null;
    }
}
    
