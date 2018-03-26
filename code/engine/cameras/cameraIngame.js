//
// cameraIngame.js
//--------------------
// The ingame camera that follows the kart from behind.
// by RHY3756547
//
// includes: main.js
//

window.cameraIngame = function(kart) {

	var thisObj = this;
	this.kart = kart;
	this.getView = getView;
	this.targetShadowPos = [0, 0, 0]

	var mat = mat4.create();

	var camOffset = [0, 32, -48]
	var lookAtOffset = [0, 16, 0]

	var camNormal = [0, 1, 0];
	var camAngle = 0;
	var boostOff = 0;

	function getView(scene) {
		var basis = buildBasis();
		var camPos = vec3.transformMat4([], camOffset, basis);
		var lookAtPos = vec3.transformMat4([], lookAtOffset, basis);

		vec3.scale(camPos, camPos, 1/1024);
		vec3.scale(lookAtPos, lookAtPos, 1/1024);

		var mat = mat4.lookAt(mat4.create(), camPos, lookAtPos, [0, 1, 0]);
		var kpos = vec3.clone(kart.pos);
		if (kart.drifting && !kart.driftLanded && kart.ylock>0) kpos[1] -= kart.ylock;
		mat4.translate(mat, mat, vec3.scale([], kpos, -1/1024));

		//interpolate visual normal roughly to target
		camNormal[0] += (kart.kartNormal[0]-camNormal[0])*0.075;
		camNormal[1] += (kart.kartNormal[1]-camNormal[1])*0.075;
		camNormal[2] += (kart.kartNormal[2]-camNormal[2])*0.075;
		vec3.normalize(camNormal, camNormal);

		if (kart.physBasis != null) {
			var kartA = kart.physicalDir+kart.driftOff/2;
			var forward = [Math.sin(kartA), 0, -Math.cos(kartA)];
			vec3.transformMat4(forward, forward, kart.physBasis.mat);
			camAngle += dirDiff(Math.atan2(forward[0], -forward[2]), camAngle)*0.075;
		} else {
			camAngle += dirDiff(kart.physicalDir+kart.driftOff/2, camAngle)*0.075;
		}
		camAngle = fixDir(camAngle);

		boostOff += (((kart.boostNorm+kart.boostMT > 0)?5:0) - boostOff)*0.075

		var p = mat4.perspective(mat4.create(), ((70+boostOff)/180)*Math.PI, gl.viewportWidth / gl.viewportHeight, 0.01, 10000.0);

		var dist = 192;
		this.targetShadowPos = vec3.add([], kart.pos, [Math.sin(kart.angle)*dist, 0, -Math.cos(kart.angle)*dist])

		thisObj.view = {p:p, mv:mat, pos: vec3.scale([], vec3.transformMat4([], [0,0,0], mat4.invert([], mat)), 1024)};

		return thisObj.view;
	}

	function buildBasis() {
		//order y, x, z
		var kart = thisObj.kart;
		var forward = [Math.sin(camAngle), 0, -Math.cos(camAngle)];
		var side = [Math.cos(camAngle), 0, Math.sin(camAngle)];
		/*
		if (kart.physBasis != null) {
			vec3.transformMat4(forward, forward, kart.physBasis.mat);
			vec3.transformMat4(side, side, kart.physBasis.mat);
		}
		*/
		var basis = gramShmidt(camNormal, side, forward);
		var temp = basis[0];
		basis[0] = basis[1];
		basis[1] = temp; //todo: cleanup
		return [
			basis[0][0], basis[0][1], basis[0][2], 0,
			basis[1][0], basis[1][1], basis[1][2], 0,
			basis[2][0], basis[2][1], basis[2][2], 0,
			0, 0, 0, 1			
		]
	}

	function gramShmidt(v1, v2, v3) {
		var u1 = v1;
		var u2 = vec3.sub([0, 0, 0], v2, project(u1, v2));
		var u3 = vec3.sub([0, 0, 0], vec3.sub([0, 0, 0], v3, project(u1, v3)), project(u2, v3));
		return [vec3.normalize(u1, u1), vec3.normalize(u2, u2), vec3.normalize(u3, u3)]
	}

	function project(u, v) {
		return vec3.scale([], u, (vec3.dot(u, v)/vec3.dot(u, u)))
	}

	function fixDir(dir) {
		return posMod(dir, Math.PI*2);
	}

	function dirDiff(dir1, dir2) {
		var d = fixDir(dir1-dir2);
		return (d>Math.PI)?(-2*Math.PI+d):d;
	}

	function posMod(i, n) {
		return (i % n + n) % n;
	}

}