//
// bowserPlatforms.js
//--------------------
// Provides moving platforms for Bowser's Castle and Delfino
// by RHY3756547
//
// includes:
// render stuff idk
//

window.ObjRotaryRoom = function(obji, scene) {
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
	t.angle = 0;

	var dirVel = 0;

	function update(scene) {
		dirVel = t.speed;
		t.angle += dirVel;
	}

	function draw(view, pMatrix) {
		var mat = mat4.translate(mat4.create(), view, t.pos);
			
		mat4.scale(mat, mat, vec3.scale([], t.scale, 16));

		mat4.rotateY(mat, mat, t.angle);
		res.mdl[0].draw(mat, pMatrix);
	}

	function requireRes() { //scene asks what resources to load
		return {mdl:[{nsbmd:"rotary_room.nsbmd"}]};	
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
		mat4.rotateY(mat, mat, t.angle);

		obj.mat = mat;
		return obj;
	}

	function moveWith(obj) { //used for collidable objects that move. 
		var p = vec3.sub([], obj.pos, t.pos);
		vec3.transformMat4(p, p, mat4.rotateY([], mat4.create(), dirVel));
		vec3.add(obj.pos, t.pos, p);
		obj.physicalDir -= dirVel;
	}

}

window.ObjBridge = function(obji, scene) {
	var obji = obji;
	var res = [];

	var t = this;

	t.collidable = true;
	t.colMode = 0;
	t.colRad = 512;
	t.getCollision = getCollision;
	t.moveWith = moveWith;

	t.pos = vec3.clone(obji.pos);
	t.angle = vec3.clone(obji.angle);
	t.scale = vec3.clone(obji.scale);

	t.requireRes = requireRes;
	t.provideRes = provideRes;
	t.update = update;
	t.draw = draw;

	t.largerUpAngle = obji.setting1&0xFFFF;
	t.upDuration = obji.setting1>>16;
	t.statDuration = obji.setting2&0xFFFF;
	t.downDuration = obji.setting2>>16;
	t.upAngle = obji.setting3&0xFFFF;
	t.unknown = obji.setting4>>16; //10001

	t.obji = obji;
	t.colFrame = 0;

	var dirVel = 0;
	var genCol;

	var prevMat;
	var curMat;
	var colMat = mat4.create();
	prevMat = curMat;

	var anim;
	var animMat;

	var frame = 0;
	var mode = 0; //going up, stationary, going down, stationary

	function setMat() {
		prevMat = curMat;
		var mat = mat4.create();
		mat4.translate(mat, mat, t.pos);

		if (t.angle[2] != 0) mat4.rotateZ(mat, mat, t.angle[2]*(Math.PI/180));
		if (t.angle[1] != 0) mat4.rotateY(mat, mat, t.angle[1]*(Math.PI/180));
		if (t.angle[0] != 0) mat4.rotateX(mat, mat, t.angle[0]*(Math.PI/180));
		
		mat4.scale(mat, mat, vec3.scale([], t.scale, 16));
		mat4.scale(colMat, mat, [genCol.scale, genCol.scale, genCol.scale]);
		t.colFrame++;
		curMat = mat;
	}

	function update(scene) {
		var angle = 0;
		frame++;
		switch (mode) {
			case 0:
				var p = frame / t.upDuration;
				angle = (0.5 - Math.cos(p * Math.PI) / 2) * t.largerUpAngle;
				if (frame >= t.upDuration) {
					mode = 1;
					frame = 0;
				}
				break;
			case 1:
			case 3:
				angle = (mode == 1) ? t.largerUpAngle : 0;
				if (frame >= t.statDuration) {
					mode = (mode + 1) % 4;
					frame = 0;
				}
				break;
			case 2:
				var p = 1 - frame / t.downDuration;
				angle = (0.5 - Math.cos(p * Math.PI) / 2) * t.largerUpAngle;
				if (frame >= t.downDuration) {
					mode = 3;
					frame = 0;
				}
				break;
		}

		t.angle[0] = -angle;
		animMat = anim.setFrame(0, 0, angle*1.5);
		setMat();
	}

	function draw(view, pMatrix) {
		var mat = mat4.create();
		mat4.mul(mat, view, curMat);

		res.mdl[0].draw(mat, pMatrix, animMat);
	}

	function requireRes() { //scene asks what resources to load
		return {mdl:[{nsbmd:"bridge.nsbmd"}], other:[null, "bridge.nsbca"]};
	}

	function provideRes(r) {
		res = r; //...and gives them to us. :)
		var inf = res.mdl[0].getCollisionModel(0, 1, 7<<8); //dash
		var inf2 = res.mdl[0].getCollisionModel(0, 0, 0); //regular
		anim = new nitroAnimator(r.mdl[0].bmd, r.other[1]);

		genCol = {dat:JSON.parse(JSON.stringify(inf.dat.concat(inf2.dat))), scale:inf.scale};
	}

	function getCollision() {
		return { tris: genCol.dat, mat: colMat, frame: t.colFrame };
	}

	function moveWith(obj) { //used for collidable objects that move. 
		//the most general way to move something with an object is to multiply its position by the inverse mv matrix of that object, and then the new mv matrix.
		vec3.transformMat4(obj.pos, obj.pos, mat4.invert([], prevMat))
		vec3.transformMat4(obj.pos, obj.pos, curMat)
	}

}

