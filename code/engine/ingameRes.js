//
// ingameRes.js
//--------------------
// Provides access to general ingame resources.
// by RHY3756547
//

window.GraphicTester = function(rom) {

	findGraphicsRecursive(rom);
	function listRecursive(resource, path) {
		path = path || "";
		var files = resource.list();
		for (var i=0; i<files.length; i++) {
			var file = files[i];
			console.log(path + file);
			if (file.toLowerCase().endsWith(".carc")) {
				listRecursive(new narc(lz77.decompress(resource.getFile(file))), path + file);
			}
			if (file.toLowerCase().endsWith(".nftr")) {
				testFont(new nftr(resource.getFile(file)), 0, path + file);
			}
		}
	}

	function findGraphicsRecursive(resource, path) {
		path = path || "";
		var files = resource.list();
		var pals = files.filter(x => x.toLowerCase().endsWith(".nclr"));
		var graphics = files.filter(x => x.toLowerCase().endsWith(".ncgr"));
		for (var i=0; i<files.length; i++) {
			var file = files[i];
			console.log(path + file);
			if (file.toLowerCase().endsWith(".carc")) {
				if (/\_..\./.exec(file) != null) continue; //a localization carc (format _us.carc). only scan the main ones. (+us)
				var mainCarc = new narc(lz77.decompress(resource.getFile(file)));
				var locCarc = resource.getFile(file.replace(".carc", "_us.carc"));
				if (locCarc != null) {
					//create a combo
					mainCarc = new narcGroup([mainCarc, new narc(lz77.decompress(locCarc))]);
				}
				findGraphicsRecursive(mainCarc, path + file);
			}
			if (file.toLowerCase().endsWith(".nscr")) {
				//screen
				//try to find a pal
				//...not a friend, like a color palette
				var palFile = mostSimilarString(file, pals, "b");
				var grFile = mostSimilarString(file, graphics.filter(x => !x.endsWith(".nce.ncgr")), "b");
				if (palFile != null && grFile != null) {
					var scr = new nscr(resource.getFile(file));
					var pal = new nclr(resource.getFile(palFile));
					var graphic = new ncgr(resource.getFile(grFile));

					var flattener = new TileFlattener(pal, graphic, scr);

					var render = flattener.toCanvas(true, 0, 0);

					var split = document.createElement("h3");
					split.innerText = path + file;
					document.body.appendChild(split);
					split = document.createElement("h4");
					split.innerText = path + palFile + " " + path + grFile;
					document.body.appendChild(split);

					document.body.appendChild(render);
				}
			}

			if (file.toLowerCase().endsWith(".ncer")) {
				//cell resource
				//try to find a pal
				//...not a friend, like a color palette
				var palFile = mostSimilarString(file, pals, "o");
				var grFile = mostSimilarString(file, graphics, "o");
				if (palFile != null && grFile != null) {
					var cer = new ncer(resource.getFile(file));
					var pal = new nclr(resource.getFile(palFile));
					var graphic = new ncgr(resource.getFile(grFile));

					var flattener = new TileFlattener(pal, graphic, cer);

					var split = document.createElement("h3");
					split.innerText = path + file;
					document.body.appendChild(split);
					split = document.createElement("h4");
					split.innerText = path + palFile + " " + path + grFile;
					document.body.appendChild(split);

					//render all images
					var imageCount = cer.cebk.imageCount;
					for (var j=0; j<imageCount; j++) {
						var render = flattener.toCanvas(true, j, 0);
						document.body.appendChild(render);
					}
				}
			}
		}
	}

	function mostSimilarString(text, list, pref) {
		var bestString = null;
		var bestScore = 0;
		for (var i=0; i<list.length; i++) {
			var score = startSimilarity(text, list[i], pref);
			if (score > bestScore) {
				bestScore = score;
				bestString = list[i];
			}
		}
		return bestString;
	}

	function countStr(text, char) {
		var count = 0;
		for (var i=0; i<text.length; i++) {
			if (text[i] == char) count++;
		}
		return count;
	}

	function startSimilarity(text1, text2, pref) {
		var min = Math.min(text1.length, text2.length);
		var score = 0;
		for (var i=0; i<min; i++) {
			if (text1[i] != text2[i]) {
				if (pref != null) {
					score += countStr(text2.substr(i), pref) / 10;
				}
				return score;
			}
			score++;
		}
		return score; //as similar as possible
	}

}

