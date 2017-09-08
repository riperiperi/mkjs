//
// lz77.js
//--------------------
// Reads and decompresses lz77 (mode 0x10 only) files. In future may be able to recompress.
// by RHY3756547
//

window.lz77 = new (function() {
	this.decompress = function(buffer) {
		var view = new DataView(buffer);
		var compType = view.getUint8(0);
		var size = view.getUint32(0, true)>>8;		

		var targ = new ArrayBuffer(size);
		var targA = new Uint8Array(targ);

		var off = 4;
		var dOff = 0;
		var eof = buffer.byteLength;
		while (off<eof) {
			var flag = view.getUint8(off++);
			for (var j=7; j>=0; j--) {
				if (off>=eof) break;
				if ((flag>>j)&1) { //1=compressed, 2=raw byte
					var dat = view.getUint16(off);
					off += 2;
					var cOff = (dOff-(dat&4095))-1;
					var len = (dat>>12)+3;

					for (var k=0; k<len; k++) {
						targA[dOff++] = targA[cOff++];
					}

				} else {
					targA[dOff++] = view.getUint8(off++);
				}
			}
		}
		return targ;
	}
})();