//
// itembox.js
//--------------------
// Drives and animates itembox entity.
// by RHY3756547
//

window.ItemBox = function(obji, scene) {
	var obji = obji;
	var res = [];

	var t = this;

	var anim = 0;
	var animFrame = 0;
	var animMat;
	var frames = 0;

	t.soundProps = {};
	t.pos = vec3.clone(obji.pos);
	//t.angle = vec3.clone(obji.angle);
	t.scale = vec3.clone(obji.scale);

	t.sndUpdate = sndUpdate;
	t.requireRes = requireRes;
	t.provideRes = provideRes;
	t.update = update;
	t.draw = draw;

	t.mode = 0;
	t.time = 0;

	var test = 0;


	function update(scene) {
		switch (t.mode) {
			case 0: //alive
				for (var i=0; i<scene.karts.length; i++) {
					var ok = scene.karts[i];
					var dist = vec3.dist(vec3.add([], t.pos, [0,1,0]), ok.pos);
					if (dist < 24) {
						var breakSound = nitroAudio.playSound(212, {}, 0, t);
						breakSound.gainN.gain.value = 4;
						for (var j=0; j<10; j++) {
							scene.particles.push(new ItemShard(scene, ok, res.mdl[2]));
						}
						scene.particles.push(new NitroEmitter(scene, ok, 47));
						t.mode = 1;
						t.time = 0;
						break;
					}
				}
				break;
			case 1: //dead
				if (t.time++ > 30) {
					t.mode = 2;
					t.time = 0;
				}
				break;
			case 2: //respawning
				if (t.time++ > 30) {
					t.mode = 0;
					t.time = 0;
				}
				break;
		}

		animMat = anim.setFrame(0, 0, animFrame);
		animFrame = (animFrame+1)%frames;
	}

	function draw(view, pMatrix, gl) {
		if (t.mode == 0 || t.mode == 2) {
			if (t.mode == 2) nitroRender.setColMult([1, 1, 1, t.time/30]);
			var mat = mat4.translate(mat4.create(), view, t.pos);
				
			mat4.scale(mat, mat, vec3.scale([], t.scale, 16));

			//res.mdl[2].draw(mat, pMatrix);

			mat4.translate(mat, mat, [0, 1, 0])

			gl.enable(gl.CULL_FACE); //box part
			//gl.depthMask(false);
			res.mdl[0].drawPoly(mat, pMatrix, 0, 1, animMat);
			//gl.depthMask(true);
			gl.disable(gl.CULL_FACE);

			//question mark part
			gl.depthRange(0, 0.99); //hack to push question mark forward in z buffer, causes a few issues with far away boxes though
			res.mdl[0].drawPoly(mat, pMatrix, 0, 0, animMat);
			gl.depthRange(0, 1);

			if (t.mode == 2) nitroRender.setColMult([1, 1, 1, 1]);
		}
	}

	function sndUpdate(view) {
		t.soundProps.pos = vec3.transformMat4([], t.pos, view);
		if (t.soundProps.lastPos != null) t.soundProps.vel = vec3.sub([], t.soundProps.pos, t.soundProps.lastPos);
		else t.soundProps.vel = [0, 0, 0];
		t.soundProps.lastPos = t.soundProps.pos;

		t.soundProps.refDistance = 192/1024;
		t.soundProps.rolloffFactor = 1;
	}

	function requireRes() { //scene asks what resources to load
		return {mdl:[{nsbmd:"itembox.nsbmd"}, {nsbmd:"obj_shadow.nsbmd"}, {nsbmd:"itembox_hahen.nsbmd"}], other:["itembox.nsbca"]};	
	}

	function provideRes(r) {
		res = r; //...and gives them to us. :)
		anim = new nitroAnimator(r.mdl[0].bmd, r.other[0]);
		frames = r.other[0].animData.objectData[0].frames;
		animFrame = Math.floor(Math.random()*frames);
		animMat = anim.setFrame(0, 0, animFrame);
	}

}