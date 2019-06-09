//
// nsbtp.js
//--------------------
// Reads NSBTP files (texture info animation) for use in combination with an NSBMD (model) file
// by RHY3756547
//
// includes: gl-matrix.js (glMatrix 2.0)
// /formats/nitro.js
//

window.nsbtp = function(input) {

	var mainOff, matOff;
	var animData;

	//anim data structure:
	// {
	//     objectData: [
	//         {
    //             obj: { }
	//         }
	//	   ]
	// }

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

	var texTotal;
	var palTotal;
	var texNamesOff;
	var palNamesOff;

	var texNames;
	var palNames;

	function load(input) {
		var view = new DataView(input);
		var header = null;
		var offset = 0;
		var tex;

		//nitro 3d header
			header = nitro.readHeader(view);
			if (header.stamp != "BTP0") throw "NSBTP invalid. Expected BTP0, found "+header.stamp;
			if (header.numSections > 1) throw "NSBTP invalid. Too many sections - should have 1 maximum.";
			offset = header.sectionOffsets[0];
		//end nitro

		mainOff = offset;

		var stamp = readChar(view, offset+0x0)+readChar(view, offset+0x1)+readChar(view, offset+0x2)+readChar(view, offset+0x3);
		if (stamp != "PAT0") throw "NSBTP invalid. Expected PAT0, found "+stamp;

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
		matOff = offset;
		var stamp = readChar(view, offset+0x0)+readChar(view, offset+0x1)+readChar(view, offset+0x2)+readChar(view, offset+0x3); //should be M_PT, where _ is a 0 character

		offset += 4;
		//b400 0303 4400 7400 - countdown (3..2..1.. then start is another model, duration 180 frames, 3 frames of anim)
		//1400 0404 4800 8800 - kuribo (4 frames, shorter animation duration)
		//1e00 0202 4000 6000 - pinball stage (2 frames)
		//0200 0202 4000 6000 - fish, cow and crab (duration and total 2 frames, unusually short animation)
		//0d00 0404 5000 9000 - bat (duration 13, 6 frames, uneven pacing)

		//16bit duration (60fps frames, total)
		//8bit tex start
		//8bit pal start
		//16bit unknown (flags? kuribo repeats by playing backwards)
		//16bit unknown

		//example data, for 3 mat 3 pal data
		//var tinfo = texInfoHandler(view, offset+4);
		//8 bytes here? looks like texinfo

		var duration = view.getUint16(offset, true);
		texTotal = view.getUint8(offset+2);
		palTotal = view.getUint8(offset+3);
		texNamesOff = view.getUint16(offset+4, true);
		palNamesOff = view.getUint16(offset+6, true);

		var nameOffset = matOff + texNamesOff;
		texNames = [];
		//read 16char tex names
		for (var i=0; i<texTotal; i++) {
			var name = "";
			for (var j=0; j<16; j++) {
				name += readChar(view, nameOffset++)
			}
			texNames[i] = name;
		}

		nameOffset = matOff + palNamesOff;
		palNames = [];
		//read 16char pal names
		for (var i=0; i<palTotal; i++) {
			var name = "";
			for (var j=0; j<16; j++) {
				name += readChar(view, nameOffset++)
			}
			palNames[i] = name;
		}

		//...then another nitro
		var data = nitro.read3dInfo(view, offset+8, matInfoHandler);

		return {data: data, nextoff: data.nextoff, texTotal:texTotal, palTotal:palTotal, duration:duration, texNames: texNames, palNames: palNames};
	}

	function matInfoHandler(view, offset, base) {
		var obj = {}
		obj.frames = [];

		// in here...
		// 16bit frames
		// 16bit maybe material number (probably? mostly 0) to replace
		// 16bit unknown (flags? 0x4400 count, 0x1101 waluigi, 0x3303 goomba, 0x0010 fish)
		// 16bit offset from M_PT (always 0x38)

		//at offset (frame of these)
		// 16bit happenAt
		// 8bit tex
		// 8bit pal

		//then (frame of these)
		// 16char texname
		//then (frame of these)
		// 16char palname
		// texture animations are bound to the material via the name of this block.

		var frames = view.getUint32(offset, true);
		obj.flags = view.getUint16(offset+4, true);
		var offset2 = view.getUint16(offset+6, true);
		offset += 8;
		obj.nextoff = offset;

		offset = matOff + offset2;
		//info and timing for each frame
		for (var i=0; i<frames; i++) {
			var entry = {
				time: view.getUint16(offset, true),
				tex: view.getUint8(offset+2), //index into names?
				pal: view.getUint8(offset+3), //index into pal names?
			}
			entry.texName = texNames[entry.tex];
			entry.palName = palNames[entry.pal];
			obj.frames.push(entry);
			offset += 4;
		}
		return obj;
	}

	function readChar(view, offset) {
		return String.fromCharCode(view.getUint8(offset));
	}
}