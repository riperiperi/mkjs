//
// clientScene.js
//--------------------
// Manages the game state when connected to a server. Drives the course scene and track picker.
// by RHY3756547
//

window.clientScene = function(wsUrl, wsInstance, res) {
	var res = res; //gameRes
	var t = this;

	var WebSocket = window.WebSocket || window.MozWebSocket;
	var ws = new WebSocket(wsUrl);
	ws.binaryType = "arraybuffer";

	t.ws = ws;
	t.mode = -1;
	t.activeScene = null;
	t.myKart = null;

	ws.onopen = function() {
		console.log("initial connection")
		//first we need to establish connection to the instance.
		var obj = {
			t:"*",
			i:wsInstance,
			c:{
				name:"TestUser"+Math.round(Math.random()*10000),
				char:Math.floor(Math.random()*12), 
				kart:Math.floor(Math.random()*0x24)
			}
		}
		sendJSONMessage(obj);
	};

	ws.onmessage = function(evt) {
		var d = evt.data;
		if (typeof d != "string") {
			//binary data
			var view = new DataView(d);
			var handler = binH[view.getUint8(0)];
			if (handler != null) handler(view);
		} else {
			//JSON string
			var obj;
			try {	
				obj = JSON.parse(d);
			} catch (err) {
				debugger; //packet recieved from server is bullshit
				return;
			}
			var handler = wsH["$"+obj.t];
			if (handler != null) handler(obj);
		}
	}

	this.update = function() {
		if (t.activeScene != null) t.activeScene.update();
		if (t.myKart != null) sendKartInfo(t.myKart);
	}

	this.render = function() {
		if (t.activeScene != null) sceneDrawer.drawTest(gl, t.activeScene, 0, 0, gl.viewportWidth, gl.viewportHeight)
	}

	function abFromBlob(blob, callback) {
		var fileReader = new FileReader();
		fileReader.onload = function() {
			callback(this.result);
		};
		fileReader.readAsArrayBuffer(blob);
	}

	function sendKartInfo(kart) {
		var dat = new ArrayBuffer(0x61);
		var view = new DataView(dat);
		view.setUint8(0, 32);
		netKart.saveKart(view, 1, kart, kart.lastInput);
		ws.send(dat);
	}

	var wsH = {};
	wsH["$*"] = function(obj) { //initiate scene.
		t.myKart = null;
		if (obj.m == 1) { //race
			t.mode = 1;

			var mainNarc, texNarc
			if (obj.c.substr(0, 5) == "mkds/") {
				var cnum = Number(obj.c.substr(5));
				var music = MKDSCONST.COURSE_MUSIC[cnum];
				var cDir = MKDSCONST.COURSEDIR+MKDSCONST.COURSES[cnum];
				var mainNarc = new narc(lz77.decompress(gameROM.getFile(cDir+".carc")));
				var texNarc = new narc(lz77.decompress(gameROM.getFile(cDir+"Tex.carc")));
				setUpCourse(mainNarc, texNarc, music, obj)
			}
			else throw "custom tracks are not implemented yet!"
		}
	}

	wsH["$+"] = function(obj) { //add kart. only used in debug circumstances. (people can't join normal gamemodes midgame)
		console.log("kart added");
		if (t.mode != 1) return;
		var kart = new Kart([0, -2000, 0], 0, 0, obj.k.kart, obj.k.char, new ((obj.p)?((window.prompt("press y for cpu controlled") == "y")?controlRaceCPU:controlDefault):controlNetwork)(t.activeScene.nkm, {}), t.activeScene);
		t.activeScene.karts.push(kart);
	}

	wsH["$-"] = function(obj) { //kart disconnect.
		t.activeScene.karts[obj.k].active = false;
	}

	var binH = [];
	binH[32] = function(view) {
		//if we are in a race, update kart positions in main scene. we should trust the server on this, however if anything goes wrong it will be caught earlier.
		if (t.mode != 1) return;

		var n = view.getUint16(0x01, true);
		var off = 0x03;
		for (var i=0; i<n; i++) {
			var kart = t.activeScene.karts[view.getUint16(off, true)];
			off += 2;
			if (kart != null && !kart.local) netKart.restoreKart(view, off, kart);
			off += 0x60;
		}
	}

	function setUpCourse(mainNarc, texNarc, music, obj) {
		var chars = [];
		for (var i=0; i<obj.k.length; i++) {
			var k = obj.k[i];
			var pKart = (i == obj.p);
			//TODO: custom character support
			chars.push({charN:k.char, kartN:k.kart, controller:((pKart)?((window.prompt("press y for cpu controlled") == "y")?controlRaceCPU:controlDefault):controlNetwork), raceCam:pKart, extraParams:[{k:"name", v:k.name}, {k:"active", v:k.active}]});
		
			if (pKart) {
				for (var i=0; i<7; i++) {
					var tchar = Math.floor(Math.random()*12);
					var tkart = Math.floor(Math.random()*0x24);
					
					chars.push({charN:tchar, kartN:tkart, controller:controlRaceCPU, raceCam:false, extraParams:[{k:"name", v:"no"}, {k:"active", v:true}]});
				}
			}
		}

		t.activeScene = new courseScene(mainNarc, texNarc, music, chars, {}, res);

		for (var i=0; i<obj.k.length; i++) {
			t.activeScene.karts[i].active = obj.k[i].active;
			if (t.activeScene.karts[i].local) t.myKart = t.activeScene.karts[i];
		}
	}

	function sendJSONMessage(obj) {
		ws.send(JSON.stringify(obj));
	}
}