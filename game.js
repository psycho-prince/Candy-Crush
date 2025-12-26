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
let lastMoveTime = 0;
let timerEvent;

function preload() {
    this.load.spritesheet('animals', 'candy_sheet.png', { frameWidth: 136, frameHeight: 136 });
    this.load.audio('pop', 'https://actions.google.com/sounds/v1/cartoon/pop.ogg');
    this.load.audio('bomb', 'https://actions.google.com/sounds/v1/science_fiction/stinger_ray_gun.ogg');
}

function create() {
    let style = { fontSize: '28px', fill: '#00ffcc', fontStyle: 'bold' };
    this.scoreText = this.add.text(20, 20, 'SCORE: 0', style).setDepth(50);
    this.timerText = this.add.text(window.innerWidth - 120, 20, '60s', style).setDepth(50);

    // PAUSE BUTTON
    this.pauseBtn = this.add.text(window.innerWidth / 2, 35, 'PAUSE', { fontSize: '24px', backgroundColor: '#444', padding: 5 })
        .setOrigin(0.5).setInteractive().setDepth(50).setVisible(false)
        .on('pointerdown', () => togglePause(this));

    createGrid(this);
    createMenu(this);
}

function createMenu(scene) {
    scene.menuGroup = scene.add.container(0, 0).setDepth(100);
    let bg = scene.add.rectangle(config.width/2, config.height/2, config.width, config.height, 0x000000, 0.85);
    let title = scene.add.text(config.width/2, config.height/3, 'ANIMAL POP!', { fontSize: '60px', fill: '#ff0066', fontStyle: 'bold' }).setOrigin(0.5);
    
    let startBtn = scene.add.text(config.width/2, config.height/2, 'START', { fontSize: '40px', backgroundColor: '#00ffcc', color: '#000', padding: 20 })
        .setOrigin(0.5).setInteractive().on('pointerdown', () => startGame(scene));

    scene.menuGroup.add([bg, title, startBtn]);
}

function startGame(scene) {
    scene.menuGroup.setVisible(false);
    scene.pauseBtn.setVisible(true);
    gameActive = true;
    score = 0;
    timeLeft = 60;
    lastMoveTime = scene.time.now;
    
    if (timerEvent) timerEvent.remove();
    timerEvent = scene.time.addEvent({
        delay: 1000,
        callback: () => { if(gameActive) { timeLeft--; scene.timerText.setText(timeLeft + 's'); if(timeLeft <= 0) scene.menuGroup.setVisible(true); }},
        loop: true
    });
    spawnColorBomb(scene);
}

function togglePause(scene) {
    gameActive = !gameActive;
    scene.pauseBtn.setText(gameActive ? 'PAUSE' : 'RESUME');
}

function spawnColorBomb(scene) {
    let x = Phaser.Math.Between(0, 9), y = Phaser.Math.Between(0, 9);
    let bomb = grid[y][x];
    if (bomb) {
        bomb.setData('special', 'colorBomb');
        bomb.setTint(0x333333);
        scene.tweens.add({ targets: bomb, scale: 0.6, angle: 360, duration: 1000, repeat: -1 });
    }
}

function createGrid(scene) {
    for (let y = 0; y < GRID_SIZE; y++) {
        grid[y] = [];
        for (let x = 0; x < GRID_SIZE; x++) {
            let frame = Phaser.Utils.Array.GetRandom(ANIMAL_FRAMES);
            let tile = scene.add.sprite(x * TILE_SIZE + TILE_SIZE, y * TILE_SIZE + 200, 'animals', frame);
            tile.setScale((TILE_SIZE / 136) * 0.9).setInteractive();
            tile.setData({ color: frame, gridX: x, gridY: y });
            tile.on('pointerdown', () => handleSelect(tile, scene));
            grid[y][x] = tile;
        }
    }
}

