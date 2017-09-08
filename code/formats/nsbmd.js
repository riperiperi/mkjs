//
// nsbmd.js
//--------------------
// Reads NSBMD models and any texture data within them. 
// by RHY3756547
//
// includes: gl-matrix.js (glMatrix 2.0)
// /formats/nitro.js
// /formats/nsbtx.js
//

window.nsbmd = function(input) {

	var mainOff, modelData, texPalOff, materials;
	var mainObj = this;

	if (input != null) {
		load(input);
	}
	this.load = load;


	function load(input) {
		mainObj.hasBillboards = false;
		var view = new DataView(input);
		var header = null;
		var offset = 0;
		var tex;

		//nitro 3d header
			header = nitro.readHeader(view);
			if (header.stamp != "BMD0") throw "NSBMD invalid. Expected BMD0, found "+header.stamp;
			if (header.numSections > 2) throw "NSBMD invalid. Too many sections - should have 2 maximum.";
			if (header.numSections == 2) tex = new nsbtx(input.slice(header.sectionOffsets[1]), true, true);
			offset = header.sectionOffsets[0];
		//end nitro

		mainOff = offset;

		var stamp = readChar(view, offset+0x0)+readChar(view, offset+0x1)+readChar(view, offset+0x2)+readChar(view, offset+0x3);
		if (stamp != "MDL0") throw "NSBMD invalid. Expected MDL0, found "+stamp;

		mainObj.tex = tex;

		modelData = nitro.read3dInfo(view, mainOff+8, modelInfoHandler);
		mainObj.modelData = modelData;
	}

	function modelInfoHandler(view, offset) {
		var mdlOff = view.getUint32(offset, true);

		var off = mainOff+mdlOff;
		var obj = readModelData(view, off);
		obj.nextoff = offset+4;

		return obj;
	}

	function readModelData(view, offset) {
		var head = {}
		head.blockSize = view.getUint32(offset, true);
		head.bonesOffset = offset+view.getUint32(offset+4, true);
		head.materialsOffset = offset+view.getUint32(offset+8, true);
		head.polyStartOffset = offset+view.getUint32(offset+0xC, true);
		head.polyEndOffset = offset+view.getUint32(offset+0x10, true);

		head.numObjects = view.getUint8(offset+0x17);
		head.numMaterials = view.getUint8(offset+0x18);
		head.numPolys = view.getUint8(offset+0x19);
		head.maxStack = view.getUint8(offset+0x1A);

		head.scale = view.getInt32(offset+0x1C, true)/4096;

		head.numVerts = view.getUint16(offset+0x24, true);
		head.numSurfaces = view.getUint16(offset+0x26, true);
		head.numTriangles = view.getUint16(offset+0x28, true);
		head.numQuads = view.getUint16(offset+0x2A, true);

		head.bboxX = view.getInt16(offset+0x2C, true)/4096;
		head.bboxY = view.getInt16(offset+0x2E, true)/4096;
		head.bboxZ = view.getInt16(offset+0x30, true)/4096;
		head.bboxWidth = view.getInt16(offset+0x32, true)/4096;
		head.bboxHeight = view.getInt16(offset+0x34, true)/4096;
		head.bboxDepth = view.getInt16(offset+0x36, true)/4096;
		//head.runtimeData = view.getUint64(offset+0x38, true);
		texPalOff = head.materialsOffset; //leak into local scope so it can be used by tex and pal bindings

		var objects = nitro.read3dInfo(view, offset+0x40, objInfoHandler);
		var polys = nitro.read3dInfo(view, head.polyStartOffset, polyInfoHandler);

		materials = nitro.read3dInfo(view, head.materialsOffset+4, matInfoHandler);

		var tex = nitro.read3dInfo(view, head.materialsOffset+view.getUint16(head.materialsOffset, true), texInfoHandler);
		var palt = nitro.read3dInfo(view, head.materialsOffset+view.getUint16(head.materialsOffset+2, true), palInfoHandler);

		var commands = parseBones(head.bonesOffset, view, polys, materials, objects, head.maxStack);

		return {head: head, objects: objects, polys: polys, materials: materials, tex:tex, palt:palt, commands:commands}
	}

	function parseBones(offset, view, polys, materials, objects, maxStack) {
		var last;
		var commands = [];

		var freeStack = maxStack;
		var forceID=null;
		var lastMat = null;

		while (offset<texPalOff) { //bones
			last = view.getUint8(offset++);
			console.log("bone cmd: 0x"+last.toString(16));
			switch (last) {
				case 0x06: //bind object transforms to parent. bone exists but is not placed in the stack
					var obj = view.getUint8(offset++);
					var parent = view.getUint8(offset++);
					var zero = view.getUint8(offset++);

					var object = objects.objectData[obj];
					object.parent = parent;

					commands.push({obj:obj, parent:parent, stackID:freeStack++});
					break;
				case 0x26:
				case 0x46: //placed in the stack at stack id
					var obj = view.getUint8(offset++);
					var parent = view.getUint8(offset++);
					var zero = view.getUint8(offset++);
					var stackID = view.getUint8(offset++);

					var object = objects.objectData[obj];
					object.parent = parent;

					commands.push({obj:obj, parent:parent, stackID:((last == 0x26)?stackID:freeStack++), restoreID:((last == 0x46)?stackID:null)});
					break;
				case 0x66: //has ability to restore to another stack id. no idea how this works
					var obj = view.getUint8(offset++);
					var parent = view.getUint8(offset++);
					var zero = view.getUint8(offset++);
					var stackID = view.getUint8(offset++);
					var restoreID = view.getUint8(offset++);

					var object = objects.objectData[obj];
					object.parent = parent;

					commands.push({obj:obj, parent:parent, stackID:stackID, restoreID:restoreID});
					break;
				case 0x04:
				case 0x24:
				case 0x44: //bind material to polygon: matID, 5, polyID
					var mat = view.getUint8(offset++);
					lastMat = mat;
					var five = view.getUint8(offset++); //???
					var poly = view.getUint8(offset++);
					polys.objectData[poly].stackID = (forceID == null)?(commands[commands.length-1].stackID):forceID;
					polys.objectData[poly].mat = mat;
					break;
				case 1:
					break;
				case 2: //node visibility (maybe to implement this set matrix to 0)

					var node = view.getUint8(offset++);
					var vis = view.getUint8(offset++);
					objects.objectData[node].vis = vis;
					console.log("visibility thing "+node);
					if (node > 10) debugger;
					break;
				case 3: //stack id for poly (wit)
					forceID = view.getUint8(offset++);
					console.log("stackid is "+forceID);
				case 0:
					break;
				case 5:
					//i don't... what??
					//holy shp!
					var poly = view.getUint8(offset++);
					polys.objectData[poly].stackID = (stackID == null)?(commands[commands.length-1].forceID):forceID;
					polys.objectData[poly].mat = lastMat;

					break;
				case 7:
					//sets object to be billboard
					var obj = view.getUint8(offset++);
					objects.objectData[obj].billboardMode = 1;
					mainObj.hasBillboards = true;
					break;
				case 8:
					//sets object to be billboard around only y axis. (xz remain unchanged)
					var obj = view.getUint8(offset++);
					objects.objectData[obj].billboardMode = 2;
					mainObj.hasBillboards = true;
					break;
				case 0x0b:
					break; //begin, not quite sure what of. doesn't seem to change anything
				case 0x2b:
					break; //end
				default:
					console.log("bone transform unknown: "+last);
				break;
			}
		}
		//if (window.throwWhatever) debugger;
		return commands;
	}

	function matInfoHandler(view, off, base) {
		var offset = texPalOff + view.getUint32(off, true);

		var rel = 0;
		/*while (rel < 40) {
			var flags = view.getUint16(offset+rel, true);
			if ((flags&15)==15) console.log("rel at "+rel);
			rel += 2;
		}*/

		var polyAttrib = view.getUint16(offset+12, true);
		console.log(polyAttrib);

		var flags = view.getUint16(offset+22, true); //other info in here is specular data etc.

		//scale starts at 44;

		var mat;
		offset += 44;
		switch ((flags>>14) & 0x03) { //texture scaling mode
			case 0:
				mat = mat3.create(); //no scale
				break;
			case 1:
				mat = mat3.create();
				mat3.scale(mat, mat, [view.getInt32(offset, true)/4096, view.getInt32(offset+4, true)/4096]);
				//mat3.translate(mat, mat, [-anim.translateS[(texFrame>>anim.frameStep.translateS)%anim.translateS.length], anim.translateT[(texFrame>>anim.frameStep.translateT)%anim.translateT.length]]) //for some mystery reason I need to negate the S translation

				break;
			case 2:
			case 3:
				mat = mat3.create(); //custom tex mat
				alert("custom");
				for (var i=0; i<16; i++) {
					mat[i] = view.getInt32(offset, true)/4096;
					offset += 4;
				}
		}

		var cullMode = ((polyAttrib>>6)&3);

		var alpha = ((polyAttrib>>16)&31)/31;
		if (alpha == 0) alpha = 1;

		return {
			height: 8 << ((flags>>7)&7),
			width: 8 << ((flags>>4)&7),
			repeatX: flags&1,
			repeatY: (flags>>1)&1,
			flipX: (flags>>2)&1,
			flipY: (flags>>3)&1,
			texMat: mat,
			alpha: alpha,
			cullMode: cullMode,
			nextoff: off + 4
		}
	}

	function texInfoHandler(view, off, base, ind) {
		var oDat = texPalOff+view.getUint16(off, true); //contains offset to array of materials to bind to
		var num = view.getUint8(off+2, true);
		var mats = [];
		for (var i=0; i<num; i++) {
			var mat = view.getUint8(oDat++);
			materials.objectData[mat].tex = ind; //bind to this material
			mats.push(mat);
		}
		return {
			mats: mats,
			nextoff: off + 4
		}
	}

	function palInfoHandler(view, off, base, ind) {
		var oDat = texPalOff+view.getUint16(off, true); //contains offset to array of materials to bind to
		var num = view.getUint8(off+2, true);
		var mats = [];
		for (var i=0; i<num; i++) {
			var mat = view.getUint8(oDat++);
			materials.objectData[mat].pal = ind; //bind to this material
			mats.push(mat);
		}
		return {
			mats: mats,
			nextoff: off + 4
		}
	}

	function polyInfoHandler(view, off, base) {
		var offset = base + view.getUint32(off, true);
		var dlStart = offset+view.getUint32(offset+8, true);
		var displayList = view.buffer.slice(dlStart, dlStart+view.getUint32(offset+0xC, true))
		return {
			nextoff: off + 4,
			disp: displayList
		}
	}

	function objInfoHandler(view, off, base) {
		var offset = base + view.getUint32(off, true);

		var flag = view.getUint16(offset, true); //flag format nnnn psrt
		var rotTerm1 = view.getInt16(offset+0x2, true)/4096; //first term of rotate mat if present
		var translate = vec3.create();
		if (!(flag&1)) { //translate (t) flag is 0
			translate[0] = view.getInt32(offset+0x4, true)/4096;
			translate[1] = view.getInt32(offset+0x8, true)/4096;
			translate[2] = view.getInt32(offset+0xC, true)/4096;
			offset += 0xC;
		}
		var pivot;
		var A, B, neg, mode;
		if (flag&8) { //pivot exists
			pivot = new Float32Array([0,0,0,0,0,0,0,0,0]);
			mode = (flag>>4)&15;
			neg = (flag>>8)&15;
			A = view.getInt16(offset+0x4, true)/4096;
			B = view.getInt16(offset+0x6, true)/4096;

			pivot[mode] = (neg&1)?-1:1;
			var horiz = mode%3;
			var vert = Math.floor(mode/3)
			var left = (horiz==0)?1:0; var top = ((vert==0)?1:0)*3;
			var right = (horiz==2)?1:2; var btm = ((vert==2)?1:2)*3;
			pivot[left+top] = A;
			pivot[right+top] = B;
			pivot[left+btm] = (neg&2)?-B:B;
			pivot[right+btm] = (neg&4)?-A:A;

			offset += 4;
		} else {
			pivot = mat3.create()
		}
		var scale = vec3.create();
		if (!(flag&4)) {
			scale[0] = view.getInt32(offset+0x4, true)/4096;
			scale[1] = view.getInt32(offset+0x8, true)/4096;
			scale[2] = view.getInt32(offset+0xC, true)/4096;
			offset += 0xC;
		} else {
			scale[0] = 1;
			scale[1] = 1;
			scale[2] = 1;
		}
		if ((!(flag&8)) && (!(flag&2))) { //rotate matrix, replaces pivot
			pivot[0] = rotTerm1;
			pivot[1] = view.getInt16(offset+0x4, true)/4096;
			pivot[2] = view.getInt16(offset+0x6, true)/4096;
			pivot[3] = view.getInt16(offset+0x8, true)/4096;
			pivot[4] = view.getInt16(offset+0xA, true)/4096;
			pivot[5] = view.getInt16(offset+0xC, true)/4096;
			pivot[6] = view.getInt16(offset+0xE, true)/4096;
			pivot[7] = view.getInt16(offset+0x10, true)/4096;
			pivot[8] = view.getInt16(offset+0x12, true)/4096;
			offset += 16;
		}
		var mat = mat4.create();
		mat4.translate(mat, mat, translate);
		mat4.multiply(mat, mat, mat4FromMat3(pivot));
		mat4.scale(mat, mat, scale);
		return {
			translate: translate,
			pivot: pivot,

			pA: A,
			pB: B,
			pMode: mode,
			pNeg: neg,
			
			scale: scale,
			flag: flag,	
			mat: mat,
			billboardMode: 0,
			nextoff: off + 4
		}
	}

	function mat4FromMat3(mat) {
        dest = mat4.create();
        
        dest[0] = mat[0];
        dest[1] = mat[1];
        dest[2] = mat[2];
        dest[3] = 0;

        dest[4] = mat[3];
        dest[5] = mat[4];
        dest[6] = mat[5];
        dest[7] = 0;

        dest[8] = mat[6];
        dest[9] = mat[7];
        dest[10] = mat[8];
        dest[11] = 0;

        dest[12] = 0;
        dest[13] = 0;
        dest[14] = 0;
        dest[15] = 1;
        
        return dest;
	}

	function readChar(view, offset) {
		return String.fromCharCode(view.getUint8(offset));
	}
}