//
// rotatingGear.js
//--------------------
// Provides rotating gear objects for tick tock clock
// by RHY3756547
//
// includes:
// render stuff idk
//

window.ObjGear = function(obji, scene) {
	var obji = obji;
	var res = [];

	var t = this;

	t.collidable = true;
	t.colMode = 0;
	t.colRad = 512;
	t.getCollision = getCollision;
	t.moveWith = moveWith;

	t.pos = vec3.clone(obji.pos);
	//t.angle = vec3.clone(obji.angle);
	t.scale = vec3.clone(obji.scale);

	t.requireRes = requireRes;
	t.provideRes = provideRes;
	t.update = update;
	t.draw = draw;

	t.speed = (obji.setting1&0xFFFF)/8192;
	t.duration = obji.setting1>>16;
	t.rampDur = obji.setting2&0xFFFF;
	t.statDur = obji.setting2>>16;
	t.wB1 = obji.setting3&0xFFFF; //ONE of these flips direction, the other makes the gear use the black model. Not sure which is which, but for tick tock clock there is no need to get this right.
	t.wB2 = obji.setting3>>16;

	t.time = 0;
	t.mode = 0; //0=rampup, 1=normal, 2=rampdown, 3=stationary
	t.angle = 0;
	t.dir = (t.wB1 == 0)

	var dirVel = 0;

	var prevMat;
	var curMat;
	setMat();
	prevMat = curMat;

	function setMat() {
		prevMat = curMat;
		var mat = mat4.create();
		mat4.translate(mat, mat, t.pos);
			
		mat4.scale(mat, mat, vec3.scale([], t.scale, 16));

		mat4.rotateY(mat, mat, obji.angle[1]*(Math.PI/180));
		mat4.rotateX(mat, mat, obji.angle[0]*(Math.PI/180));

		mat4.rotateY(mat, mat, t.angle);
		curMat = mat;
	}

	function update(scene) {
		t.time++;
		switch (t.mode) {
			case 0: 
				dirVel = t.speed*(t.time/t.rampDur)*((t.dir)?-1:1);
				if (t.time > t.rampDur) {
					t.time = 0; t.mode = 1;
				}
				break;
			case 1:
				dirVel = t.speed*((t.dir)?-1:1);
				if (t.time > t.duration) {
					t.time = 0; t.mode = 2;
				}
				break;
			case 2:
				dirVel = t.speed*(1-t.time/t.rampDur)*((t.dir)?-1:1);
				if (t.time > t.rampDur) {
					t.time = 0; t.mode = 3; t.dir = !t.dir;
				}
				break;
			case 3:
				dirVel = 0;
				if (t.time > t.statDur) {
					t.time = 0; t.mode = 0;
				}
				break;
		}
		t.angle += dirVel;
		setMat();
	}

	function draw(view, pMatrix) {
		var mat = mat4.translate(mat4.create(), view, t.pos);
			
		mat4.scale(mat, mat, vec3.scale([], t.scale, 16));

		mat4.rotateY(mat, mat, obji.angle[1]*(Math.PI/180));
		mat4.rotateX(mat, mat, obji.angle[0]*(Math.PI/180));

		mat4.rotateY(mat, mat, t.angle);

		res.mdl[t.wB1].draw(mat, pMatrix);
	}

	function requireRes() { //scene asks what resources to load
		switch (obji.ID) {
			case 0x00CB:
				return {mdl:[{nsbmd:"gear_white.nsbmd"}, {nsbmd:"gear_black.nsbmd"}]};	
			case 0x00CE:
				return {mdl:[{nsbmd:"test_cylinder.nsbmd"}]};
			case 0x00D1:
				t.colRad = 4096;
				return {mdl:[{nsbmd:"rotary_bridge.nsbmd"}]};
		}
	}

	function provideRes(r) {
		res = r; //...and gives them to us. :)
	}

	function getCollision() {
		var obj = {};
		var inf = res.mdl[0].getCollisionModel(0, 0);
		obj.tris = inf.dat;

		var mat = mat4.translate([], mat4.create(), t.pos);
		mat4.scale(mat, mat, vec3.mul([], [16*inf.scale, 16*inf.scale, 16*inf.scale], t.scale));

		mat4.rotateY(mat, mat, obji.angle[1]*(Math.PI/180));
		mat4.rotateX(mat, mat, obji.angle[0]*(Math.PI/180));
		mat4.rotateY(mat, mat, t.angle);

		obj.mat = mat;
		return obj;
	}

	function moveWith(obj) { //used for collidable objects that move.

		//the most general way to move something with an object is to multiply its position by the inverse mv matrix of that object, and then the new mv matrix.

		vec3.transformMat4(obj.pos, obj.pos, mat4.invert([], prevMat))
		vec3.transformMat4(obj.pos, obj.pos, curMat)

		/*var p = vec3.sub([], obj.pos, t.pos);

		if (obji.ID == 0x00D1) { //todo: maybe something more general
			vec3.transformMat4(p, p, mat4.rotateX([], mat4.create(), dirVel));
			vec3.add(obj.pos, t.pos, p);
		} else {
			vec3.transformMat4(p, p, mat4.rotateY([], mat4.create(), dirVel));
			vec3.add(obj.pos, t.pos, p);
			obj.physicalDir -= dirVel;
		}*/
	}

}