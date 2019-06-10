//
// nitroAudio.js
//--------------------
// Provides an interface for playing nds music and sound effects.
// by RHY3756547
//

window.AudioContext = window.AudioContext || window.webkitAudioContext;

window.nitroAudio = new (function() {
	var t = this;
	var ctx;

	t.sounds = [];

	t.tick = tick;
	t.playSound = playSound;
	t.kill = kill;
	t.init = init;
	t.instaKill = instaKill;
	t.updateListener = updateListener;

	t.sdat = null;

	function init(sdat) {
		ctx = new AudioContext();
		t.ctx = ctx;

		var listener = ctx.listener;
		listener.dopplerFactor = 1;
		listener.speedOfSound = 100/1024; //343.3

		SSEQWaveCache.init(sdat, ctx);
		t.sdat = sdat;
	}

	function updateListener(pos, view) {
		var listener = ctx.listener;
		if (listener.positionX == null) {
			//use old setters. safari ios
			listener.setPosition(pos[0], pos[1], pos[2]);
			listener.setOrientation(view[8], -view[9], -view[10], view[4], view[5], view[6]);
		} else {
			listener.positionX.value = pos[0];
			listener.positionY.value = pos[1];
			listener.positionZ.value = pos[2];
			listener.forwardX.value = view[8];
			listener.forwardY.value = -view[9];
			listener.forwardZ.value = -view[10];
			listener.upX.value = view[4];
			listener.upY.value = view[5];
			listener.upZ.value = view[6];
		}
	}

	function tick() {
		for (var i=0; i<t.sounds.length; i++) {
			var snd = t.sounds[i];
			snd.seq.tick();
			if (snd.obj != null && snd.obj.soundProps != null && snd.panner != null) updatePanner(snd.panner, snd.obj.soundProps);
		}
		for (var i=0; i<t.sounds.length; i++) {
			var snd = t.sounds[i];
			snd.dead = snd.seq.dead;
			if (snd.dead) {
				snd.gainN.disconnect();
				t.sounds.splice(i--, 1);
			}
		}
	}

	function kill(sound) {
		if (!sound.killing) {
			sound.killing = true;
			sound.seq.kill();
		}
	}

	function instaKill(sound) { //instantly kills a sound
		if (sound == null) return;
		var ind = t.sounds.indexOf(sound)
		sound.gainN.disconnect();
		if (ind == -1) return;
		t.sounds.splice(ind, 1);
	}

	function playSound(seqN, params, arcN, obj) { //if arc is not specified, we just play a normal sequence. this allows 3 overloads. 
		//obj should have a property "soundProps" where it sets its falloff, position and velocity relative to the oberver occasionally
		var sound = { dead: false, killing: false, obj: obj };

		var output;
		if (obj != null) { //if obj is not null then we have a 3d target to assign this sound to.
			output = ctx.createPanner();
			sound.gainN = ctx.createGain();
			sound.gainN.connect(ctx.destination);
			output.connect(sound.gainN);
			sound.panner = output;

			if (sound.obj.soundProps == null) sound.obj.soundProps = obj;
			updatePanner(sound.panner, sound.obj.soundProps);
		} else {
			output = ctx.createGain();
			sound.gainN = output;
			output.connect(ctx.destination);
		}

		var player;
		if (arcN == null) {
			var seq = t.sdat.sections["$INFO"][0][seqN];
			if (seq == null) return;
			sound.seq = new SSEQPlayer(seq, t.sdat, ctx, output, params);
		} else {
			var arc = t.sdat.sections["$INFO"][1][arcN];
			if (arc == null) return;
			var seq = arc.arc.entries[seqN];
			if (seq == null) return;
			sound.seq = new SSEQPlayer(seq, t.sdat, ctx, output, params);
		}

		//now that we have the player, package it in an object
		t.sounds.push(sound);
		return sound;
	}

	function updatePanner(panner, soundProps) {
		if (panner == null || soundProps == null) return;
		if (soundProps.pos != null) panner.setPosition(soundProps.pos[0], soundProps.pos[1], soundProps.pos[2]);
		//if (soundProps.vel != null) panner.setVelocity(soundProps.vel[0], soundProps.vel[1], soundProps.vel[2]);

		panner.refDistance = soundProps.refDistance || 192;
		if (soundProps.panningModel != null) panner.panningModel = soundProps.panningModel;
		panner.rolloffFactor = soundProps.rolloffFactor || 1;
	}

})();