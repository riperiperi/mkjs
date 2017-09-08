//
// kartoffsetdata.js
//--------------------
// Provides functionality to read mario kart ds kart wheel and character model offsets.
// by RHY3756547
//
// includes: gl-matrix.js (glMatrix 2.0)
//

window.kartoffsetdata = function(input) {

	var thisObj = this;

	if (input != null) {
		load(input);
	}
	this.load = load;

	function load(input) {
		var view = new DataView(input);
		var off = 0;
		var karts = []
		for (var i=0; i<37; i++) {
			var obj = {};
			obj.name = readString(view, off, 0x10);
			off += 0x10;
			obj.frontTireSize = view.getInt32(off, true)/4096;
			off += 4;

			var wheels = [];
			for (var j=0; j<4; j++) {
				var pos = vec3.create();
				pos[0] = view.getInt32(off, true)/4096;
				pos[1] = view.getInt32(off+4, true)/4096;
				pos[2] = view.getInt32(off+8, true)/4096;
				off += 12;
				wheels.push(pos);
			}

			var chars = [];
			for (var j=0; j<13; j++) {
				var pos = vec3.create();
				pos[0] = view.getInt32(off, true)/4096;
				pos[1] = view.getInt32(off+4, true)/4096;
				console.log("charPos: "+pos[1]);
				pos[2] = view.getInt32(off+8, true)/4096;
				off += 12;
				chars.push(pos);
			}

			obj.wheels = wheels;
			obj.chars = chars;

			karts.push(obj);
		}
		thisObj.karts = karts;
	}

	function readChar(view, offset) {
		return String.fromCharCode(view.getUint8(offset));
	}

	function readString(view, offset, length) {
		var str = "";
		for (var i=0; i<length; i++) {
			var b = view.getUint8(offset++);
			if (b != 0) str += String.fromCharCode(b);
		}
		return str;
	}
}