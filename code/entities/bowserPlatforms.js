//
// bowserPlatforms.js
//--------------------
// Provides platforms for Bowser's Castle
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

	var movVel;

	//t.speed = (obji.setting1&0xFFFF)/8192;

	function update(scene) {
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
				Vertex1: [25, 0, 11],
				Vertex2: [25, 0, -11],
				Vertex3: [-25, 0, -11],
				Normal: [0, 1, 0]
			},
			{
				Vertex1: [-25, 0, -11],
				Vertex2: [-25, 0, 11],
				Vertex3: [25, 0, 11],
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