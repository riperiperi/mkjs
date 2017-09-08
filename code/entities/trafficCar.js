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

	t.requireRes = requireRes;
	t.provideRes = provideRes;
	t.update = update;
	t.draw = draw;

	t.route = scene.paths[obji.routeID];
	t.routeSpeed = (obji.setting1>>16)/100;
	t.routePos = (obji.setting1&0xFFFF)%t.route.length;
	t.nextNode = t.route[t.routePos];
	t.prevPos = t.pos;
	t.elapsedTime = 0;

	var facingNormal = [0, 1, 0];
	var curNormal = [0, 1, 0];
	var floorNormal = [0, 1, 0];

	function update(scene) {
		//simple behaviour, just follow the path! piece of cake.
		t.elapsedTime += t.routeSpeed;
		t.pos = vec3.lerp([], t.prevPos, t.nextNode.pos, t.elapsedTime/t.nextNode.duration);
		if (t.elapsedTime >= t.nextNode.duration) {
			t.elapsedTime = 0;
			t.prevPos = t.nextNode.pos;
			t.routePos = (t.routePos+1)%t.route.length;
			t.nextNode = t.route[t.routePos];
		}

		facingNormal = vec3.sub([], t.prevPos, t.nextNode.pos)
		vec3.normalize(facingNormal, facingNormal);

		var rate = 0.025
		curNormal[0] += (facingNormal[0]-curNormal[0])*rate;
		curNormal[1] += (facingNormal[1]-curNormal[1])*rate;
		curNormal[2] += (facingNormal[2]-curNormal[2])*rate;
		vec3.normalize(curNormal, curNormal);

		var spos = vec3.clone(t.pos);
		spos[1] += 32;
		var result = lsc.raycast(spos, [0, -100, 0], scene.kcl, 0.05, []);
		if (result != null) {
			floorNormal = result.normal;
		} else {
			floorNormal = [0,1,0];
		}

	}

	function draw(view, pMatrix) {
		var mat = mat4.translate(mat4.create(), view, t.pos);
			
		mat4.scale(mat, mat, vec3.scale([], t.scale, 16));

		mat4.mul(mat, mat, mat4.invert([], mat4.lookAt([], [0, 0, 0], curNormal, floorNormal)));
		res.mdl[0].draw(mat, pMatrix);
	}

	function requireRes() { //scene asks what resources to load
		switch (obji.ID) {
			case 0x019A:
				return {mdl:[{nsbmd:"car_a.nsbmd"}]}; //one model, car
			case 0x019C:
				return {mdl:[{nsbmd:"truck_a.nsbmd"}]}; //one model, truck
			case 0x0195:
				return {mdl:[{nsbmd:"bus_a.nsbmd"}]}; //one model, bus
		}	
	}

	function provideRes(r) {
		res = r; //...and gives them to us. :)
	}
}

window.ObjCar = ObjTruck;
window.ObjBus = ObjTruck;