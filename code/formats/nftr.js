//
// nftr.js
//--------------------
// Reads NFTR fonts and compiles them to a texture and character lookup table. Texture is replaceable.
// by RHY3756547
//
// includes: gl-matrix.js (glMatrix 2.0)
// /formats/nitro.js
//

window.nftr = function(input) {

	var mainOff;
	var mainObj = this;

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
			//debugger;
			if (header.stamp != "RTFN") throw "NFTR invalid. Expected RTFN, found "+header.stamp;
			offset = header.sectionOffsets[0];
		//end nitro

		mainOff = offset;
	}
}