//
// soundMaker.js
//--------------------
// Provides env sound object, such as crowd for figure 8
// by RHY3756547
//

//0008

window.ObjSoundMaker = function(obji, scene) {
	var obji = obji;

	var t = this;

	t.pos = vec3.clone(obji.pos);

	t.soundProps = {};
	t.sndUpdate = sndUpdate;
	t.requireRes = requireRes;
	t.provideRes = provideRes;
	t.update = update;
	t.draw = draw;

	var mat = mat4.create();
	var frame = 0;

	var sound = null;
	var sN = 0;
	var threshold = 0.2;
	var gain = 1;
	switch (obji.ID) {
		case 0x0008: 
			sN = 259;
			gain = 2;
			threshold = 0.2;
			break;
	}

	function draw(view, pMatrix) {

	}

	function update() {
	}

	function sndUpdate(view) {
		t.soundProps.pos = vec3.transformMat4([], t.pos, view);
		t.soundProps.pos = [0, 0, Math.sqrt(vec3.dot(t.soundProps.pos, t.soundProps.pos))]
		//if (t.soundProps.lastPos != null) t.soundProps.vel = vec3.sub([], t.soundProps.pos, t.soundProps.lastPos);
		//else t.soundProps.vel = [0, 0, 0];
		//t.soundProps.lastPos = t.soundProps.pos;

		t.soundProps.refDistance = 1024/1024;
		//t.soundProps.rolloffFactor = 1;

		var calcVol = (t.soundProps.refDistance / (t.soundProps.refDistance + t.soundProps.rolloffFactor * (t.soundProps.pos[2] - t.soundProps.refDistance)));

		if (calcVol<threshold) {
			if (sound != null) {
				nitroAudio.instaKill(sound);
				sound = null;
			}
		} else {
			if (sound == null) {
				sound = nitroAudio.playSound(sN, {}, 0, t);
				sound.gainN.gain.value = gain;
			}
		}
	}

	function requireRes() {
		return {mdl: []};
	}

	function provideRes(r) { }

}