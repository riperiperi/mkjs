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
	var t = this;
	this.info = {};

	if (input != null) {
		load(input);
	}
	this.load = load;
	this.drawToCanvas = drawToCanvas;
	this.measureText = measureText;
	this.measureMapped = measureMapped;
	this.mapText = mapText;

	function load(input) {
		var view = new DataView(input);
		var header = null;
		var offset = 0;
		var tex;

		//nitro 3d header
			header = nitro.readHeader(view);
			//debugger;
			if (header.stamp != "RTFN") throw "NFTR invalid. Expected RTFN, found "+header.stamp;
			offset = 0x10; //nitro header for nftr doesn't have section offsets - they are in order
		//end nitro
		
		var info = t.info;
		info.type = readChar(view, offset+0x0)+readChar(view, offset+0x1)+readChar(view, offset+0x2)+readChar(view, offset+0x3);
		info.blockSize = view.getUint32(offset+0x4, true);

		info.unknown1 = view.getUint8(offset+0x8);
		info.height = view.getUint8(offset+0x9);
		info.nullCharIndex = view.getUint16(offset+0xA, true);
		info.unknown2 = view.getUint8(offset+0xC);
		info.width = view.getUint8(offset+0xD);
		info.widthBis = view.getUint8(offset+0xE);
		info.encoding = view.getUint8(offset+0xF);

		info.offsetCGLP = view.getUint32(offset+0x10, true); //character graphics
		info.offsetCWDH = view.getUint32(offset+0x14, true); //character width
		info.offsetCMAP = view.getUint32(offset+0x18, true); //character map

		if (info.blockSize == 0x20) {
			//extra info
			info.fontHeight = view.getUint8(offset+0x1C);
			info.fontWidth = view.getUint8(offset+0x1D);
			info.bearingX = view.getUint8(offset+0x1E);
			info.bearingY = view.getUint8(offset+0x1F);
		}

		loadCGLP(view);
		loadCWDH(view);
		loadCMAP(view);

		mainOff = offset;
	}

	function loadCGLP(view) {
		var offset = t.info.offsetCGLP - 8;

		var cglp = {};
		cglp.type = readChar(view, offset+0x0)+readChar(view, offset+0x1)+readChar(view, offset+0x2)+readChar(view, offset+0x3);
		cglp.blockSize = view.getUint32(offset+0x4, true);
		cglp.tileWidth = view.getUint8(offset+0x8);
		cglp.tileHeight = view.getUint8(offset+0x9);
		cglp.tileLength = view.getUint16(offset+0xA, true);
		cglp.unknown = view.getUint16(offset+0xC, true);
		cglp.depth = view.getUint8(offset+0xE);
		cglp.rotateMode = view.getUint8(offset+0xF);

		offset += 0x10;
		cglp.tiles = [];
		var total = (cglp.blockSize - 0x10) / cglp.tileLength;
		for (var i=0; i<total; i++) {
			cglp.tiles.push(new Uint8Array(view.buffer.slice(offset, offset+cglp.tileLength)));
			offset += cglp.tileLength;
		}
		t.cglp = cglp;
	}

	function loadCWDH(view) {
		var offset = t.info.offsetCWDH - 8;

		var cwdh = {};
		cwdh.type = readChar(view, offset+0x0)+readChar(view, offset+0x1)+readChar(view, offset+0x2)+readChar(view, offset+0x3);
		cwdh.blockSize = view.getUint32(offset+0x4, true);
		cwdh.firstCode = view.getUint16(offset+0x8, true);
		cwdh.lastCode = view.getUint16(offset+0xA, true);

		cwdh.unknown = view.getUint32(offset+0xC, true);

		cwdh.info = [];
		offset += 0x10;
		for (var i=0; i<t.cglp.tiles.length; i++) {
			var info = {};
			info.pixelStart = view.getInt8(offset);
			info.pixelWidth = view.getUint8(offset+1);
			info.pixelLength = view.getUint8(offset+2);
			cwdh.info.push(info);
			offset += 3;
		}

		t.cwdh = cwdh;
	}

	function loadCMAP(view) {
		var offset = t.info.offsetCMAP - 8;
		var cmaps = [];
		var charMap = {};
		while (offset > 0 && offset < view.byteLength) {
			var cmap = {};
			cmap.type = readChar(view, offset+0x0)+readChar(view, offset+0x1)+readChar(view, offset+0x2)+readChar(view, offset+0x3);
			cmap.blockSize = view.getUint32(offset+0x4, true);
			cmap.firstChar = view.getUint16(offset+0x8, true);
			cmap.lastChar = view.getUint16(offset+0xA, true);

			cmap.typeSection = view.getUint32(offset+0xC, true);
			cmap.nextOffset = view.getUint32(offset+0x10, true);

			offset += 0x14;
			switch (cmap.typeSection & 0xFFFF) {
				case 1: //char code list (first to last)
					cmap.charCodes = [];
					var total = (cmap.lastChar - cmap.firstChar) + 1;
					var charCode = cmap.firstChar;
					for (var i=0; i<total; i++) {
						var char = view.getUint16(offset, true);
						cmap.charCodes.push(char);
						if (char != 65535) {
							charMap[String.fromCharCode(charCode)] = char;
						}
						charCode++;
						offset += 2;
					}
					break;
				case 2: //char code map
					cmap.numChars = view.getUint16(offset, true);
					offset += 2;
					cmap.charMap = [];
					for (var i=0; i<cmap.numChars; i++) {
						var charCode = view.getUint16(offset, true);
						var char = view.getUint16(offset+2, true);
						cmap.charMap.push([charCode, char]);
						charMap[String.fromCharCode(charCode)] = char;
						offset += 4;
					}
					break;
				default: 
					cmap.firstCharCode = view.getUint16(offset, true);
					var total = (cmap.lastChar - cmap.firstChar) + 1;
					var charCode = cmap.firstChar;
					var char = cmap.firstCharCode;

					for (var i=0; i<total; i++) {
						charMap[String.fromCharCode(charCode++)] = char++;
					}
					break;

			}
			cmaps.push(cmap);
			offset = cmap.nextOffset - 8;
		}

		t.charMap = charMap;
		t.cmaps = cmaps;
	}

	function readChar(view, offset) {
		return String.fromCharCode(view.getUint8(offset));
	}

	// RENDERING FUNCTIONS

	function mapText(text, missing) {
		if (missing == null) missing = "*";
		var map = t.charMap;
		var result = [];
		for (var i=0; i<text.length; i++) {
			var code = text[i];
			var mapped = map[code];
			if (mapped == null) mapped = map[missing];
			result.push(mapped);
		}
		return result;
	}

	function measureText(text, missing, spacing) {
		return measureMapped(mapText(text, missing), spacing);
	}

	function measureMapped(mapped, spacing) {
		if (spacing == null) spacing = 1;
		var width = 0;
		var widths = t.cwdh.info;

		for (var i=0; i<mapped.length; i++) {
			width += widths[mapped[i]].pixelLength + spacing; // pixelWidth is the width of drawn section - length is how wide the char is
		}

		return [width, t.info.height];
	}

	function drawToCanvas(text, palette, spacing) {
		if (spacing == null) spacing = 1;
		var mapped = mapText(text, "");
		var size = measureMapped(mapped, spacing);

		var canvas = document.createElement("canvas");
		canvas.width = size[0];
		canvas.height = size[1];
		var ctx = canvas.getContext("2d");

		//draw chars
		var widths = t.cwdh.info;
		var position = 0;

		for (var i=0; i<mapped.length; i++) {
			var c = mapped[i];
			var cinfo = widths[c];

			var data = getCharData(c, palette);
			ctx.putImageData(data, position + cinfo.pixelStart, 0, 0, 0, cinfo.pixelWidth, data.height);

			position += cinfo.pixelLength + spacing;
		}
		return canvas;
	}

	function getCharData(id, pal) {
		//todo: cache?
		var cglp = t.cglp;
		var tile = cglp.tiles[id];
		var pixels = cglp.tileWidth*cglp.tileHeight;
		var d = new Uint8ClampedArray(pixels*4);
		var data = new ImageData(d, cglp.tileWidth, cglp.tileHeight);
		var depth = t.cglp.depth;
		var mask = (1<<depth)-1;

		var bit = 8;
		var byte = 0;
		var curByte = tile[byte];
		var ind = 0;
		for (var i=0; i<pixels; i++) {
			bit -= depth;
			var pind = 0;
			if (bit < 0) {
				//overlap into next
				var end = bit + 8;
				if (end < 8) {
					//still some left in this byte
					pind = (curByte << (-bit)) & mask;
				}
				curByte = tile[++byte];
				bit += 8;
				pind |= (curByte >> (bit)) & mask;
			} else {
				pind = (curByte >> (bit)) & mask;
			}

			var col = pal[pind];
			d[ind++] = col[0];
			d[ind++] = col[1];
			d[ind++] = col[2];
			d[ind++] = col[3];
		}
		return data;
	}

}