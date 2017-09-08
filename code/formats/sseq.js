//
// sseq.js
//--------------------
// Reads sseq files.
// by RHY3756547
//

window.sseq = function(input) {
	var t = this;
	this.load = load;

	function load(input, archived) {
		var view = new DataView(input);
		var header = null;
		var offset = 0;

		var stamp = readChar(view, 0x0)+readChar(view, 0x1)+readChar(view, 0x2)+readChar(view, 0x3);
		if (stamp != "SSEQ") throw "SSEQ invalid. Expected SSEQ, found "+stamp;
		offset += 16;
		var data = readChar(view, offset)+readChar(view, offset+1)+readChar(view, offset+2)+readChar(view, offset+3);
		if (data != "DATA") throw "SWAV invalid, expected DATA, found "+data;
		offset += 8;

		t.data = new Uint8Array(input.slice(view.getUint32(offset, true)));
	}
	
	function readChar(view, offset) {
		return String.fromCharCode(view.getUint8(offset));
	}

	if (input != null) {
		load(input);
	}
}