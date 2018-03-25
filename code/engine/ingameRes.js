//
// ingameRes.js
//--------------------
// Provides access to general ingame resources.
// by RHY3756547
//

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