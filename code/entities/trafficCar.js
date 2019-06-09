//
// trafficCar.js
//--------------------
// Provides multiple types of traffic. 
// by RHY3756547
//
// includes:
// render stuff idk
//

window.ObjTruck = function(obji, scene) {
	var obji = obji;
	var res = [];

	var t = this;

	t.pos = vec3.clone(obji.pos);
	//t.angle = vec3.clone(obji.angle);
	t.scale = vec3.clone(obji.scale);
	t.vel = vec3.create();

	t.requireRes = requireRes;
	t.provideRes = provideRes;
	t.update = update;
	t.draw = draw;

	t.route = scene.paths[obji.routeID];
	t.routeSpeed = 0.01;
	t.unknown = (obji.setting1&0xFFFF);
	t.routePos = (obji.setting1>>16); //(obji.setting1&0xFFFF)%t.route.length;
	t.variant = (obji.setting2&0xFFFF); //sets design for this car (from nsbtp)
	t.variant2 = (obji.setting2>>16); //0 or 1. unknown purpose

	t.routePos = (t.routePos+1)%t.route.length;

	t.nodes = [
		t.route[(t.routePos+t.route.length-2)%t.route.length].pos,
		t.route[(t.routePos+t.route.length-1)%t.route.length].pos, 
		t.route[t.routePos].pos,
		t.route[(t.routePos+1)%t.route.length].pos
		];

	t.nextNode = t.route[t.routePos];
	t.prevPos = t.pos;
	t.elapsedTime = 0;

	var curNormal = [0, 1, 0];
	var curFloorNormal = [0, 1, 0];
	var floorNormal = [0, 1, 0];

	//collision stuff
	t.collidable = true;
	t.colMode = 0;
	t.colRad = 512;
	t.colFrame = 0;
	t.moveWith = moveWith;
	t.getCollision = getCollision;

	var colRes;

	var dirVel = 0;

	var prevMat;
	var curMat;
	var colMat = mat4.create();
	prevMat = curMat;

	function setMat() {
		prevMat = curMat;
		var mat = mat4.create();
		mat4.translate(mat, mat, t.pos);
			
		mat4.scale(mat, mat, vec3.scale([], t.scale, 16));

		mat4.mul(mat, mat, mat4.invert([], mat4.lookAt([], [0, 0, 0], curNormal, curFloorNormal)));
		mat4.scale(colMat, mat, [colRes.scale, colRes.scale, colRes.scale]);
		t.colFrame++;
		curMat = mat;
	}

	//end collision stuff

	function cubic1D(y0, y1, y2, y3, i) {
		var a0, a1, a2, a3, i2;

		i2 = i*i;
		a0 = -0.5*y0 + 1.5*y1 - 1.5*y2 + 0.5*y3;
		a1 = y0 - 2.5*y1 + 2*y2 - 0.5*y3;
		a2 = -0.5*y0 + 0.5*y2;
		a3 = y1;

		return(a0 * i * i2 + a1 * i2 + a2 * i + a3);
	}

	function cubic3D(points, i) { //note: i is 0-1 between point 1 and 2. (0 and 3 are used to better define the curve)
		var p0 = points[0];
		var p1 = points[1];
		var p2 = points[2];
		var p3 = points[3];
		return [
			cubic1D(p0[0], p1[0], p2[0], p3[0], i),
			cubic1D(p0[1], p1[1], p2[1], p3[1], i),
			cubic1D(p0[2], p1[2], p2[2], p3[2], i)
		];
	}

	function update(scene) {
		//simple behaviour, just follow the path! piece of cake.

		//recalculate our route speed using a target real world speed.
		var nextTime = t.elapsedTime + t.routeSpeed;
		for (var i=0; i<((t.elapsedTime == 0)?3:1); i++) {
			if (nextTime < 1) {
				var targSpeed = 2;
				var estimate = cubic3D(t.nodes, nextTime);
				var estDistance = vec3.dist(estimate, t.pos);
				t.routeSpeed *= targSpeed/estDistance; //correct
				if (t.routeSpeed > 0.2) t.routeSpeed = 0.2;
			}
		}
		if (t.routeSpeed <= 0) t.routeSpeed = 0.01;

		t.elapsedTime += t.routeSpeed;
		var i = t.elapsedTime;

		var newPos = cubic3D(t.nodes, i); //vec3.lerp([], t.prevPos, t.nextNode.pos, i);
		vec3.sub(t.vel, newPos, t.pos);
		t.pos = newPos;
		
		if (t.elapsedTime >= 1) {
			t.elapsedTime -= 1;
			
			t.routePos = (t.routePos+1)%t.route.length;
			t.nextNode = t.route[t.routePos];
			t.nodes.splice(0, 1);
			t.nodes.push(t.route[(t.routePos+1)%t.route.length].pos);
			t.routeSpeed = 0.25;
		}

		curNormal = vec3.sub([], t.prevPos, t.pos)
		t.prevPos = vec3.clone(t.pos);
		vec3.normalize(curNormal, curNormal);
		if (isNaN(curNormal[0])) curNormal = [0, 0, 1];

		var spos = vec3.clone(t.pos);
		spos[1] += 32;
		var result = lsc.raycast(spos, [0, -100, 0], scene, 0.05, []);
		if (result != null) {
			floorNormal = result.normal;
		} else {
			floorNormal = [0,1,0];
		}

		var rate = 0.025;
		curFloorNormal[0] += (floorNormal[0]-curFloorNormal[0])*rate;
		curFloorNormal[1] += (floorNormal[1]-curFloorNormal[1])*rate;
		curFloorNormal[2] += (floorNormal[2]-curFloorNormal[2])*rate;
		vec3.normalize(curFloorNormal, curFloorNormal);
		setMat();
	}

	function draw(view, pMatrix) {
		var mat = mat4.translate(mat4.create(), view, t.pos);
			
		mat4.scale(mat, mat, vec3.scale([], t.scale, 16));

		mat4.mul(mat, mat, mat4.invert([], mat4.lookAt([], [0, 0, 0], curNormal, curFloorNormal)));
		res.mdl[0].setFrame(t.variant);
		res.mdl[0].draw(mat, pMatrix);
	}

	function requireRes() { //scene asks what resources to load
		switch (obji.ID) {
			case 0x019A:
				return {mdl:[{nsbmd:"car_a.nsbmd"}], other:["car_a.nsbtp"]}; //one model, car
			case 0x019C:
				return {mdl:[{nsbmd:"truck_a.nsbmd"}], other:["truck_a.nsbtp"]}; //one model, truck
			case 0x0195:
				return {mdl:[{nsbmd:"bus_a.nsbmd"}]}; //one model, bus
		}	
	}

	function moveWith(obj) { //used for collidable objects that move.
		//the most general way to move something with an object is to multiply its position by the inverse mv matrix of that object, and then the new mv matrix.

		vec3.transformMat4(obj.pos, obj.pos, mat4.invert([], prevMat))
		vec3.transformMat4(obj.pos, obj.pos, curMat);
	}

	function getCollision() {
		return { tris: colRes.dat, mat: colMat, frame: t.colFrame };
	}

	function provideRes(r) {
		res = r; //...and gives them to us. :)
		if (r.other != null) {
			if (r.other.length > 0 && r.other[0] != null) {
				res.mdl[0].loadTexPAnim(r.other[0]);
			}
		}
		colRes = res.mdl[0].getBoundingCollisionModel(0, 0);
		for (var i=0; i<colRes.dat.length; i++) {
			colRes.dat[i].CollisionType = MKDS_COLTYPE.KNOCKBACK_DAMAGE << 8;
		}
	}
}

window.ObjCar = ObjTruck;
window.ObjBus = ObjTruck;