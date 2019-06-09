//
// nscr.js
//--------------------
// Loads nscr files and provides a variety of functions for accessing and using the data.
// Screen data for nitro 2d graphics. Each cell references a graphic (ncgr) and palette (nclr).
// by RHY3756547
//

window.nscr = function(input) {

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
			if (header.stamp != "RCSN") throw "NSCR invalid. Expected RCSN, found "+header.stamp;
			if (header.numSections != 1) throw "NSCR invalid. Too many sections - should have 1.";
			offset = header.sectionOffsets[0];
		//end nitro
		t.sectionOffsets = header.sectionOffsets;
		t.sectionOffsets[0] = 0x18;

		mainOff = offset;

		t.scrn = loadSCRN(view);
	}

	function loadSCRN(view) {
		var offset = t.sectionOffsets[0] - 8;

		var scrn = {};
		scrn.type = readChar(view, offset+0x0)+readChar(view, offset+0x1)+readChar(view, offset+0x2)+readChar(view, offset+0x3);
		if (scrn.type != "NRCS") throw "SCRN invalid. Expected NRCS, found "+scrn.type;
		scrn.blockSize = view.getUint32(offset+0x4, true);
		t.sectionOffsets[1] = t.sectionOffsets[0] + scrn.blockSize;
		scrn.screenWidth = view.getUint16(offset+0x8, true); //in pixels
		scrn.screenHeight = view.getUint16(offset+0xA, true);
		scrn.padding = view.getUint32(offset+0xC, true); //always 0
		scrn.screenDataSize = view.getUint32(offset+0x10, true);
		offset += 0x14;

		var entries = (scrn.blockSize - 0x14)/2;
		scrn.data = [];

		for (var i=0; i<entries; i++) {
			scrn.data.push(view.getUint16(offset, true));
			offset += 2;
		}
		return scrn;

		/* 
		Format is (YYYYXXNNNNNNNNNN)
		Y4 Palette Number 
		X2 Transformation (YFlip/XFlip) 
		N10 Tile Number
		*/
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