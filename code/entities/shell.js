//
// shell.js
//--------------------
// Entity type for shells. (green) 
// by RHY3756547
//
// includes: gl-matrix.js (glMatrix 2.0)
// /formats/kcl.js
//

window.GreenShell = function(scene, owner, time, itemID, cliID, params) {
	var t = this;
	var minimumMove = 0.01;

	this.pos = vec3.transformMat4([], [0, (-owner.params.colRadius)+1, 16], owner.mat);
	this.vel = vec3.create();
	this.gravity = [0, -0.17, 0]; //100% confirmed by me messing around with the gravity value in mkds
	this.angle = owner.angle;
	this.speed = 10;
	this.yvel = 0;

	this.update = update;
	this.draw = draw;

	function update(scene) {
		t.vel = [Math.sin(t.angle)*t.speed, t.yvel, -Math.cos(t.angle)*t.speed]
		vec3.add(t.vel, t.vel, t.gravity);

		//simple point move. 

		var steps = 0;
		var remainingT = 1;
		var velSeg = vec3.clone(t.vel);
		var posSeg = vec3.clone(t.pos);
		var ignoreList = [];
		while (steps++ < 10 && remainingT > 0.01) {
			var result = lsc.raycast(posSeg, velSeg, scene.kcl, 0.05, ignoreList);
			if (result != null) {
				colResponse(posSeg, velSeg, result, ignoreList)
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

		t.yvel = t.vel[1];
	}

	function draw(mvMatrix, pMatrix) {
		var mat = mat4.translate(mat4.create(), mvMatrix, vec3.add(vec3.create(), t.pos, [0, 3, 0]));
			
		spritify(mat);
		mat4.scale(mat, mat, [16, 16, 16]);

		scene.gameRes.items.koura_g.draw(mat, pMatrix);
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
		var gravS = Math.sqrt(vec3.dot(t.gravity, t.gravity));
		var angle = Math.acos(vec3.dot(vec3.scale(vec3.create(), t.gravity, -1/gravS), n));
		var adjustPos = true

		if (MKDS_COLTYPE.GROUP_WALL.indexOf(colType) != -1) { //wall
			//shell reflection code - slide y vel across plane, bounce on xz
			vec3.add(t.vel, vec3.scale(vec3.create(), n, -2*(vec3.dot(t.vel, n)/vec3.dot(n,n))), t.vel);
			t.vel[1] = 0;

			var v = t.vel;
			t.angle = Math.atan2(v[0], -v[2]);

		} else if (MKDS_COLTYPE.GROUP_ROAD.indexOf(colType) != -1) {
			//sliding plane
			var proj = vec3.dot(t.vel, n);
			vec3.sub(t.vel, t.vel, vec3.scale(vec3.create(), n, proj));
		} else {
			adjustPos = false;
			ignoreList.push(plane);
		}

		var rVelMag = Math.sqrt(vec3.dot(t.vel, t.vel));
		vec3.scale(t.vel, t.vel, t.speed/rVelMag); //force speed to shell speed for green shells.

		//vec3.add(pos, pos, vec3.scale(vec3.create(), n, minimumMove)); //move away from plane slightly

		if (adjustPos) { //move back from plane slightly
			vec3.add(pos, pos, vec3.scale(vec3.create(), n, minimumMove));
			/*
				var velMag = Math.sqrt(vec3.dot(pvel, pvel));
				if (velMag*dat.t > minimumMove) {
					vec3.sub(pos, pos, vec3.scale(vec3.create(), pvel, minimumMove/velMag)); //move back slightly after moving
				} else {
					vec3.sub(pos, pos, vec3.scale(vec3.create(), pvel, dat.t)); //if we're already too close undo the movement.
				}
			*/
		}
		
	}
}