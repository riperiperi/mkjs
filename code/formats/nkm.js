//
// nkm.js
//--------------------
// Loads nkm files and provides a variety of functions for accessing and using the data.
// 
// nkm files usually drive the game logic of tracks (checkpoints, ai waypoints, objects on track) so it's pretty
// crucial to have this up and running.
//
// by RHY3756547
//
// includes: gl-matrix.js (glMatrix 2.0)
//

window.nkm = function(input, mkwii) {
	//todo, support versions for other games (MKWii etc)

	this.load = load;
	var thisObj = this;
	var handlers = [];

	window.onmousemove = function(evt) {
		mouseX = evt.pageX;
		mouseY = evt.pageY;
	}

	this.scopeEval = function(code) {return eval(code)} //for debug purposes

	function load(buffer, mkwii) {
		var view = new DataView(buffer);
		thisObj.stamp = readChar(view, 0x0)+readChar(view, 0x1)+readChar(view, 0x2)+readChar(view, 0x3);
		thisObj.version = view.getUint16(0x4, true);
		var n = view.getUint16(0x6, true);
		var off = 8;
		var sections = {};

		for (var i=0; i<(n-8)/4; i++) {
			var soff = view.getUint32(off, true);
			var section = readSection(view, soff+n)
			sections[section.type] = section;

			off += 4;
		}
		thisObj.sections = sections;
	}

	function readSection(view, off) {
		var obj = {};
		obj.type = readChar(view, off+0x0)+readChar(view, off+0x1)+readChar(view, off+0x2)+readChar(view, off+0x3);

		if (obj.type == "STAG") {
			handlers["STAG"](view, off, obj);
		} else {
			var handler = handlers[obj.type];
			if (handler == null) {
				console.error("Unknown NKM section type "+obj.type+"!");
				return obj;
			}
			var entN = view.getUint32(off+0x4, true);
			off += 0x8;
			var entries = [];
			for (var i=0; i<entN; i++) {
				var item = handler(view, off);
				entries.push(item);
				off = item.nextOff;
			}
			obj.entries = entries;
		}
		return obj;
	}

	handlers["OBJI"] = function(view, off) {
		var obj = {};
		obj.pos = vec3.create();
		obj.pos[0] = view.getInt32(off, true)/4096;
		obj.pos[1] = view.getInt32(off+4, true)/4096;
		obj.pos[2] = view.getInt32(off+8, true)/4096;

		obj.angle = [];
		obj.angle[0] = view.getInt32(off+0xC, true)/4096;
		obj.angle[1] = view.getInt32(off+0x10, true)/4096;
		obj.angle[2] = view.getInt32(off+0x14, true)/4096;

		obj.scale = vec3.create();
		obj.scale[0] = view.getInt32(off+0x18, true)/4096;
		obj.scale[1] = view.getInt32(off+0x1C, true)/4096;
		obj.scale[2] = view.getInt32(off+0x20, true)/4096;

		obj.ID = view.getUint16(off+0x24, true);
		obj.routeID = view.getUint16(off+0x26, true);

		obj.setting1 = view.getUint32(off+0x28, true);
		obj.setting2 = view.getUint32(off+0x2C, true);
		obj.setting3 = view.getUint32(off+0x30, true);
		obj.setting4 = view.getUint32(off+0x34, true);

		obj.timeTrials = view.getUint32(off+0x38, true);

		obj.nextOff = off+0x3C; 
		return obj;
	}

	handlers["PATH"] = function(view, off) {
		var obj = {};
		obj.routeID = view.getUint8(off);
		obj.loop = view.getUint8(off+1);
		obj.numPts = view.getUint16(off+2, true);
		obj.nextOff = off+0x4; 
		return obj;
	}

	handlers["POIT"] = function(view, off) {
		var obj = {};

		obj.pos = vec3.create();
		obj.pos[0] = view.getInt32(off, true)/4096;
		obj.pos[1] = view.getInt32(off+4, true)/4096;
		obj.pos[2] = view.getInt32(off+8, true)/4096;

		obj.pointInd = view.getUint16(off+0xC, true);
		obj.duration = view.getUint16(off+0xE, true);
		obj.unknown = view.getUint32(off+0x10, true);

		obj.nextOff = off+0x14; 
		return obj;
	}

	handlers["STAG"] = function(view, off, obj) {
		obj.courseID = view.getUint16(off+0x4, true);
		obj.laps = view.getUint16(off+0x6, true); //doubles as battle mode duration
		obj.unknown = view.getUint8(off+0x8);
		obj.fogEnable = view.getUint8(off+0x9);
		obj.fogMode = view.getUint8(off+0xA);
		obj.fogSlope = view.getUint8(off+0xB);

		//skip 8 bytes of unknown, probably more fog stuff. (disabled for now)

		obj.fogDist = view.getInt32(off+0x14, true)/4096;
		obj.fogCol = readRGB(view, off+0x18);
		obj.fogAlpha = view.getUint16(off+0x1A, true);

		obj.kclCol = [readRGB(view, off+0x1C), readRGB(view, off+0x1E), readRGB(view, off+0x20), readRGB(view, off+0x22)];

		//unknown 8 bytes again

		return obj;
	}

	handlers["KTPS"] = function(view, off) { //start positions
		var obj = {};
		obj.pos = vec3.create();
		obj.pos[0] = view.getInt32(off, true)/4096;
		obj.pos[1] = view.getInt32(off+4, true)/4096;
		obj.pos[2] = view.getInt32(off+8, true)/4096;

		obj.angle = [];
		obj.angle[0] = view.getInt32(off+0xC, true)/4096;
		obj.angle[1] = view.getInt32(off+0x10, true)/4096;
		obj.angle[2] = view.getInt32(off+0x14, true)/4096;

		obj.id1 = view.getInt16(off+0x18, true);
		obj.id2 = view.getInt16(off+0x1A, true);
		obj.nextOff = off+0x1C;

		return obj;
	}

	handlers["KTP2"] = handlers["KTPS"]; //must pass this point for lap to count. ids irrelevant
	handlers["KTPJ"] = function(view, off){
		var obj = handlers["KTPS"](view, off);
		obj.respawnID = view.getInt32(off+0x1C, true);
		obj.nextOff += 0x4;
		return obj;
	}; //respawn points. id1 is cpu route, id2 is item route
	handlers["KTPC"] = handlers["KTPS"]; //cannon positions. id1 is cpu route, id2 is cannon id 
	handlers["KTPM"] = handlers["KTPS"]; //mission kart position. must pass for mission to succeed.

	handlers["CPOI"] = function(view, off) {
		var obj = {};
		obj.x1 = view.getInt32(off, true)/4096;
		obj.z1 = view.getInt32(off+0x4, true)/4096;
		obj.x2 = view.getInt32(off+0x8, true)/4096;
		obj.z2 = view.getInt32(off+0xC, true)/4096;
		obj.sinus = view.getInt32(off+0x10, true)/4096;
		obj.cosinus = view.getInt32(off+0x14, true)/4096;
		obj.distance = view.getInt32(off+0x18, true)/4096;

		obj.nextSection = view.getInt16(off+0x1C, true);
		obj.currentSection = view.getInt16(off+0x1E, true);

		obj.keyPoint = view.getInt16(off+0x20, true);
		obj.respawn = view.getUint8(off+0x22);
		obj.unknown = view.getUint8(off+0x23);

		obj.nextOff = off+0x24;

		return obj;
	}

	handlers["CPAT"] = function(view, off) { //checkpoint path
		var obj = {};
		obj.startInd = view.getInt16(off, true);
		obj.pathLen = view.getInt16(off+0x2, true);

		obj.dest = [view.getInt8(off+0x4)];
		var tmp = view.getInt8(off+0x5)
		if (tmp != -1) obj.dest.push(tmp);

		var tmp2 = view.getInt8(off+0x6)
		if (tmp2 != -1) obj.dest.push(tmp2);

		obj.source = [view.getInt8(off+0x7)];

		var tmp3 = view.getInt8(off+0x8)
		if (tmp3 != -1) obj.source.push(tmp3);

		var tmp4 = view.getInt8(off+0x9)
		if (tmp4 != -1) obj.source.push(tmp4);

		obj.sectionOrder = view.getInt16(off+0xA, true);

		obj.nextOff = off+0xC;
		return obj;
	}

	handlers["MEPA"] = function(view, off) { //checkpoint path
		var obj = {};
		obj.startInd = view.getInt16(off, true);
		obj.pathLen = view.getInt16(off+0x2, true);

		obj.dest = [];
		var o = off+4;
		for(var i=0; i<8; i++) {
			var tmp = view.getInt8(o++);
			if (tmp != -1) obj.dest.push(tmp);
		}

		obj.source = [];
		for(var i=0; i<8; i++) {
			var tmp = view.getInt8(o++);
			if (tmp != -1) obj.source.push(tmp);
		}

		obj.nextOff = o;
		return obj;
	}

	handlers["IPAT"] = handlers["CPAT"]; //item path
	handlers["EPAT"] = handlers["CPAT"]; //enemy path

	handlers["IPOI"] = function(view, off) {
		var obj = {};
		obj.pos = vec3.create();
		obj.pos[0] = view.getInt32(off, true)/4096;
		obj.pos[1] = view.getInt32(off+4, true)/4096;
		obj.pos[2] = view.getInt32(off+8, true)/4096;
		obj.unknown1 = view.getUint8(off+0xC); //tends to be 0 or FF
		obj.unknown2 = view.getUint8(off+0xD);
		obj.unknown3 = view.getUint8(off+0xE);
		obj.unknown4 = view.getUint8(off+0xF);
		obj.unknown5 = view.getUint32(off+0x10, true); //tends to be 0

		obj.nextOff = off+0x14;
		return obj;
	}

	handlers["EPOI"] = function(view, off) {
		var obj = {};
		obj.pos = vec3.create();
		obj.pos[0] = view.getInt32(off, true)/4096;
		obj.pos[1] = view.getInt32(off+4, true)/4096;
		obj.pos[2] = view.getInt32(off+8, true)/4096;

		obj.pointSize = view.getInt32(off+0xC, true)/4096;
		obj.cpuDrift = view.getUint16(off+0x10, true); //will find out what this means in due time, a watcher on this value while a cpu is going around the track should clear things up.
		obj.unknown1 = view.getUint16(off+0x12, true); //tends to be 0
		obj.unknown2 = view.getUint32(off+0x14, true); //tends to be 0

		obj.nextOff = off+0x18;
		return obj;
	}

	handlers["MEPO"] = function(view, off) { //theres usually 5 of these LOL!!! im not sorry
		var obj = {};
		obj.pos = vec3.create();
		obj.pos[0] = view.getInt32(off, true)/4096;
		obj.pos[1] = view.getInt32(off+4, true)/4096;
		obj.pos[2] = view.getInt32(off+8, true)/4096;

		obj.pointSize = view.getInt32(off+0xC, true)/4096;
		obj.cpuDrift = view.getUint16(off+0x10, true); //will find out what this means in due time, a watcher on this value while a cpu is going around the track should clear things up.
		obj.unknown1 = view.getUint16(off+0x12, true); //tends to be 0
		obj.unknown1 = view.getUint32(off+0x14, true); //tends to be 0

		obj.nextOff = off+0x18;
		return obj;
	}

	handlers["AREA"] = function(view, off) { //area for cameras. this section is ridiculous - will need thorough investigation if we want to get race spectate cameras working.
		var obj = {};
		obj.pos = vec3.create();
		obj.pos[0] = view.getInt32(off, true)/4096;
		obj.pos[1] = view.getInt32(off+4, true)/4096;
		obj.pos[2] = view.getInt32(off+8, true)/4096;

		obj.dimensions = vec3.create();
		obj.dimensions[0] = view.getInt32(off+0xC, true)/4096;
		obj.dimensions[1] = view.getInt32(off+0x10, true)/4096;
		obj.dimensions[2] = view.getInt32(off+0x14, true)/4096;

		//44 bytes of unknown, ouch!

		obj.came = view.getUint8(off+0x43);
		
		obj.one = view.getUint32(off+0x44, true); //good ole one

		obj.nextOff = off+0x48;
		return obj;
	}

	handlers["CAME"] = function(view, off) { //cameras. not really much known about these right now.
		var obj = {};
		obj.pos1 = vec3.create();
		obj.pos1[0] = view.getInt32(off, true)/4096;
		obj.pos1[1] = view.getInt32(off+4, true)/4096;
		obj.pos1[2] = view.getInt32(off+8, true)/4096;

		obj.angle = vec3.create();
		obj.angle[0] = view.getInt32(off+0xC, true)/4096;
		obj.angle[1] = view.getInt32(off+0x10, true)/4096;
		obj.angle[2] = view.getInt32(off+0x14, true)/4096;

		obj.pos2 = vec3.create();
		obj.pos2[0] = view.getInt32(off+0x18, true)/4096;
		obj.pos2[1] = view.getInt32(off+0x1C, true)/4096;
		obj.pos2[2] = view.getInt32(off+0x20, true)/4096;

		obj.pos3 = vec3.create();
		obj.pos3[0] = view.getInt32(off+0x24, true)/4096;
		obj.pos3[1] = view.getInt32(off+0x28, true)/4096;
		obj.pos3[2] = view.getInt32(off+0x2C, true)/4096;

		//44 bytes of unknown, ouch!

		obj.zoomSpeedM1 = view.getInt16(off+0x30, true)/4096;

		obj.zoomStart = view.getInt16(off+0x32, true)/4096; //alters zoom somehow
		obj.zoomEnd = view.getInt16(off+0x34, true)/4096;

		obj.zoomSpeedM2 = view.getInt16(off+0x36, true)/4096;
		obj.zoomMark1 = view.getInt16(off+0x38, true)/4096; //zoom speed changes at zoom marks
		obj.zoomMark2 = view.getInt16(off+0x3A, true)/4096;

		obj.zoomSpeed = view.getInt16(off+0x3C, true)/4096;
		obj.camType = view.getInt16(off+0x3E, true);
		obj.camRoute = view.getInt16(off+0x40, true);
		obj.routeSpeed = view.getInt16(off+0x42, true);
		obj.pointSpeed = view.getInt16(off+0x44, true);
		obj.duration = view.getInt16(off+0x46, true);
		obj.nextCam = view.getInt16(off+0x48, true);

		obj.firstCam = view.getUint8(off+0x4A);
		obj.one = view.getUint8(off+0x4B); //tends to be 1 if cam type is 5

		obj.nextOff = off+0x4C;
		return obj;
	}


	function readRGB(view, offset) {
		var dat = view.getUint16(offset, true);
		var col = [dat&31, (dat>>5)&31, (dat>>10)&31];
		return col;
	}

	function readChar(view, offset) {
		return String.fromCharCode(view.getUint8(offset));
	}

	if (input != null) {
		if (typeof input == "string") {
			var xml = new XMLHttpRequest();
			xml.responseType = "arraybuffer";
			xml.open("GET", input, true);
			xml.onload = function() {
				load(xml.response);
			}
			xml.send();
		} else {
			load(input, mkwii);
		}
	}

}