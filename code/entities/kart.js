//
// kart.js
//--------------------
// Entity type for karts.
// by RHY3756547
//
// includes: gl-matrix.js (glMatrix 2.0)
// /formats/kcl.js
//

window.Kart = function(pos, angle, speed, kartN, charN, controller, scene) {
	var k = this;
	var minimumMove = 0.05;
	var MAXSPEED = 24;
	var BOOSTTIME = 90;

	var kartSoundBase = 170;

	var COLBOUNCE_TIME = 20;
	var COLBOUNCE_STRENGTH = 1;

	var params = scene.gameRes.kartPhys.karts[kartN];
	var offsets = scene.gameRes.kartOff.karts[kartN];
	this.wheelClass = (offsets.name[10] == "L")?2:((offsets.name[10] == "M")?1:0);

	this.local = controller.local;
	this.active = true;
	this.preboost = true;

	this.soundProps = {};
	this.pos = pos;
	this.angle = angle;
	this.vel = vec3.create();
	this.weight = params.weight;
	this.params = params;
	this.kartBounce = kartBounce;

	this.speed = speed;
	this.drifting = false;
	this.driftMode = 0; //1 left, 2 right, 0 undecided
	this.driftLanded = false; //if we haven't landed then apply a constant turn.

	//powerslide info: to advance to the next mode you need to hold the same button for 10 or more frames. Mode 0 starts facing drift direction, 1 is other way, 2 is returning (mini spark), 3 is other way, 4 is returning (turbo spark)
	this.driftPSTick = 0;
	this.driftPSMode = 0;

	this.kartTargetNormal = [0, 1, 0];
	this.kartNormal = [0, 1, 0];
	this.airTime = 0;
	this.controller = controller;

	this.driftOff = 0;
	this.physicalDir = angle;
	this.mat = mat4.create();
	this.basis = mat4.create();
	this.ylock = 0;

	this.cannon = null;

	this.gravity = [0, -0.17, 0]; //100% confirmed by me messing around with the gravity value in mkds. for sticky surface and loop should modify to face plane until in air

	this.update = update;
	this.sndUpdate = sndUpdate;
	this.draw = draw;

	this.drawKart = drawKart;
	this.drawWheels = drawWheels;
	this.drawChar = drawChar;

	this.getPosition = getPosition;
	this.playCharacterSound = playCharacterSound;

	this.trackAttach = null; //a normal for the kart to attach to (loop)
	this.boostMT = 0;
	this.boostNorm = 0;

	this.kartColVel = vec3.create();
	this.kartColTimer = 0;
	this.kartWallTimer = 0;
	this.charSoundTimer = 0;

	this.placement = 0;
	this.lastPlacement = 0;

	var charRes = scene.gameRes.getChar(charN);
	var kartRes = scene.gameRes.getKart(kartN);
	var kartPolys = [];

	var kObj = kartRes.bmd.modelData.objectData[0];

	for (var i=0; i<kObj.polys.objectData.length; i++) {
		if (kObj.materials.names[kObj.polys.objectData[i].mat] != "kart_tire\0\0\0\0\0\0\0") kartPolys.push(i)
	}

	var tireRes = scene.gameRes.tireRes;

	this.anim = new nitroAnimator(charRes.model.bmd, charRes.driveA);
	this.charRes = charRes;
	this.animMode = "drive";
	this.driveAnimF = 14; //29 frames in total, 14 is mid
	this.animFrame = 0; //only used for non drive anim
	this.animMat = null;

	this.lastInput = null;

	//race statistics
	this.lapNumber = 1;
	this.passedKTP2 = false;
	this.checkPointNumber = 0;
	this.OOB = 0;

	this.wheelParticles = [
		new NitroEmitter(scene, k, -1, [1, 1.5, -1]),
		new NitroEmitter(scene, k, -1, [-1, 1.5, -1])
		];

	scene.particles.push(this.wheelParticles[0]);
	scene.particles.push(this.wheelParticles[1]);

	var nkm = scene.nkm;
	var startLine = nkm.sections["KTPS"].entries[0];
	var passLine = nkm.sections["KTP2"].entries[0];
	var checkpoints = nkm.sections["CPOI"].entries;
	var respawns = nkm.sections["KTPJ"].entries;
	var futureChecks = [1];

	var hitGroundAnim = [ //length 13, on y axis
		1.070,
		1.130,
		1.170,
		1.190,
		1.2,
		1.190,
		1.170,
		1.130,
		1.070,
		1,
		0.950,
		0.920,
		0.950,
	]

	var charGroundAnim = [ //length 13, on y axis
	 	1,
		1,
		1,
		1,
		1,
		1.080,
		1.140,
		1.180,
		1.140,
		1.060,
		0.970,
		0.960,
		0.980,
	]

	var lastCollided = -1;
	var lastBE = -1;
	var lastColSounds = {};
	var ylvel = 0;
	var wheelTurn = 0;
	var onGround;

	var kartAnim = 0;
	var groundAnim = -1;
	var stuckTo = null;

	var updateMat = true;

	var drawMat = {
		kart: mat4.create(),
		wheels: [mat4.create(), mat4.create(), mat4.create(), mat4.create()],
		character: mat4.create()
	}

	controller.setKart(k);

	var soundMode = -1;
	var sounds = { //sounds that can be simultaneous
		kart: null,
		drift: null,
		lastTerrain: -1,
		lastBE: -1,
		drive: null,
		boost: null,
		powerslide: null,
		boostSoundTrig: true, //true if a new boost sound can be played
		transpose: 0
	}
	updateKartSound(0, {turn:0});

	function recalcMat(view) {
		var mat = mat4.mul([], view, k.mat);
		var xscale = 1+Math.cos((kartAnim/4)*Math.PI)*0.015;
		var yscale = 1+Math.cos(((kartAnim+4)/4)*Math.PI)*0.015;

		if (groundAnim != -1) yscale *= hitGroundAnim[groundAnim];

		mat4.translate(mat, mat, [0, -params.colRadius, 0]); //main part
		var kmat = mat4.scale(drawMat.kart, mat, [16*xscale, 16*yscale, 16]);

		//wheels
		for (var i=0; i<4; i++) {
			var scale = 16*((i<2)?offsets.frontTireSize:1);
			var wmat = mat4.translate(drawMat.wheels[i], mat, [0, 0, 0]);

			if (groundAnim != -1) mat4.scale(wmat, wmat, [1, hitGroundAnim[groundAnim], 1]);

			mat4.translate(wmat, wmat, offsets.wheels[i]);
			mat4.scale(wmat, wmat, [scale, scale, scale]);
			if (i<2) mat4.rotateY(wmat, wmat, ((k.driveAnimF-14)/14)*Math.PI/6);
			mat4.rotateX(wmat, wmat, wheelTurn);

			if (i>1) {
				k.wheelParticles[i-2].offset = vec3.scale(k.wheelParticles[i-2].offset, vec3.add(k.wheelParticles[i-2].offset, offsets.wheels[i], [k.wheelClass*(i-2.5)*-2, (-params.colRadius)-k.wheelClass*2, 0]), 1/16);
			}
		}

		var scale = 16;
		var pos = vec3.clone(offsets.chars[charN]);

		if (groundAnim != -1) pos[1] *= charGroundAnim[groundAnim];

		var cmat = mat4.translate(drawMat.character, mat, vec3.scale([], pos, 16))
		mat4.scale(cmat, cmat, [scale, scale, scale]);

		if (k.animMode == "drive") k.animMat = k.anim.setFrame(0, 0, k.driveAnimF);
		else k.animMat = k.anim.setFrame(0, 0, k.animFrame++);

		updateMat = false;
	}

	function drawChar(view, pMatrix) {
		charRes.model.draw(drawMat.character, pMatrix, k.animMat);
	}

	function drawKart(view, pMatrix, gl) {
		if (updateMat) recalcMat(view);
		//if we're in simple shadows mode, draw the kart's stencil shadow.

		if (false) {
			//gl.enable(gl.CULL_FACE); //culling is fun!
			gl.clear(gl.STENCIL_BUFFER_BIT);
			//gl.cullFace(gl.FRONT);
			gl.colorMask(false, false, false, false);
			gl.depthMask(false);

			gl.enable(gl.STENCIL_TEST);
			gl.stencilMask(0xFF);
			gl.stencilFunc(gl.ALWAYS, 1, 0xFF);
			gl.stencilOp(gl.KEEP, gl.INCR, gl.KEEP);

			kartRes.shadVol.draw(drawMat.kart, pMatrix, simpleMatStack);

			gl.colorMask(true, true, true, true)
			//gl.cullFace(gl.BACK);
			gl.stencilFunc(gl.LESS	, 0, 0xFF);
			gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

			kartRes.shadVol.draw(drawMat.kart, pMatrix, simpleMatStack);
			gl.disable(gl.STENCIL_TEST);
			//gl.disable(gl.CULL_FACE);
			gl.depthMask(true);

		}

		for (var i=0; i<kartPolys.length; i++) {
			kartRes.drawPoly(drawMat.kart, pMatrix, 0, kartPolys[i], simpleMatStack);
		}
	}

	function drawWheels(view, pMatrix) {
		if (updateMat) recalcMat(view);
		var wheelMod = tireRes[offsets.name];
		for (var i=0; i<4; i++) {
			wheelMod.draw(drawMat.wheels[i], pMatrix, simpleMatStack);
		}
	}

	function draw(view, pMatrix) {
		drawWheels(view, pMatrix);
		drawKart(view, pMatrix);
		drawChar(view, pMatrix);
	}


	k.lWheelParticle = null;

	function update(scene) {
		if (k.placement != k.lastPlacement) {
			if (k.placement < k.lastPlacement) {
				if (k.charSoundTimer == 0) {
					playCharacterSound(5);
					k.charSoundTimer = 60;
				}
			}
			k.lastPlacement = k.placement;
		}

		var lastPos = vec3.clone(k.pos);
		updateMat = true;

		if (groundAnim != -1) {
			if (++groundAnim >= hitGroundAnim.length) groundAnim = -1;
		}

		onGround = (k.airTime < 5);

		kartAnim = (kartAnim+1)%8;
		var input = k.controller.fetchInput();
		k.lastInput = input;

		if (input.turn > 0.3) {
			if (k.driveAnimF < 28) k.driveAnimF++;
		} else if (input.turn < -0.3) {
			if (k.driveAnimF > 0) k.driveAnimF--;
		} else {
			if (k.driveAnimF > 14) k.driveAnimF--;
			else if (k.driveAnimF < 14) k.driveAnimF++;
		}

		//update sounds

		var newSoundMode = soundMode;
		if (input.accel) {
			if (soundMode == 0 || soundMode == 6) newSoundMode = 2;
			if (soundMode == 4) newSoundMode = 3;
		} else {
			if (soundMode != 0) {
				if (soundMode == 2 || soundMode == 3) newSoundMode = 4;
				if (newSoundMode == 4 && k.speed < 0.5) newSoundMode = 0;
			} 
		}

		if (k.boostMT+k.boostNorm > 0) {
			if (k.boostNorm == BOOSTTIME || k.boostMT == params.miniTurbo) {
				if (sounds.boostSoundTrig) {
					if (sounds.boost != null) nitroAudio.instaKill(sounds.boost);
					sounds.boost = nitroAudio.playSound(160, {}, 0, k);
					sounds.boost.gainN.gain.value = 2;
					sounds.boostSoundTrig = false;
				}
			} else {
				sounds.boostSoundTrig = true;
			}
		} else if (sounds.boost != null) {
			nitroAudio.kill(sounds.boost);
			sounds.boost = null;
		}

		var isMoving = onGround && k.speed > 0.5;
		if (isMoving) {
			if (lastCollided != sounds.lastTerrain || lastBE != sounds.lastBE || sounds.drive == null) {
				if (sounds.drive != null) nitroAudio.kill(sounds.drive);
				if (lastColSounds.drive != null) {
					sounds.drive = nitroAudio.playSound(lastColSounds.drive, {}, 0, k);
					sounds.drive.gainN.gain.value = 2;
				}
			}

			if (k.drifting && k.driftLanded) {
				if (lastCollided != sounds.lastTerrain || lastBE != sounds.lastBE || sounds.drift == null) {
					if (sounds.drift != null) nitroAudio.kill(sounds.drift);
					if (lastColSounds.drift != null) {
						sounds.drift = nitroAudio.playSound(lastColSounds.drift, {}, 0, k);
					}
				}
			} else if (sounds.drift != null) { nitroAudio.kill(sounds.drift); sounds.drift = null; }

			sounds.lastTerrain = lastCollided;
			sounds.lastBE = lastBE;
		} else {
			if (sounds.drift != null) { nitroAudio.kill(sounds.drift); sounds.drift = null; }
			if (sounds.drive != null) { nitroAudio.kill(sounds.drive); sounds.drive = null; }

		}
		k.wheelParticles[0].pause = !isMoving;
		k.wheelParticles[1].pause = !isMoving;

		//end sound update

		if (k.preboost) {

		} else if (k.cannon != null) { //when cannon is active, we fly forward at max move speed until we get to the cannon point.
			var c = scene.nkm.sections["KTPC"].entries[k.cannon];

			if (c.id2 != 0) {
				var c2 = scene.nkm.sections["KTPC"].entries[c.id2];
				c = c2;

				var mat = mat4.create();
				mat4.rotateY(mat, mat, c.angle[1]*(Math.PI/180));
				mat4.rotateX(mat, mat, c.angle[0]*(-Math.PI/180));

				k.pos = vec3.clone(c2.pos);
				vec3.add(k.pos, k.pos, vec3.transformMat4([], [0,16,16], mat));

				k.physicalDir = (180-c2.angle[1])*(Math.PI/180);
				k.angle = k.physicalDir;
				k.cannon = null;
			} else {

				var mat = mat4.create();
				mat4.rotateY(mat, mat, c.angle[1]*(Math.PI/180));
				mat4.rotateX(mat, mat, c.angle[0]*(-Math.PI/180));

				var forward = [0, 0, 1];
				var up = [0, 1, 0];

				k.vel = vec3.scale([], vec3.transformMat4(forward, forward, mat), MAXSPEED);
				k.speed = Math.min(k.speed+1, MAXSPEED);
				vec3.add(k.pos, k.pos, k.vel);
				k.physicalDir = (180-c.angle[1])*(Math.PI/180);
				k.angle = k.physicalDir;
				k.kartTargetNormal = vec3.transformMat4(up, up, mat);

				var planeConst = -vec3.dot(c.pos, forward);
				var cannonDist = vec3.dot(k.pos, forward) + planeConst;
				if (cannonDist > 0) k.cannon = null;
			}
		} else { //default kart mode

			if (k.OOB > 0) {
				playCharacterSound(0);
				var current = checkpoints[k.checkPointNumber];
				var respawn = respawns[current.respawn];
				k.physicalDir = (180-respawn.angle[1])*(Math.PI/180);
				k.angle = k.physicalDir;
				k.speed = 0;
				k.vel = vec3.create();
				k.pos = vec3.clone(respawn.pos);
				vec3.add(k.pos, k.pos, [0,16,0]);
				if (k.controller.setRouteID != null) k.controller.setRouteID(respawn.id1);
				k.OOB = 0;
			}
			var groundEffect = 0;
			if (lastCollided != -1) {
				groundEffect = MKDS_COLTYPE.PHYS_MAP[lastCollided];
				if (groundEffect == null) groundEffect = 0;
			}

			var effect = params.colParam[groundEffect];
			var top = params.topSpeed*effect.topSpeedMul; //if you let go of accel, drift ends anyway, so always accel in drift.

			var boosting = (k.boostNorm + k.boostMT)>0;

			if (boosting) {
				var top2
				if (k.boostNorm>0){
					top2 = params.topSpeed*1.3;
					k.boostNorm--;
				} else {
					top2 = params.topSpeed*((effect.topSpeedMul >= 1)?1.3:effect.topSpeedMul);
				}

				if (k.boostMT>0) {
					k.boostMT--;
				}

				if (k.speed <= top2) {
					k.speed += 1;
					if (k.speed > top2) k.speed = top2;
				} else {
					k.speed *= 0.95;
				}
			}

			//kart controls
			if (k.drifting) {
				if ((onGround) && !(input.accel && input.drift && (k.speed > 2 || !k.driftLanded))) {
					//end drift, execute miniturbo
					k.drifting = false;
					clearWheelParticles();
					if (sounds.powerslide != null) {
						nitroAudio.instaKill(sounds.powerslide);
						sounds.powerslide = null;
					}
					if (k.driftPSMode == 3) {
						k.boostMT = params.miniTurbo;
					}
					k.driftPSMode = 0;
					k.driftPSTick = 0;
				}

				if (k.driftMode == 0) {
					if (input.turn > 0.30) {
						k.driftMode = 2;
					} else if (input.turn < -0.30) {
						k.driftMode = 1;
					}
				} else {
					if (k.driftLanded) {
						var change = (((k.driftMode-1.5)*Math.PI/1.5)-k.driftOff)*0.05;
						k.driftOff += change;
						k.physicalDir -= change;
					}

					//if we're above the initial y position, add a constant turn with a period of 180 frames.
					if (!k.driftLanded && k.ylock>=0) {
						k.physicalDir += (Math.PI*2/180)*(k.driftMode*2-3);
					}
				}

				if (onGround) {
					if (!k.driftLanded) {
						if (k.driftMode == 0) {
							k.drifting = false;
							clearWheelParticles();
						}
						else {
							k.driftPSMode = 0;
							k.driftPSTick = 0;
							k.driftLanded = true;
							if (k.drifting) setWheelParticles(20, 1); //20 = smoke, 1 = drift priority
						}
					}
					if (k.drifting) {

						if (!boosting) {
							if (k.speed <= top) {
								k.speed += (k.speed/top > params.driftAccelSwitch)?params.driftAccel2:params.driftAccel1;
								if (k.speed > top) k.speed = top;
							} else {
								k.speed *= 0.95;
							}
						}

						var turn = ((k.driftMode == 1)?(input.turn-1):(input.turn+1))/2; 

						k.physicalDir += params.driftTurnRate*turn+((k.driftMode == 1)?-1:1)*(50/32768)*Math.PI; //what is this mystery number i hear you ask? well my friend, this is the turn rate for outward drift.

						//miniturbo code
						if (input.turn != 0) {
							var inward = ((input.turn>0) == k.driftMode-1); //if we're turning 

							switch (k.driftPSMode) {
								case 0: //dpad away from direction for 10 frames 
									if (!inward) k.driftPSTick++;
									else if (k.driftPSTick > 9) {
										k.driftPSMode++;
										k.driftPSTick = 1;

										//play blue spark sound, flare
										setWheelParticles(126, 2); //126 = blue flare, 2 = flare priority
										var blue = nitroAudio.playSound(210, {}, 0, k);
										blue.gainN.gain.value = 2;

									} else k.driftPSTick = 0;
									break;
								case 1: //dpad toward direction for 10 frames 
									if (inward) k.driftPSTick++;
									else if (k.driftPSTick > 9) {
										k.driftPSMode++;
										k.driftPSTick = 1;

									} else k.driftPSTick = 0;
									break;
								case 2: //dpad away from direction for 10 frames 
									if (!inward) k.driftPSTick++;
									else if (k.driftPSTick > 9) {
										k.driftPSMode++;
										k.driftPSTick = 1;
										//play red sparks sound, full MT!
										setWheelParticles(22, 2); //22 = red flare, 2 = flare priority
										setWheelParticles(17, 1); //17 = red mt, 1 = drift priority
										sounds.powerslide = nitroAudio.playSound(209, {}, 0, k);
										sounds.powerslide.gainN.gain.value = 2;
									} else k.driftPSTick = 0;
									break;
								case 3: //turbo charged
									break;
							}
						}
					}
				}
			}

			if (!k.drifting) {
				if (onGround) {
					var effect = params.colParam[groundEffect];
					if (!boosting) {
						if (input.accel) {
							if (k.speed <= top) {
								k.speed += (k.speed/top > params.accelSwitch)?params.accel2:params.accel1;
								if (k.speed > top) k.speed = top;
							} else {
								k.speed *= 0.95;
							}
						} else {
							k.speed *= params.decel;
						}
					}

					if ((input.accel && k.speed >= 0) || (k.speed > 0.1)) {
						k.physicalDir += params.turnRate*input.turn;
					} else if (	k.speed < -0.1) {
						k.physicalDir -= params.turnRate*input.turn;
					}

					if (input.drift) {
						ylvel = 1.25;
						k.vel[1] += 1.25;
						k.airTime = 4;
						k.drifting = true;
						k.driftLanded = false;
						k.driftMode = 0;
						k.ylock = 0;

						var boing = nitroAudio.playSound(207, {transpose: -4}, 0, k);
						boing.gainN.gain.value = 2;
					}
				} else {
					if (input.drift) {
						ylvel = 0;
						k.drifting = true;
						k.driftLanded = false;
						k.driftMode = 0;
						k.ylock = -0.001;
					}
				}
			}

			k.physicalDir = fixDir(k.physicalDir);

			if (k.driftOff != 0 && (!k.drifting || !k.driftLanded)) {
				if (k.driftOff > 0) {
					k.physicalDir += params.driftOffRestore;
					k.driftOff -= params.driftOffRestore;
					if (k.driftOff < 0) k.driftOff = 0;
				} else {
					k.physicalDir -= params.driftOffRestore;
					k.driftOff += params.driftOffRestore;
					if (k.driftOff > 0) k.driftOff = 0;
				} 
			}

			checkKartCollision(scene);

			if (!onGround) {
				this.kartTargetNormal = [0, 1, 0];
				if (k.physBasis != null) vec3.transformMat4(this.kartTargetNormal,this.kartTargetNormal,k.physBasis.mat);
				vec3.add(k.vel, k.vel, k.gravity)
				if (k.ylock >= 0) {
					ylvel += k.gravity[1];
					k.ylock += ylvel;
				}

				if (k.kartColTimer == COLBOUNCE_TIME) {
					vec3.add(k.vel, k.vel, k.kartColVel);
				}
			} else {
				k.angle += dirDiff(k.physicalDir, k.angle)*effect.handling/2;
				k.angle = fixDir(k.physicalDir);

				k.vel[1] += k.gravity[1];
				k.vel = [Math.sin(k.angle)*k.speed, k.vel[1], -Math.cos(k.angle)*k.speed]

				if (k.kartColTimer > 0) {
					vec3.add(k.vel, k.vel, vec3.scale([], k.kartColVel, k.kartColTimer/10))
				}
			}

			if (k.kartColTimer > 0) k.kartColTimer--;
			if (k.kartWallTimer > 0) k.kartWallTimer--;
			if (k.charSoundTimer > 0) k.charSoundTimer--;

			wheelTurn += k.speed/16;
			wheelTurn = fixDir(wheelTurn);
			k.airTime++;
			//end kart controls

			//move kart on moving platforms (no collision, will be corrected by next step)
			if (stuckTo != null) {
				if (stuckTo.moveWith != null) stuckTo.moveWith(k);
				stuckTo = null;
			}

			//move kart. 



			var steps = 0;
			var remainingT = 1;
			var baseVel = k.vel;
			if (k.physBasis != null) {
				if (k.physBasis.time-- < 0) exitBasis();
				else {
					baseVel = vec3.transformMat4([], baseVel, k.physBasis.mat);
					k.vel[1] = -1;
				}
			}
			var velSeg = vec3.clone(baseVel);
			var posSeg = vec3.clone(k.pos);
			var ignoreList = [];
			while (steps++ < 10 && remainingT > 0.01) {
				var result = lsc.sweepEllipse(posSeg, velSeg, scene, [params.colRadius, params.colRadius, params.colRadius], ignoreList);
				if (result != null) {
					colResponse(posSeg, velSeg, result, ignoreList)
					remainingT -= result.t;
					if (remainingT > 0.01) {
						if (k.physBasis != null) {
							baseVel = vec3.transformMat4([], k.vel, k.physBasis.mat);
						}
						velSeg = vec3.scale(vec3.create(), baseVel, remainingT);
					}
				} else {
					vec3.add(posSeg, posSeg, velSeg);
					remainingT = 0;
				}
			}
			k.pos = posSeg;
		}

		//interpolate visual normal roughly to target
		var rate = onGround?0.15:0.025;
		k.kartNormal[0] += (k.kartTargetNormal[0]-k.kartNormal[0])*rate;
		k.kartNormal[1] += (k.kartTargetNormal[1]-k.kartNormal[1])*rate;
		k.kartNormal[2] += (k.kartTargetNormal[2]-k.kartNormal[2])*rate;
		vec3.normalize(k.kartNormal, k.kartNormal);

		k.basis = buildBasis();

		var mat = mat4.create();
		mat4.translate(mat, mat, k.pos);
		k.mat = mat4.mul(mat, mat, k.basis);

		if (input.item) {
			scene.items.addItem(0, scene.karts.indexOf(k), {})
		}

		updateKartSound(newSoundMode, input);
		positionChanged(lastPos, k.pos);
	}

	function playCharacterSound(sound, volume) {
		//0 - hit
		//1 - hit spin
		//2 - hit ?? hit grnd
		//3 - hit banana? race start?
		//4 - hit spin?
		//5 - good pass?
		//6 - good OK!
		//7 - use item
		//8 - hit someone?
		//9 = win
		//10 = alright
		//11 = bad
		//12 = good record
		//13 = bad record
		if (volume == null) volume = 1;
		nitroAudio.playSound(sound + charRes.sndOff, {volume: 2*volume}, 2, k);
	}

	function clearWheelParticles(prio) {
		for (var i=0; i<2; i++) {
			if (prio == null) {
				//clear all specials
				k.wheelParticles[i].clearEmitter(1); //drift mode
				//k.wheelParticles[i].clearEmitter(2); //drift flare (blue mt, red big flash)
			} else {
				k.wheelParticles[i].clearEmitter(0);
			}
		}
	}

	function setWheelParticles(id, prio) {
		for (var i=0; i<2; i++) {
			k.wheelParticles[i].setEmitter(id, prio);
		}
	}

	function genFutureChecks() {
		//all future points that 
		var chosen = {}
		var current = checkpoints[k.checkPointNumber];
		var expectedSection = current.nextSection;
		futureChecks = [];
		for (var i=k.checkPointNumber+1; i<checkpoints.length; i++) {
			var check = checkpoints[i];
			if (expectedSection != -1 && check.currentSection != expectedSection) continue;

			if (chosen[check.currentSection] != true) {
				futureChecks.push(i);
				chosen[check.currentSection] = true;
			}
		}
	}

	function positionChanged(oldPos, pos) {
		//crossed into new checkpoint?
		if (checkpoints.length == 0) return;
		for (var i=0; i<futureChecks.length; i++) {
			var check = checkpoints[futureChecks[i]];
			var distOld = vec2.sub([], [check.x1, check.z1], [oldPos[0], oldPos[2]]);
			var dist = vec2.sub([], [check.x1, check.z1], [pos[0], pos[2]]);
			var dot = vec2.dot(dist, [check.sinus, check.cosinus]);
			var dotOld = vec2.dot(distOld, [check.sinus, check.cosinus]);

			var lineCheck = vec2.sub([], [check.x1, check.z1], [check.x2, check.z2]);
			var lineDot = vec2.dot(dist, lineCheck);

			if (lineDot > 0 && lineDot < vec2.sqrLen(lineCheck) && dot < 0 && dotOld >= 0) {
				k.checkPointNumber = futureChecks[i];
				genFutureChecks();
				break;
			}
		}

		if (!k.passedKTP2 && forwardCrossedKTP(passLine, oldPos, pos)) k.passedKTP2 = true;
		if (k.passedKTP2 && futureChecks.length == 0) {
			//we can finish the lap
			if (forwardCrossedKTP(startLine, oldPos, pos)) {
				k.lapNumber++;
				k.checkPointNumber = 0;
				k.passedKTP2 = 0;
				futureChecks = [1];
				scene.lapAdvance(k);
			}
		}
	}

	function getPosition() {
		if (futureChecks.length == 0) return 0;
		var check = checkpoints[futureChecks[0]];
		var dist = vec2.sub([], [check.x1, check.z1], [k.pos[0], k.pos[2]]);
		var dot = vec2.dot(dist, [check.sinus, check.cosinus]);

		return k.checkPointNumber + (1-(Math.abs(dot)/(0xFFFF))) + k.lapNumber*checkpoints.length;
	}

	function forwardCrossedKTP(ktp, oldPos, pos) {
		var distOld = vec2.sub([], [ktp.pos[0], ktp.pos[2]], [oldPos[0], oldPos[2]]);
		var dist = vec2.sub([], [ktp.pos[0], ktp.pos[2]], [pos[0], pos[2]]);

		var ang = (ktp.angle[1]/180)*Math.PI;

		var sinus = Math.sin(ang);
		var cosinus = Math.cos(ang);

		var dot = vec2.dot(dist, [sinus, cosinus]);
		var dotOld = vec2.dot(distOld, [sinus, cosinus]);

		return (dot < 0 && dotOld >= 0);
	}

	function checkKartCollision(scene) { //check collision with other karts. Really simple.
		for (var i=0; i<scene.karts.length; i++) {
			var ok = scene.karts[i];
			if (!ok.active) continue;
			if (k != ok) {
				var dist = vec3.dist(k.pos, ok.pos);
				if (dist < 16) {

					kartBounce(ok);
					ok.kartBounce(k);
				}
			}
		}

	}

	function kartBounce(ok) {
		k.kartColTimer = COLBOUNCE_TIME;
		var weightMul = COLBOUNCE_STRENGTH*(1+(ok.weight-k.weight))*((ok.boostNorm>0 || ok.boostMT>0)?2:1)*((k.boostNorm>0 || k.boostMT>0)?0.5:1);

		//as well as side bounce also add velocity difference if other vel > mine.

		vec3.sub(k.kartColVel, k.pos, ok.pos);
		k.kartColVel[1] = 0;
		vec3.normalize(k.kartColVel, k.kartColVel);
		vec3.scale(k.kartColVel, k.kartColVel, weightMul);

		if (vec3.length(k.vel) < vec3.length(ok.vel)) vec3.add(k.kartColVel, k.kartColVel, vec3.sub([], ok.vel, k.vel));

		k.kartColVel[1] = 0;
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

	function updateKartSound(mode, input) {
		var turn = (onGround && !k.drifting)?(1-Math.abs(input.turn)/11):1;
		var transpose = (mode == 0)?0:(22*turn*k.speed/params.topSpeed);

		sounds.transpose += (transpose-sounds.transpose)/15;
		if (mode != soundMode) {
			soundMode = mode;
			if (sounds.kart != null) nitroAudio.instaKill(sounds.kart);
			sounds.kart = nitroAudio.playSound(kartSoundBase+soundMode, {transpose:sounds.transpose, volume:1}, 0, k);
			//if (mode == 3) sounds.kart.gainN.gain.value = 0.5;
		} else {
			sounds.kart.seq.setTranspose(sounds.transpose);
		}
	}

	function buildBasis() {
		//order y, x, z
		var dir = k.physicalDir+k.driftOff+(Math.sin((COLBOUNCE_TIME-k.kartColTimer)/3)*(Math.PI/6)*(k.kartColTimer/COLBOUNCE_TIME));
		var forward = [Math.sin(dir), 0, -Math.cos(dir)];
		var side = [Math.cos(dir), 0, Math.sin(dir)];
		if (k.physBasis != null) {
			vec3.transformMat4(forward, forward, k.physBasis.mat);
			vec3.transformMat4(side, side, k.physBasis.mat);
		}
		var basis = gramShmidt(k.kartNormal, side, forward);
		var temp = basis[0];
		basis[0] = basis[1];
		basis[1] = temp; //todo: cleanup
		return [
			basis[0][0], basis[0][1], basis[0][2], 0,
			basis[1][0], basis[1][1], basis[1][2], 0,
			basis[2][0], basis[2][1], basis[2][2], 0,
			0, 0, 0, 1			
		]

	}

	function enterBasis(normal) {
		//establish a new basis for the kart velocity based on this normal.
		//used by looping and sticky track surface types.

		//first let's get the forward direction in our current basis

		var dir = k.angle;
		var forward, side;
		if (k.physBasis != null) {
			forward = vec3.transformMat4([], [-	Math.sin(dir), 0, Math.cos(dir)], k.physBasis.mat);
			side = vec3.transformMat4([], [Math.cos(dir), 0, Math.sin(dir)], k.physBasis.mat);
		} else {
			forward = [-Math.sin(dir), 0, Math.cos(dir)];
			side = [Math.cos(dir), 0, Math.sin(dir)];
		}
		
		var basis = gramShmidt(normal, side, forward);
		var temp = basis[0];
		basis[0] = basis[1];
		basis[1] = temp; //todo: cleanup
		var m4 = [
			basis[0][0], basis[0][1], basis[0][2], 0,
			basis[1][0], basis[1][1], basis[1][2], 0,
			basis[2][0], basis[2][1], basis[2][2], 0,
			0, 0, 0, 1			
		];

		k.physicalDir = dirDiff(k.physicalDir, k.angle);
		k.angle = 0; //our front direction is now aligned with z.
		k.vel = [Math.sin(k.angle)*k.speed, k.vel[1], -Math.cos(k.angle)*k.speed];

		k.physBasis = {
			mat: m4,
			inv: mat4.invert([], m4),
			time: 15,
			loop: false
		};
	}

	function exitBasis() {
		//return to a normal y up, z forward basis.

		var v = vec3.transformMat4([], k.vel, k.physBasis.mat);
		k.physicalDir = dirDiff(k.physicalDir, k.angle);
		k.angle = Math.atan2(v[0], -v[2]);
		k.physicalDir += k.angle;
		k.vel = v;
		k.physBasis = null;
	}

	function sndUpdate(view) {
		k.soundProps.pos = vec3.transformMat4([], k.pos, view);
		if (k.soundProps.lastPos != null) k.soundProps.vel = vec3.sub([], k.soundProps.pos, k.soundProps.lastPos);
		else k.soundProps.vel = [0, 0, 0];
		k.soundProps.lastPos = k.soundProps.pos;

		k.soundProps.refDistance = 192/1024;
		k.soundProps.rolloffFactor = 1;

		var calcVol = (k.soundProps.refDistance / (k.soundProps.refDistance + k.soundProps.rolloffFactor * (Math.sqrt(vec3.dot(k.soundProps.pos, k.soundProps.pos)) - k.soundProps.refDistance)));
	}

	function gramShmidt(v1, v2, v3) {
		var u1 = v1;
		var u2 = vec3.sub([0, 0, 0], v2, project(u1, v2));
		var u3 = vec3.sub([0, 0, 0], vec3.sub([0, 0, 0], v3, project(u1, v3)), project(u2, v3));
		return [vec3.normalize(u1, u1), vec3.normalize(u2, u2), vec3.normalize(u3, u3)]
	}

	function colSound(collision, effect) {
		if (MKDS_COLTYPE.SOUNDMAP[collision] == null) return {};
		return MKDS_COLTYPE.SOUNDMAP[collision][effect] || {};
	}

	function colParticle(collision, effect) {
		if (MKDS_COLTYPE.SOUNDMAP[collision] == null) return null
		return MKDS_COLTYPE.SOUNDMAP[collision][effect].particle || null;
	}

	function project(u, v) {
		return vec3.scale([], u, (vec3.dot(u, v)/vec3.dot(u, u)))
	}

	function colResponse(pos, pvel, dat, ignoreList) {

		var plane = dat.plane;
		var colType = (plane.CollisionType>>8)&31;
		var colBE = (plane.CollisionType>>5)&7;

		var change = (colType != lastCollided);
		lastCollided = colType;
		lastBE = colBE;
		lastColSounds = colSound(lastCollided, colBE);

		var n = vec3.normalize([], dat.normal);
		var an = n;
		if (k.physBasis != null) {
			an = vec3.transformMat4([], n, k.physBasis.inv);
		}
		var gravS = Math.sqrt(vec3.dot(k.gravity, k.gravity));
		var angle = Math.acos(vec3.dot(vec3.scale(vec3.create(), k.gravity, -1/gravS), n));
		var adjustPos = true;

		if (colType == MKDS_COLTYPE.OOB || colType == MKDS_COLTYPE.FALL) {
			k.OOB = 1;
		}

		if (MKDS_COLTYPE.GROUP_WALL.indexOf(colType) != -1) { //wall
			//sliding plane, except normal is transformed to be entirely on the xz plane (cannot ride on top of wall, treated as vertical)
			var xz = Math.sqrt(an[0]*an[0]+an[2]*an[2])
			var adjN = [an[0]/xz, 0, an[2]/xz]
			var proj = vec3.dot(k.vel, adjN);

			if (proj < -1) { 
				if (k.kartWallTimer == 0) {
					if (lastColSounds.hit != null) nitroAudio.playSound(lastColSounds.hit, {volume:1}, 0, k) 
					var colObj = {pos:pos, vel:[0,0,0], mat: mat4.fromTranslation([], pos)};
					scene.particles.push(new NitroEmitter(scene, colObj, 13));
					scene.particles.push(new NitroEmitter(scene, colObj, 14));
				}
				k.kartWallTimer = 15;
			}
			vec3.sub(k.vel, k.vel, vec3.scale(vec3.create(), adjN, proj)); 
			

			//convert back to angle + speed to keep change to kart vel

			var v = k.vel;
			k.speed = Math.sqrt(v[0]*v[0]+v[2]*v[2]);
			k.angle = Math.atan2(v[0], -v[2]);
		} else if (MKDS_COLTYPE.GROUP_ROAD.indexOf(colType) != -1) {
			//sliding plane
			if (MKDS_COLTYPE.GROUP_BOOST.indexOf(colType) != -1) {
				k.boostNorm = BOOSTTIME;
			}

			var stick = (colType == MKDS_COLTYPE.STICKY || colType == MKDS_COLTYPE.LOOP); 

			if (k.vel[1] > 0) k.vel[1] = 0;
			var proj = vec3.dot(k.vel, an);
			if (!stick && proj < -4 && k.vel[1] < -2) { proj -= 1.5; }
			vec3.sub(k.vel, k.vel, vec3.scale(vec3.create(), an, proj));

			if (stick) {
				enterBasis(dat.pNormal);
				k.physBasis.loop = colType == MKDS_COLTYPE.LOOP;
			} else {
				if (k.physBasis != null)
					exitBasis();
			}

			k.kartTargetNormal = dat.pNormal;

			if (change) {
				var particle = colParticle(lastCollided, colBE);
				if (particle == null)
					clearWheelParticles(0);
				else
					setWheelParticles(particle, 0);
			}
			if (!onGround && !stick) {
				groundAnim = 0;
				if (lastColSounds.land != null) nitroAudio.playSound(lastColSounds.land, {volume:1}, 0, k)
			}
			k.airTime = 0;
			stuckTo = dat.object;
		} else if (colType == MKDS_COLTYPE.CANNON) {
			//cannon!!
			k.cannon = colBE;
		} else {
			adjustPos = false;
			ignoreList.push(plane);
		}

		//vec3.add(pos, pos, vec3.scale(vec3.create(), n, minimumMove)); //move away from plane slightly

		if (adjustPos) { //move back from plane slightly
			//vec3.add(pos, pos, vec3.scale(vec3.create(), n, minimumMove));
			vec3.add(pos, pos, vec3.scale(vec3.create(), pvel, dat.t));
			vec3.add(pos, vec3.scale([], n, params.colRadius+minimumMove), dat.colPoint);
			/*if (dat.embedded) {
				
			} else {
				var velMag = Math.sqrt(vec3.dot(pvel, pvel));
				if (velMag*dat.t > minimumMove) {
					vec3.add(pos, pos, vec3.scale(vec3.create(), pvel, dat.t-(minimumMove/velMag)));
				} else {
					//do not move, too close
				}
			}*/
		} else {
			vec3.add(pos, pos, vec3.scale(vec3.create(), pvel, dat.t));
		}
		
	}
}