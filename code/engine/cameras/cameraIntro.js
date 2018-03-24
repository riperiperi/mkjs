//
// cameraIntro.js
//--------------------
// Runs the intro camera for a scene.
// by RHY3756547
//
// includes: main.js
//

window.cameraIntro = function() {

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
	var duration = 0;
	var pointInterp = 0;

	var normalFOV = 70;
	var zoomLevel = 1;

	var viewW;
	var viewH;

	function getView(scene, width, height) {
		if (curCam == null) {
			restartCam(scene);
		}
		viewW = width;
		viewH = height;

		if (zoomLevel < curCam.zoomMark1) zoomLevel += curCam.zoomSpeedM1;
		else if (zoomLevel > curCam.zoomMark2) zoomLevel += curCam.zoomSpeedM2;
		else zoomLevel += curCam.zoomSpeed;

		if (zoomLevel > curCam.zoomEnd) zoomLevel = curCam.zoomEnd;

		if (duration-- < 0) {
			var cams = scene.nkm.sections["CAME"].entries;
			if (curCam.nextCam != -1) {
				curCamNum = curCam.nextCam;
				curCam = cams[curCamNum];
				zoomLevel = curCam.zoomStart;

				initCam(scene, curCam)
			} else {
				restartCam(scene);
			}
		}
		

		thisObj.view = camFunc(scene, curCam);
	}

	function restartCam(scene) {
		var cams = scene.nkm.sections["CAME"].entries;
		for (var i=0; i<cams.length; i++) {
			if (cams[i].firstCam == 2) {
				curCamNum = i;
				curCam = cams[curCamNum];
				zoomLevel = curCam.zoomStart;

				initCam(scene, curCam)
			}
		}
	}

	function recalcRouteSpeed() {
		routeSpeed = (curCam.routeSpeed/100)/60;
		//(curCam.routeSpeed/20)/vec3.dist(route[routePos].pos, route[(routePos+1)%route.length].pos);
	}

	var camFunc = function(scene, came) {
		var camPos = vec3.lerp([], route[routePos].pos, route[(routePos+1)%route.length].pos, routeProg);
		routeProg += routeSpeed;
		if (routeProg > 1) {
			routePos = (routePos+1)%route.length;
			routeProg = 0;
			recalcRouteSpeed();
		}

		pointInterp += (curCam.pointSpeed/100)/60;
		if (pointInterp > 1) pointInterp = 1;

		var lookAtPos = vec3.lerp([], curCam.pos2, curCam.pos3, pointInterp)

		vec3.scale(camPos, camPos, 1/1024);
		vec3.scale(lookAtPos, lookAtPos, 1/1024);

		var mat = mat4.lookAt(mat4.create(), camPos, lookAtPos, [0, 1, 0]);
		var p = mat4.perspective(mat4.create(), (zoomLevel*normalFOV/180)*Math.PI, viewW / viewH, 0.01, 10000.0);
		
		thisObj.targetShadowPos = lookAtPos;

		return {p:p, mv:mat, pos: vec3.scale([], vec3.transformMat4([], [0,0,0], mat4.invert([], mat)), 1024)}
	}

	var initCam = function(scene, came) {
		var routes = scene.paths;
		route = routes[came.camRoute];
		routePos = 0;
		routeProg = 0;
		duration = came.duration;
		recalcRouteSpeed();

	}

}