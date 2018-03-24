//
// collisionTypes.js
//--------------------
// Includes enums for collision types.
// by RHY3756547
//
// includes: gl-matrix.js (glMatrix 2.0)
// /formats/kcl.js
//


window.MKDS_COLSOUNDS = new function() {
	this.DRIFT_ASPHALT = 84;
	this.DRIFT_CONCRETE = 85;
	this.DRIFT_EDGE = 86; //happens when you hit an edge while drifting?
	this.DRIFT_DIRT = 87;
	this.DRIFT_ROAD = 88;
	this.DRIFT_STONE = 89;
	this.DRIFT_SAND = 90;
	this.DRIFT_ICE = 91;
	this.DRIFT_GLASS = 92;
	this.DRIFT_WATER = 93;
	this.DRIFT_BOARD = 94; //boardwalk!
	this.DRIFT_CARPET = 95; //like luigis mansion
	this.DRIFT_METALGAUZE = 96;
	this.DRIFT_PLASTIC = 97;
	this.DRIFT_RAINBOW = 99;
	this.DRIFT_MARSH = 100; //luigis mansion

	this.LAND_ASPHALT = 103;
	this.LAND_SAND = 104;
	this.LAND_DIRT = 105;
	this.LAND_ICE = 106;
	this.LAND_GRASS = 107;
	this.LAND_SNOW = 108;
	this.LAND_METALGAUZE = 109;
	this.LAND_MARSH = 110;
	this.LAND_WATER = 111;
	this.LAND_WATERDEEP = 112;
	this.LAND_CARPET = 113;

	this.DRIVE_DIRT = 114;
	this.DRIVE_GRASS = 115;
	this.DRIVE_WATER = 116;
	this.DRIVE_STONE = 117;
	this.DRIVE_SAND = 118;
	this.DRIVE_MARSH = 119;
	this.DRIVE_CARPET = 120;

	this.HIT_CAR = 128;
	this.HIT_CONCRETE = 129;
	this.HIT_FENCE = 130;
	this.HIT_WOOD = 131;
	this.HIT_TREE = 132;
	this.HIT_BUSH = 133;
	this.HIT_CLIFF = 134;
	this.HIT_SIGN = 135;
	this.HIT_ICE = 136;
	this.HIT_SNOW = 137;
	this.HIT_TABLE = 138;
	this.HIT_BOUNCY = 139;
	this.HIT_JELLY = 140;
	this.HIT_METALGAUZE = 141;
	this.HIT_METAL = 142;

	this.BRAKE = 143;
	this.BRAKE_CONCRETE = 144;
	this.BRAKE_DIRT = 145;
	this.BRAKE_STONE = 146;
	this.BRAKE_ICE = 147;
	this.BRAKE_GLASS = 148;
	this.BRAKE_WATER = 149;
	this.BRAKE_BOARD = 150; //boardwalk
	this.BRAKE_CARPET = 151;
	this.BRAKE_METALGAUZE = 152;
	this.BRAKE_PLASTIC = 153;
	this.BRAKE_METAL = 154;
	this.BRAKE_RAINBOW = 155;
	this.BRAKE_MARSH = 156;

	this.BRAKE_BOOST = 158;

}	

