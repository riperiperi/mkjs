//
// nclr.js
//--------------------
// Loads nclr files and provides a variety of functions for accessing and using the data.
// Palette information for nitro 2d graphics.
// by RHY3756547
//

window.nclr = function(input) {

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
			if (header.stamp != "RLCN") throw "NCLR invalid. Expected RLCN, found "+header.stamp;
			if (header.numSections < 1 || header.numSections > 2) throw "NCLR invalid. Too many sections - should have 2.";
			offset = header.sectionOffsets[0];
		//end nitro
		t.sectionOffsets = header.sectionOffsets;
		t.sectionOffsets[0] = 0x18;

		mainOff = offset;

		t.pltt = loadPLTT(view);
		if (header.numSections > 1) t.pcmp = loadPCMP(view);
	}

	function loadPLTT(view) {
		var offset = t.sectionOffsets[0] - 8;

		var pltt = {};
		pltt.type = readChar(view, offset+0x0)+readChar(view, offset+0x1)+readChar(view, offset+0x2)+readChar(view, offset+0x3);
		if (pltt.type != "TTLP") throw "NCLR invalid. Expected TTLP, found "+pltt.type;
		pltt.blockSize = view.getUint32(offset+0x4, true);
		t.sectionOffsets[1] = t.sectionOffsets[0] + pltt.blockSize;
		pltt.bitDepth = view.getUint32(offset+0x8, true); //3 -> 4bit, 4 -> 8bit
		pltt.padding = view.getUint32(offset+0xC, true);
		pltt.palEntries = view.getUint32(offset+0x10, true) / 2; //stored in bytes, 2 bytes per col. seems to be wrong sometimes? (8bit mode, padding as 1)
		pltt.colorsPerPal = view.getUint32(offset+0x14, true); //usually 16

		//16-bit pallete data
		//XBBBBBGGGGGRRRRR

		var colsPerPal = (pltt.bitDepth == 4)?256:16;
		var realPalCount = (pltt.blockSize - 0x18) / 2;

		offset += 0x18;
		pltt.palettes = [];
		var curPal = [];
		for (var i=0; i<realPalCount; i++) {
			curPal.push(readPalColour(view, offset));
			if (curPal.length >= colsPerPal) {
				pltt.palettes.push(curPal);
				curPal = [];
			}
			offset += 2;
		}
		if (curPal.length > 0) pltt.palettes.push(curPal);
		return pltt;
	}

	function loadPCMP(view) { //palette count map, supposedly. maps each palette to an ID
		var offset = t.sectionOffsets[1] - 8;

		var pcmp = {};
		pcmp.type = readChar(view, offset+0x0)+readChar(view, offset+0x1)+readChar(view, offset+0x2)+readChar(view, offset+0x3);
		if (pcmp.type != "PMCP") throw "NCLR invalid. Expected PMCP, found "+stamp;
		pcmp.blockSize = view.getUint32(offset+0x4, true);
		pcmp.palCount = view.getUint16(offset+0x8, true);
		//unknown 16: 0?
		pcmp.unknown = view.getUint32(offset+0xC, true);

		offset += 0x10;
		var palIDs = [];
		for (var i=0; i<pcmp.palCount; i++) {
			palIDs.push(view.getUint16(offset, true));
			offset += 2;
		}
		return pcmp;
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