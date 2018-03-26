//
// cameraSpectator.js
//--------------------
// Spectates a specific kart. Requires NKM AREA and CAME to be set up correctly.
// by RHY3756547
//
// includes: main.js
//

window.cameraSpectator = function(kart) {

	var thisObj = this;
	this.kart = kart;
	this.getView = getView;
	this.targetShadowPos = [0, 0, 0]

	var mat = mat4.create();

	var curCamNum = -1;
	var curCam = null;

	var route = null;
	var routePos = 0;
	var routeSpeed = 0;
	var routeProg = 0;

	var relPos = [];
	var posOff = [];

	var normalFOV = 70;
	var zoomLevel = 1;

	var viewW;
	var viewH;

	function getView(scene, width, height) {
		viewW = width;
		viewH = height;

		var cams = scene.nkm.sections["CAME"].entries;
		var tArea = getNearestArea(scene.nkm.sections["AREA"].entries, kart.pos)
		if (tArea.came != curCamNum) {
			//restart camera.
			curCamNum = tArea.came;
			curCam = cams[curCamNum];
			zoomLevel = curCam.zoomStart;

			initCam[curCam.camType](scene, curCam)
		}

		if (zoomLevel < curCam.zoomMark1) zoomLevel += curCam.zoomSpeedM1;
		else if (zoomLevel > curCam.zoomMark2) zoomLevel += curCam.zoomSpeedM2;
		else zoomLevel += curCam.zoomSpeed;

		if (zoomLevel > curCam.zoomEnd) zoomLevel = curCam.zoomEnd;
		
		thisObj.view = camFunc[curCam.camType](scene, curCam);
		thisObj.view.pos = vec3.scale([], vec3.transformMat4([], [0,0,0], mat4.invert([], thisObj.view.mv)), 1024)
		return thisObj.view;
	}

	var camFunc = [];

	camFunc[1] = function(scene, came) {
		var camPos = vec3.lerp([], route[routePos].pos, route[(routePos+1)%route.length].pos, routeProg);
		routeProg += routeSpeed;
		if (routeProg > 1) {
			routePos = (routePos+1)%route.length;
			routeProg = 0;
			recalcRouteSpeed();
		}

		var lookAtPos = vec3.transformMat4([], [0, 4, 0], kart.mat);

		vec3.scale(camPos, camPos, 1/1024);
		vec3.scale(lookAtPos, lookAtPos, 1/1024);

		var mat = mat4.lookAt(mat4.create(), camPos, lookAtPos, [0, 1, 0]);
		var p = mat4.perspective(mat4.create(), (zoomLevel*normalFOV/180)*Math.PI, viewW / viewH, 0.01, 10000.0);
		
		thisObj.targetShadowPos = kart.pos;

		return {p:p, mv:mat}
	}

	camFunc[0] = function(scene, came) { //point cam
		var camPos = vec3.clone(came.pos1);

		var lookAtPos = vec3.transformMat4([], [0, 4, 0], kart.mat);

		vec3.scale(camPos, camPos, 1/1024);
		vec3.scale(lookAtPos, lookAtPos, 1/1024);

		var mat = mat4.lookAt(mat4.create(), camPos, lookAtPos, [0, 1, 0]);
		var p = mat4.perspective(mat4.create(), (zoomLevel*normalFOV/180)*Math.PI, viewW / viewH, 0.01, 10000.0);
		
		thisObj.targetShadowPos = kart.pos;

		return {p:p, mv:mat}
	}

	camFunc[5] = function(scene, came) { //dash cam
		var basis = kart.basis;
		var camPos = vec3.transformMat4([], relPos, basis);
		var lookAtPos = vec3.transformMat4([], [0, 0, 0], basis);

		vec3.scale(camPos, camPos, 1/1024);
		vec3.scale(lookAtPos, lookAtPos, 1/1024);

		var mat = mat4.lookAt(mat4.create(), camPos, lookAtPos, [0, 1, 0]);

		var off = mat4.create();
		mat4.translate(off, off, [-came.pos3[0]/1024, came.pos3[1]/1024, -came.pos3[2]/1024]);
		mat4.mul(mat, off, mat);

		var kpos = vec3.clone(kart.pos);
		if (kart.drifting && !kart.driftLanded && kart.ylock>0) kpos[1] -= kart.ylock;
		mat4.translate(mat, mat, vec3.scale([], kpos, -1/1024));
		
		var p = mat4.perspective(mat4.create(), (zoomLevel*normalFOV/180)*Math.PI, viewW / viewH, 0.01, 10000.0);

		thisObj.targetShadowPos = kart.pos;

		return {p:p, mv:mat}
	}

	camFunc[2] = camFunc[0];

	var initCam = [];

	initCam[1] = function(scene, came) {
		var routes = scene.paths;
		route = routes[came.camRoute];
		routePos = 0;
		routeProg = 0;
		recalcRouteSpeed();

	}

	initCam[2] = function(scene, came) {
	}

	function recalcRouteSpeed() {
		routeSpeed = (curCam.routeSpeed/100)/60;
		//(curCam.routeSpeed/20)/vec3.dist(route[routePos].pos, route[(routePos+1)%route.length].pos);
	}

	initCam[5] = function(scene, came) {
		var mat = mat4.create();
		mat4.rotateY(mat, mat, (180-came.pos2[0])*(Math.PI/180));
		mat4.rotateX(mat, mat, -came.pos2[1]*(Math.PI/180));


		relPos = vec3.transformMat4([], [0, 0, -came.pos2[2]], mat);
		/*var basis = kart.basis;
		relPos = vec3.sub(relPos, came.pos1, kart.pos);
		vec3.transformMat4(relPos, relPos, mat4.invert([], basis));*/
	}

	initCam[0] = initCam[2];


	function getNearestArea(areas, pos) {
		var smallestDist = Infinity;
		var closestArea = null;
		for (var i=0; i<areas.length; i++) {
			var a = areas[i];
			var sub = vec3.sub([], a.pos, pos);
			vec3.divide(sub, sub, a.dimensions);
			var dist = Math.sqrt(sub[0]*sub[0] + sub[1]*sub[1] + sub[2]*sub[2]);
			if (dist<smallestDist && a.came != 255) {
				smallestDist = dist;
				closestArea = a;
			}
		}
		return closestArea;
	}

	function buildBasis() {
		//order y, x, z
		var basis = gramShmidt(camNormal, [Math.cos(camAngle), 0, Math.sin(camAngle)], [Math.sin(camAngle), 0, -Math.cos(camAngle)]);
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