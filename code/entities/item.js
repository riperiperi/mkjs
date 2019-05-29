//
// shell.js
//--------------------
// Entity type for any item. Specific item types in `/item` folder
// Has a default collision handler, but can pass control to the specific item code.
// by RHY3756547
//
// includes: gl-matrix.js (glMatrix 2.0)
// /formats/kcl.js
//
var itemTypes = {
	//physics, holdable
	'$koura_g': GreenShellC,
	'$koura_r': RedShellC,
	'$banana': BananaC,
	'$bomb': BombC,
	'$f_box': FakeBoxC,

	//groups
	'$koura_group': ShellGroupC,
	'$banana_group': BananaGroupC,
	
	//one use items
	'$kinoko': MushroomC,
	'$kinoko_group': MushroomGroupC,
	'$kinoko_p': QueenMushroomC,
	'$star': StarC,
	'$thunder': ThunderC,
	'$gesso': BlooperC,
	'$teresa': BooC,
	'$killer': KillerC,
	'$koura_w': BlueShellC
}

window.Item = function(scene, owner, type) {
	var t = this;
	var minimumMove = 0.01;

	this.id = 0;

	this.pos = vec3.transformMat4([], [0, (-owner.params.colRadius)+1, 16], owner.mat);
	this.vel = vec3.create();
	this.gravity = [0, -0.17, 0]; //100% confirmed by me messing around with the gravity value in mkds
	this.minBounceVel = 0.5;
	this.airResist = 0.95;
	this.enablePhysics = true;
	this.floorBounce = 0.5;
	this.held = true;
	this.type = type;
	this.owner = owner;

	this.angle = owner.angle;
	this.speed = 10;
	this.yvel = 0;

	this.colRadius = 4;
	this.holdDist = 16;
	this.safeKart = owner;

	var deadTimerLength = 20;
	var throwVelocity = 16;
	var throwAngle = (Math.PI / 3) * 2;
	this.deadTimer = 0; //animates death. goes to 20, then deletes for real. dead objects can't run update or otherwise

	//a controller makes this item what it is...
	// canBeHeld: boolean
	// canBeDropped: boolean | 'func'
	// isDestructive: boolean
	// update?: (scene: CourseScene) => void
	// draw?: (mvMatrix, pMatrix) => void     // OVERRIDES NORMAL DRAW FUNCTION!
	// release?: (direction: number) => boolean   //direction is 1 for forward, -1 for back. returns if the item has more uses
	// collide?: (item: Item | Kart)
	// collideKart?: (item: Kart)
	var subtypeInd = type.indexOf('-');
	if (subtypeInd == -1) subtypeInd = type.length;
	this.controller = new itemTypes["$"+type.substr(0, subtypeInd)](this, scene, type.substr(subtypeInd + 1));

	//functions
	this.update = update;
	this.draw = draw;

	this.updateHold = updateHold;
	this.release = release;
	this.canBeHeld = canBeHeld;
	this.canBeDropped = canBeDropped;
	this.isDestructive = isDestructive;
	this.isSolid = isSolid;
	this.finalize = finalize;
	this.collide = collide;

	function updateHold(kart) {
		//move the object behind the kart (physical direction without drift off)
		//assuming this will only be called for something that can be held
		var dir = -kart.driftOff;

		//offset the kart's drift offset (on direction)
		var pos = [Math.sin(dir)*t.holdDist, 0, -Math.cos(dir)*t.holdDist];
		
		//make relative to the kart's position
		vec3.transformMat4(pos, pos, kart.mat);
		
		vec3.sub(t.vel, pos, t.pos); //set the object's velocity to try move it to the hold location. (gravity is disabled)
		t.enablePhysics = true;
	}

	function release(forward) {
		//release the item, either forward or back
		if (t.canBeHeld()) t.updateHold(owner);
		if (t.controller.release) t.controller.release(forward);
		else {
			//default drop and throw. just here for template purposes
			if (forward >= 0) {
				var dir = owner.physicalDir;
				vec3.zero(t.vel);
			} else {
				vec3.zero(t.vel);
			}
		}
		this.held = false;
	}

	function canBeHeld() {
		return t.controller.canBeHeld || false;
	}

	function canBeDropped() {
		return t.controller.canBeDropped || true;
	}

	function isDestructive() {
		return t.controller.isDestructive || false;
	}

	function isSolid() {
		return t.controller.isSolid || true;
	}

	function finalize() {
		//kill instantly
		t.deadTimer = deadTimerLength;
		scene.items.removeItem(t);
	}

	function collide(item) {
		if (t.controller.collide) {
			t.controller.collide(item);
			return;
		}

		if (item.type) {
			//has a type, definitely an item
			if (item.isDestructive() || t.isDestructive()) {
				//mutual destruction. other side will deal with how they handle the collision
				t.deadTimer++;
			} else if (item.isSolid() && t.isSolid()) {
				//bounce off other items that are not destructive
				//set our velocity to move away (not too intensely)
				//(only apply if our id is before, to avoid double adding the velocity)
				if (t.id < item.id) {
					var diff = vec3.sub([], t.pos, item.pos);
					vec3.scale(diff, diff, 0.5);
					vec3.add(t.vel, t.vel, diff);
					vec3.sub(item.vel, item.vel, diff);
					t.enablePhysics = true;
					item.enablePhysics = true;
				}
			}
		} else {
			//is a kart. usually this is where objects differ
			if (t.controller.collideKart) {
				t.controller.collideKart(item);
			}
		}
	}

	function update(scene) {
		if (t.controller.update) t.controller.update(scene);

		if (t.deadTimer > 0) {
			t.deadTimer++;
			if (t.deadTimer >= 20) t.finalize();
			return;
		}

		//search for player collisions, collisions with other items
		for (var i=0; i<scene.karts.length; i++) {
			var ok = scene.karts[i];
			var dist = vec3.dist(vec3.add([], t.pos, [0,1,0]), ok.pos);
			if (dist < t.colRadius + 12) {
				//colliding with a kart.
				//do we need to do something?
				t.collide(ok);
			}
		}

		for (var i=0; i<scene.items.length; i++) {
			var ot = scene.items[i];
			var dist = vec3.dist(t.pos, ot.pos);
			if (dist < t.colRadius + ot.colRadius) {
				//two items are colliding.
				t.collide(ot);
			}
		}


		if (t.enablePhysics) {
			if (!t.held) {
				vec3.add(t.vel, t.vel, t.gravity);
				vec3.scale(t.vel, t.vel, t.airResist);
			}

			//by default, items use raycast collision against the world (rather than ellipse)
			//this speeds things up considerably

			var steps = 0;
			var remainingT = 1;
			var velSeg = vec3.clone(t.vel);
			var posSeg = vec3.clone(t.pos);
			var ignoreList = [];
			while (steps++ < 10 && remainingT > 0.01) {
				var result = lsc.raycast(posSeg, velSeg, scene.kcl, 0.05, ignoreList);
				if (result != null) {
					if (t.controller.colResponse) t.controller.colResponse(posSeg, velSeg, result, ignoreList)
					else colResponse(posSeg, velSeg, result, ignoreList)
					remainingT -= result.t;
					if (remainingT > 0.01) {
						velSeg = vec3.scale(vec3.create(), t.vel, remainingT);
					}
				} else {
					vec3.add(posSeg, posSeg, velSeg);
					remainingT = 0;
				}
			}
			t.pos = posSeg;
		}
	}

	function draw(mvMatrix, pMatrix) {
		if (t.deadTimer > 0) nitroRender.setColMult([1, 1, 1, 1-(t.deadTimer/deadTimerLength)]); //fade out
		if (t.controller.draw) {
			t.controller.draw(mvMatrix, pMatrix);
		} else {
			var mat = mat4.translate(mat4.create(), mvMatrix, vec3.add(vec3.create(), t.pos, [0, 3, 0]));
				
			spritify(mat);
			mat4.scale(mat, mat, [16, 16, 16]);

			scene.gameRes.items[type].draw(mat, pMatrix);
		}
		if (t.deadTimer > 0) nitroRender.setColMult([1, 1, 1, 1]);
	}

	var spritify = function(mat, scale) {
		var scale = (scale == null)?Math.sqrt(mat[0]*mat[0]+mat[1]*mat[1]+mat[2]*mat[2]):scale;

		mat[0]=scale; mat[1]=0; mat[2]=0;
		mat[4]=0; mat[5]=scale; mat[6]=0;
		mat[8]=0; mat[9]=0; mat[10]=scale;
	}

	function colResponse(pos, pvel, dat, ignoreList) {

		var plane = dat.plane;
		var colType = (plane.CollisionType>>8)&31;
		vec3.add(pos, pos, vec3.scale(vec3.create(), pvel, dat.t));

		var n = dat.normal;
		vec3.normalize(n, n);
		var adjustPos = true;

		if (MKDS_COLTYPE.GROUP_WALL.indexOf(colType) != -1) { //wall
			//normally, item collision with a wall cause a perfect reflection of the velocity.
			var proj = vec3.dot(t.vel, n) * 2;
			vec3.sub(t.vel, t.vel, vec3.scale(vec3.create(), n, proj));

		} else if (MKDS_COLTYPE.GROUP_ROAD.indexOf(colType) != -1) {
			//sliding plane
			var proj = vec3.dot(t.vel, n) * (1 + t.floorBounce);
			vec3.sub(t.vel, t.vel, vec3.scale(vec3.create(), n, proj));

			if (t.floorBounce == 0 || Math.abs(proj) < t.minBounceVel) t.enablePhysics = false;
		} else {
			adjustPos = false;
			ignoreList.push(plane);
		}

		if (adjustPos) { //move back from plane slightly
			vec3.add(pos, pos, vec3.scale(vec3.create(), n, minimumMove));
		}
		
	}
}