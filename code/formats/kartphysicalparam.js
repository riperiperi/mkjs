//
// kartphysicalparam.js
//--------------------
// Provides functionality to read mario kart ds kart physical parameters
// by RHY3756547
//
// includes: gl-matrix.js (glMatrix 2.0) (maybe)
//

window.kartphysicalparam = function(input) {

	var thisObj = this;

	if (input != null) {
		load(input);
	}
	this.load = load;

	function load(input) {
		var view = new DataView(input);
		var off = 0;
		var karts = []
		for (var i=0; i<50; i++) {
			var obj = {};
			var colParam = [];

			obj.colRadius = view.getInt32(off, true)/4096;
			obj.unknown1 = view.getInt32(off+0x4, true)/4096;
			obj.unknown2 = view.getInt32(off+0x8, true)/4096;
			obj.weight = view.getInt16(off+0xC, true)/4096;
			obj.miniTurbo = view.getUint16(off+0xE, true);
			obj.topSpeed = view.getInt32(off+0x10, true)/4096;
			obj.accel1 = view.getInt32(off+0x14, true)/4096;
			obj.accel2 = view.getInt32(off+0x18, true)/4096;
			obj.accelSwitch = view.getInt32(off+0x1C, true)/4096;
			obj.driftAccel1 = view.getInt32(off+0x20, true)/4096;
			obj.driftAccel2 = view.getInt32(off+0x24, true)/4096;
			obj.driftAccelSwitch = view.getInt32(off+0x28, true)/4096;
			obj.decel = view.getInt32(off+0x2C, true)/4096;
			obj.turnRate = (view.getInt16(off+0x30, true)/32768)*Math.PI;
			obj.driftTurnRate = (view.getInt16(off+0x32, true)/32768)*Math.PI;
			obj.driftOffRestore = (view.getInt16(off+0x34, true)/32768)*Math.PI;
			obj.unknown3 = view.getInt16(off+0x36, true);
			
			var off1 = off+0x38;
			var off2 = off+0x68;
			for (var j=0; j<12; j++) {
				var handling = view.getInt32(off1, true)/4096;
				var topSpeed = view.getInt32(off2, true)/4096;
				colParam.push({
					handling: handling,
					topSpeedMul: topSpeed
				});
				off1+=4;
				off2+=4;
			}

			obj.colParam = colParam;

			karts.push(obj);
			off += 0x98;
		}
		thisObj.karts = karts;
	}
}