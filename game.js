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
    // Spritesheet and Sounds
    this.load.spritesheet('animals', 'candy_sheet.png', { frameWidth: 136, frameHeight: 136 });
    this.load.audio('pop', 'https://actions.google.com/sounds/v1/cartoon/pop.ogg');
}

function create() {
    const style = { fontSize: '24px', fill: '#00ffcc', fontStyle: 'bold' };
    
    // HUD setup
    this.scoreText = this.add.text(20, 40, 'SCORE: 0', style).setDepth(50).setVisible(false);
    this.timerText = this.add.text(window.innerWidth - 100, 40, '60s', style).setDepth(50).setVisible(false);
    
    // Pause Button
    this.pauseBtn = this.add.text(window.innerWidth / 2, 50, 'PAUSE', { 
        fontSize: '20px', backgroundColor: '#e74c3c', padding: 8 
    }).setOrigin(0.5).setInteractive().setDepth(50).setVisible(false);

    createGrid(this);
    setupMenus(this);
}

function setupMenus(scene) {
    // MAIN MENU
    scene.menuGroup = scene.add.container(0, 0).setDepth(100);
    let bg = scene.add.rectangle(config.width/2, config.height/2, config.width, config.height, 0x1a1a2e, 1);
    let title = scene.add.text(config.width/2, config.height/4, 'ANIMAL POP', { fontSize: '56px', fill: '#ff0066', fontStyle: 'bold' }).setOrigin(0.5);
    
    let rushBtn = createBtn(scene, config.height/2 - 40, '1 MIN RUSH', '#00ffcc', () => startLevel(scene, 'rush'));
    let endlessBtn = createBtn(scene, config.height/2 + 60, 'ENDLESS', '#f1c40f', () => startLevel(scene, 'endless'));
    scene.menuGroup.add([bg, title, rushBtn, endlessBtn]);

    // PAUSE MENU
    scene.pauseGroup = scene.add.container(0, 0).setDepth(101).setVisible(false);
    let pBg = scene.add.rectangle(config.width/2, config.height/2, config.width, config.height, 0x000000, 0.8);
    let resBtn = createBtn(scene, config.height/2 - 40, 'RESUME', '#2ecc71', () => { gameActive = true; scene.pauseGroup.setVisible(false); });
    let quitBtn = createBtn(scene, config.height/2 + 60, 'QUIT', '#e74c3c', () => location.reload());
    scene.pauseGroup.add([pBg, resBtn, quitBtn]);

    scene.pauseBtn.on('pointerdown', () => { gameActive = false; scene.pauseGroup.setVisible(true); });
}

function createBtn(scene, y, txt, clr, cb) {
    return scene.add.text(config.width/2, y, txt, { fontSize: '28px', backgroundColor: clr, color: '#000', padding: 12, fontStyle: 'bold' })
        .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', cb);
}

function startLevel(scene, mode) {
    score = 0; timeLeft = 60; gameActive = true;
    scene.menuGroup.setVisible(false);
    scene.scoreText.setVisible(true).setText('SCORE: 0');
    scene.pauseBtn.setVisible(true);
    
    if (mode === 'rush') {
        scene.timerText.setVisible(true).setText('60s');
        timerEvent = scene.time.addEvent({ 
            delay: 1000, 
            callback: () => { 
                if(gameActive) { 
                    timeLeft--; 
                    scene.timerText.setText(timeLeft+'s'); 
                    if(timeLeft <= 0) location.reload(); 
                }
            }, 
            loop: true 
        });
    }
}

function createGrid(scene) {
    for (let y = 0; y < GRID_SIZE; y++) {
        grid[y] = [];
        for (let x = 0; x < GRID_SIZE; x++) {
            grid[y][x] = spawnTile(x, y, scene);
        }
    }
}

function spawnTile(x, y, scene) {
    let frame = Phaser.Utils.Array.GetRandom(ANIMAL_FRAMES);
    let tile = scene.add.sprite(x * TILE_SIZE + TILE_SIZE, y * TILE_SIZE + 200, 'animals', frame);
    tile.setScale((TILE_SIZE / 136) * 0.9).setInteractive();
    tile.setData({ color: frame, gridX: x, gridY: y });
    tile.on('pointerdown', () => handleSelect(tile, scene));
    return tile;
}

