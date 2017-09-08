//
// ssar.js
//--------------------
// Reads ssar files.
// by RHY3756547
//

window.ssar = function(input) {
	var t = this;
	this.load = load;

	function load(input) {
		var view = new DataView(input);
		var header = null;
		var offset = 0;

		var stamp = readChar(view, 0x0)+readChar(view, 0x1)+readChar(view, 0x2)+readChar(view, 0x3);
		if (stamp != "SSAR") throw "SSAR invalid. Expected SSAR, found "+stamp;
		offset += 16;
		var data = readChar(view, offset)+readChar(view, offset+1)+readChar(view, offset+2)+readChar(view, offset+3);
		if (data != "DATA") throw "SSAR invalid, expected DATA, found "+data;
		offset += 8;

		t.dataOff = view.getUint32(offset, true);
		t.data = new Uint8Array(view.buffer.slice(t.dataOff));
		var count = view.getUint32(offset+4, true);
		t.entries = [];
		
		offset += 8;
		for (var i=0; i<count; i++) {
			t.entries.push(readSeqEntry(view, offset));
			offset += 12;
		}
	}

	function readSeqEntry(view, off) {
		var obj = {};
		obj.pc = view.getUint32(off, true);
		obj.seq = {data:t.data};
		obj.bank = view.getUint16(off+4, true);
		obj.vol = view.getUint8(off+6);
		obj.cpr = view.getUint8(off+7);
		obj.ppr = view.getUint8(off+8);
		obj.ply = view.getUint8(off+9);
		return obj;
	}


	function readChar(view, offset) {
		return String.fromCharCode(view.getUint8(offset));
	}

	if (input != null) {
		load(input);
	}
}