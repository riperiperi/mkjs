//
// nsbta.js
//--------------------
// Reads NSBTA files (texture uv animation via uv transform matrices within a polygon) for use in combination with an NSBMD (model) file
// by RHY3756547
//
// includes: gl-matrix.js (glMatrix 2.0)
// /formats/nitro.js
//

// man oh man if only there were some documentation on this that weren't shoddily written code in mkds course modifier
// well i guess we can find out how the format works
// together :')

window.nsbta = function(input) {

	var mainOff;
	var animData;
	var mainObj = this;
	var prop = [
		"scaleS",
		"scaleT",
		"rotation",
		"translateS",
		"translateT"
	]

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
			if (header.stamp != "BTA0") throw "NSBTA invalid. Expected BTA0, found "+header.stamp;
			if (header.numSections > 1) throw "NSBTA invalid. Too many sections - should have 1 maximum.";
			offset = header.sectionOffsets[0];
		//end nitro

		mainOff = offset;

		var stamp = readChar(view, offset+0x0)+readChar(view, offset+0x1)+readChar(view, offset+0x2)+readChar(view, offset+0x3);
		if (stamp != "SRT0") throw "NSBTA invalid. Expected SRT0, found "+stamp;

		animData = nitro.read3dInfo(view, mainOff+8, animInfoHandler);
		mainObj.animData = animData;
	}

	function animInfoHandler(view, offset) {
		var animOff = view.getUint32(offset, true);

		var off = mainOff+animOff;
		var obj = readAnimData(view, off);
		obj.nextoff = offset+4;

		return obj;
	}

	function readAnimData(view, offset) {
		var stamp = readChar(view, offset+0x0)+readChar(view, offset+0x1)+readChar(view, offset+0x2)+readChar(view, offset+0x3); //should be M_AT, where _ is a 0 character
		var unknown1 = view.getUint16(offset+4, true);
		var unknown2 = view.getUint8(offset+6, false);
		var unknown3 = view.getUint8(offset+7, false);
		var data = nitro.read3dInfo(view, offset+8, matInfoHandler);
		return {data: data, nextoff: data.nextoff};
	}

	function matInfoHandler(view, offset, base) {
		// there doesn't seem to be any documentation on this so I'm going to take the first step and maybe explain a few things here:
		// each material has 5 sets of 16 bit values of the following type:
		//
		// frames: determines the number of frames worth of transforms of this type are stored
		// flags: if >4096 then multiple frames are used instead of inline data. not much else is known
		// offset/data: depending on previous flag, either points to an array of data or provides the data for the sole frame. relative to base of this 3dinfoobject
		// data2: used for rotation matrix (second value)
		//
		// order is as follows:
		// scaleS, scaleT, rotation, translateS, translateT (all values are signed fixed point 1.3.12)
		//
		// note: rotation external data has two 16 bit integers instead of one per frame.
		//
		// also!! rotation matrices work as follows:
		//
		// | B   A |
		// | -A   B |
		//
		// kind of like nsbmd pivot

		var obj = {}
		obj.flags = []; //for debug
		obj.frames = [];
		obj.frameStep = {};

		for (var i=0; i<5; i++) {
			
			obj[prop[i]] = [];
			var frames = view.getUint16(offset, true);
			var flags = view.getUint16(offset+2, true);
			var value = view.getUint16(offset+4, true);
			var data2 = view.getInt16(offset+6, true)/4096;

			//flags research so far:
			//bit 13 (8196) - set if inline single frame data, unset if multiple frame data at offset
			//bit 14-15 - framestep, aka what to shift frame counters by (eg for half framerate this would be 1, frame>>1, essentially dividing the frame speed by 2.)

			obj.frameStep[prop[i]] = (flags>>14);
			obj.flags[i] = flags;
			obj.frames[i] = frames;

			if (flags & 8192) {
				if (value & 32768) value = 65536-value; //convert to int
				obj[prop[i]].push(value/4096);
				if (i == 2) obj[prop[i]].push(data2);
			} else { //data is found at offset
				frames = frames>>obj.frameStep[prop[i]];
				//frames -= 1;
				var off = base + value-8;
				for (var j=0; j<frames*((i==2)?2:1); j++) {
					var prevvalue = view.getInt16(off-2, true)/4096;
					//debugger;
					obj[prop[i]].push(view.getInt16(off, true)/4096);
					off += 2;
				}
			}

			offset += 8;
		}
		obj.nextoff = offset;
		return obj;
	}

	function readChar(view, offset) {
		return String.fromCharCode(view.getUint8(offset));
	}
}