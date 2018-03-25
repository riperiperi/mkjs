//
// controlRaceCPU.js
//--------------------
// Provides AI control for default races
// by RHY3756547
//
// includes: main.js
//

window.controlRaceCPU = function(nkm) {

	var thisObj = this;
	var kart;

	this.setKart = function(k) {
		kart = k;
		thisObj.kart = k;
		calcDestNorm();
	}

	this.fetchInput = fetchInput;
	this.setRouteID = setRouteID;

	var battleMode = (nkm.sections["EPAT"] == null);

	var paths, points;
	if (battleMode) { //MEEPO!!
		var paths = nkm.sections["MEPA"].entries;
		var points = nkm.sections["MEPO"].entries;
	} else {
		var paths = nkm.sections["EPAT"].entries;
		var points = nkm.sections["EPOI"].entries;
	}

	var ePath = paths[0];
	var ePoiInd = ePath.startInd;
	var ePoi = points[ePath.startInd];

	var posOffset = [0, 0, 0];
	var destOff = [0, 0, 0];
	var offTrans = 0;
	chooseNewOff();

	var destNorm;
	var destConst;
	var destPoint;

	function fetchInput() {
		//basically as a cpu, we're really dumb and need a constant supply of points to drive to.
		//battle mode AI is a lot more complex, but since we're only going in one direction it can be kept simple.

		var accel = true; //currently always driving forward. should change for sharp turns and when we get stuck on a wall 
		//(drive in direction of wall? we may need to reverse, "if stuck for too long we can just call lakitu and the players won't even notice" - Nintendo)

		var dist = vec3.dot(destNorm, kart.pos) + destConst;
		if (dist < ePoi.pointSize) advancePoint();
		if (ePath.loop) debugger;

		destPoint = vec3.add([], ePoi.pos, vec3.scale([], vec3.lerp([], posOffset, destOff, offTrans), ePoi.pointSize));
		var dirToPt = Math.atan2(destPoint[0]-kart.pos[0], kart.pos[2]-destPoint[2]);

		var physDir = kart.physicalDir;
		if (kart.physBasis) {
			if (kart.physBasis.loop) { 
				return {
					accel: true, //x
					decel: false, //z
					drift: false, //s
					item: false, //a

					//-1 to 1, intensity.
					turn: 0,
					airTurn: 0 //air excitebike turn, doesn't really have much function
				};
			}
			var forward = [Math.sin(physDir), 0, -Math.cos(physDir)];
			vec3.transformMat4(forward, forward, kart.physBasis.mat);
			var physDir = Math.atan2(forward[0], -forward[2]);
		}
		var diff = dirDiff(dirToPt, physDir);
		var turn = Math.min(Math.max(-1, (diff*3)), 1);

		offTrans += 1/240;

		if (offTrans >= 1) chooseNewOff();

		return {
			accel: accel, //x
			decel: false, //z
			drift: false, //s
			item: false, //a

			//-1 to 1, intensity.
			turn: turn,
			airTurn: 0 //air excitebike turn, doesn't really have much function
		};
	}

	function chooseNewOff() {
		posOffset = destOff;
		var ang = Math.random()*Math.PI*2;
		var strength = Math.random();
		destOff = [Math.sin(ang)*strength, 0, Math.cos(ang)*strength];
		offTrans = 0;
	}
		

	function calcDestNorm() {
		var norm = vec3.sub([], kart.pos, ePoi.pos);
		vec3.normalize(norm, norm);

		destNorm = norm;
		destConst = -vec3.dot(ePoi.pos, norm)

	}

	function setRouteID(routeID) {
		ePoiInd = routeID-1
		advancePoint();
	}

	function advancePoint() {
		if (++ePoiInd < ePath.startInd+ePath.pathLen) {
			//next within this path
			ePoi = points[ePoiInd];
		} else {
			//advance to one of next possible paths
			
			if (battleMode) {
				var loc = (Math.random()>0.5 && ePath.source.length>0)?ePath.source:ePath.dest;
				var pathInd = loc[Math.floor(Math.random()*loc.length)];
				ePoiInd = pathInd;
				var pt = points[ePoiInd];
				if (pt != null) {
					ePoi = pt;
					recomputePath();
				}
			} else {
				var pathInd = ePath.dest[Math.floor(Math.random()*ePath.dest.length)];
				ePath = paths[pathInd];
				ePoi = points[ePath.startInd];
				ePoiInd = ePath.startInd;
			}
		}
		calcDestNorm();
	}

	function recomputePath() { //use if point is set by anything but the path system, eg. respawn
		for (var i=0; i<paths.length; i++) {
			var rel = (ePoiInd-paths[i].startInd);
			if (rel >= 0 && rel < paths[i].pathLen) {
				ePath = paths[i];
			}
		}
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