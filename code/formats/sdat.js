//
// sdat.js
//--------------------
// Reads sdat archives.
// Right now this just loads literally every resource in the sdat since in js there is no such thing as half loading a 
// file from local storage, so why not just load it once and store in a usable format.
//
// by RHY3756547
//
// includes: gl-matrix.js (glMatrix 2.0)
//

window.sdat = function(input) {
	var t = this;
	this.sections = {};
	this.load = load;

	function load(input) {
		t.buffer = input;
		var view = new DataView(input);
		var header = null;
		var offset = 0;

		var stamp = readChar(view, 0x0)+readChar(view, 0x1)+readChar(view, 0x2)+readChar(view, 0x3);
		if (stamp != "SDAT") throw "SDAT invalid. Expected SDAT, found "+stamp;

		var unknown1 = view.getUint32(0x4, true);
		var filesize = view.getUint32(0x8, true);
		var headsize = view.getUint16(0xC, true);
		var numSections = view.getUint16(0xE, true);
		var sectionOffsets = [];
		var sectionSizes = [];
		for (var i=3; i>-1; i--) { //reverse order so we can process files into js objects
			var off = (view.getUint32(0x10+i*8, true));
			var size = (view.getUint32(0x14+i*8, true));
			if (size != 0) readSection(view, off);
		}
		
	}

	function readSection(view, off) {
		var stamp = "$"+readChar(view, off)+readChar(view, off+1)+readChar(view, off+2)+readChar(view, off+3);
		if (sectionFunc[stamp] != null) t.sections[stamp] = sectionFunc[stamp](view, off+8);
		else console.error("Invalid section in SDAT! No handler for section type "+stamp.substr(1, 4));
	}

	var sectionFunc = {}

	sectionFunc["$SYMB"] = function(view, off) {

	}

	sectionFunc["$INFO"] = function(view, off) {
		var obj = [];
		for (var i=0; i<8; i++) {
			var relOff = off+view.getUint32(off+i*4, true)-8;

			var count = view.getUint32(relOff, true);
			obj[i] = [];
			relOff += 4;
			var last = null;
			for (var j=0; j<count; j++) {
				var infoOff = view.getUint32(relOff, true);
				//WRONG
				last = recordInfoFunc[i](view, off+infoOff-8);//(infoOff == 0 && last != null)?last.nextOff:(off+infoOff-8));
				obj[i][j] = last;
				relOff += 4;
			}
		}
		console.log(obj);
		return obj;
	}

	sectionFunc["$FAT "] = function(view, off) {
		var a = [];
		var count = view.getUint32(off, true);
		off += 4;
		for (var i=0; i<count; i++) {
			var obj = {};
			obj.off = view.getUint32(off, true);
			obj.size = view.getUint32(off+4, true);
			off += 16;
			a.push(obj);
		}
		console.log(a);
		return a;
	}

	sectionFunc["$FILE"] = function(view, off) {
		console.log("file");
	}

	var recordInfoFunc = []

	recordInfoFunc[0] = function(view, off) {
		var obj = {};
		obj.fileID = view.getUint16(off, true);
		obj.seq = new sseq(getFile(obj.fileID));
		obj.pc = 0;
		obj.unknown = view.getUint16(off+2, true);
		obj.bank = view.getUint16(off+4, true);
		obj.vol = view.getUint8(off+6);
		obj.cpr = view.getUint8(off+7);
		obj.ppr = view.getUint8(off+8);
		obj.ply = view.getUint8(off+9);
		obj.nextOff = off+10;
		return obj;
	}
	recordInfoFunc[1] = function(view, off) {
		var obj = {};
		obj.fileID = view.getUint16(off, true);
		obj.arc = new ssar(getFile(obj.fileID));
		obj.unknown = view.getUint16(off+2, true);
		obj.nextOff = off+4;
		return obj;
	}
	recordInfoFunc[2] = function(view, off) {
		var obj = {};
		obj.fileID = view.getUint16(off, true);
		obj.unknown = view.getUint16(off+2, true);
		obj.bank = new sbnk(getFile(obj.fileID));
		obj.waveArcs = [];
		off += 4;
		for (var i=0; i<4; i++) {
			obj.waveArcs[i] = view.getUint16(off, true);
			off += 2;
		}
		obj.nextOff = off;
		return obj;
	}
	recordInfoFunc[3] = function(view, off) {
		var obj = {};
		obj.fileID = view.getUint16(off, true);
		obj.unknown = view.getUint16(off+2, true);
		obj.arc = new swar(getFile(obj.fileID));
		obj.nextOff = off+4;
		return obj;
	}
	recordInfoFunc[4] = function(view, off) {}
	recordInfoFunc[5] = function(view, off) {}
	recordInfoFunc[6] = function(view, off) {}

	recordInfoFunc[7] = function(view, off) {
		var obj = {};
		obj.fileID = view.getUint16(off, true);
		obj.unknown = view.getUint16(off+2, true);
		obj.vol = view.getUint8(off+4);
		obj.pri = view.getUint8(off+5);
		obj.ply = view.getUint8(off+6);
		obj.nextOff = off+7;
		return obj;
	}

	function getFile(fid) {
		var file = t.sections["$FAT "][fid];
		if (file != null) {
			return t.buffer.slice(file.off, file.off+file.size);
		}
	}

	function readChar(view, offset) {
		return String.fromCharCode(view.getUint8(offset));
	}

	if (input != null) {
		load(input);
	}
}