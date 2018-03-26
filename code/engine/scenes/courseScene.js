//
// courseScene.js
//--------------------
// Manages the ingame state of a course.
// by RHY3756547
//
// includes: narc.js
// formats/*
// engine/*
// entities/*
// gl-matrix.js
// render/*
//

window.courseScene = function(mainNarc, texNarc, music, chars, options, gameRes) {

	var startSetups = [
		{maxplayers:12, toAline:4, xspacing:32, yspacing:32, liney:160},
		{maxplayers:24, toAline:4, xspacing:32, yspacing:32, liney:80},
		{maxplayers:36, toAline:6, xspacing:21, yspacing:21, liney:80},
		{maxplayers:48, toAline:6, xspacing:21, yspacing:21, liney:54},
		{maxplayers:64, toAline:8, xspacing:16, yspacing:16, liney:54},
		{maxplayers:112, toAline:8, xspacing:16, yspacing:16, liney:32},
	]

	var scn = this;

	scn.sndUpdate = sndUpdate;
	scn.update = update;
	scn.draw = draw;
	scn.removeParticle = removeParticle;
	scn.removeEntity = removeEntity;
	scn.updateMode = updateMode;
	scn.lapAdvance = lapAdvance;

	scn.fileBank = {};
	var loadFunc = {
		$nsbmd: nsbmd,
		$nsbtx: nsbtx,
		$nsbca: nsbca,
		$nsbta: nsbta,
		$nsbtp: nsbtp,
	}
	scn.typeRes = [];
	scn.gameRes = gameRes;
	scn.lightMat = [];
	scn.farShadMat = [];
	scn.shadMat = [];

	//game mode initialization
	scn.mode = { mode: -1, time: 0 };
	var musicRestartTimer = -1;
	var musicRestart = 3.5*60;
	var musicRestartType = 0;
	var finishers = [];

	//load main course
	var courseTx = new nsbtx(texNarc.getFile("/course_model.nsbtx"), false, true);
	var taFile = mainNarc.getFile("/course_model.nsbta");
	if (taFile != null) var courseTa = new nsbta(taFile); //can be null
	var courseMdl = new nsbmd(mainNarc.getFile("/course_model.nsbmd"));

	var course = new nitroModel(courseMdl, courseTx)
	if (taFile != null) course.loadTexAnim(courseTa);

	//load sky
	var skyTx = new nsbtx(texNarc.getFile("/course_model_V.nsbtx"), false, true);
	var staFile = mainNarc.getFile("/course_model_V.nsbta");
	if (staFile != null) var skyTa = new nsbta(staFile); //can be null
	console.log("--------- LOADING SKY ---------")
	var skyMdl = new nsbmd(mainNarc.getFile("/course_model_V.nsbmd"));

	var sky = new nitroModel(skyMdl, skyTx)
	if (staFile != null) sky.loadTexAnim(skyTa);

	ckcl = new kcl(mainNarc.getFile("/course_collision.kcl"), false);
	cnkm = new nkm(mainNarc.getFile("/course_map.nkm"));

	scn.course = course;
	scn.sky = sky;
	scn.kcl = ckcl;
	scn.nkm = cnkm;
	scn.entities = []; //these should never change
	scn.karts = []; //these should probably not change
	scn.items = new ItemController(scn); //these should change a lot!!
	scn.particles = []; //not synced with server at all

	scn.colEnt = [];

	scn.musicPlayer = null;

	startCourse(chars);

	var frame = 0;
	var entsToRemove = [];

	function draw(gl, pMatrix, shadow) {
		gl.cullFace(gl.BACK);

		/*var mat = scn.camera.getView(scn);

		var pMatrix = mat.p;
		var mvMatrix = mat.mv;*/
		var mvMatrix = mat4.create();
		nitroRender.setAlpha(1);

		if (!shadow) {
			var skyMat = mat4.scale(mat4.create(), mvMatrix, [1/64, 1/64, 1/64]);
			sky.setFrame(frame);
			sky.draw(skyMat, pMatrix);
		}

		var lvlMat = mat4.scale(mat4.create(), mvMatrix, [1/64, 1/64, 1/64]);//[2, 2, 2]);
		course.setFrame(frame);
		course.draw(lvlMat, pMatrix);	

		var transE = [];

		mat4.scale(mvMatrix, mvMatrix, [1/1024, 1/1024, 1/1024])

		//"so why are these separated rhys??"
		//
		//fantastic i'm glad you asked
		//if we draw lots of the same model, not animated in a row we don't need to resend the matStack for that model
		//which saves a lot of time for the 2 extra model types per car.

		for (var i=0; i<scn.karts.length; i++) if (scn.karts[i].active) scn.karts[i].drawKart(mvMatrix, pMatrix, gl);
		for (var i=0; i<scn.karts.length; i++) if (scn.karts[i].active) scn.karts[i].drawWheels(mvMatrix, pMatrix, gl);
		for (var i=0; i<scn.karts.length; i++) if (scn.karts[i].active) scn.karts[i].drawChar(mvMatrix, pMatrix, gl);

		for (var i=0; i<scn.entities.length; i++) {
			var e = scn.entities[i];
			if (e.transparent) transE.push(e);
			else e.draw(mvMatrix, pMatrix, gl);
		}

		for (var i=0; i<scn.particles.length; i++) {
			var e = scn.particles[i];
			e.draw(mvMatrix, pMatrix, gl);
		}

		scn.items.draw(mvMatrix, pMatrix, gl);

	}

	function sndUpdate(view) {
		var mulmat = mat4.create();
		mat4.scale(mulmat, mulmat, [1/1024, 1/1024, 1/1024]);
		var view = mat4.mul([], view, mulmat)

		for (var i=0; i<scn.karts.length; i++) {
			var e = scn.karts[i];
			if (e.sndUpdate != null) e.sndUpdate(view);
		}

		for (var i=0; i<scn.entities.length; i++) {
			var e = scn.entities[i];
			if (e.sndUpdate != null) e.sndUpdate(view);
		}
	}

	function update() {
		var shadres = 0.25;
		var targ = vec3.transformMat4([], scn.camera.targetShadowPos, scn.lightMat);
		vec3.scale(targ, targ, 1/1024);
		mat4.mul(scn.shadMat, mat4.ortho(mat4.create(), targ[0]-shadres, targ[0]+shadres, targ[1]-shadres, targ[1]+shadres, -targ[2]-2.5, -targ[2]+2.5), scn.lightMat);

		var places = [];
		for (var i=0; i<scn.karts.length; i++) { places.push(scn.karts[i]); }
		places.sort(function(a, b) {return b.getPosition() - a.getPosition()});
		for (var i=0; i<places.length; i++) { places[i].placement = i+1; };

		for (var i=0; i<scn.karts.length; i++) {
			var ent = scn.karts[i];
			if (ent.active) ent.update(scn);
		}

		var entC = scn.entities.slice(0);
		for (var i=0; i<entC.length; i++) {
			var ent = entC[i];
			ent.update(scn);
		}

		var prtC = scn.particles.slice(0);
		for (var i=0; i<prtC.length; i++) {
			var ent = prtC[i];
			ent.update(scn);
		}

		scn.items.update(scn);

		if (musicRestartTimer > -1) {
			musicRestartTimer++;
			if (musicRestartTimer > musicRestart) {
				scn.musicPlayer = nitroAudio.playSound(music, {volume:2, bpmMultiplier:(musicRestartType==0)?1.25:1}, null);
				musicRestartTimer = -1;
			}
		}

		for (var i=0; i<entsToRemove.length; i++) {
			scn.entities.splice(scn.entities.indexOf(entsToRemove[i]), 1);
		}
		entsToRemove = [];
		var mat = scn.camera.getView(scn, nitroRender.getViewWidth(), nitroRender.getViewHeight());
		frame++;
	}

	function removeParticle(obj) {
		scn.particles.splice(scn.particles.indexOf(obj), 1);
	}

	function removeEntity(obj) {
		entsToRemove.push(obj);
	}

	function compilePaths() {
		var path = scn.nkm.sections["PATH"].entries;
		var pts = scn.nkm.sections["POIT"].entries;

		var paths = [];
		var ind = 0;
		for (var i=0; i<path.length; i++) {
			var p = [];
			for (var j=0; j<path[i].numPts; j++) {
				p.push(pts[ind++]);
			}
			paths.push(p);
		} 
		scn.paths = paths;
	}

	function startCourse() {
		scn.lightMat = mat4.create();
		mat4.rotateX(scn.lightMat, scn.lightMat, Math.PI*(61/180));
		mat4.rotateY(scn.lightMat, scn.lightMat, Math.PI*(21/180));

		mat4.mul(scn.farShadMat, mat4.ortho(mat4.create(), -5, 5, -5, 5, -5, 5), scn.lightMat);

		compilePaths();

		//chars format: {charN: int, kartN: int, controller: function, raceCam: bool, controlOptions: object}

		var startSet = null;
		for (var i=0; i<startSetups.length; i++) {
			if (chars.length < startSetups[i].maxplayers) {
				startSet = startSetups[i];
				break;
			}
		}

		var startpos = scn.nkm.sections["KTPS"].entries[0];

		for (var i=0; i<chars.length; i++) {
			var c = chars[i];
			var kart = new Kart(vec3.add([], startpos.pos, startPosition(startSet.toAline, startSet.xspacing, startSet.yspacing, startSet.liney, startpos.angle[1], i)), (180-startpos.angle[1])*(Math.PI/180), 0, c.kartN, c.charN, new c.controller(scn.nkm, c.controlOptions), scn);
			scn.karts.push(kart);
			var spectator = false; //(prompt("Type y for spectator cam")=="y")
			if (c.raceCam) scn.camera = (spectator?(new cameraSpectator(kart, scn)):(new cameraIngame(kart, scn)));
		}

		var obj = scn.nkm.sections["OBJI"].entries;
		for (var i=0; i<obj.length; i++) {
			var o = obj[i];
			var func = objDatabase.idToType[o.ID];
			if (func != null) {
				var ent = new func(o, scn);

				if (scn.typeRes[o.ID] == null) loadRes(ent.requireRes(), o.ID)
				else ent.requireRes(); //some objects use this for determining their function.

				ent.provideRes(scn.typeRes[o.ID]);
				scn.entities.push(ent);
				if (ent.collidable) scn.colEnt.push(ent);
			}
		}
	}

	function loadOrGet(res) {
		var ext = res.split(".").pop();
		if (scn.fileBank["$"+ext] == null) scn.fileBank["$"+ext] = {};
		var item = scn.fileBank["$"+ext]["$"+res];
		if (item != null) return item;

		var func = loadFunc["$"+ext];
		if (func != null) {
			var test = mainNarc.getFile(res);
			if (test == null) test = gameRes.MapObj.getFile(res.split("/").pop())
			if (test == null) throw "COULD NOT FIND RESOURCE "+res+"!";
			if (res == "/MapObj/itembox.nsbmd") throwWhatever = true;
			var item = new func(test);
			scn.fileBank["$"+ext]["$"+res] = item;
			return item;		
		}
	}

	// the thresholds for different win sounds and music
	// thresh, goalsound, goalmusic, goalpostmusic
	var finishPercents = [
		[0, 66, 46, 58, 9],
		[0.5, 66, 47, 56, 10],
		[1.1, 67, 48, 57, 11]
	]

	function lapAdvance(kart) {
		//if the kart is us, play some sounds and show lakitu
		var winPercent = finishers.length/scn.karts.length;
		if (kart.local) {
			if (kart.lapNumber == 3) {
				//last lap
				musicRestartTimer = 0;
				nitroAudio.instaKill(scn.musicPlayer);
				scn.musicPlayer = nitroAudio.playSound(62, {volume:2}, null);
			}
			else if (kart.lapNumber == 4) {
				var finishTuple = [];
				for (var i=0; i<finishPercents.length; i++) {
					finishTuple = finishPercents[i];
					if (finishPercents[i][0] >= winPercent) break;
				}

				kart.controller = new controlRaceCPU(scn.nkm, {});
				kart.controller.setKart(kart);

				kart.anim.setAnim(winPercent>0.5?kart.charRes.loseA:kart.charRes.winA);
				kart.animMode = "raceEnd";

				scn.camera = (new cameraSpectator(kart, scn));
				nitroAudio.playSound(finishTuple[1], {volume:2}, 0);
				nitroAudio.playSound(finishTuple[2], {volume:2}, null);
				nitroAudio.instaKill(scn.musicPlayer);
				kart.playCharacterSound(finishTuple[4], 2);
				musicRestartTimer = 0;
				musicRestart = 7.5*60;
				musicRestartType = 1;
				music = finishTuple[3];
				scn.entities.push(new Race3DUI(scn, "goal"));
			}
			else if (kart.lapNumber < 4) nitroAudio.playSound(65, {volume:2}, 0);
		}

		if (kart.lapNumber == 4) finishers.push(kart);
	}

	function startPosition(toAline, xspacing, yspacing, liney, angle, i) {
		var horizN = i%toAline;
		var vertN = Math.floor(i/toAline);
		var staggered = (vertN%2); //second line moves 1/2 x spacing to the right
		var relPos = [(horizN-(toAline/2)-0.25)*xspacing+staggered*0.5, 8, -(horizN*yspacing + vertN*liney)];
		var mat = mat4.rotateY([], mat4.create(), angle*(Math.PI/180));
		vec3.transformMat4(relPos, relPos, mat);
		return relPos;
	}

	function loadRes(res, id) {
		var models = [];

		for (var i=0; i<res.mdl.length; i++) {
			var inf = res.mdl[i];
			var bmd = loadOrGet("/MapObj/"+inf.nsbmd);
			var btx = (inf.nsbtx == null)?null:loadOrGet("/MapObj/"+inf.nsbtx);

			var mdl = new nitroModel(bmd, btx);

			models.push(mdl);
		}

		var other = [];
		if (res.other != null) {
			for (var i=0; i<res.other.length; i++) {
				other.push(loadOrGet("/MapObj/"+res.other[i]));
			}
		}

		scn.typeRes[id] = {mdl:models, other: other};
	}

	function updateMode(mode) {
		// updates the game mode...

		// {
		//   id = (0:pregame, 1:countdown, 2:race, 3:postgame)
		//   time = (elapsed time in seconds)
		//   frameDiv = (0-60)
		//  }
		var lastid = scn.mode.id;
		if (lastid != mode.id) {
			//mode switch
			switch (mode.id) {
				case 0: 
					//race init. fade scene in and play init music.
					nitroAudio.playSound(11, {volume:2}, null); //7:race (gp), 11:race2 (vs), 12:battle
					break;
				case 1:
					//spawn lakitu and countdown animation. allow pre-acceleration.
					//generally happens at least 2 seconds after init
					scn.entities.push(new Race3DUI(scn, "count", -30));
					break;
				case 2:
					//enable all racers and start music
					for (var i=0; i<scn.karts.length; i++) {
						scn.karts[i].preboost = false;
					}
					nitroAudio.playSound(40, {volume:2, bpmMultiplier:16}, 0);
					scn.entities.push(new Race3DUI(scn, "start"));
					break;
					
			}
		}

		if (scn.mode.time != mode.time) {
			switch (mode.id) {
				case 0:
					break;
				case 1:
				if (mode.time > 0) {
					//beeps for countdown
					nitroAudio.playSound(39, {bpmMultiplier:16}, 0);
				}
				break;
				case 2:
				//show ui and play music at certain time after go

				if (mode.time == 1) {
					scn.musicPlayer = nitroAudio.playSound(music, {volume:2}, null);
				}
				//
				break;
			}
		}

		//win sting: 46
		//ok sting: 47
		//lose sting: 48
		//battle lose sting: 49
		//battle win sting: 50
		//ok sting??: 51
		//mission mode win sting: 52
		//mission mode win2 sting: 53
		//mission mode superwin sting: 54
		//boss win sting: 55
		//ok music: 56
		//lose music: 57
		//win music: 58
		//racelose : 61
		//ok music: 58
		//good time trials music: 59
		//ok time trials: 60

		//final lap: 62
		
		//full results win: 63
		//results draw: 64
		//full results lose: 65
		//gp results cutscene music: 66
		//gp results win music: 67
		//??? : 68
		//credits: 69-70
		// star: 73

		scn.mode = mode;
	}
}
