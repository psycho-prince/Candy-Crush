const config = {
    type: Phaser.AUTO,
    width: 400,
    height: 400,
    scene: { preload: preload, create: create }
};

const game = new Phaser.Game(config);
const GRID_SIZE = 8;
const TILE_SIZE = 50;
const COLORS = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff]; // Red, Green, Blue, Yellow, Pink

let grid = [];
let selectedTile = null;

function preload() {
    // We will generate textures programmatically so no external images are needed
}

function create() {
    // 1. Create the grid
    for (let y = 0; y < GRID_SIZE; y++) {
        grid[y] = [];
        for (let x = 0; x < GRID_SIZE; x++) {
            let color = Phaser.Utils.Array.GetRandom(COLORS);
            let tile = this.add.rectangle(x * TILE_SIZE + 25, y * TILE_SIZE + 25, 45, 45, color);
            
            tile.setInteractive();
            tile.setData('gridX', x);
            tile.setData('gridY', y);
            tile.setData('color', color);

            tile.on('pointerdown', () => handleSelect(tile));
            grid[y][x] = tile;
        }
    }
}

function handleSelect(tile) {
    if (!selectedTile) {
        selectedTile = tile;
        tile.setStrokeStyle(4, 0xffffff); // Highlight selected
    } else {
        const x1 = selectedTile.getData('gridX');
        const y1 = selectedTile.getData('gridY');
        const x2 = tile.getData('gridX');
        const y2 = tile.getData('gridY');

        // Check if tiles are neighbors
        const dist = Math.abs(x1 - x2) + Math.abs(y1 - y2);
        if (dist === 1) {
            swapTiles(selectedTile, tile);
        }

        selectedTile.setStrokeStyle(0);
        selectedTile = null;
    }
}

function swapTiles(tile1, tile2) {
    // Visual Swap
    const tempX = tile1.x;
    const tempY = tile1.y;
    tile1.x = tile2.x;
    tile1.y = tile2.y;
    tile2.x = tempX;
    tile2.y = tempY;

    // Update Data logic here (Check for matches of 3)
    console.log("Tiles swapped! Now check for matches...");
}