async function handleSelect(tile, scene) {
    if (isProcessing || !gameActive) return;
    lastMoveTime = scene.time.now;

    if (!selectedTile) {
        selectedTile = tile;
        tile.setAlpha(0.5);
    } else {
        let x1 = selectedTile.getData('gridX'), y1 = selectedTile.getData('gridY');
        let x2 = tile.getData('gridX'), y2 = tile.getData('gridY');

        if (Math.abs(x1 - x2) + Math.abs(y1 - y2) === 1) {
            isProcessing = true;
            selectedTile.setAlpha(1);
            
            if (selectedTile.getData('special') === 'colorBomb' || tile.getData('special') === 'colorBomb') {
                scene.sound.play('bomb');
                let color = (selectedTile.getData('special') === 'colorBomb') ? tile.getData('color') : selectedTile.getData('color');
                await explodeColor(scene, color);
                if (selectedTile.getData('special') === 'colorBomb') { grid[y1][x1] = null; selectedTile.destroy(); }
                else { grid[y2][x2] = null; tile.destroy(); }
            } else {
                await swapTiles(selectedTile, tile, scene);
                if (checkMatches(scene)) {
                    scene.sound.play('pop');
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
            tile.setAlpha(0.5);
        }
    }
}

function swapTiles(tile1, tile2, scene) {
    return new Promise(resolve => {
        const x1 = tile1.getData('gridX'), y1 = tile1.getData('gridY');
        const x2 = tile2.getData('gridX'), y2 = tile2.getData('gridY');
        grid[y1][x1] = tile2; grid[y2][x2] = tile1;
        tile1.setData({gridX: x2, gridY: y2}); tile2.setData({gridX: x1, gridY: y1});
        scene.tweens.add({
            targets: [tile1, tile2],
            x: (t) => t.getData('gridX') * TILE_SIZE + TILE_SIZE,
            y: (t) => t.getData('gridY') * TILE_SIZE + 200,
            duration: 200, onComplete: resolve
        });
    });
}

function checkMatches(scene) {
    let toDestroy = new Set();
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (x < GRID_SIZE - 2 && grid[y][x] && grid[y][x+1] && grid[y][x+2]) {
                if (grid[y][x].getData('color') === grid[y][x+1].getData('color') && grid[y][x].getData('color') === grid[y][x+2].getData('color')) {
                    toDestroy.add(grid[y][x]); toDestroy.add(grid[y][x+1]); toDestroy.add(grid[y][x+2]);
                }
            }
            if (y < GRID_SIZE - 2 && grid[y][x] && grid[y+1][x] && grid[y+2][x]) {
                if (grid[y][x].getData('color') === grid[y+1][x].getData('color') && grid[y][x].getData('color') === grid[y+2][x].getData('color')) {
                    toDestroy.add(grid[y][x]); toDestroy.add(grid[y+1][x]); toDestroy.add(grid[y+2][x]);
                }
            }
        }
    }
    if (toDestroy.size > 0) {
        score += toDestroy.size * 10;
        scene.scoreText.setText('SCORE: ' + score);
        toDestroy.forEach(t => { grid[t.getData('gridY')][t.getData('gridX')] = null; t.destroy(); });
        return true;
    }
    return false;
}

async function processMatches(scene) {
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = GRID_SIZE - 1; y >= 0; y--) {
            if (grid[y][x] === null) {
                for (let k = y - 1; k >= 0; k--) {
                    if (grid[k][x]) {
                        grid[y][x] = grid[k][x]; grid[k][x] = null;
                        grid[y][x].setData('gridY', y);
                        scene.tweens.add({ targets: grid[y][x], y: y * TILE_SIZE + 200, duration: 200 });
                        break;
                    }
                }
            }
        }
    }
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
            if (grid[y][x] === null) {
                let frame = Phaser.Utils.Array.GetRandom(ANIMAL_FRAMES);
                let tile = scene.add.sprite(x * TILE_SIZE + TILE_SIZE, -50, 'animals', frame);
                tile.setScale((TILE_SIZE / 136) * 0.9).setInteractive();
                tile.setData({ color: frame, gridX: x, gridY: y });
                tile.on('pointerdown', () => handleSelect(tile, scene));
                grid[y][x] = tile;
                scene.tweens.add({ targets: tile, y: y * TILE_SIZE + 200, duration: 200 });
            }
        }
    }
    await new Promise(r => setTimeout(r, 300));
    if (checkMatches(scene)) await processMatches(scene);
}

async function explodeColor(scene, color) {
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (grid[y][x] && grid[y][x].getData('color') === color) {
                grid[y][x].destroy(); grid[y][x] = null;
            }
        }
    }
    await processMatches(scene);
}

function update(time) {
    if (gameActive && time - lastMoveTime > 4000) {
        let t = grid[Phaser.Math.Between(0,9)][Phaser.Math.Between(0,9)];
        if (t) { this.tweens.add({ targets: t, x: t.x + 5, yoyo: true, repeat: 3, duration: 50 }); lastMoveTime = time; }
    }
        }
