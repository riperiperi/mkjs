//
// ncgr.js
//--------------------
// Loads ncgr files and provides a variety of functions for accessing and using the data.
// "Graphics Resource", as in tile data. Usually rendered in conjunction with Palette (nclr) and Cell (ncer) / screen (nscr) data.
// by RHY3756547
//

window.ncgr = function(input) {

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
			if (header.stamp != "RGCN") throw "NCGR invalid. Expected RGCN, found "+header.stamp;
			if (header.numSections < 1 || header.numSections > 2) throw "NCGR invalid. Too many sections - should have 2.";
			offset = header.sectionOffsets[0];
		//end nitro
		t.sectionOffsets = header.sectionOffsets;
		t.sectionOffsets[0] = 0x18;

		mainOff = offset;

		t.char = loadCHAR(view);
		if (header.numSections > 1) t.cpos = loadCPOS(view);
	}

	function loadCHAR(view) {
		var offset = t.sectionOffsets[0] - 8;

		var char = {};
		char.type = readChar(view, offset+0x0)+readChar(view, offset+0x1)+readChar(view, offset+0x2)+readChar(view, offset+0x3);
		if (char.type != "RAHC") throw "NCGR invalid. Expected RAHC, found "+char.type;
		char.blockSize = view.getUint32(offset+0x4, true);
		t.sectionOffsets[1] = t.sectionOffsets[0] + char.blockSize;
		char.tilesY = view.getUint16(offset+0x8, true); //(tiles y)
		char.tilesX = view.getUint16(offset+0xA, true); //(tiles x)
		char.bitDepth = view.getUint32(offset+0xC, true); //3 - 4bits, 4 - 8bits
		//pad 0x10
		char.tiledFlag = view.getUint32(offset+0x14, true);
		char.tileDataSize = view.getUint32(offset+0x18, true);
		char.unknown = view.getUint32(offset+0x1C, true); //usually 24
		offset += 0x20;

		//tiles are 8 or 4 bit index to pal data
		//64 pixels per tile (8*8)
		var tileCount = (char.blockSize-0x20) / ((char.bitDepth == 4) ? 64 : 32);
		char.tiles = [];
		for (var i=0; i<tileCount; i++) {
			var tile = [];
			if (char.bitDepth == 4) {
				//easy, just read 1024 bytes
				for (var j=0; j<64; j++) tile.push(view.getUint8(offset++));
			} else {
				for (var j=0; j<32; j++) {
					var dat = view.getUint8(offset++);
					tile.push(dat&0xF);
					tile.push(dat>>4);
				}
			}
			char.tiles.push(tile);
		}
		return char;
	}

	function loadCPOS(view) { //palette count map, supposedly. maps each palette to an ID
		var offset = t.sectionOffsets[1] - 8;

		var cpos = {};
		cpos.type = readChar(view, offset+0x0)+readChar(view, offset+0x1)+readChar(view, offset+0x2)+readChar(view, offset+0x3);
		if (cpos.type != "SOPC") throw "NCLR invalid. Expected SOPC, found "+stamp;
		cpos.blockSize = view.getUint32(offset+0x4, true);
		//padding 0x8

		cpos.tileSize = view.getUint16(offset+0xC, true); //always 32
		cpos.tileCount = view.getUint16(offset+0xE, true);
		return cpos;
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