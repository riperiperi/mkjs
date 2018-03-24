//
// decorations.js
//--------------------
// Provides decoration objects.
// by RHY3756547
//
// includes:
// render stuff idk
//

window.ObjDecor = function(obji, scene) {
	var forceBill;
	var obji = obji;
	var res = [];

	var t = this;

	t.pos = vec3.clone(obji.pos);
	t.angle = vec3.clone(obji.angle);
	t.scale = vec3.clone(obji.scale);

	t.requireRes = requireRes;
	t.provideRes = provideRes;
	t.update = update;
	t.draw = draw;

	var mat = mat4.create();
	var frame = 0;
	var anim = null;
	var animFrame = 0;
	var animMat = null;

	function draw(view, pMatrix) {
		mat4.translate(mat, view, t.pos);
				
		if (t.angle[2] != 0) mat4.rotateZ(mat, mat, t.angle[2]*(Math.PI/180));
		if (t.angle[1] != 0) mat4.rotateY(mat, mat, t.angle[1]*(Math.PI/180));
		if (t.angle[0] != 0) mat4.rotateX(mat, mat, t.angle[0]*(Math.PI/180));

		if (anim != null) {
			animMat = anim.setFrame(0, 0, animFrame++);
		}

		mat4.scale(mat, mat, vec3.scale([], t.scale, 16));
		res.mdl[0].draw(mat, pMatrix, animMat);
	}

	function update() {

	}

	function requireRes() { //scene asks what resources to load
		forceBill = true;
		switch (obji.ID) {
			case 0x012D:
				return {mdl:[{nsbmd:"BeachTree1.nsbmd"}]}; //non solid
			case 0x012E:
				return {mdl:[{nsbmd:"BeachTree1.nsbmd"}]};
			case 0x012F:
				return {mdl:[{nsbmd:"earthen_pipe1.nsbmd"}]}; //why is there an earthen pipe 2

			case 0x0130:
				return {mdl:[{nsbmd:"opa_tree1.nsbmd"}]};
			case 0x0131:
				return {mdl:[{nsbmd:"OlgPipe1.nsbmd"}]};
			case 0x0132:
				return {mdl:[{nsbmd:"OlgMush1.nsbmd"}]};
			case 0x0133:
				return {mdl:[{nsbmd:"of6yoshi1.nsbmd"}]};
			case 0x0134:
				return {mdl:[{nsbmd:"cow.nsbmd"}], other:[null, null, "cow.nsbtp"]}; //has animation, cow.nsbtp
			case 0x0135:
				forceBill = false;
				return {mdl:[{nsbmd:"NsKiller1.nsbmd"}, {nsbmd:"NsKiller2.nsbmd"}, {nsbmd:"NsKiller2_s.nsbmd"}]}; //probably animates
			case 0x0138:
				return {mdl:[{nsbmd:"GardenTree1.nsbmd"}]};
			case 0x0139:
				return {mdl:[{nsbmd:"kamome.nsbmd"}], other:[null, null, "kamone.nsbtp"]}; //animates using nsbtp, and uses route to move

			case 0x013A:
				return {mdl:[{nsbmd:"CrossTree1.nsbmd"}]};

			//0x013C is big cheep cheep
			case 0x013C:
				forceBill = false;
				return {mdl:[{nsbmd:"bakubaku.nsbmd"}]};

			//0x013D is spooky ghost
			case 0x013D:
				forceBill = false;
				return {mdl:[{nsbmd:"teresa.nsbmd"}], other:[null, null, "teresa.nsbtp"]};

			case 0x013E:
				return {mdl:[{nsbmd:"Bank_Tree1.nsbmd"}]};
			case 0x013F:
				return {mdl:[{nsbmd:"GardenTree1.nsbmd"}]}; //non solid

			case 0x0140:
				return {mdl:[{nsbmd:"chandelier.nsbmd"}], other:[null, "chandelier.nsbca"]};
			case 0x0142:
				return {mdl:[{nsbmd:"MarioTree3.nsbmd"}]};
			case 0x0145:
				return {mdl:[{nsbmd:"TownTree1.nsbmd"}]};
			case 0x0146:
				//solid
				return {mdl:[{nsbmd:"Snow_Tree1.nsbmd"}]};
			case 0x0148:
				return {mdl:[{nsbmd:"DeTree1.nsbmd"}]};
			case 0x0149:
				return {mdl:[{nsbmd:"BankEgg1.nsbmd"}]};

			case 0x014B:
				return {mdl:[{nsbmd:"KinoHouse1.nsbmd"}]};
			case 0x014C:
				return {mdl:[{nsbmd:"KinoHouse2.nsbmd"}]};
			case 0x014D:
				return {mdl:[{nsbmd:"KinoMount1.nsbmd"}]};
			case 0x014E:
				return {mdl:[{nsbmd:"KinoMount2.nsbmd"}]};


			case 0x014F:
				return {mdl:[{nsbmd:"olaTree1c.nsbmd"}]};

			case 0x0150:
				return {mdl:[{nsbmd:"osaTree1c.nsbmd"}]};
			case 0x0151:
				forceBill = false;
				return {mdl:[{nsbmd:"picture1.nsbmd"}], other:[null, "picture1.nsbca"]};
			case 0x0152:
				forceBill = false;
				return {mdl:[{nsbmd:"picture2.nsbmd"}], other:[null, "picture2.nsbca"]};
			case 0x0153:
				return {mdl:[{nsbmd:"om6Tree1.nsbmd"}]};

			//0x0154 is rainbow road rotating star
			case 0x0154:
				forceBill = false;
				return {mdl:[{nsbmd:"RainStar.nsbmd"}], other:["RainStar.nsbta"]};

			case 0x0155:
				return {mdl:[{nsbmd:"Of6Tree1.nsbmd"}]};
			case 0x0156:
				return {mdl:[{nsbmd:"Of6Tree1.nsbmd"}]};
			case 0x0157:
				return {mdl:[{nsbmd:"TownMonte.nsbmd"}], other:[null, null, "TownMonte.nsbtp"]}; //pianta!

			//debug pianta bridge
			case 0x00CC:
				forceBill = false;
				return {mdl:[{nsbmd:"bridge.nsbmd"}], other:[null, "bridge.nsbca"]};
			//debug puddle
			case 0x000D:
				forceBill = false;
				return {mdl:[{nsbmd:"puddle.nsbmd"}]};
			//debug airship
			case 0x0158:
				forceBill = false;
				return {mdl:[{nsbmd:"airship.nsbmd"}]};

			//need version for 3d objects?

			//DEBUG ENEMIES - remove here when implemented.

			case 0x0191: //goomba
				return {mdl:[{nsbmd:"kuribo.nsbmd"}], other:[null, null, "kuribo.nsbtp"]}; //has nsbtp, route
			case 0x0192: //rock
				forceBill = false;
				return {mdl:[{nsbmd:"rock.nsbmd"}, {nsbmd:"rock_shadow.nsbmd"}]}; //has route
			case 0x0193: //thwomp
				forceBill = false;
				return {mdl:[{nsbmd:"dossun.nsbmd"}, {nsbmd:"dossun_shadow.nsbmd"}]}; //has route
			case 0x0196: //chain chomp
				forceBill = false;
				return {mdl:[{nsbmd:"wanwan.nsbmd"}, {nsbmd:"wanwan_chain.nsbmd"}, {nsbmd:"wanwan_kui.nsbmd"}, {nsbmd:"rock_shadow.nsbmd"}]};
			case 0x0198: //bowser castle GBA fireball
				return {mdl:[{nsbmd:"mkd_ef_bubble.nsbmd"}]};
			case 0x0199: //peach gardens monty
				forceBill = false;
				return {mdl:[{nsbmd:"choropu.nsbmd"}], other:[null, null, "choropu.nsbtp"]}; //has nsbtp
			case 0x019B: //cheep cheep (bouncing)
				return {mdl:[{nsbmd:"pukupuku.nsbmd"}]}; //has nsbtp //, other:[null, null, "pukupuku.nsbtp"]
			case 0x019D: //snowman
				return {mdl:[{nsbmd:"sman_top.nsbmd"}, {nsbmd:"sman_bottom.nsbmd"}]};
			case 0x019E: //trunk with bats
				forceBill = false;
				return {mdl:[{nsbmd:"kanoke_64.nsbmd"}, {nsbmd:"basabasa.nsbmd"}], other:[null, "kanoke_64.nsbca"]}; //basa has nsbtp
			case 0x01A0: //bat
				return {mdl:[{nsbmd:"basabasa.nsbmd"}], other:[null, null, "basabasa.nsbtp"]}; //has nsbtp
			case 0x01A1: //as fortress cannon
				forceBill = false;
				return {mdl:[{nsbmd:"NsCannon1.nsbmd"}]};
			case 0x01A3: //mansion moving tree
				forceBill = false;
				return {mdl:[{nsbmd:"move_tree.nsbmd"}], other:[null, "move_tree.nsbca"]}; //has route
			case 0x01A4: //flame
				forceBill = false;
				return {mdl:[{nsbmd:"mkd_ef_burner.nsbmd"}], other:["mkd_ef_burner.nsbta", null]};
			case 0x01A5: //chain chomp no base
				forceBill = false;
				return {mdl:[{nsbmd:"wanwan.nsbmd"}, {nsbmd:"wanwan_chain.nsbmd"}, {nsbmd:"rock_shadow.nsbmd"}]};

			case 0x01A6: //plant
				return {mdl:[{nsbmd:"ob_pakkun_sf.nsbmd"}], other:[null, null, "ob_pakkun_sf.nsbtp"]}; //has nsbtp

			case 0x01A7: //monty airship
				forceBill = false;
				return {mdl:[{nsbmd:"poo.nsbmd"}, {nsbmd:"cover.nsbmd"}, {nsbmd:"hole.nsbmd"}], other:[null, null, "poo.nsbtp"]}; //poo has nsbtp

			case 0x01A8: //bound
				forceBill = false;
				return {mdl:[{nsbmd:"bound.nsbmd"}], other:[null, null, "bound.nsbtp"]}; //has nsbtp
			case 0x01A9: //flipper
				forceBill = false;
				return {mdl:[{nsbmd:"flipper.nsbmd"}], other:["flipper.nsbta", null, "flipper.nsbtp"]}; //has nsbtp

			case 0x01AA: //3d fire plant
				forceBill = false;
				//note... what exactly is PakkunZHead...
				return {mdl:[{nsbmd:"PakkunMouth.nsbmd"}, {nsbmd:"PakkunBody.nsbmd"}, {nsbmd:"FireBall.nsbmd"}], other:[null, "PakkunMouth.nsbca"]};
			case 0x01AC: //crab
				forceBill = false;
				return {mdl:[{nsbmd:"crab.nsbmd"}, {nsbmd:"crab_hand.nsbmd"}], other:[null, null, "crab.nsbtp"]}; //both have nsbtp

			case 0x01AD: //desert hills sun
				forceBill = false;
				return {mdl:[{nsbmd:"sun.nsbmd"}, {nsbmd:"sun_LOD.nsbmd"}]/*, other:[null, "sun.nsbca"]*/}; //exesun animation does not load

			case 0x01B0: //routed iron ball
				return {mdl:[{nsbmd:"IronBall.nsbmd"}]};
			case 0x01B1: //routed choco mountain rock
				forceBill = false;
				return {mdl:[{nsbmd:"rock2.nsbmd"}]};
			case 0x01B2: //sanbo... whatever that is (pokey?) routed
				return {mdl:[{nsbmd:"sanbo_h.nsbmd"}, {nsbmd:"sanbo_b.nsbmd"}]};
			case 0x01B3: //iron ball
				return {mdl:[{nsbmd:"IronBall.nsbmd"}]};

			case 0x01B4: //cream
				forceBill = false;
				return {mdl:[{nsbmd:"cream.nsbmd"}, {nsbmd:"cream_effect.nsbmd"}]};
			case 0x01B5: //berry
				forceBill = false;
				return {mdl:[{nsbmd:"berry.nsbmd"}, {nsbmd:"cream_effect.nsbmd"}]};
		}	
	}

	function provideRes(r) {
		res = r; //...and gives them to us. :)

		if (forceBill) {
			t.angle[1] = 0;
			var bmd = r.mdl[0].bmd;
			bmd.hasBillboards = true;
			var models = bmd.modelData.objectData;
			for (var i=0; i<models.length; i++) {
				var objs = models[i].objects.objectData;
				for (var j=0; j<objs.length; j++) {
					objs[i].billboardMode = 2;
				}
			}
		}

		if (r.other != null) {
			if (r.other.length > 0 && r.other[0] != null) {
				res.mdl[0].loadTexAnim(r.other[0]);
			}
			if (r.other.length > 1 && r.other[1] != null)
				anim = new nitroAnimator(r.mdl[0].bmd, r.other[1]);
		}
	}

}