//
// ncer.js
//--------------------
// Loads ncer files and provides a variety of functions for accessing and using the data.
// Cell data for nitro 2d graphics. Multiple images made out of multiple cells, sharing an input palette and ncgr.
// by RHY3756547
//

window.ncer = function(input) {
    var dimensions = [ //indexed by width, then height
        [[8,8], [16,8], [8,16]],
        [[16,16], [32,8], [8,32]],
        [[32,32], [32,16], [16,32]],
        [[64,64], [64,32], [32,64]],
    ]

    var mainOff;
    var t = this;
    if (input != null) {
        load(input);
    }
    this.load = load;

    function load(input) {
        var view = new DataView(input);
        var header = null;
        var offset = 0;
        var tex;

        //nitro 3d header
            header = nitro.readHeader(view);
            if (header.stamp != "RECN") throw "NCER invalid. Expected RECN, found "+header.stamp;
            if (header.numSections < 1 || header.numSections > 3) throw "NCER invalid. Too many sections - should have 1-3.";
        //end nitro
        t.sectionOffsets = header.sectionOffsets;
        t.sectionOffsets[0] = 0x18;

        mainOff = offset;

        t.cebk = loadCEBK(view);
        /* ignore for now
        t.labl = loadLABL(view);
        t.uext = loadUEXT(view); //external data?
        */
    }

    function getSize(shape, size, double) {
        var dim = dimensions[size][shape];
        if (double) return [dim[0]*2, dim[1]*2];
        return [dim[0], dim[1]];
    }

    function readOAM(view, offset) {
        //see ds docs. really, any of them?
        var obj0 = view.getUint16(offset, true);
        var obj1 = view.getUint16(offset + 2, true);
        var obj2 = view.getUint16(offset + 4, true);

        var rsFlag = (obj0 & 0x100) > 0;
        var x = obj1 & 0x01FF;
        var y = obj0 & 0xFF;
        var result = {
            y: (y > 0x80) ? y-0x100 : y,
            rsFlag: rsFlag,
            disable: (!rsFlag && (obj0 & 0x200) > 0),
            doubleSize: (rsFlag && (obj0 & 0x200) > 0),
            objMode: (obj0 >> 10) & 0x3,
            mosaic: (obj0 & 0x1000) > 0,
            depth: (obj0 & 0x2000) > 0,
            shape: (obj0 >> 14) & 0x3, //used in combination with size to determine final x+y tile size.

            x: (x > 0x100) ? x-0x200 : x,

            xFlip: (!rsFlag && (obj1 & 0x1000) > 0),
            yFlip: (!rsFlag && (obj1 & 0x2000) > 0),

            selectParam: rsFlag ? ((obj1 >> 9) & 0x1F) : 0,

            size: (obj1 >> 14) & 0x3,

            tileOffset: obj2 & 0x03FF,
            priority: (obj2 >> 10) & 3,
            pal: (obj2 >> 12) & 0xF,
        }
        result.size = getSize(result.shape, result.size, result.doubleSize);
        return result;
    }

    function loadCEBK(view) { //cell bank
        var offset = t.sectionOffsets[0] - 8;

        var cebk = {};
        cebk.type = readChar(view, offset+0x0)+readChar(view, offset+0x1)+readChar(view, offset+0x2)+readChar(view, offset+0x3);
        if (cebk.type != "KBEC") throw "NCER invalid. Expected KBEC, found "+cebk.type;
        cebk.blockSize = view.getUint32(offset+0x4, true);
        cebk.imageCount = view.getUint16(offset+0x8, true);
        cebk.bankType = view.getUint16(offset+0xA, true); //type 1 has additional fields
        cebk.unknown = view.getUint32(offset+0xC, true); //always 0x12
        cebk.boundarySize = view.getUint32(offset+0x10, true) * 64; //area in which the image can be drawn (pixel height AND width)
        cebk.partitionDataOffset = view.getUint32(offset+0x14, true);
        //pad 0x18
        //pad 0x1C

        cebk.images = [];

        offset += 0x20;
        var tableEnd = offset + cebk.imageCount * (8 + cebk.bankType * 8);
        for (var i=0; i<cebk.imageCount; i++) {
            var image = {};
            image.numCells = view.getUint16(offset, true);
            image.readOnlyInfo = view.getUint16(offset + 0x2, true);
            image.offset = view.getInt32(offset + 0x4, true);
            offset += 0x8;
            if (cebk.bankType == 1) {
                image.xMax = view.getInt16(offset, true);
                image.yMax = view.getInt16(offset+2, true);
                image.xMin = view.getInt16(offset+4, true);
                image.yMin = view.getInt16(offset+6, true);
                offset += 0x8;
            }

            var offset2 = tableEnd + image.offset;
            image.cells = [];
            for (var j=0; j<image.numCells; j++) {
                var cell = readOAM(view, offset2);
                offset2 += 6;
                image.cells.push(cell);
            }
            cebk.images.push(image);
        }

        if (cebk.partitionDataOffset != 0) { //not sure what this does, just that it's here
            var pOff = t.sectionOffsets[0] + cebk.partitionDataOffset;
            cebk.maxPartitionSize = view.getUint32(pOff, true);
            cebk.firstOffset = view.getUint32(pOff+4, true);
            pOff += cebk.firstOffset;
            for (var i=0; i<cebk.imageCount; i++) {
                cebk.images[i].partitionOffset = view.getUint32(pOff, true);
                cebk.images[i].partitionSize = view.getUint32(pOff+4, true);
                pOff += 8;
            }
        }

        return cebk;
    }

    function readPalColour(view, ind) {
        var col = view.getUint16(ind, true);
        var f = 255/31;
        return [Math.round((col&31)*f), Math.round(((col>>5)&31)*f), Math.round(((col>>10)&31)*f), 255];
    }

    function readChar(view, offset) {
        return String.fromCharCode(view.getUint8(offset));
    }
}