window.IngameRes = function(rom) {
	var r = this;
	this.kartPhys = new kartphysicalparam(rom.getFile("/data/KartModelMenu/kartphysicalparam.bin"));
	this.kartOff = new kartoffsetdata(rom.getFile("/data/KartModelMenu/kartoffsetdata.bin"));
	this.MapObj = new narc(lz77.decompress(rom.getFile("/data/Main/MapObj.carc"))); //contains generic map obj, look in here when mapobj res is missing from course. (itembox etc)
	this.MainRace = new narc(lz77.decompress(rom.getFile("/data/MainRace.carc"))); //contains item models.
	this.MainEffect = new narc(lz77.decompress(rom.getFile("/data/MainEffect.carc"))); //contains particles.
	this.Main2D = new narc(lz77.decompress(rom.getFile("/data/Main2D.carc")));

	this.KartModelSub = new narc(lz77.decompress(rom.getFile("/data/KartModelSub.carc"))); //contains characters + animations

	this.Race = new narc(lz77.decompress(rom.getFile("/data/Scene/Race.carc"))); //contains lakitu, count, various graphics
	this.RaceLoc = new narc(lz77.decompress(rom.getFile("/data/Scene/Race_us.carc"))); //contains lakitu lap signs, START, YOU WIN etc. some of these will be replaced by hi res graphics by default.
	this.RaceEffect = new spa(r.MainEffect.getFile("RaceEffect.spa"));

	this.MainFont = new nftr(r.Main2D.getFile("marioFont.NFTR"));
	this.MFont = new nftr(r.Main2D.getFile("LC_Font_m.NFTR"));
	this.SFont = new nftr(r.Main2D.getFile("LC_Font_s.NFTR"));

	//testFont(this.MainFont, 0);
	//testFont(this.MFont, 16*4);
	//testFont(this.SFont, 32*4);

	/*
	var test = new GraphicTester(rom);
	listRecursive(rom);
	*/


	function testFont(font, off, name) {
		var all = Object.keys(font.charMap).join("");
		var split = document.createElement("h3");
		split.innerText = name;
		document.body.appendChild(split);

		for (var i=0; i<4; i++) {
			var sliceF = Math.floor((all.length * i) / 4);
			var sliceT = Math.floor((all.length * (i+1)) / 4);

			var canvas = font.drawToCanvas(all.substring(sliceF, sliceT), [[0, 0, 0, 0], [255, 0, 0, 255], [255, 255, 255, 255],
			 [32, 0, 0, 255], [64, 0, 0, 255], [96, 0, 0, 255], [128, 0, 0, 255]]);
			document.body.appendChild(canvas);
			//canvas.style.position = "absolute";
			//canvas.style.left = 0;
			//canvas.style.top = off + "px";

			//off += 16;
		}
	}

	function listRecursive(resource, path) {
		path = path || "";
		var files = resource.list();
		for (var i=0; i<files.length; i++) {
			var file = files[i];
			console.log(path + file);
			if (file.toLowerCase().endsWith(".carc")) {
				listRecursive(new narc(lz77.decompress(resource.getFile(file))), path + file);
			}
			if (file.toLowerCase().endsWith(".nftr")) {
				if (file == "/selectFont.NFTR") debugger;
				testFont(new nftr(resource.getFile(file)), 0, path + file);
			}
		}
	}

	//debugger;

	this.getChar = getChar;
	this.getKart = getKart;

	var itemNames = [
		"banana", "bomb", "gesso" /*squid*/, "kinoko" /*mushroom*/, "kinoko_p" /*queen shroom*/, "koura_g" /*green shell*/, "koura_r" /*red shell*/, "star", "teresa" /*boo*/, "thunder", 
		"koura_w" /*blue shell item rep*/, "f_box", "killer" /*bullet bill*/
	]

	//order
	//donkey, toad, bowser?, luigi, mario, peach, wario, yoshi, daisy, waluigi, dry bones (karon), robo, heyho
	var toSoundOff = [
		4, 0, 1, 2, 5, 6, 7, 3, 10, 8, 9, 11, 12
	];

	var charNames = [
		"mario", "donkey", "kinopio", "koopa", "peach", "wario", "yoshi", "luigi", "karon", "daisy", "waluigi", "robo", "heyho"
	];

	var charAbbrv = [
		"MR", "DK", "KO", "KP", "PC", "WR", "YS", "LG", "KA", "DS", "WL", "RB", "HH"
	];

	var tireName = ["kart_tire_L", "kart_tire_M", "kart_tire_S"];

	var characters = [];
	var karts = [];

	loadItems();
	loadTires();

	function loadItems() { //loads physical representations of items
		var t = {}
		for (var i=0; i<itemNames.length; i++) {
			var n = itemNames[i];
			t[n] = new nitroModel(new nsbmd(r.MainRace.getFile("/Item/it_"+n+".nsbmd")));
		}
		t.blueShell = new nitroModel(new nsbmd(r.MainRace.getFile("/Item/koura_w.nsbmd")));
		t.splat = new nitroModel(new nsbmd(r.MainRace.getFile("/Item/geso_sumi.nsbmd")));
		t.fakeBox = new nitroModel(new nsbmd(r.MainRace.getFile("/MapObj/box.nsbmd")));
		r.items = t;
	}

	function loadTires() {
		var path = "/data/KartModelMenu/kart/tire/";
		var tires = {};
		for (var i=0; i<tireName.length; i++) tires[tireName[i]] = new nitroModel(new nsbmd(rom.getFile(path+tireName[i]+".nsbmd")), new nsbtx(rom.getFile(path+tireName[i]+".nsbtx")));
		r.tireRes = tires;
	}

	function getChar(ind) {
		if (characters[ind] != null) return characters[ind];
		var base = "/character/"+charNames[ind]+"/P_"+charAbbrv[ind];

		var obj = {
			model: new nitroModel(new nsbmd(r.KartModelSub.getFile(base+".nsbmd")), new nsbtx(r.KartModelSub.getFile(base+".nsbtx")), {tex:{1:2}, pal:{1:2}}),
			driveA: new nsbca(r.KartModelSub.getFile(base+"_drive.nsbca")),
			loseA: new nsbca(r.KartModelSub.getFile(base+"_lose.nsbca")),
			spinA: new nsbca(r.KartModelSub.getFile(base+"_spin.nsbca")),
			winA: new nsbca(r.KartModelSub.getFile(base+"_win.nsbca")),
			sndOff: toSoundOff[ind]*14,
		}
		characters[ind] = obj;
		return characters[ind];
	}

	var letters = ["a", "b", "c"]

	function getKart(ind) { //returns a nitroModel, but also includes a property "shadVol" containing the kart's shadow volume.
		if (karts[ind] != null) return karts[ind];
		var c = Math.floor(ind/3);
		var t = ind%3;
		if (t == 0) c = 0; //only mario has standard kart

		var name = charAbbrv[c]+"_"+letters[t];
		var path = "/data/KartModelMenu/kart/"+charNames[c]+"/kart_"+name;

		var model = new nitroModel(new nsbmd(rom.getFile(path+".nsbmd")), new nsbtx(rom.getFile(path+".nsbtx")));
		model.shadVol = new nitroModel(new nsbmd(rom.getFile("/data/KartModelMenu/kart/shadow/sh_"+name+".nsbmd")));
		//todo, assign special pallete for A karts

		karts[ind] = model;
		return karts[ind];
	}
}