//
// nsbtx.js
//--------------------
// Reads NSBTX files (or TEX0 sections) and provides canvases containing decoded texture data.
// by RHY3756547
//
// includes: gl-matrix.js (glMatrix 2.0)
// /formats/nitro.js
//

window.nsbtx = function(input, tex0) {
	var texDataSize, texInfoOff, texOffset, compTexSize, compTexInfoOff, 
		compTexOffset, compTexInfoDataOff /*wtf*/, palSize, palInfoOff, 
		palOffset, mainOff

	var textureInfo, paletteInfo, palData, texData, compData, compInfoData, colourBuffer
	var thisObj = this;

	var bitDepths = [0, 8, 2, 4, 8, 2, 8, 16]

	if (input != null) {
		load(input, tex0);
	}
	this.load = load;
	this.readTexWithPal = readTexWithPal;
	this.cache = {}; //textures for btx are cached in this object.

	this.scopeEval = function(code) {return eval(code)} //for debug purposes

	function load(input, tex0) {
		colourBuffer = new Uint32Array(4);
		var view = new DataView(input);
		var header = null;
		var offset = 0;
		if (!tex0) { //nitro 3d header
			header = nitro.readHeader(view);
			if (header.stamp != "BTX0") throw "nsbtx invalid. Expected BTX0, found "+header.stamp;
			if (header.numSections > 1) throw "NSBTX invalid. Too many sections - should only have one.";
			offset = header.sectionOffsets[0];
		}

		mainOff = offset;

		var stamp = readChar(view, offset+0x0)+readChar(view, offset+0x1)+readChar(view, offset+0x2)+readChar(view, offset+0x3);
		if (stamp != "TEX0") throw "NSBTX invalid. Expected TEX0, found "+stamp;
		var size = view.getUint32(offset+0x04, true);
		texDataSize = view.getUint16(offset+0x0C, true)<<3;
		texInfoOff = view.getUint16(offset+0x0E, true);
		texOffset = view.getUint16(offset+0x14, true);

		compTexSize = view.getUint16(offset+0x1C, true)<<3;
		compTexInfoOff = view.getUint16(offset+0x1E, true);
		compTexOffset = view.getUint32(offset+0x24, true);
		compTexInfoDataOff = view.getUint32(offset+0x28, true);

		palSize = view.getUint32(offset+0x30, true)<<3;
		palInfoOff = view.getUint32(offset+0x34, true);
		palOffset = view.getUint32(offset+0x38, true);

		//read palletes, then textures.
		var po = mainOff + palOffset;
		palData = input.slice(po, po+palSize);

		var to = mainOff + texOffset;
		texData = input.slice(to, to+texDataSize);

		var co = mainOff + compTexOffset;
		compData = input.slice(co, co+compTexSize); //pixel information for compression. 2bpp, 16 pixels, so per 4x4 block takes up 4 bytes

		var cio = mainOff + compTexInfoDataOff;
		compInfoData = input.slice(cio, cio+compTexSize/2); //each 4x4 block has a 16bit information uint. 2 bytes per block, thus half the size of above.


		paletteInfo = nitro.read3dInfo(view, mainOff + palInfoOff, palInfoHandler);
		textureInfo = nitro.read3dInfo(view, mainOff + texInfoOff, texInfoHandler);

		thisObj.paletteInfo = paletteInfo;
		thisObj.textureInfo = textureInfo;
	}

	function readTexWithPal(textureId, palId) {
		var tex = textureInfo.objectData[textureId];
		var pal = paletteInfo.objectData[palId];

		var format = tex.format; 
		var trans = tex.pal0trans;

		if (format == 5) return readCompressedTex(tex, pal); //compressed 4x4 texture, different processing entirely

		var off = tex.texOffset;
		var palView = new DataView(palData);
		var texView = new DataView(texData);
		var palOff = pal.palOffset;

		var canvas = document.createElement("canvas");
		canvas.width = tex.width;
		canvas.height = tex.height;
		var ctx = canvas.getContext("2d");
		var img = ctx.getImageData(0, 0, tex.width, tex.height);
		
		var total = tex.width*tex.height;
		var databuf;
		for (var i=0; i<total; i++) {
			var col;
			if (format == 1) { //A3I5 encoding. 3 bits alpha 5 bits pal index
				var dat = texView.getUint8(off++)
				col = readPalColour(palView, palOff, dat&31, trans);
				col[3] = (dat>>5)*(255/7);

			} else if (format == 2) { //2 bit pal
				if (i%4 == 0) databuf = texView.getUint8(off++);
				col = readPalColour(palView, palOff, (databuf>>((i%4)*2))&3, trans)

			} else if (format == 3) { //4 bit pal
				if (i%2 == 0) {
					databuf = texView.getUint8(off++);
					col = readPalColour(palView, palOff, databuf&15, trans)
				} else {
					col = readPalColour(palView, palOff, databuf>>4, trans)
				}

			} else if (format == 4) { //8 bit pal
				col = readPalColour(palView, palOff, texView.getUint8(off++), trans)

			} else if (format == 6) { //A5I3 encoding. 5 bits alpha 3 bits pal index
				var dat = texView.getUint8(off++)
				col = readPalColour(palView, palOff, dat&7, trans);
				col[3] = (dat>>3)*(255/31);

			} else if (format == 7) { //raw color data
				col = texView.getUint16(off, true);
				colourBuffer[0] = Math.round(((col&31)/31)*255)
				colourBuffer[1] = Math.round((((col>>5)&31)/31)*255)
				colourBuffer[2] = Math.round((((col>>10)&31)/31)*255)
				colourBuffer[3] = Math.round((col>>15)*255);
				col = colourBuffer;
				off += 2;

			} else {
				console.log("texture format is none, ignoring")
				return canvas;
			}
			img.data.set(col, i*4);
		}
		ctx.putImageData(img, 0, 0)
		return canvas;
	}

	function readCompressedTex(tex, pal) { //format 5, 4x4 texels. I'll keep this well documented so it's easy to understand.
		var off = tex.texOffset;
		var texView = new DataView(compData); //real texture data - 32 bits per 4x4 block (one byte per 4px horizontal line, each descending 1px)
		var compView = new DataView(compInfoData); //view into compression info - informs of pallete and parameters.
		var palView = new DataView(palData); //view into the texture pallete
		var compOff = off/2; //info is 2 bytes per block, so the offset is half that of the tex offset.
		var palOff = pal.palOffset;
		var transColor = new Uint8Array([0, 0, 0, 0]); //transparent black

		var canvas = document.createElement("canvas");
		canvas.width = tex.width;
		canvas.height = tex.height;
		var ctx = canvas.getContext("2d");
		var img = ctx.getImageData(0, 0, tex.width, tex.height);

		var w = tex.width>>2; //iterate over blocks, block w and h is /4.
		var h = tex.height>>2;

		for (var y=0; y<h; y++) {
			for (var x=0; x<w; x++) {
				//inside block
				var bInfo = compView.getUint16(compOff, true); //block info

				var addr = (bInfo & 0x3fff); //offset to relevant pallete
				var mode = ((bInfo >> 14) & 3); 

				var finalPo = palOff+addr*4;
				var imgoff = x*4+(y*w*16);
				for (var iy=0; iy<4; iy++) {
					var dat = texView.getUint8(off++);
					for (var ix=0; ix<4; ix++) { //iterate over horiz lines
						var part = (dat>>(ix*2))&3;
						var col;

						switch (mode) {
							case 0: //value 3 is transparent, otherwise pal colour
								if (part == 3) col = transColor;
								else col = readPalColour(palView, finalPo, part);
								break;
							case 1: //average mode - colour 2 is average of 1st two, 3 is transparent. 0&1 are normal.
								if (part == 3) col = transColor;
								else if (part == 2) col = readFractionalPal(palView, finalPo, 0.5);
								else col = readPalColour(palView, finalPo, part);
								break;
							case 2: //pal colour
								col = readPalColour(palView, finalPo, part);
								break;
							case 3: //5/8 3/8 mode - colour 2 is 5/8 of col0 plus 3/8 of col1, 3 is 3/8 of col0 plus 5/8 of col1. 0&1 are normal.
								if (part == 3) col = readFractionalPal(palView, finalPo, 3/8);
								else if (part == 2) col = readFractionalPal(palView, finalPo, 5/8);
								else col = readPalColour(palView, finalPo, part);
								break;
						}

						img.data.set(col, (imgoff++)*4)
					}
					imgoff += tex.width-4;
				}
				compOff += 2; //align off to next block
			}
		}

		ctx.putImageData(img, 0, 0)
		return canvas;
	}

	function readPalColour(view, palOff, ind, pal0trans) {
		var col = view.getUint16(palOff+ind*2, true);
		var f = 255/31;
		colourBuffer[0] = Math.round((col&31)*f)
		colourBuffer[1] = Math.round(((col>>5)&31)*f)
		colourBuffer[2] = Math.round(((col>>10)&31)*f)
		colourBuffer[3] = (pal0trans && ind == 0)?0:255;
		return colourBuffer;
	}

	function readFractionalPal(view, palOff, i) {
		var col = view.getUint16(palOff, true);
		var col2 = view.getUint16(palOff+2, true);
		var ni = 1-i;
		var f = 255/31;
		colourBuffer[0] = Math.round((col&31)*f*i + (col2&31)*f*ni)
		colourBuffer[1] = Math.round(((col>>5)&31)*f*i + ((col2>>5)&31)*f*ni)
		colourBuffer[2] = Math.round(((col>>10)&31)*f*i + ((col2>>10)&31)*f*ni)
		colourBuffer[3] = 255;
		return colourBuffer;
	}

	function palInfoHandler(view, offset) {
		var palOffset = view.getUint16(offset, true)<<3;
		var unknown = view.getUint16(offset+2, true);
		return {
			palOffset: palOffset,
			unknown: unknown,
			nextoff: offset+4
		}
	}

	function texInfoHandler(view, offset) {
		var texOffset = view.getUint16(offset, true)<<3;
		var flags = view.getUint16(offset+2, true);
		var width2 = view.getUint8(offset+4, true);
		var unknown = view.getUint8(offset+5, true);
		var height2 = view.getUint8(offset+6, true);
		var unknown2 = view.getUint8(offset+7, true);
		return {
			texOffset: texOffset,
			pal0trans: (flags>>13)&1, //two top flags are texture matrix modes. not sure if it really matters (except for nsbta animation maybe, but 0 = no transform and things that have tex animations are set to 0 anyways).
			format: ((flags>>10)&7),
			height: 8 << ((flags>>7)&7),
			width: 8 << ((flags>>4)&7),
			repeatX: flags&1,
			repeatY: (flags>>1)&1,
			flipX: (flags>>2)&1,
			flipY: (flags>>3)&1,

			unkWidth: width2,
			unk1: unknown,
			unkHeight: height2,
			unk2: unknown2,

			nextoff: offset+8
		}
	}

	function readChar(view, offset) {
		return String.fromCharCode(view.getUint8(offset));
	}
}