//
// tileFlattener.js
//--------------------
// Renders screens or cells to 2d canvas. Useful for drawing UI elements from the ROM.
// by RHY3756547
//
// includes: main.js
//

window.TileFlattener = function(palette, tiles, map) {

    this.palette = palette;
    this.tiles = tiles;
    this.map = map;
    this.toCanvas = toCanvas;

    this.cellMode = map.cebk != null;

    var tileCache = {};
    var zero = [0, 0, 0, 0];
    var emptyTile = new Uint8ClampedArray(64);

    function getTileImg(pal0trans, tile, pal) {
        var cacheID = tile + ":" + pal;
        var item = tileCache[cacheID];
        if (item != null) return item;
        //make the tile
        var canvas = document.createElement("canvas");
        canvas.width = 8;
        canvas.height = 8;
        var ctx = canvas.getContext("2d");

        var d = new Uint8ClampedArray(8*8*4);
        var data = new ImageData(d, 8, 8);
        var targ = 0;
        var colors = palette.pltt.palettes[pal] || [];
        var tileData = tiles.char.tiles[tile] || emptyTile;

        for (var i=0; i<64; i++) {
            var colID = tileData[i];
            var col = (pal0trans && colID == 0) ? zero : (colors[colID] || zero);
            d[targ++] = col[0];
            d[targ++] = col[1];
            d[targ++] = col[2];
            d[targ++] = col[3];
        }

        ctx.putImageData(data, 0, 0);
        tileCache[cacheID] = canvas;
        return canvas;
    }

    function calcImageSize(image) {
        var xMin = 65536;
        var yMin = 65536;
        var xMax = 0;
        var yMax = 0;
        for (var i=0; i<image.cells.length; i++) {
            var cell = image.cells[i];
            var size = cell.size;
            var x = cell.x + size[0];
            if (x > xMax) xMax = x;
            x -= size[0];
            if (x < xMin) xMin = x;
            var y = cell.y + size[1];
            if (y > yMax) yMax = y;
            y -= size[1];
            if (y < yMin) yMin = y;
        }
        return [xMin, yMin, xMax, yMax];
    }

    function toCanvas(pal0trans, imageInd, palInd) {
        var canvas = document.createElement("canvas");
        if (this.cellMode) {
            //essentially a collection of ds sprites
            //render out the image the user has requested
            var image = map.cebk.images[imageInd];
            var isize = calcImageSize(image);
            
            canvas.width = isize[2] - isize[0];
            canvas.height = isize[3] - isize[1];
            var ctx = canvas.getContext("2d");
            var tileWidth = this.tiles.char.tilesX;
            image.cells.sort(function(a, b){return b.priority - a.priority});

            for (var i=image.cells.length-1; i>=0; i--) {
                var cell = image.cells[i];

                var size = cell.size;
                var sx2 = size[0]/2;
                var sy2 = size[1]/2;
                ctx.save();
                ctx.translate(cell.x + sx2 - isize[0], cell.y + sy2 - isize[1]);
                ctx.scale(cell.xFlip?(-1):1, cell.yFlip?(-1):1);

                var tile = cell.tileOffset;
                var pal = cell.pal;
                ctx.strokeStyle = "white";
                ctx.strokeWidth = 1;
                if (cell.disable) continue;

                //draw oam sprite
                var base = tile;
                for (var y=0; y<size[1]; y+=8) {
                    for (var x=0; x<size[0]; x+=8) {
                        var img = getTileImg(pal0trans, tile++, pal);
                        ctx.drawImage(img, x-sx2, y-sy2);
                    }
                    if (tileWidth != 65535) { //when defined, wrap to the next row when drawing a lower portion of the sprite
                        base += tileWidth;
                        tile = base;
                    }
                }
                ctx.restore();
            }
        } else {
            //screen render, very simple
            var screen = map.scrn;
            canvas.width = screen.screenWidth;
            canvas.height = screen.screenHeight;
            var ctx = canvas.getContext("2d");

            var data = screen.data;
            var tileWidth = (screen.screenWidth / 8);
            var tileHeight = (screen.screenHeight / 8);
            var x = 0;
            var y = 0;
            for (var i=0; i<data.length; i++) {
                var info = data[i];

                /*
                Format is (YYYYXXNNNNNNNNNN)
                Y4 Palette Number 
                X2 Transformation (YFlip/XFlip) 
                N10 Tile Number
                */
                var pal = info >> 12;
                var trans = (info >> 10) & 3;
                var tile = info & 0x3FF;

                var img = getTileImg(pal0trans, tile, pal);
                var xf = (trans&1) > 0;
                var yf = (trans&2) > 0;

                if (xf || yf) {
                    //transform
                    ctx.save();
                    ctx.translate(x + 4, y + 4);
                    ctx.scale(xf?(-1):1, yf?(-1):1);
                    ctx.drawImage(img, -4, -4);
                    ctx.restore();
                } else {
                    ctx.drawImage(img, x, y);
                }

                x += 8;
                if (x >= screen.screenWidth) {
                    x -= screen.screenWidth;
                    y += 8;
                }
            }
        }
        return canvas;
    }
}