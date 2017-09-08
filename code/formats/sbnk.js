//
// sbnk.js
//--------------------
// Reads sbnk files.
// by RHY3756547
//
// includes: gl-matrix.js (glMatrix 2.0)
//

window.sbnk = function(input, dataView) {
	var t = this;
	this.load = load;

	function load(input, dataView) {
		var view = (dataView)?input:(new DataView(input));
		var header = null;
		var offset = 0;

			var stamp = readChar(view, 0x0)+readChar(view, 0x1)+readChar(view, 0x2)+readChar(view, 0x3);
			if (stamp != "SBNK") throw "SWAV invalid. Expected SWAV, found "+stamp;
			offset += 16;
			var data = readChar(view, offset)+readChar(view, offset+1)+readChar(view, offset+2)+readChar(view, offset+3);
			if (data != "DATA") throw "SWAV invalid, expected DATA, found "+data;
			offset += 8;

			offset += 32; //skip reserved

		var numInst = view.getUint32(offset, true);
		t.instruments = [];
		offset += 4;
		for (var i=0; i<numInst; i++) {
			var fRecord = view.getUint8(offset);
			var nOffset = view.getUint16(offset+1, true);

			if (fRecord == 0) {
				t.instruments.push({type:0});
			} else if (fRecord < 16) { //note/wave definition
				var obj = readParams(view, nOffset);
				obj.type = 1;
				t.instruments.push(obj);
			} else if (fRecord == 16) {
				var obj = {};
				obj.lower = view.getUint8(nOffset++);
				obj.upper = view.getUint8(nOffset++);
				obj.entries = []
				var notes = (obj.upper-obj.lower)+1;
				for (var j=0; j<notes; j++) {
					obj.entries.push(readParams(view, nOffset+2));
					nOffset += 12;
				}
				obj.type = 2;
				t.instruments.push(obj);
			} else if (fRecord == 17) {
				var obj = {};
				obj.regions = [];
				for (var j=0; j<8; j++) {
					var dat = view.getUint8(nOffset+j);
					if (dat != 0) obj.regions.push(dat);
					else break;
				}
				obj.entries = [];
				nOffset += 8;
				for (var j=0; j<obj.regions.length; j++) {
					obj.entries.push(readParams(view, nOffset+2));
					nOffset += 12;
				}
				obj.type = 3;
				t.instruments.push(obj);
			}

			offset += 4;
		}
	}

	function readParams(view, off) {
		var obj = {};
		obj.swav = view.getUint16(off, true);
		obj.swar = view.getUint16(off+2, true);
		obj.note = view.getUint8(off+4);

		obj.freq = noteToFreq(obj.note);

		obj.attack = view.getUint8(off+5);
		obj.decay = view.getUint8(off+6);
		obj.sustainLvl = view.getUint8(off+7);
		obj.release = view.getUint8(off+8);
		obj.pan = view.getUint8(off+9);
		return obj;
	}

	function noteToFreq(n) {
		return Math.pow(2, (n-49)/12)*440;
	}

	function readChar(view, offset) {
		return String.fromCharCode(view.getUint8(offset));
	}

	if (input != null) {
		load(input, dataView);
	}
}