function handleSelect(tile, scene) {
    if (isProcessing || !gameActive) return;
    lastMoveTime = scene.time.now;

    if (!selectedTile) {
        selectedTile = tile;
        tile.setAlpha(0.6);
        tile.setScale(tile.scale * 1.1);
    } else {
        let x1 = selectedTile.getData('gridX'), y1 = selectedTile.getData('gridY');
        let x2 = tile.getData('gridX'), y2 = tile.getData('gridY');

        if (Math.abs(x1 - x2) + Math.abs(y1 - y2) === 1) {
            isProcessing = true;
            selectedTile.setAlpha(1);
            selectedTile.setScale(selectedTile.scale / 1.1);
            swapTiles(selectedTile, tile, scene, true);
        } else {
            selectedTile.setAlpha(1);
            selectedTile.setScale(selectedTile.scale / 1.1);
            selectedTile = tile;
            tile.setAlpha(0.6);
            tile.setScale(tile.scale * 1.1);
        }
    }
}

function swapTiles(t1, t2, scene, check) {
    const x1 = t1.getData('gridX'), y1 = t1.getData('gridY');
    const x2 = t2.getData('gridX'), y2 = t2.getData('gridY');
    
    grid[y1][x1] = t2; grid[y2][x2] = t1;
    t1.setData({gridX: x2, gridY: y2}); t2.setData({gridX: x1, gridY: y1});

    scene.tweens.add({
        targets: [t1, t2],
        x: (t) => t.getData('gridX') * TILE_SIZE + TILE_SIZE,
        y: (t) => t.getData('gridY') * TILE_SIZE + 200,
        duration: 200,
        onComplete: () => {
            if (check && !checkMatches(scene)) {
                swapTiles(t1, t2, scene, false);
            } else if (check) {
                processMatches(scene);
            } else {
                isProcessing = false; selectedTile = null;
            }
        }
    });
}

function checkMatches(scene) {
    let toClear = [];
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE - 2; x++) {
            if (grid[y][x] && grid[y][x+1] && grid[y][x+2]) {
                if (grid[y][x].getData('color') === grid[y][x+1].getData('color') && grid[y][x].getData('color') === grid[y][x+2].getData('color')) {
                    toClear.push(grid[y][x], grid[y][x+1], grid[y][x+2]);
                }
            }
        }
    }
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE - 2; y++) {
            if (grid[y][x] && grid[y+1][x] && grid[y+2][x]) {
                if (grid[y][x].getData('color') === grid[y+1][x].getData('color') && grid[y][x].getData('color') === grid[y+2][x].getData('color')) {
                    toClear.push(grid[y][x], grid[y+1][x], grid[y+2][x]);
                }
            }
        }
    }
    
    if (toClear.length > 0) {
        scene.sound.play('pop');
        toClear.forEach(t => { 
            if(grid[t.getData('gridY')][t.getData('gridX')]) {
                score += 10;
                grid[t.getData('gridY')][t.getData('gridX')] = null; 
                t.destroy(); 
            }
        });
        scene.scoreText.setText('SCORE: ' + score);
        return true;
    }
    return false;
}

function processMatches(scene) {
    for (let x = 0; x < GRID_SIZE; x++) {
        let fall = 0;
        for (let y = GRID_SIZE - 1; y >= 0; y--) {
            if (grid[y][x] === null) fall++;
            else if (fall > 0) {
                let t = grid[y][x];
                grid[y + fall][x] = t; grid[y][x] = null;
                t.setData('gridY', y + fall);
                scene.tweens.add({ targets: t, y: (y + fall) * TILE_SIZE + 200, duration: 300 });
            }
        }
        for (let i = 0; i < fall; i++) {
            let t = spawnTile(x, i, scene);
            grid[i][x] = t; t.y = -100;
            scene.tweens.add({ targets: t, y: i * TILE_SIZE + 200, duration: 400 });
        }
    }
    scene.time.delayedCall(500, () => {
        if (checkMatches(scene)) processMatches(scene);
        else { isProcessing = false; selectedTile = null; }
    });
}

function update(time) {
    if (gameActive && time - lastMoveTime > 4000) {
        let rx = Phaser.Math.Between(0, 9), ry = Phaser.Math.Between(0, 9);
        let t = grid[ry][rx];
        if (t) { 
            this.tweens.add({ targets: t, angle: 10, yoyo: true, duration: 100, repeat: 3 }); 
            lastMoveTime = time; 
        }
    }
                             }
