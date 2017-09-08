//
// objDatabase.js
//--------------------
// Links object IDs to specific entity types. Must be initialized after all js files are loaded!
// by RHY3756547
//
// includes:
// entities/*
//

window.objDatabase = new (function(){

	this.init = function() {
		this.idToType = [];

		var t = this.idToType;
		t[0x0001] = ObjWater;
		t[0x0003] = ObjWater;
		t[0x0006] = ObjWater;
		t[0x0008] = ObjSoundMaker;
		t[0x0009] = ObjWater;
		t[0x000C] = ObjWater;

		t[0x0065] = ItemBox;

		t[0x00CA] = ObjRoutePlatform;
		t[0x00CB] = ObjGear;
		t[0x00CE] = ObjGear; //test_cylinder, tick tock clock end
		t[0x00D0] = ObjRotaryRoom;
		t[0x00D1] = ObjGear; //rotary bridge		

		t[0x012D] = ObjDecor; 
		t[0x012E] = ObjDecor; 
		t[0x012F] = ObjDecor; 

		t[0x0130] = ObjDecor; 
		t[0x0131] = ObjDecor; 
		t[0x0132] = ObjDecor; 
		t[0x0133] = ObjDecor; 
		t[0x0134] = ObjDecor; 
		t[0x0135] = ObjDecor; 
		t[0x0138] = ObjDecor; 
		t[0x0139] = ObjDecor; 
		t[0x013C] = ObjDecor; //DEBUG: cheep cheep (routed)
		t[0x013D] = ObjDecor; //DEBUG: ghost

		t[0x013A] = ObjDecor; //figure 8 tree
		t[0x013C] = ObjDecor; 
		t[0x013F] = ObjDecor; 

		t[0x0140] = ObjDecor; 
		t[0x0142] = ObjDecor; //more trees
		t[0x0145] = ObjDecor;
		t[0x0146] = ObjDecor;
		t[0x0148] = ObjDecor;
		t[0x0149] = ObjDecor; //yoshi falls egg

		t[0x014B] = ObjDecor;
		t[0x014C] = ObjDecor;
		t[0x014D] = ObjDecor;
		t[0x014E] = ObjDecor;
		t[0x014F] = ObjDecor;

		t[0x0150] = ObjDecor; 
		t[0x0151] = ObjDecor; 
		t[0x0152] = ObjDecor; 
		t[0x0153] = ObjDecor; 
		t[0x0154] = ObjDecor; //rainbow star
		t[0x0155] = ObjDecor; 
		t[0x0156] = ObjDecor; 
		t[0x0157] = ObjDecor; 

		t[0x019C] = ObjTruck;
		t[0x019A] = ObjCar;
		t[0x0195] = ObjBus;


		t[0x00CC] = ObjDecor; //DEBUG: pianta bridge
		t[0x000D] = ObjDecor; //DEBUG: puddle

		t[0x0158] = ObjDecor; //DEBUG: airship (routed)

		//DEBUG ENEMIES AS DECOR: switch as implemented:

		t[0x0191] = ObjDecor;
		t[0x0192] = ObjDecor;
		t[0x0193] = ObjDecor;
		t[0x0196] = ObjDecor;
		t[0x0198] = ObjDecor;
		t[0x0199] = ObjDecor;
		//truck
		t[0x019B] = ObjDecor;
		t[0x019D] = ObjDecor;
		t[0x019E] = ObjDecor;

		t[0x01A0] = ObjDecor;
		t[0x01A1] = ObjDecor;
		t[0x01A3] = ObjDecor;
		t[0x01A4] = ObjDecor;
		t[0x01A5] = ObjDecor;
		t[0x01A6] = ObjDecor;
		t[0x01A7] = ObjDecor;
		t[0x01A8] = ObjDecor;
		t[0x01A9] = ObjDecor;

		t[0x01AA] = ObjDecor;
		t[0x01AC] = ObjDecor;
		t[0x01AD] = ObjDecor;
		//rotating fireballs

		t[0x01B0] = ObjDecor;
		t[0x01B1] = ObjDecor;
		t[0x01B2] = ObjDecor;
		t[0x01B3] = ObjDecor;
		t[0x01B4] = ObjDecor;
		t[0x01B5] = ObjDecor;
	}

})();