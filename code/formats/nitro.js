//
// nitro.js
//--------------------
// General purpose functions for nitro formats, eg. NSBTX or NSBMD
// by RHY3756547
//
// includes: gl-matrix.js (glMatrix 2.0)
//

window.nitro = new function() {
	this.readHeader = function(view) { //input: DataView with base offset at header position
		var stamp = readChar(view, 0x0)+readChar(view, 0x1)+readChar(view, 0x2)+readChar(view, 0x3);
		var unknown1 = view.getUint32(0x4, true);
		var filesize = view.getUint32(0x8, true);
		var headsize = view.getUint16(0xC, true);
		var numSections = view.getUint16(0xE, true);
		var sectionOffsets = [];
		for (var i=0; i<numSections; i++) {
			sectionOffsets.push(view.getUint32(0x10+i*4, true));
		}
		return {
			stamp: stamp,
			unknown1: unknown1,
			filesize: filesize,
			headsize: headsize,
			numSections: numSections,
			sectionOffsets: sectionOffsets
		}
	}

	this.read3dInfo = function(view, offset, dataHandler) {
		var baseOff = offset;
		offset += 1; //skip dummy
		var numObjects = view.getUint8(offset++);
		var secSize = view.getUint16(offset, true);
		offset += 2;
		//unknown block. documentation out of 10
		var uhdSize = view.getUint16(offset, true);
		offset += 2;
		var usecSize = view.getUint16(offset, true);
		offset += 2;
		var unknown = view.getUint32(offset, true); //usually 0x0000017F
		offset += 4;
		var objectUnk = []
		for (var i=0; i<numObjects; i++) {
			var uk1 = view.getUint16(offset, true);
			var uk2 = view.getUint16(offset+2, true);
			objectUnk.push({uk1: uk1, uk2: uk2});
			offset += 4;
		}
		//info block
		var ihdSize = view.getUint16(offset, true);
		offset += 2;
		var isecSize = view.getUint16(offset, true);
		offset += 2;
		var objectData = []
		for (var i=0; i<numObjects; i++) {
			var data = dataHandler(view, offset, baseOff, i); //must return object with "nextoff" as offset after reading data
			objectData.push(data)
			offset = data.nextoff;
		}

		var names = []
		for (var i=0; i<numObjects; i++) {
			var name = "";
			for (var j=0; j<16; j++) {
				name += readChar(view, offset++)
			}
			names.push(name);
		}

		return {
			numObjects: numObjects,
			unknown: unknown,
			objectUnk: objectUnk,
			objectData: objectData,
			names: names,
			nextoff: offset
		}
	}

	function readChar(view, offset) {
		return String.fromCharCode(view.getUint8(offset));
	}
}