//
// ndsFS.js
//--------------------
// Reads nds roms using nitroFS and provides access to files by directory structure.
// by RHY3756547
//

window.ndsFS = function(input) {
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
		arc.view = view;
		arc.sections = {};

		arc.nameOff = view.getUint32(0x40, true);
		arc.fileOff = view.getUint32(0x48, true)

		arc.sections["BTNF"] = {};
		handlers["BTNF"](view, arc.nameOff, arc.sections["BTNF"]) //file name table

		/*arc.sections["BTAF"] = {};
		handlers["BTAF"](view, , arc.sections["BTAF"]) //file alloc table */
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
		var off = arc.fileOff+id*8;
		/*var table = arc.sections["BTAF"].files;
		var file = table[id];
		if (file == null) {
			console.error("File ID invalid: "+id);
			return null;
		}*/
		return arc.buffer.slice(arc.view.getUint32(off, true), arc.view.getUint32(off+4, true));
	}

	var handlers = {};
	handlers["BTAF"] = function(view, off, obj) {
		obj.files = [];
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