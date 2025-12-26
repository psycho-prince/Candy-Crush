const config = {
    type: Phaser.AUTO,
    width: 440,
    height: 600,
    backgroundColor: '#3d4a5d',
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

const GRID_SIZE = 8;
const TILE_SIZE = 55;
const ANIMAL_FRAMES = [0, 1, 2, 3, 4, 5]; 

let grid = [];
let selectedTile = null;
let isProcessing = false;
let score = 0;
let timeLeft = 60;
let gameActive = false;
let timerEvent, scoreText, timerText, overlay, startBtn;

function preload() {
    this.load.spritesheet('animals', 'candy_sheet.png', {
        frameWidth: 136, 
        frameHeight: 136
    });
}

function create() {
    // UI Elements
    scoreText = this.add.text(20, 520, 'SCORE: 0', { fontSize: '24px', fill: '#fff', fontStyle: 'bold' });
    timerText = this.add.text(280, 520, 'TIME: 60', { fontSize: '24px', fill: '#fff', fontStyle: 'bold' });

    createGrid(this);
    createMenu(this);
}

function createMenu(scene) {
    overlay = scene.add.rectangle(220, 250, 440, 500, 0x000000, 0.8).setDepth(10);
    startBtn = scene.add.text(220, 250, 'START GAME', { 
        fontSize: '40px', fill: '#0f0', backgroundColor: '#222', padding: 10 
    }).setOrigin(0.5).setInteractive().setDepth(11);

    startBtn.on('pointerdown', () => startGame(scene));
}

function startGame(scene) {
    score = 0;
    timeLeft = 60;
    gameActive = true;
    overlay.setVisible(false);
    startBtn.setVisible(false);
    scoreText.setText('SCORE: 0');
    
    if (timerEvent) timerEvent.remove();
    timerEvent = scene.time.addEvent({
        delay: 1000,
        callback: () => {
            timeLeft--;
            timerText.setText('TIME: ' + timeLeft);
            if (timeLeft <= 0) endGame(scene);
        },
        loop: true
    });
}

function endGame(scene) {
    gameActive = false;
    timerEvent.remove();
    overlay.setVisible(true);
    startBtn.setText('RESTART').setVisible(true);
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
    let tile = scene.add.sprite(x * TILE_SIZE + 35, y * TILE_SIZE + 35, 'animals', frame);
    tile.setScale(0.38).setInteractive();
    tile.setData({ color: frame, gridX: x, gridY: y });
    tile.on('pointerdown', () => { if(gameActive) handleSelect(tile, scene); });
    grid[y][x] = tile;
    return tile;
}

async function handleSelect(tile, scene) {
    if (isProcessing) return;
    if (!selectedTile) {
        selectedTile = tile;
        tile.setAlpha(0.6);
    } else {
        let x1 = selectedTile.getData('gridX'), y1 = selectedTile.getData('gridY');
        let x2 = tile.getData('gridX'), y2 = tile.getData('gridY');

        if (Math.abs(x1 - x2) + Math.abs(y1 - y2) === 1) {
            isProcessing = true;
            selectedTile.setAlpha(1);
            await swapTiles(selectedTile, tile, scene);
            
            // COLOR BOMB LOGIC (If swapped with a special tile)
            if (selectedTile.getData('special') || tile.getData('special')) {
                // Clear all of one type logic would go here
            }

            if (checkMatches(scene)) {
                await processMatches(scene);
            } else {
                await swapTiles(selectedTile, tile, scene); 
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

function swapTiles(tile1, tile2, scene) {
    return new Promise(resolve => {
        const x1 = tile1.getData('gridX'), y1 = tile1.getData('gridY');
        const y1_old = tile1.getData('gridY'); 
        const x2 = tile2.getData('gridX'), y2 = tile2.getData('gridY');

        grid[y1][x1] = tile2; grid[y2][x2] = tile1;
        tile1.setData({gridX: x2, gridY: y2});
        tile2.setData({gridX: x1, gridY: y1});

        scene.tweens.add({
            targets: [tile1, tile2],
            x: (t) => t.getData('gridX') * TILE_SIZE + 35,
            y: (t) => t.getData('gridY') * TILE_SIZE + 35,
            duration: 200,
            onComplete: resolve
        });
    });
}

function checkMatches(scene) {
    let toDestroy = new Set();
    // Standard horizontal/vertical match detection
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
                        grid[y][x] = grid[k][x];
                        grid[k][x] = null;
                        grid[y][x].setData('gridY', y);
                        scene.tweens.add({ targets: grid[y][x], y: y * TILE_SIZE + 35, duration: 300, ease: 'Bounce' });
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
                scene.tweens.add({ targets: tile, y: y * TILE_SIZE + 35, duration: 300 });
            }
        }
    }
    await new Promise(r => setTimeout(r, 500));
    if (checkMatches(scene)) await processMatches(scene);
}

function update() {
    // This runs every frame, we can add hint logic here later
}
