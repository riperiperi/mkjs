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

window.Item = function(scene, owner, type, id) {
	var t = this;
	var minimumMove = 0.01;

	this.id = id;

	this.pos = vec3.transformMat4([], [0, (-owner.params.colRadius)+1, 16], owner.mat);
	this.vel = vec3.create();
	this.gravity = [0, -0.17, 0]; //100% confirmed by me messing around with the gravity value in mkds
	this.minBounceVel = 0.5;
	this.airResist = 0.99;
	this.enablePhysics = true;
	this.floorBounce = 0.5;
	this.held = true;
	this.type = type;
	this.owner = owner;
	this.holdTime = 20;
	this.dead = false;

	this.angle = owner.angle;
	this.speed = 10;
	this.yvel = 0;
	this.xyScale = [1, 1];

	this.colRadius = 4;
	this.holdDist = 2;
	this.safeKart = owner;
	var safeTimeMax = 4;
	this.safeTime = safeTimeMax; //time the object needs to not be colliding with the source to start considering collisions with it
	this.stuckTo = null;

	this.groundTime = 0;

	
	var deadTimerLength = 30;
	var throwVelocity = 7; //xz velocity for throw. angle adds a y component
	var throwAngle = (Math.PI / 10) * 2;
	var working = vec3.create();
	this.deadTimer = 0; //animates death. goes to 20, then deletes for real. dead objects can't run update or otherwise

	//a controller makes this item what it is...
	// canBeHeld: boolean
	// canBeDropped: boolean | 'func'
	// isDestructive: boolean
	// update?: (scene: CourseScene) => void
	// draw?: (mvMatrix, pMatrix) => void     // OVERRIDES NORMAL DRAW FUNCTION!
	// release?: (direction: number) => boolean   //direction is 1 for forward, -1 for back. returns if the item has more uses
	// onRest?: (normal: vec3) => void   //when the object comes to a rest (first time, or after leaving the ground for a while)
	// onDie?: (final: boolean) => void   //when the object dies
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
		var dir = kart.driftOff / 4;

		//offset the kart's drift offset (on direction)
		var pos;
		if (t.holdPos != null) {
			pos = vec3.clone(t.holdPos);
		} else {
			var dist = t.colRadius + kart.params.colRadius + t.holdDist;
			var pos = [Math.sin(dir)*dist, -kart.params.colRadius, -Math.cos(dir)*dist];
		}
		
		//make relative to the kart's position
		vec3.transformMat4(pos, pos, kart.mat);
		
		vec3.sub(t.vel, pos, t.pos); //set the object's velocity to try move it to the hold location. (gravity is disabled)
		t.enablePhysics = true;
	}

	function release(forward) {
		//release the item, either forward or back
		t.holdTime = 0;
		if (t.canBeHeld()) {
			t.updateHold(owner);
			updateCollision(scene);
		}
		t.enablePhysics = true;
		if (t.controller.release) t.controller.release(forward);
		else {
			//default drop and throw. just here for template purposes
			if (forward > 0) {
				nitroAudio.playSound(218, {volume: 2}, 0, owner);
				var dir = owner.driftOff / 4;

				//offset the kart's drift offset (on direction). add y component
				var vel = [-Math.sin(dir)*throwVelocity, Math.tan(throwAngle) * throwVelocity, Math.cos(dir)*throwVelocity];
				var z = [0, 0, 0];
				
				//make relative to the kart's orientation
				vec3.transformMat4(vel, vel, owner.mat);
				vec3.transformMat4(z, z, owner.mat);
				vec3.sub(vel, vel, z);
				var v2 = vec3.scale([], owner.vel, 2);
				vec3.add(vel, vel, v2);

				t.vel = vel;
			} else {
				t.vel = vec3.create();
				t.safeKart = null;
			}
		}
		t.held = false;
	}

	function canBeHeld() {
		return t.controller.canBeHeld || false;
	}

	function canBeDropped() {
		if (t.controller.canBeDropped == null) return true;
		return t.controller.canBeDropped;
	}

	function isDestructive() {
		return t.controller.isDestructive || false;
	}

	function isSolid() {
		if (t.controller.isSolid == null) return true;
		return t.controller.isSolid;
	}

	function finalize() {
		//kill instantly
		if (t.controller.onDie) t.controller.onDie(true);
		t.deadTimer = deadTimerLength;
		scene.items.removeItem(t);
		t.dead = true;
	}

	function intensityMax(targ, vec) {
		if (Math.abs(vec[0]) > Math.abs(targ[0])*0.5) targ[0] = vec[0];
		if (Math.abs(vec[1]) > Math.abs(targ[1])*0.5) targ[1] = vec[1];
		if (Math.abs(vec[2]) > Math.abs(targ[2])*0.5) targ[2] = vec[2];
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
				item.deadTimer++;
			} else if (item.isSolid() && t.isSolid()) {
				//bounce off other items that are not destructive
				//set our velocity to move away (not too intensely)
				//(only apply if our id is before, to avoid double adding the velocity)
				if (t.id < item.id) {
					var diff = vec3.sub(working, t.pos, item.pos);
					vec3.scale(diff, diff, 0.33);
					intensityMax(t.vel, diff);
					vec3.scale(diff, diff, -1);
					intensityMax(item.vel, diff);
					//vec3.add(t.vel, t.vel, diff);
					//vec3.sub(item.vel, item.vel, diff);
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
		if (t.holdTime > 0 && t.holdTime-- > 7) {
			if (t.holdTime == 7) {
				nitroAudio.playSound(231, {volume: 2}, 0, owner);
			}
			return;
		}
		if (t.pos[2] < -10000) finalize(); //out of bounds failsafe

		if (t.deadTimer > 0) {
			if (t.deadTimer == 1 && t.controller.onDie) t.controller.onDie(false);
			t.deadTimer++;
			t.sprMat = mat4.create();
			mat4.translate(t.sprMat, t.sprMat, [t.deadTimer/50, Math.sin((t.deadTimer/30) * Math.PI) * 0.5, 0]);
			mat4.rotateZ(t.sprMat, t.sprMat, (t.deadTimer/-15) * Math.PI);
			if (t.deadTimer >= 30) t.finalize();
			return;
		}

		if (t.held) {
			t.updateHold(owner);
		}

		var hitSafe = false;
		//search for player collisions, collisions with other items
		for (var i=0; i<scene.karts.length; i++) {
			var ok = scene.karts[i];
			
			var dist = vec3.dist(vec3.add(working, t.pos, [0,t.colRadius/2,0]), ok.pos);
			if (dist < t.colRadius + ok.params.colRadius) {
				//colliding with a kart.
				//do we need to do something?
				if (ok === t.safeKart) {
					hitSafe = true;
					continue;
				}
				t.collide(ok);
			}
		}

		if (t.safeKart && !hitSafe && !t.held) {
			t.safeTime--;
			if (t.safeTime <= 0) {
				t.safeKart = null;
			}
		}

		if (t.holdTime == 0) { //avoid mutual item destruction on the first frame
			for (var i=0; i<scene.items.items.length; i++) {
				var ot = scene.items.items[i];
				if (ot == t || (t.held && ot.held)) continue;
				var dist = vec3.dist(t.pos, ot.pos);
				if (dist < t.colRadius + ot.colRadius && ot.holdTime <= 7 && ot.deadTimer == 0) {
					//two items are colliding.
					t.collide(ot);
				}
			}
		}

		if (t.groundTime > 0) t.groundTime++;

		if (t.stuckTo != null) {
			if (t.stuckTo.moveWith != null) t.stuckTo.moveWith(t);
			t.enablePhysics = true;
			t.stuckTo = null;
		}

		if (t.enablePhysics) {
			updateCollision(scene);
		}
	}

	function updateCollision(scene) {
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
			var result = lsc.raycast(posSeg, velSeg, scene, 0.05, ignoreList);
			if (result != null) {
				if (t.controller.colResponse && !t.held) t.controller.colResponse(posSeg, velSeg, result, ignoreList)
				else colResponse(posSeg, velSeg, result, ignoreList)
				remainingT -= result.t;
				if (remainingT > 0.01) {
					velSeg = vec3.scale(velSeg, t.vel, remainingT);
				}
			} else {
				vec3.add(posSeg, posSeg, velSeg);
				remainingT = 0;
			}
		}
		t.pos = posSeg;
	}

	function draw(mvMatrix, pMatrix) {
		if (t.holdTime > 7) return;
		if (t.deadTimer > 0) nitroRender.setColMult([1, 1, 1, 1-(t.deadTimer/deadTimerLength)]); //fade out
		if (t.controller.draw) {
			t.controller.draw(mvMatrix, pMatrix);
		} else {
			var mat = mat4.translate(mat4.create(), mvMatrix, vec3.add(vec3.create(), t.pos, [0, t.colRadius * t.xyScale[1], 0]));
				
			spritify(mat);
			var scale = 6*t.colRadius * (1 - t.holdTime/7);
			mat4.scale(mat, mat, [scale, scale, scale]);

			var mdl = scene.gameRes.items[type];
			//apply our custom mat (in sprite space), if it exists
			//used for destruction animation, scaling
			if (t.sprMat) {
				var oldMat = mdl.baseMat;
				mdl.setBaseMat(t.sprMat);
				mdl.draw(mat, pMatrix);
				mdl.setBaseMat(oldMat);
			} else {
				mdl.draw(mat, pMatrix);
			}
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
			t.safeKart = null;
		} else if (colType == MKDS_COLTYPE.OOB || colType == MKDS_COLTYPE.FALL) {
			if (t.deadTimer == 0) t.deadTimer++;
		} else if (MKDS_COLTYPE.GROUP_ROAD.indexOf(colType) != -1) {
			//sliding plane
			var bounce = t.held ? 0 : t.floorBounce;
			var proj = vec3.dot(t.vel, n) * (1 + bounce);
			vec3.sub(t.vel, t.vel, vec3.scale(vec3.create(), n, proj));

			if (!t.held && (t.floorBounce == 0 || Math.abs(proj) < t.minBounceVel)) {
				t.vel[0] = 0;
				t.vel[1] = 0;
				t.vel[2] = 0;
				t.enablePhysics = false;
				if (t.groundTime == 0) {
					t.groundTime = 1;
					if (t.controller.onRest) {
						t.controller.onRest(n);
					}
				}
			}
			t.stuckTo = dat.object;
		} else {
			adjustPos = false;
			ignoreList.push(plane);
		}

		if (adjustPos) { //move back from plane slightly
			vec3.add(pos, pos, vec3.scale(vec3.create(), n, minimumMove));
		}
		
	}
}