//
// netKart.js
//--------------------
// Singleton for serializing and restoring kart data.
// by RHY3756547
//
// includes: gl-matrix.js (glMatrix 2.0)
// /entities/kart.js
//

window.netKart = new function() {
	var animNames = ["drive", "win", "lose", "spin"]
	this.saveKart = saveKart;
	this.restoreKart = restoreKart;

	function saveKart(view, off, k, input) { // requires 0x60 bytes of space from the offset location
		saveVec3(view, off, k.pos);
		saveVec3(view, off+0xC, k.vel);
		view.setFloat32(off+0x18, k.angle, true);
		view.setFloat32(off+0x1C, k.physicalDir, true);
		view.setFloat32(off+0x20, k.driftOff, true);
		if (k.cannon != null) view.setUint16(off+0x24, k.cannon, true);
		else view.setUint16(off+0x24, 0xFFFF, true);

		view.setUint16(off+0x26, k.airTime, true);
		view.setUint16(off+0x28, k.lastCollided, true);

		view.setUint8(off+0x2A, k.boostMT);
		view.setUint8(off+0x2B, k.boostNorm);

		view.setUint16(off+0x2C, k.stuckTo, true);
		view.setUint8(off+0x2E, k.wheelTurn);

		saveVec3(view, off+0x30, k.kartColVel);
		view.setUint8(off+0x3C, k.kartColTimer);

		saveVec3(view, off+0x3D, k.kartTargetNormal);
		saveVec3(view, off+0x49, k.trackAttach);

		var driftFlags = ((k.drifting)?1:0)|(k.driftMode<<1)|((k.driftLanded)?8:0);
		view.setUint8(off+0x55, driftFlags);

		view.setUint8(off+0x56, animNames.indexOf(k.animMode));

		var binput = ((input.accel)?1:0)|((input.decel)?2:0)|((input.drift)?4:0);
		view.setUint8(off+0x57, binput);

		view.setFloat32(off+0x58, input.turn, true);
		view.setFloat32(off+0x5C, input.airTurn, true);		
	}

	function restoreKart(view, off, k) { // we use the same endianness format as the ds to avoid confusion.
		try {
			k.pos = readVec3(view, off, k.pos);
			k.vel = readVec3(view, off+0xC, k.vel);
			k.angle = view.getFloat32(off+0x18, true);
			k.physicalDir = view.getFloat32(off+0x1C, true);
			k.driftOff = view.getFloat32(off+0x20, true);
			k.cannon = view.getUint16(off+0x24, true);
			if (k.cannon == 0xFFFF) k.cannon = null;

			k.airTime = view.getUint16(off+0x26, true);
			k.lastCollided = view.getUint16(off+0x28, true);

			k.boostMT = view.getUint8(off+0x2A);
			k.boostNorm = view.getUint8(off+0x2B);

			k.stuckTo = view.getUint16(off+0x2C, true);
			k.wheelTurn = view.getUint8(off+0x2E);

			k.kartColVel = readVec3(view, off+0x30, k.kartColVel);
			k.kartColTimer = view.getUint8(off+0x3C);

			k.kartTargetNormal = readVec3(view, off+0x3D, k.kartTargetNormal);
			k.trackAttach = readVec3(view, off+0x49, k.trackAttach);

			var driftFlags = view.getUint8(off+0x55);

			k.drifting = driftFlags&1;
			k.driftMode = (driftFlags>>1)&3;
			k.driftLanded = driftFlags&8;

			k.animMode = animNames[view.getUint8(off+0x56)];

			k.controller.binput = view.getUint8(off+0x57);

			k.controller.turn = view.getFloat32(off+0x58, true);
			k.controller.airTurn = view.getFloat32(off+0x5C, true);

		} catch (err) {
			console.err("Kart restore failure:"+err.message);
			//failed to restore kart data. may wish to disconnect on this, but it's probably better to not react.
		}
	}

	function saveVec3(view, off, vec) { 
		var vec = vec;
		if (vec == null) vec = [NaN, NaN, NaN];
		view.setFloat32(off, vec[0], true);
		view.setFloat32(off+4, vec[1], true);
		view.setFloat32(off+8, vec[2], true);
	}

	function readVec3(view, off, vec) { 
		var first = view.getFloat32(off, true);
		if (isNaN(first)) return null;
		vec = vec3.create();
		vec[0] = first;
		vec[1] = view.getFloat32(off+4, true);
		vec[2] = view.getFloat32(off+8, true);
		return vec;
	}
}