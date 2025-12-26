const config = {
    type: Phaser.AUTO,
    width: 440,
    height: 550,
    backgroundColor: '#3d4a5d',
    scene: { preload: preload, create: create }
};

const game = new Phaser.Game(config);

const GRID_SIZE = 8;
const TILE_SIZE = 55;
// Selecting specific animals that have high contrast for kids
const ANIMAL_FRAMES = [0, 1, 2, 3, 4, 5]; 

let grid = [];
let selectedTile = null;
let isProcessing = false;
let score = 0;
let scoreText;

function preload() {
    // Correcting for Kenney Animal Pack Redux
    // These tiles are 136x136 pixels total (128px animal + 8px padding/margin)
    this.load.spritesheet('animals', 'candy_sheet.png', {
        frameWidth: 136, 
        frameHeight: 136,
        margin: 0,
        spacing: 0
    });
}

function create() {
    scoreText = this.add.text(20, 490, 'SCORE: 0', { 
        fontSize: '28px', fill: '#ffffff', fontStyle: 'bold', fontFamily: 'Arial'
    });

    for (let y = 0; y < GRID_SIZE; y++) {
        grid[y] = [];
        for (let x = 0; x < GRID_SIZE; x++) {
            spawnTile(x, y, this);
        }
    }
}

function spawnTile(x, y, scene) {
    let frame = Phaser.Utils.Array.GetRandom(ANIMAL_FRAMES);
    let tile = scene.add.sprite(x * TILE_SIZE + 35, y * TILE_SIZE + 35, 'animals', frame);
    
    // Adjusted scale: 136px down to ~50px is roughly 0.38
    tile.setScale(0.38); 
    tile.setInteractive();
    tile.setData('color', frame);
    tile.setData('gridX', x);
    tile.setData('gridY', y);
    
    tile.on('pointerdown', () => handleSelect(tile, scene));
    grid[y][x] = tile;
    return tile;
}

// ... Keep your existing handleSelect, swapTiles, checkMatches, and processMatches functions ...