window.ObjRoutePlatform = function(obji, scene) {
	var obji = obji;
	var res = [];
	var genCol;

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

	generateCol();

	t.statDur = (obji.setting1&0xFFFF);
	t.route = scene.paths[obji.routeID];
	t.routeSpeed = 1/6;
	t.routePos = 0;
	t.nextNode = t.route[t.routePos];
	t.prevPos = t.pos;
	t.elapsedTime = 0;

	t.mode = 0;
	t.colFrame = 0;

	var movVel;

	//t.speed = (obji.setting1&0xFFFF)/8192;

	function update(scene) {
		t.colFrame++;
		if (t.mode == 0) {
			t.elapsedTime += t.routeSpeed;
			movVel = vec3.sub([], t.nextNode.pos, t.prevPos);
			//vec3.normalize(movVel, movVel);
			vec3.scale(movVel, movVel, t.routeSpeed/t.nextNode.duration);
			vec3.add(t.pos, t.pos, movVel);
			if (t.elapsedTime >= t.nextNode.duration) {
				t.elapsedTime = 0;
				t.prevPos = t.nextNode.pos;
				t.routePos = (t.routePos+1)%t.route.length;
				t.nextNode = t.route[t.routePos];
				t.mode = 1;
			}
		} else {
			t.elapsedTime += 1;
			movVel = [0, 0, 0];
			if (t.elapsedTime > t.statDur) {
				t.mode = 0;
				t.elapsedTime = 0;
			}
		}
	}

	function draw(view, pMatrix) {
		var mat = mat4.translate(mat4.create(), view, t.pos);
			
		mat4.scale(mat, mat, vec3.scale([], t.scale, 16));

		res.mdl[0].draw(mat, pMatrix);
	}

	function requireRes() { //scene asks what resources to load
		return {mdl:[{nsbmd:"koopa_block.nsbmd"}]};	//25x, 11y
	}

	function provideRes(r) {
		res = r; //...and gives them to us. :)
	}

	function generateCol() {
		genCol = {dat: [
			{
				Vertices: [[25, 0, 11], [25, 0, -11], [-25, 0, -11]],
				Normal: [0, 1, 0]
			},
			{
				Vertices: [[-25, 0, -11], [-25, 0, 11], [25, 0, 11]],
				Normal: [0, 1, 0]
			},
		], scale: 1};
	}

	function getCollision() {
		var obj = {};
		var inf = genCol;//res.mdl[0].getCollisionModel(0, 0);
		obj.tris = inf.dat;

		var mat = mat4.translate([], mat4.create(), t.pos);
		mat4.scale(mat, mat, vec3.mul([], [16*inf.scale, 16*inf.scale, 16*inf.scale], t.scale));

		obj.mat = mat;
		obj.frame = t.colFrame;
		return obj;
	}

	function moveWith(obj) { //used for collidable objects that move. 
		/*var p = vec3.sub([], obj.pos, t.pos);
		vec3.transformMat4(p, p, mat4.rotateY([], mat4.create(), dirVel));
		vec3.add(obj.pos, t.pos, p);
		obj.physicalDir -= dirVel;*/
		vec3.add(obj.pos, obj.pos, movVel);
	}

}