//
// singleScene.js
//--------------------
// Drives the course scene when not connected to a server. Simulates responses expected from a server.
// by RHY3756547
//

window.singleScene = function(course, wsInstance, res) {
	var res = res; //gameRes
	var t = this;

	t.mode = -1;
	t.activeScene = null;
	t.myKart = null;

	var mchar = Math.floor(Math.random()*12);
	var mkart = Math.floor(Math.random()*0x24);
					
	this.update = function() {
		if (t.activeScene != null) {
			t.activeScene.update();
			//simulate what a server would do
			updateServer();
		}
	}

	var advanceTimes = [3,4,-1,-1]

	function updateServer() {
		var m = t.mode;
		m.frameDiv++;
		if (m.frameDiv == 60) {
			m.frameDiv -= 60;
			m.time++;
			var timeAd = advanceTimes[m.id];
			if (timeAd != -1 && m.time >= timeAd) {
				m.id++;
				m.time = 0;
			}
		}

		t.activeScene.updateMode(JSON.parse(JSON.stringify(t.mode)));
	}

	this.render = function() {
		if (t.activeScene != null) sceneDrawer.drawTest(gl, t.activeScene, 0, 0, gl.viewportWidth, gl.viewportHeight)
	}

	begin(course);

	function begin(course) {
		var mainNarc, texNarc
		if (course.substr(0, 5) == "mkds/") {
			var cnum = Number(course.substr(5));
			var music = MKDSCONST.COURSE_MUSIC[cnum];
			var cDir = MKDSCONST.COURSEDIR+MKDSCONST.COURSES[cnum];
			var mainNarc = new narc(lz77.decompress(gameROM.getFile(cDir+".carc")));
			var texNarc = new narc(lz77.decompress(gameROM.getFile(cDir+"Tex.carc")));
			setUpCourse(mainNarc, texNarc, music)
		} else throw "custom tracks are not implemented yet!"
	}


	function setUpCourse(mainNarc, texNarc, music) {
		var chars = [];
		chars.push({charN:mchar, kartN:mkart, controller:((window.prompt("press y for cpu controlled") == "y")?controlRaceCPU:controlDefault), raceCam:true, extraParams:[{k:"name", v:"single"}, {k:"active", v:true}]});

		for (var i=0; i<7; i++) {
			var tchar = Math.floor(Math.random()*12);
			var tkart = Math.floor(Math.random()*0x24);
					
			chars.push({charN:tchar, kartN:tkart, controller:controlRaceCPU, raceCam:false, extraParams:[{k:"name", v:"no"}, {k:"active", v:true}]});
		}

		t.activeScene = new courseScene(mainNarc, texNarc, music, chars, {}, res);

		t.myKart = t.activeScene.karts[0];
		t.mode = {
			id:0,
			time:0,
			frameDiv:0,
		}
		t.activeScene.updateMode(t.mode);
	}

}