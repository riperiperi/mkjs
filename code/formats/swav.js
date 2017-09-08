//
// swav.js
//--------------------
// Reads swav files.
// by RHY3756547
//
// includes: gl-matrix.js (glMatrix 2.0)
//

window.swav = function(input, hasHead, dataView) {
	var t = this;
	this.load = load;
	this.getAudioBuffer = getAudioBuffer;

	function load(input, hasHead, dataView) {
		var view = (dataView)?input:(new DataView(input));
		var header = null;
		var offset = 0;

		if (hasHead) {
			var stamp = readChar(view, 0x0)+readChar(view, 0x1)+readChar(view, 0x2)+readChar(view, 0x3);
			if (stamp != "SWAV") throw "SWAV invalid. Expected SWAV, found "+stamp;
			offset += 16;
			var data = readChar(view, offset)+readChar(view, offset+1)+readChar(view, offset+2)+readChar(view, offset+3);
			if (data != "DATA") throw "SWAV invalid, expected DATA, found "+data;
			offset += 8;
		}

		t.waveType = view.getUint8(offset);
		t.bLoop = view.getUint8(offset+1);
		t.nSampleRate = view.getUint16(offset+2, true);
		if (t.nSampleRate < 3000) throw "BAD SAMPLE RATE! "+t.nSampleRate;
		t.nTime = view.getUint16(offset+4, true);
		t.nLoopOff = view.getUint16(offset+6, true);
		t.nNonLoopLen = view.getUint32(offset+8, true);
		t.bytesize = (t.nLoopOff+t.nNonLoopLen)*4;
		t.mul = 1;

		offset += 12;
		var data;
		switch (t.waveType) {
			case 0:
				var size = t.bytesize;
				data = new Float32Array(size);
				for (var i=0; i<size; i++) {
					data[i] = view.getInt8(offset++)/0x7F;
				}
				t.loopSTime = (t.nLoopOff*4)/t.nSampleRate;
			break;
			case 1:
				var size = t.bytesize/2;
				data = new Float32Array(size);
				for (var i=0; i<size; i++) {
					data[i] = view.getInt16(offset, true)/0x7FFF;
					offset += 2;
				}
				t.loopSTime = (t.nLoopOff*2)/t.nSampleRate;
			break;
			case 2:
				data = decodeADPCM(view, offset);
				t.loopSTime = ((t.nLoopOff-1)*8)/t.nSampleRate;
			break;
		}
		t.data = data;
	}

	function getAudioBuffer(ctx) {
		while (true) {
			try {
				var buf = ctx.createBuffer(1, t.data.length, t.nSampleRate);
				buf.getChannelData(0).set(t.data);
				return buf;
			} catch (e) {
				t.nSampleRate *= 2; //keep increasing sample rate until the target supports it.
				t.loopSTime /= 2;
				t.mul *= 2;
			}
			if (t.nSampleRate > 96000) return ctx.createBuffer(1, 1, 44000); //give up and return an empty buffer
		}
	}

	var indChanges = [-1, -1, -1, -1, 2, 4, 6, 8];
	var ADPCMTable = [ 
		0x0007,0x0008,0x0009,0x000A,0x000B,0x000C,0x000D,0x000E,0x0010,0x0011,0x0013,0x0015,
		0x0017,0x0019,0x001C,0x001F,0x0022,0x0025,0x0029,0x002D,0x0032,0x0037,0x003C,0x0042,
		0x0049,0x0050,0x0058,0x0061,0x006B,0x0076,0x0082,0x008F,0x009D,0x00AD,0x00BE,0x00D1,
		0x00E6,0x00FD,0x0117,0x0133,0x0151,0x0173,0x0198,0x01C1,0x01EE,0x0220,0x0256,0x0292,
		0x02D4,0x031C,0x036C,0x03C3,0x0424,0x048E,0x0502,0x0583,0x0610,0x06AB,0x0756,0x0812,
		0x08E0,0x09C3,0x0ABD,0x0BD0,0x0CFF,0x0E4C,0x0FBA,0x114C,0x1307,0x14EE,0x1706,0x1954,
		0x1BDC,0x1EA5,0x21B6,0x2515,0x28CA,0x2CDF,0x315B,0x364B,0x3BB9,0x41B2,0x4844,0x4F7E,
		0x5771,0x602F,0x69CE,0x7462,0x7FFF
	]; //thanks no$gba docs

	function decodeADPCM(view, off) {
		var pcm = view.getUint16(off, true); //initial pcm
		var ind = view.getUint8(off+2); //initial index
		off += 4;

		var size = t.bytesize-4;
		var out = new Float32Array((size*2));
		var write = 0;
		//out[write++] = pcm/0x7FFF;

		for (var i=0; i<size; i++) {
			var b = view.getUint8(off++);
			for (var j=0; j<2; j++) {
				var nibble = (b>>(j*4))&15;

				var diff = Math.floor(((nibble&7)*2+1)*ADPCMTable[ind]/8);
				if (nibble&8) pcm = Math.max(pcm-diff, -0x7FFF);
				else pcm = Math.min(pcm+diff, 0x7FFF);
				out[write++] = pcm/0x7FFF;

				ind = Math.min(88, Math.max(0, ind + indChanges[nibble&7]));
			}
		}
		return out;
	}


	function readChar(view, offset) {
		return String.fromCharCode(view.getUint8(offset));
	}

	if (input != null) {
		load(input, hasHead, dataView);
	}
}