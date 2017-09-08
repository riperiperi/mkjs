//
// swar.js
//--------------------
// Reads swar files.
// by RHY3756547
//
// includes: gl-matrix.js (glMatrix 2.0)
//

window.swar = function(input, dataView) {
	var t = this;
	this.load = load;

	function load(input, dataView) {
		var view = (dataView)?input:(new DataView(input));
		var header = null;
		var offset = 0;

		var stamp = readChar(view, 0x0)+readChar(view, 0x1)+readChar(view, 0x2)+readChar(view, 0x3);
		if (stamp != "SWAR") throw "SWAR invalid. Expected SWAR, found "+stamp;
		offset += 16; //skip magic number, size and number of blocks
		var data = readChar(view, offset)+readChar(view, offset+1)+readChar(view, offset+2)+readChar(view, offset+3);
		if (data != "DATA") throw "SWAV invalid, expected DATA, found "+data;
		offset += 40; //skip reserved 0s and size

		var nSamples = view.getUint32(offset, true);
		offset += 4;

		t.samples = [];
		for (var i=0; i<nSamples; i++) {
			t.samples.push(new swav(new DataView(input, view.getUint32(offset, true)), false, true));
			offset += 4;
		}
	}

	function readChar(view, offset) {
		return String.fromCharCode(view.getUint8(offset));
	}

	if (input != null) {
		load(input, dataView);
	}
}