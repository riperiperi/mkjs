//
// narc.js
//--------------------
// Reads narc archives and provides access to files by directory structure.
// by RHY3756547
//

window.narc = function(input) {

	this.load = load;
	this.getFile = getFile;

	var arc = this;
	var handlers = [];

	window.onmousemove = function(evt) {
		mouseX = evt.pageX;
		mouseY = evt.pageY;
	}

	this.scopeEval = function(code) {return eval(code)} //for debug purposes

	function load(buffer) {
		arc.buffer = buffer; //we will use this data in the future.

		var view = new DataView(buffer);
		arc.stamp = readChar(view, 0x0)+readChar(view, 0x1)+readChar(view, 0x2)+readChar(view, 0x3);
		if (arc.stamp != "NARC") throw "File provided is not a NARC archive! Expected NARC, found "+arc.stamp+".";

		arc.byteOrder = view.getUint16(0x4, true); //todo: check byte order and flip to little endian when necessary
		arc.version = view.getUint16(0x6, true); 
		arc.size = view.getUint32(0x8, true); 
		arc.headSize = view.getUint16(0xC, true);
		arc.numBlocks = view.getUint16(0xE, true);
			
		var off = arc.headSize;

		arc.sections = {};
		for (var i=0; i<arc.numBlocks; i++) {
			var section = readSection(view, off);
			arc.sections[section.type] = section;
			off = 4*Math.ceil(section.nextOff/4);
		}
	}

	function readSection(view, off) {
		var obj = {};
		obj.type = readChar(view, off+0x0)+readChar(view, off+0x1)+readChar(view, off+0x2)+readChar(view, off+0x3);
		obj.size = view.getUint32(off+0x4, true); 

		if (handlers[obj.type] == null) throw "Unknown NARC section "+obj.type+"!";
		handlers[obj.type](view, off+0x8, obj);

		obj.nextOff = off+obj.size;
		return obj;
	}

	function getFile(name) {
		var path = name.split("/");
		var start = (path[0] == "")?1:0; //fix dirs relative to root (eg "/hi/test.bin")

		var table = arc.sections["BTNF"].directories;
		var curDir = table[0].entries; //root
		for (var i=start; i<path.length; i++) {
			var found = false;
			for (var j=0; j<curDir.length; j++) {
				if (curDir[j].name == path[i]) {
					if (curDir[j].dir) {
						found = true;
						curDir = table[curDir[j].id-0xF000].entries;
						break;
					} else {
						return readFileWithID(curDir[j].id);
					}
					
				}
			}
			if (!found) {
				console.error("File not found: "+name+", could not find "+path[i]);
				return null;
			}
		}
		console.error("Path is not a file: "+name);
		return null; //incomplete path; we ended on a directory, not a file!
	}

	function readFileWithID(id) {
		var table = arc.sections["BTAF"].files;
		var file = table[id];
		var off = arc.sections["GMIF"].baseOff;
		if (file == null) {
			console.error("File ID invalid: "+id);
			return null;
		}
		return arc.buffer.slice(file.start+off, file.end+off);
	}

	var handlers = {};
	handlers["BTAF"] = function(view, off, obj) {
		obj.numFiles = view.getUint16(off, true); 
		obj.reserved = view.getUint16(off+0x2, true); 
		obj.files = [];
		off += 4;
		for (var i=0; i<obj.numFiles; i++) {
			var fl = {}
			fl.start = view.getUint32(off, true); 
			fl.end = view.getUint32(off+4, true); 
			obj.files.push(fl);
			off += 8;
		}
	}

	handlers["BTNF"] = function(view, off, obj) { //filename table - includes directories and filenames.
		var soff = off;
		obj.directories = [];
		//read root dir, then we know number of directories to read.
		var root = {};
		var dirOff = soff+view.getUint32(off, true); 
		root.firstFile = view.getUint16(off+4, true); 
		populateDir(view, dirOff, root);
		root.numDir = view.getUint16(off+6, true); 

		off += 8;
		obj.directories.push(root);

		var n = root.numDir-1;
		for (var i=0; i<n; i++) {
			var dir = {};
			var dirOff = soff+view.getUint32(off, true); 
			dir.firstFile = view.getUint16(off+4, true); 
			populateDir(view, dirOff, dir);
			dir.parent = view.getUint16(off+6, true); 

			off += 8;
			obj.directories.push(dir);
		}
	}

	handlers["GMIF"] = function(view, off, obj) {
		obj.baseOff = off;
	}

	function populateDir(view, off, dir) {
		curFile = dir.firstFile;
		dir.entries = [];
		while (true) {
			var flag = view.getUint8(off++);
			var len = flag&127;
			if (!	(flag&128)) { //file or end of dir
				if (len == 0) return;
				else {
					dir.entries.push({
						dir: false,
						id: curFile++,
						name: readString(view, off, len)
					})
					off += len;
				}
			} else {
				var dirID = view.getUint16(off+len, true);
				dir.entries.push({
						dir: true,
						id: dirID,
						name: readString(view, off, len)
				});
				off += len+2;
			}
		}
	}

	function readString(view, off, length) {
		var str = "";
		for (var i=0; i<length; i++) {
			str += readChar(view, off++);
		}
		return str;
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
			load(input);
		}
	}
}
