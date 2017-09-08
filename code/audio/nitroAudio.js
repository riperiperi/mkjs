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
		if (soundProps.refDistance != null) panner.refDistance = soundProps.refDistance;
		if (soundProps.panningModel != null) panner.panningModel = soundProps.panningModel;
		if (soundProps.rolloffFactor != null) panner.rolloffFactor = soundProps.rolloffFactor;
	}

})();