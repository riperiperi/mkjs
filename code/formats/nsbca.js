//
// nsbca.js
//--------------------
// Reads NSBCA files (bone animations) for use in combination with an NSBMD (model) file
// by RHY3756547
//
// includes: gl-matrix.js (glMatrix 2.0)
// /formats/nitro.js
//

// most investigation done by florian for the mkds course modifier.
// I've tried to keep things much simpler than they were in his code.

window.nsbca = function(input) {

	var mainOff;
	var animData;
	var speeds = [1.0, 0.5, 1/3];
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
			if (header.stamp != "BCA0") throw "NSBCA invalid. Expected BCA0, found "+header.stamp;
			if (header.numSections > 1) throw "NSBCA invalid. Too many sections - should have 1 maximum.";
			offset = header.sectionOffsets[0];
		//end nitro

		mainOff = offset;

		var stamp = readChar(view, offset+0x0)+readChar(view, offset+0x1)+readChar(view, offset+0x2)+readChar(view, offset+0x3);
		if (stamp != "JNT0") throw "NSBCA invalid. Expected JNT0, found "+stamp;

		animData = nitro.read3dInfo(view, mainOff+8, animInfoHandler);
		mainObj.animData = animData;
	}

	function animInfoHandler(view, off, base) {
		var offset = mainOff + view.getUint32(off, true);
		var obj = {nextoff: off + 4}
		readAnim(view, offset, obj);
		return obj;
	}

	function readAnim(view, off, obj) {
		obj.baseOff = off;
		obj.stamp = readChar(view, off+0x0)+readChar(view, off+0x2)+readChar(view, off+0x3);
		obj.frames = view.getUint16(off+0x4, true);
		obj.numObj = view.getUint16(off+0x6, true);
		obj.unknown = view.getUint32(off+0x8, true); //NOTE: this may be a flag. used later to specify extra frames if not = 3 
		obj.off1 = view.getUint32(off+0xC, true);
		obj.off2 = view.getUint32(off+0x10, true); //offset to rotation data
		off += 0x14;
		var transforms = [];
		for (var i=0; i<obj.numObj; i++) {
			var off2 = view.getUint16(off, true)+obj.baseOff;
			transforms.push(readTrans(view, off2, obj));
			off += 2;
		}
		obj.trans = transforms;
	}

	function readTrans(view, off, obj) {
		var flag = view.getUint16(off, true); //--zyx-Sr-RZYX-T-

		off += 4;

		var transform = {};

		if (!((flag>>1) & 1)) { //T: translation
			var translate = [[], [], []]; //store translations in x,y,z arrays
			var tlExtra = [];

			for (var i=0; i<3; i++) { //iterate over x y z (for translation)
				var f = (flag>>(3+i))&1;
				if (f) { //one value
					translate[i].push(view.getInt32(off, true)/4096);
					off += 4;
				} else { //credit to florian for cracking this.
					var inf = {};
					inf.startFrame = view.getUint16(off, true)
					var dat = view.getUint16(off+2, true)
					inf.endFrame = dat&0x0FFF;
					inf.halfSize = ((dat>>12)&3);
					inf.speed = speeds[((dat>>14)&3)];
					inf.off = view.getUint32(off+4, true);

					var extra = (obj.unknown != 3)?0:(obj.frames-inf.endFrame); 
					var length = Math.floor((obj.frames+extra)*inf.speed);
					var w = (inf.halfSize)?2:4;

					var off2 = obj.baseOff+inf.off;
					for (var j=0; j<length; j++) {
						translate[i].push(((inf.halfSize)?view.getInt16(off2, true):view.getInt32(off2, true))/4096);
						off2 += w;
					}
					tlExtra[i] = inf;
					off += 8;
				}
			}

			transform.translate = translate;
			transform.tlExtra = tlExtra;
		}

		if (!((flag>>6) & 1)) { //R: rotation, which is both fun and exciting.

			var rotate = []; 
			var rotExtra;

			var f = (flag>>8)&1;
			if (f) { //one value
				rotate.push(readRotation(view, off, obj));
				off += 4;
			} else { //credit to florian for cracking this.
				var inf = {};
				inf.startFrame = view.getUint16(off, true)
				var dat = view.getUint16(off+2, true) //low 12 bits are end frame, high 4 are size flag and speed
				inf.endFrame = dat&0x0FFF;
				inf.halfSize = ((dat>>12)&3); //not used by rotation?
				inf.speed = speeds[((dat>>14)&3)];
				inf.off = view.getUint32(off+4, true);
				var extra = (obj.unknown != 3)?0:(obj.frames-inf.endFrame); 
				//florian's rotate code seems to ignore this extra value. I'll need more examples of nsbca to test this more thoroughly.
				var length = Math.floor((obj.frames+extra)*inf.speed);

				var off2 = obj.baseOff+inf.off;
				try {
					for (var j=0; j<length; j++) {
						rotate.push(readRotation(view, off2, obj));
						off2 += 2;
					}
				} catch (e) {
					
				}
				rotExtra = inf;
				off += 8;
			}

			transform.rotate = rotate;
			transform.rotExtra = rotExtra;
		}

		if (!((flag>>9) & 1)) { //S: scale
			var scale = [[], [], []]; //store scales in x,y,z arrays
			var scExtra = [];

			for (var i=0; i<3; i++) { //iterate over x y z (for scale)
				var f = (flag>>(11+i))&1;
				if (f) { //one value
					scale[i].push({
						s1: view.getInt32(off, true)/4096,
						s2: view.getInt32(off, true)/4096
					});
					off += 8;
				} else { //credit to florian for cracking this.
					var inf = {};
					inf.startFrame = view.getUint16(off, true)
					var dat = view.getUint16(off+2, true)
					inf.endFrame = dat&0x0FFF;
					inf.halfSize = ((dat>>12)&3);
					inf.speed = speeds[((dat>>14)&3)];
					inf.off = view.getUint32(off+4, true);

					var extra = (obj.unknown != 3)?0:(obj.frames-inf.endFrame); 
					var length = Math.ceil((obj.frames+extra)*inf.speed);
					var w = ((inf.halfSize)?2:4);

					var off2 = obj.baseOff+inf.off;
					for (var j=0; j<length; j++) {
						scale[i].push({
							s1: ((inf.halfSize)?view.getInt16(off2, true):view.getInt32(off2, true))/4096,
							s2: ((inf.halfSize)?view.getInt16(off2+w, true):view.getInt32(off2+w, true))/4096
						});
						off2 += w*2;
					}
					scExtra[i] = inf;
					off += 8;
				}
			}

			transform.scale = scale;
			transform.scExtra = scExtra;
		}

		return transform;
	}

	function readRotation(view, off, obj) {
		var dat = view.getInt16(off, true);
		var ind = (dat&0x7FFF);
		var mode = (dat>>15);

		if (mode) { //rotation is pivot
			var off2 = obj.baseOff+obj.off1+ind*6; //jump to rotation data
			return {
				pivot: true,
				param: view.getUint16(off2, true),
				a: view.getInt16(off2+2, true)/4096,
				b: view.getInt16(off2+4, true)/4096
			};
		} else {
			var off2 = obj.baseOff+obj.off2+ind*10; //jump to rotation data
			var d1 = view.getInt16(off2, true);
			var d2 = view.getInt16(off2+2, true);
			var d3 = view.getInt16(off2+4, true);
			var d4 = view.getInt16(off2+6, true);
			var d5 = view.getInt16(off2+8, true);

			var i6 = ((d5&7)<<12) | ((d1&7)<<9) | ((d2&7)<<6) | ((d3&7)<<3) | ((d4&7));
			if (i6&4096) i6 = (-8192)+i6;

			var v1 = [d1>>3, d2>>3, d3>>3]
			var v2 = [d4>>3, d5>>3, i6]

			vec3.scale(v1, v1, 1/4096);
			vec3.scale(v2, v2, 1/4096);
			var v3 = vec3.cross([], v1, v2)

			var mat = [
				v1[0], v1[1], v1[2],
				v2[0], v2[1], v2[2],
				v3[0], v3[1], v3[2]
			]

			return {
				pivot: false,
				mat: mat
			};
		}
	}

	function readChar(view, offset) {
		return String.fromCharCode(view.getUint8(offset));
	}
}