window.MKDS_COLTYPE = new (function(){
	this.ROAD = 0x00;
	this.OFFROADMAIN = 0x01;
	this.OFFROAD3 = 0x02;
	this.OFFROAD2 = 0x03;
	this.RAINBOWFALL = 0x04;
	this.OFFROAD1 = 0x05;
	this.SLIPPERY = 0x06;
	this.BOOST = 0x07;
	this.WALL = 0x08;
	this.WALL2 = 0x09;
	this.OOB = 0x0A; //voids out the player, returns to lakitu checkpoint.
	this.FALL = 0x0B; //like out of bounds, but you fall through it.
	this.JUMP_PAD = 0x0C; //jump pads on GBA levels
	this.STICKY = 0x0D; //sets gravity to negative this plane's normal until the object hasn't collided for a few frames.
	this.SMALLJUMP = 0x0E; //choco island 2's disaster ramps
	this.CANNON = 0x0F; //activates cannon. basic effect id is the cannon to use.
	this.UNKNOWN = 0x10; //it is a mystery...
	this.FALLSWATER = 0x11; //points to falls object in nkm, gets motion parameters from there.
	this.BOOST2 = 0x12;
	this.LOOP = 0x13; //like sticky but with boost applied. see rainbow road ds
	this.SOUNDROAD = 0x14;
	this.RR_SPECIAL_WALL = 0x15;

	this.GROUP_ROAD = [
		this.ROAD, this.OFFROAD1, this.OFFROAD2, this.OFFROAD3, this.OFFROAD4, this.SLIPPERY, this.BOOST,
		this.JUMP_PAD, this.STICKY, this.SMALLJUMP, this.FALLSWATER, this.BOOST2, this.LOOP, this.SOUNDROAD,
		this.OOB, this.OFFROADMAIN
	]

	this.GROUP_SOLID = [
		this.ROAD, this.OFFROAD1, this.OFFROAD2, this.OFFROAD3, this.OFFROAD4, this.SLIPPERY, this.BOOST,
		this.JUMP_PAD, this.STICKY, this.SMALLJUMP, this.FALLSWATER, this.BOOST2, this.LOOP, this.SOUNDROAD,
		this.OOB, this.OFFROADMAIN,

		this.WALL, this.WALL2, this.RR_SPECIAL_WALL
	]

	this.GROUP_WALL = [
		this.WALL, this.WALL2, this.RR_SPECIAL_WALL
	]

	this.GROUP_BOOST = [
		this.BOOST, this.BOOST2, this.LOOP
	]

	this.PHYS_MAP = new Array(31);
	this.PHYS_MAP[this.ROAD] = 0;
	this.PHYS_MAP[this.OFFROAD3] = 2;
	this.PHYS_MAP[this.OFFROAD2] = 3;
	this.PHYS_MAP[this.OFFROAD1] = 4;
	this.PHYS_MAP[this.OFFROADMAIN] = 5;
	this.PHYS_MAP[this.SLIPPERY] = 6;
	this.PHYS_MAP[this.BOOST] = 8;
	this.PHYS_MAP[this.BOOST2] = 8;
	this.PHYS_MAP[this.FALLSWATER] = 10;
	this.PHYS_MAP[this.LOOP] = 11;

	//collision sound handlers
	//26 is blue water, 30 is white
	//28 and 15 might be sand/dirt 

	var waterRoad = {drift: MKDS_COLSOUNDS.DRIFT_WATER, brake: MKDS_COLSOUNDS.BRAKE_WATER, land: MKDS_COLSOUNDS.LAND_WATER, drive: MKDS_COLSOUNDS.DRIVE_WATER, particle: 30};

	this.SOUNDMAP = {
		0x00: //road
		[
			{drift: MKDS_COLSOUNDS.DRIFT_ASPHALT, brake: MKDS_COLSOUNDS.BRAKE, land: MKDS_COLSOUNDS.LAND_ASPHALT},
			{drift: MKDS_COLSOUNDS.DRIFT_SAND, brake: MKDS_COLSOUNDS.BRAKE_SAND, land: MKDS_COLSOUNDS.LAND_SAND, drive: MKDS_COLSOUNDS.DRIVE_SAND},
			{drift: MKDS_COLSOUNDS.DRIFT_STONE, brake: MKDS_COLSOUNDS.BRAKE_STONE, land: MKDS_COLSOUNDS.LAND_ASPHALT, drive: MKDS_COLSOUNDS.DRIVE_STONE},
			{drift: MKDS_COLSOUNDS.DRIFT_CONCRETE, brake: MKDS_COLSOUNDS.BRAKE_CONCRETE, land: MKDS_COLSOUNDS.LAND_ASPHALT},
			{drift: MKDS_COLSOUNDS.DRIFT_BOARD, brake: MKDS_COLSOUNDS.BRAKE_BOARD, land: MKDS_COLSOUNDS.LAND_ASPHALT},

			{drift: MKDS_COLSOUNDS.DRIFT_ASPHALT, brake: MKDS_COLSOUNDS.BRAKE, land: MKDS_COLSOUNDS.LAND_SNOW}, //snow?

			{drift: MKDS_COLSOUNDS.DRIFT_METALGAUZE, brake: MKDS_COLSOUNDS.BRAKE_METALGAUZE, land: MKDS_COLSOUNDS.LAND_METALGAUZE},
			{drift: MKDS_COLSOUNDS.DRIFT_ASPHALT, brake: MKDS_COLSOUNDS.BRAKE, land: MKDS_COLSOUNDS.LAND_ASPHALT},
		],

		0x01: //road 2 the roadening
		[
			{drift: MKDS_COLSOUNDS.DRIFT_ASPHALT, brake: MKDS_COLSOUNDS.BRAKE, land: MKDS_COLSOUNDS.LAND_ASPHALT},
			{drift: MKDS_COLSOUNDS.DRIFT_ASPHALT, brake: MKDS_COLSOUNDS.BRAKE, land: MKDS_COLSOUNDS.LAND_ASPHALT},
			{drift: MKDS_COLSOUNDS.DRIFT_ASPHALT, brake: MKDS_COLSOUNDS.BRAKE, land: MKDS_COLSOUNDS.LAND_ASPHALT},
			{drift: MKDS_COLSOUNDS.DRIFT_WATER, brake: MKDS_COLSOUNDS.BRAKE_WATER, land: MKDS_COLSOUNDS.LAND_WATERDEEP, drive: MKDS_COLSOUNDS.DRIVE_WATER, particle: 30},
			{drift: MKDS_COLSOUNDS.DRIFT_ASPHALT, brake: MKDS_COLSOUNDS.BRAKE, land: MKDS_COLSOUNDS.LAND_ASPHALT},
			{},
			{},
			{}
		],

		0x02: //road 3
		[
			{drift: MKDS_COLSOUNDS.DRIFT_SAND, brake: MKDS_COLSOUNDS.BRAKE_SAND	, land: MKDS_COLSOUNDS.LAND_SAND, drive: MKDS_COLSOUNDS.DRIVE_SAND},
			waterRoad,

			{drift: MKDS_COLSOUNDS.DRIFT_ASPHALT, brake: MKDS_COLSOUNDS.BRAKE, land: MKDS_COLSOUNDS.LAND_SNOW}, //snow

			{drift: MKDS_COLSOUNDS.DRIFT_SAND, brake: MKDS_COLSOUNDS.BRAKE_SAND, land: MKDS_COLSOUNDS.LAND_SAND, drive: MKDS_COLSOUNDS.DRIVE_SAND},
			{},
			{},
			{},
			{}
		],

		0x03: //road 4
		[
			{drift: MKDS_COLSOUNDS.DRIFT_SAND, brake: MKDS_COLSOUNDS.BRAKE_SAND	, land: MKDS_COLSOUNDS.LAND_SAND, drive: MKDS_COLSOUNDS.DRIVE_SAND, particle: 28},
			{drift: MKDS_COLSOUNDS.DRIFT_DIRT, brake: MKDS_COLSOUNDS.BRAKE_DIRT, land: MKDS_COLSOUNDS.LAND_DIRT, drive: MKDS_COLSOUNDS.DRIVE_DIRT, particle: 15},

			{drift: MKDS_COLSOUNDS.DRIFT_ASPHALT, brake: MKDS_COLSOUNDS.BRAKE, land: MKDS_COLSOUNDS.LAND_GRASS, drive: MKDS_COLSOUNDS.DRIVE_GRASS, particle: 32},

			{drift: MKDS_COLSOUNDS.DRIFT_SAND, brake: MKDS_COLSOUNDS.BRAKE_SAND, land: MKDS_COLSOUNDS.LAND_SAND, drive: MKDS_COLSOUNDS.DRIVE_SAND, particle: 28},
			{drift: MKDS_COLSOUNDS.DRIFT_SAND, brake: MKDS_COLSOUNDS.BRAKE_SAND, land: MKDS_COLSOUNDS.LAND_SAND, drive: MKDS_COLSOUNDS.DRIVE_SAND, particle: 28},
			{drift: MKDS_COLSOUNDS.DRIFT_ASPHALT, brake: MKDS_COLSOUNDS.BRAKE, land: MKDS_COLSOUNDS.LAND_SNOW, particle:112}, //snow
			{},
			{}
		],

		0x05: //road 5
		[
			{drift: MKDS_COLSOUNDS.DRIFT_SAND, brake: MKDS_COLSOUNDS.BRAKE_SAND	, land: MKDS_COLSOUNDS.LAND_SAND, drive: MKDS_COLSOUNDS.DRIVE_SAND, particle: 28},
			{drift: MKDS_COLSOUNDS.DRIFT_DIRT, brake: MKDS_COLSOUNDS.BRAKE_DIRT, land: MKDS_COLSOUNDS.LAND_DIRT, drive: MKDS_COLSOUNDS.DRIVE_DIRT, particle: 15},

			{drift: MKDS_COLSOUNDS.DRIFT_ASPHALT, brake: MKDS_COLSOUNDS.BRAKE, land: MKDS_COLSOUNDS.LAND_GRASS, drive: MKDS_COLSOUNDS.DRIVE_GRASS, particle: 32},

			{drift: MKDS_COLSOUNDS.DRIFT_SAND, brake: MKDS_COLSOUNDS.BRAKE_SAND, land: MKDS_COLSOUNDS.LAND_SAND, drive: MKDS_COLSOUNDS.DRIVE_SAND, particle: 28},
			{drift: MKDS_COLSOUNDS.DRIFT_ASPHALT, brake: MKDS_COLSOUNDS.BRAKE, land: MKDS_COLSOUNDS.LAND_GRASS, drive: MKDS_COLSOUNDS.DRIVE_GRASS, particle: 32},
			{},
			{},
			{}
		],

		0x06: //slippery
		[
			{drift: MKDS_COLSOUNDS.DRIFT_ICE, brake: MKDS_COLSOUNDS.BRAKE_ICE, land:MKDS_COLSOUNDS.LAND_ICE},
			{drift: MKDS_COLSOUNDS.DRIFT_MARSH, brake: MKDS_COLSOUNDS.BRAKE_MARSH, land:MKDS_COLSOUNDS.LAND_MARSH, drive: MKDS_COLSOUNDS.DRIVE_MARSH, particle: 24},
			{},
			{},
			{},
			{},
			{},
			{}
		],

		0x07: //bo0st
		[
			{drift: MKDS_COLSOUNDS.BRAKE_PLASTIC, brake: MKDS_COLSOUNDS.BRAKE_PLASTIC, land:MKDS_COLSOUNDS.LAND_ASPHALT},
			{drift: MKDS_COLSOUNDS.BRAKE_PLASTIC, brake: MKDS_COLSOUNDS.BRAKE_PLASTIC, land:MKDS_COLSOUNDS.LAND_ASPHALT},
			{},
			{},
			{},
			{},
			{},
			{}
		],

		0x08: //wall
		[//placeholders
			{hit: MKDS_COLSOUNDS.HIT_CONCRETE},
			{hit: MKDS_COLSOUNDS.HIT_CLIFF},
			{hit: MKDS_COLSOUNDS.HIT_SIGN}, //cliff
			{hit: MKDS_COLSOUNDS.HIT_WOOD},
			{hit: MKDS_COLSOUNDS.HIT_BUSH},
			{},
			{hit: MKDS_COLSOUNDS.HIT_JELLY},
			{hit: MKDS_COLSOUNDS.HIT_ICE},
		],

		0x09: //wall 2
		[
			{hit: MKDS_COLSOUNDS.HIT_CONCRETE}, 
			{hit: MKDS_COLSOUNDS.HIT_STONE},
			{hit: MKDS_COLSOUNDS.HIT_METAL},
			{hit: MKDS_COLSOUNDS.HIT_WOOD},
			{hit: MKDS_COLSOUNDS.HIT_BUSH},
			{},
			{hit: MKDS_COLSOUNDS.HIT_JELLY},
			{hit: MKDS_COLSOUNDS.HIT_ICE},
		],

		0x10: //wall 3
		[
			{hit: MKDS_COLSOUNDS.HIT_CONCRETE}, 
			{},
			{},
			{},
			{},
			{},
			{},
			{},
		],

		0x15: //wall with sound effect
		[
			{hit: MKDS_COLSOUNDS.HIT_CONCRETE},
			{hit: MKDS_COLSOUNDS.HIT_STONE},
			{hit: MKDS_COLSOUNDS.HIT_RAINBOW}, //only diff i think
			{hit: MKDS_COLSOUNDS.HIT_WOOD},
			{hit: MKDS_COLSOUNDS.HIT_BUSH},
			{},
			{hit: MKDS_COLSOUNDS.HIT_JELLY},
			{hit: MKDS_COLSOUNDS.HIT_ICE},
		],

		0x11: [ //yoshi falls water
			waterRoad,
			waterRoad,
			waterRoad,
			waterRoad,
			waterRoad,
			waterRoad,
			waterRoad,
			waterRoad
		],

		0x12: //boost
		[
			{drift: MKDS_COLSOUNDS.BRAKE_PLASTIC, brake: MKDS_COLSOUNDS.BRAKE_PLASTIC, land:MKDS_COLSOUNDS.LAND_ASPHALT},
			{},
			{},
			{},
			{},
			{},
			{},
			{}
		],

		0x13: //looping
		[
			{drift: MKDS_COLSOUNDS.DRIFT_ASPHALT, brake: MKDS_COLSOUNDS.BRAKE, land:MKDS_COLSOUNDS.LAND_ASPHALT},
			{drift: MKDS_COLSOUNDS.DRIFT_RAINBOW, brake: MKDS_COLSOUNDS.BRAKE_RAINBOW, land:MKDS_COLSOUNDS.LAND_ASPHALT},
			{},
			{},
			{},
			{},
			{},
			{}
		],

		0x14: //road with sfx
		[
			{},
			{drift: MKDS_COLSOUNDS.DRIFT_CARPET, brake: MKDS_COLSOUNDS.BRAKE_CARPET, land:MKDS_COLSOUNDS.LAND_CARPET, drive: MKDS_COLSOUNDS.DRIVE_CARPET},
			{drift: MKDS_COLSOUNDS.DRIFT_RAINBOW, brake: MKDS_COLSOUNDS.BRAKE_RAINBOW, land:MKDS_COLSOUNDS.LAND_ASPHALT},
			{},
			{}, //stairs
			{},
			{},
			{}
		]
	}

})()