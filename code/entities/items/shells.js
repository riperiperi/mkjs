window.GreenShellC = function(item, scene) {
	var t = this;
	this.canBeHeld = true;
	this.canBeDropped = true;
	this.isDestructive = true;
	this.angle = 0;
	this.speed = 6; //base speed + kart speed
	this.sound = null;
	this.soundCooldown = 0;
	item.colRadius = 3;

	var minimumMove = 0.17;
	this.gravity = [0, -0.17, 0]; //100% confirmed by me messing around with the gravity value in mkds

	this.collideKart = collideKart;
	this.update = update;
	this.release = release;
	this.onDie = onDie;
	this.colResponse = colResponse;

	function release(forward) {
		t.sound = nitroAudio.playSound(215, {volume: 1.5}, 0, item);
		t.speed = 6;
		t.angle = item.owner.physicalDir;
		if (forward < 0) {
			t.angle += Math.PI;
			t.angle %= Math.PI*2;
		} else {
			t.speed += item.owner.speed;
		}
	}

	function onDie(final) {
		if (!final) {
			nitroAudio.playSound(214, {volume: 2}, 0, item);
		}
		if (t.sound) {
			nitroAudio.instaKill(t.sound);
			t.sound = null;
		}
	}

	function collideKart(kart) {
		item.deadTimer = 1;
		kart.damage(MKDSCONST.DAMAGE_FLIP);
	}

	function update(scene) {
		item.vel = [Math.sin(t.angle)*t.speed, item.vel[1], -Math.cos(t.angle)*t.speed]
		vec3.add(item.vel, item.vel, t.gravity);
		if (this.soundCooldown > 0) this.soundCooldown--;
	}

	function colResponse(pos, pvel, dat, ignoreList) {
		var plane = dat.plane;
		var colType = (plane.CollisionType>>8)&31;
		vec3.add(pos, pos, vec3.scale(vec3.create(), pvel, dat.t));

		var n = dat.normal;
		vec3.normalize(n, n);
		var gravS = Math.sqrt(vec3.dot(t.gravity, t.gravity));
		var angle = Math.acos(vec3.dot(vec3.scale(vec3.create(), t.gravity, -1/gravS), n));
		var adjustPos = true

		if (MKDS_COLTYPE.GROUP_WALL.indexOf(colType) != -1) { //wall
			//shell reflection code - slide y vel across plane, bounce on xz
			if (this.soundCooldown <= 0) {
				nitroAudio.playSound(213, {volume: 2.5}, 0, item);
				this.soundCooldown = 30;
			}
			vec3.add(item.vel, vec3.scale(vec3.create(), n, -2*(vec3.dot(item.vel, n)/vec3.dot(n,n))), item.vel);
			item.vel[1] = 0;

			var v = item.vel;
			t.angle = Math.atan2(v[0], -v[2]);
		} else if (colType == MKDS_COLTYPE.OOB || colType == MKDS_COLTYPE.FALL) {
			if (item.deadTimer == 0) item.deadTimer++;
		} else if (MKDS_COLTYPE.GROUP_ROAD.indexOf(colType) != -1) {
			//sliding plane
			var proj = vec3.dot(item.vel, n);
			vec3.sub(item.vel, item.vel, vec3.scale(vec3.create(), n, proj));
		} else {
			adjustPos = false;
			ignoreList.push(plane);
		}

		var rVelMag = Math.sqrt(vec3.dot(item.vel, item.vel));
		vec3.scale(item.vel, item.vel, t.speed/rVelMag); //force speed to shell speed for green shells.

		if (adjustPos) { //move back from plane slightly
			vec3.add(pos, pos, vec3.scale(vec3.create(), n, minimumMove));
		}
		
	}
}

window.RedShellC = function(item, scene) {
	this.canBeHeld = true;
	this.canBeDropped = true;
	this.isDestructive = true;
}

window.ShellGroupC = function(item, scene, type) {
	var t = this;
	this.canBeHeld = "func";
	this.canBeDropped = "func";
	this.rotationPeriod = 45;
	item.colRadius = -Infinity;

	this.draw = draw;
	this.update = update;
	this.release = release;
	this.onDie = onDie;

	this.children = [];

	var itemType = "koura_g";
	var itemCount = 3;

	if (type.length > 0) {
		var typeParse = type.split("-");
		if (typeParse.length == 1) {
			itemType = type;
		} else if (typeParse.length == 2 && !isNaN(typeParse[1]-0)) {
			itemType = typeParse[0];
			itemCount = typeParse[1]-0;
		}
	}

	this.phase = 0;
	var spinDist = 6;

	init();

	function init() {
		t.remaining = itemCount;
		item.holdPos = [0, 0, 0];
		//create children
		for (var i=0; i<itemCount; i++) {
			var sub = scene.items.createItem(itemType, item.owner);
			sub.holdTime = 7;
			t.children.push(sub);
		}
		nitroAudio.playSound(231, {volume: 2}, 0, item);
		this.sound = nitroAudio.playSound(227, {volume: 1.5}, 0, item);
	}

	function onDie(final) {
		if (t.sound) {
			nitroAudio.instaKill(t.sound);
			t.sound = null;
		}
	}

	function update(scene) {
		for (var i=0; i<t.children.length; i++) {
			var child = t.children[i];
			if (child == null) continue;
			if (child.deadTimer > 0) {
				t.children[i] = null;
				t.remaining--;
				continue;
			}
			var angle = ((i / itemCount + t.phase / t.rotationPeriod) * Math.PI * 2);
			var rad = item.owner.params.colRadius;
			var dist = spinDist + rad;
			child.holdPos = [-Math.sin(angle) * dist, -item.owner.params.colRadius, Math.cos(angle) * dist];
		}
		t.phase++;
		t.phase %= t.rotationPeriod;
	}

	function release(forward) {
		//forward the release to our last child
		var toUse;

		for (var i=0; i<t.children.length; i++) {
			var child = t.children[i];
			if (child == null) continue;
			if (child.deadTimer > 0) {
				t.children[i] = null;
				t.remaining--;
				continue;
			}
			toUse = child;
			t.children[i] = null;
			t.remaining--;
			break;
		}

		if (toUse != null) {
			toUse.release(forward);
		}
		if (t.remaining == 0) {
			item.finalize();
		}
	}

	function draw(mvMatrix, pMatrix) {
		//the group itself is invisible - the shells draw individually
	}
}

window.BlueShellC = null;