//
// sseqPlayer.js
//--------------------
// Provides an interface for playing SSEQs onto an AudioContext.
// by RHY3756547
//
//

window.SSEQWaveCache = new (function() {
	var cache = [];
	var sdat, ctx;

	this.cacheWaveArc = function(num) {
		if (cache[num] == null) {
			var warinfo = sdat.sections["$INFO"][3]
			if (warinfo[num] == null) return;
			var arc = warinfo[num].arc.samples;
			if (arc == null) return;
			cache[num] = [];
			for (var i=0; i<arc.length; i++) {
				cache[num].push({info: arc[i], buf: arc[i].getAudioBuffer(ctx)});
			}
		}
	}

	this.getWave = function(arc, num) {
		return cache[arc][num];
	}

	this.init = function(s, c) {
		cache = [];
		sdat = s;
		ctx = c;
	}
})();

window.SSEQPlayer = function(sseqHead, sdat, ctx, outputTarget, properties) {
	//a virtual machine, super fun obviously
	//
	//player handles loaded sounds.

	var CYCLE_TIME = 0.0052;

	var t = this;
	t.bpm = 120;
	t.bpmMultiplier = 1;
	t.transpose = 0; //overall transpose value, only set by external factors (threads cannot set this)
	t.volume = (t.volume == null)?1:t.volume;

	if (properties != null) {
		var p;
		for (p in properties) {
			if (properties.hasOwnProperty(p)) {
				t[p] = properties[p];
			}
		}
	}

	var ctx = ctx;
	t.ctx = ctx;
	var sseqHead = sseqHead;
	var sdat = sdat;
	t.lastNoteEnd = 0;

	t.tick = tick;
	t.threads = [];

	t.trackAlloc = 0;
	t.trackStarted = 0;

	t.playNote = playNote;
	t.cutNoteShort = cutNoteShort;
	t.startThread = startThread;
	t.terminateThread = terminateThread;
	t.setTempo = setTempo;
	t.updateNoteFreq = updateNoteFreq;
	t.setTranspose = setTranspose;
	t.kill = kill;

	t.bank = null;
	t.vars = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
	t.dead = false;

	t.masterGain = ctx.createGain();
	console.log("seqvol: "+(sseqHead.vol)/0x7F)
	t.masterGain.gain.value = (sseqHead.vol*t.volume)/0x7F;
	t.masterGain.connect((outputTarget != null)?outputTarget:ctx.destination);

	startThread(sseqHead.pc); //starts a thread with its initial pc pos
	loadBank(sseqHead.bank);
	t.loadBank = loadBank;
	var threadsToKill = [];
	t.baseAudioTime = ctx.currentTime;

	var buffer = 0.020;
	t.remainder = 0;

	tick();

	function tick() {
		var time = (ctx.currentTime-t.baseAudioTime)*(48*t.bpm/60)+t.remainder;
		t.remainder = time%1;
		time = Math.floor(time);
		t.baseAudioTime = ctx.currentTime;

		for (var i=0; i<t.threads.length; i++) {
			t.threads[i].tick(time);
		}

		while (threadsToKill.length>0) {
			t.threads.splice(threadsToKill.pop(), 1);
		}

		if (t.threads.length == 0 && ctx.currentTime > t.lastNoteEnd) t.dead = true;
	}

	function startThread(pc) {
		var thread = new SSEQThread(sseqHead.seq.data, pc, t);
		t.threads.push(thread);
	}

	function terminateThread(thread) {
		threadsToKill.push(t.threads.indexOf(thread));
	}

	function setTempo(bpm) {
		//sets tempo of threads and alters their wait times to adjust
		t.bpm = bpm*t.bpmMultiplier;
	}

	function loadBank(bn) {
		t.bank = sdat.sections["$INFO"][2][bn];
		if (t.bank == null) {return;}
		for (var i=0; i<4; i++) {
			if (t.bank.waveArcs[i] != 0xFFFF) SSEQWaveCache.cacheWaveArc(t.bank.waveArcs[i]);
		}
	}

	function cutNoteShort(thread, note) {
		try { //can throw exception if note has already ended.
			if (note.ended) return;
			var time = thread.calculateCurrentTime();
			var baseTime = (time == Infinity)?ctx.currentTime:time;
			if (baseTime > note.noteEndsAt) return;
			var releaseTime = note.relTime;
			note.note.gain.cancelScheduledValues(baseTime);
			note.note.gain.linearRampToValueAtTime(0, baseTime+releaseTime); //then release
			note.src.stop(baseTime+releaseTime);
			if (baseTime+releaseTime > t.lastNoteEnd) t.lastNoteEnd = baseTime+releaseTime;
		} catch (e) {}
	}

	function setTranspose(newT) {
		t.transpose = newT;
		for (var i=0; i<t.threads.length; i++) {
			var note = t.threads[i].lastNote;
			if (note != null) updateNoteFreq(t.threads[i], note);
		}
	}

	function updateNoteFreq(thread, note) {
		var noteOffsets = (note.pitched?((thread.pitchBend/0x7F)*thread.pitchBendRange):0)+thread.transpose+t.transpose;
		note.src.playbackRate.setValueAtTime((noteToFreq(note.start+noteOffsets)/note.base)/note.snd.info.mul, ctx.currentTime);
	}

	function kill() { //smoothly kills a sequence. If you want to instantly kill it, disconnect and then dereference it.
		t.lastNoteEnd = 0;
		for (var i=0; i<t.threads.length; i++) {
			var note = t.threads[i].lastNote;
			if (note != null) cutNoteShort(t.threads[i], note);
			t.threads.splice(i--, 1);
		}
	}

	function playNote(thread, velocity, duration, num) {
		if (thread.wait < 0) console.log("warning - MIDI buffer overflowed! "+thread.wait);
		velocity /= 127;
		if (t.bank.bank.instruments == null) return;
		var inst = t.bank.bank.instruments[thread.program];
		if (inst == null) return null;
		var oldinst = inst;
		inst = getInst(inst, num);
		if (inst == null) { /*debugger;*/ return; }

		var fireNote = true;
		var note;
		var source;
		var snd;
		if (thread.tie && thread.lastNote != null) {
			note = thread.lastNote.note;
			source = thread.lastNote.src;
			snd = thread.lastNote.snd;
		} else {
			note = ctx.createGain();
			note.connect(thread.gain);
			snd = SSEQWaveCache.getWave(t.bank.waveArcs[inst.swar], inst.swav);
			source = ctx.createBufferSource();
			source.loop = (snd.info.bLoop == 1);

			source.loopStart = snd.info.loopSTime;
			source.loopEnd = snd.buf.duration;

			source.buffer = snd.buf;
			source.connect(note);
		}

		var noteOffsets = thread.transpose+t.transpose; // (thread.pitchBend/0x7F)*thread.pitchBendRange+	
		
		var baseTime = thread.calculateCurrentTime();
		var realDur = (thread.tie)?Infinity:(ticksToMs(duration)/1000);

		var targetFreq = (noteToFreq(num+noteOffsets)/inst.freq)/snd.info.mul;
		if (thread.portaKey&0x80) source.playbackRate.value = targetFreq; //sound frequency may have been adjusted for the device to support it
		else {
			//handle porta
			//we need to calculate the sweep time then apply a linear transform to the playback rate to get there
			//when portaTime is 0 we use the length of the note
			var sweepPitch = thread.sweepPitch+(thread.portaKey-num)*(1<<6);

			source.playbackRate.setValueAtTime((noteToFreq(thread.portaKey+noteOffsets)/inst.freq)/snd.info.mul, baseTime);

			if (thread.portaTime == 0 && duration != Infinity) source.playbackRate.exponentialRampToValueAtTime(targetFreq, baseTime+(ticksToMs(duration)/1000));
			else {
				var timeS = thread.portaTime*thread.portaTime;
				var time = ticksToMs((Math.abs(sweepPitch)*timeS)>>11)/1000;
				source.playbackRate.exponentialRampToValueAtTime(targetFreq, baseTime+time);
			}
		}

		//sequence the note

		var atk = (thread.attack != null)?thread.attack:inst.attack;
		var dec = (thread.decay != null)?thread.decay:inst.decay;
		var sus = (thread.sustain != null)?thread.sustain:inst.sustainLvl;
		var rel = (thread.release != null)?thread.release:inst.release;

		var attackTime = calculateRequiredAttackCycles(convertAttToRate(atk))*CYCLE_TIME;//(255/convertAttToRate(inst.attack))*0.016; //0.01;
		var decayTime = (92544/convertFallToRate(dec))*(1-sus/0x7F)*CYCLE_TIME/2;
		var releaseTime = (92544/convertFallToRate(rel))*(sus/0x7F)*CYCLE_TIME/2;

		if ((!thread.tie) || thread.lastNote == null) {
			note.gain.value = 0.0;
			note.gain.setValueAtTime(0.0, baseTime); //initially 0
			note.gain.linearRampToValueAtTime(velocity, baseTime+attackTime); //attack
			note.gain.linearRampToValueAtTime(velocity*sus/0x7F, baseTime+attackTime+decayTime); //decay

			source.start(baseTime);

			source.onended = function(){
				note.ended = true;
				source.disconnect();
			}
		}

		if (realDur != Infinity) {
			if (baseTime+attackTime+decayTime < baseTime+realDur) note.gain.linearRampToValueAtTime(velocity*sus/0x7F, baseTime+realDur); //sustain until
			note.gain.linearRampToValueAtTime(0, baseTime+realDur+releaseTime); //then release
			source.stop(baseTime+realDur+releaseTime);

			if (baseTime+realDur+releaseTime > t.lastNoteEnd) t.lastNoteEnd = baseTime+realDur+releaseTime;
		}

		return {src: source, base: inst.freq, start:num, note: note, relTime: releaseTime, snd: snd, noteEndsAt:baseTime+realDur};
	}

	function calculateRequiredAttackCycles(att) {
		var value = 92544;
		var ticks = 0;
		while (value > 0) {
			value = Math.floor((att*value)/255);
			ticks++
		}
		return ticks;
	}

	function convertAttToRate(attack) {
		var table = [0x00, 0x01, 0x05, 0x0E, 0x1A, 0x26, 0x33, 0x3F, 0x49, 0x54,
		0x5C, 0x64, 0x6D, 0x74, 0x7B, 0x7F, 0x84, 0x89, 0x8F];
		if (attack & 0x80) return 0;
		else if (attack >= 0x6F) return table[0x7F-attack];
		else return 0xFF-attack;
	}

	function convertFallToRate(fall) {
		if (fall&0x80) return 0;
		else if (fall == 0x7F) return 0xFFFF;
		else if (fall == 0x7E) return 0x3C00;
		else if (fall < 0x32) return ((fall<<1)+1)&0xFFFF;
		else return (0x1E00/(0x7E-fall))&0xFFFF;
	}

	function noteToFreq(n) {
		return Math.pow(2, (n-49)/12)*440;
	}

	function getInst(inst, note) {
		switch (inst.type) {
			case 0:
				return null;
			case 1:
				return inst;
			case 2:
				return inst.entries[Math.max(inst.lower, Math.min(inst.upper, note))-inst.lower];
			case 3:
				for (var i=0; i<inst.regions.length; i++) {
					if (note <= inst.regions[i]) return inst.entries[i];
				}
				return null;
		}
	}

	function ticksToMs(ticks) {
		return (ticks/48)*(60000/t.bpm);
	}
}

function SSEQThread(prog, pc, player) {
	var VOLMUL = 1/4;
	var t = this;
	var pc = pc;
	var prog = prog;
	var player = player;
	var comparisonResult = false;

	//hacky implementation for certain instructions forcing the values of the next. thanks guys for making me have to do this
	var force = false;
	var forceCommand = 0;
	var forceValue = 0;
	var forceSpecial = 0;

	t.buffer = 10; //the distance in beats where we queue notes to fire.
	t.wait = 0;
	t.offT = 0;

	t.program = 0;
	t.pitchBendRange = 1;
	t.pitchBend = 0;
	t.portaKey = 0x80; //is a byte, top bit is on/off (set is off).
	t.portaTime = 0;
	t.sweepPitch = 0;
	t.transpose = 0;

	t.attack = null;
	t.delay = null;
	t.sustain = null;
	t.release = null;

	t.tie = false;

	t.tick = tick;
	t.calculateCurrentTime = calculateCurrentTime;

	t.noteWait = true;	
	t.loopPtr = 0;
	t.loopTimes = 0;

	//set up volume and pan controls
	var ctx = player.ctx;
	var gainL = ctx.createGain();
	var gainR = ctx.createGain();
	gainL.gain.value = 1;
	gainR.gain.value = 1;
	var merger = ctx.createChannelMerger(2);
	var splitter = ctx.createChannelSplitter(2);

	t.pan = 0;

	t.gain = player.ctx.createGain();
	t.gain.connect(gainL);
	t.gain.connect(gainR);

	t.gain.gain.value = VOLMUL;

	//splitter.connect(gainL, 0);
	//splitter.connect(gainR, 1);
	gainL.connect(merger, 0, 0);
	gainR.connect(merger, 0, 1);
	merger.connect(player.masterGain, 0, 0);
	//end audio setup

	t.lastNote = null;
	t.dead = false;

	t.stack = [];

	function tick(time) {
		t.wait -= time;
		t.offT = 0;
		var insts = 0;

		while (t.wait < t.buffer && !t.dead) {
			var inst = (force)?forceCommand:prog[pc++];
			if (inst<0x80) noteOn(inst);
			else if (Instructions[inst] != null) Instructions[inst](inst);
			else throw "bad instruction??";

			if (force && inst != 0xA0 && inst != 0xA1) force = false;

			if (++insts > 10000) { Instructions[0xFF](); console.error("audio thread locked up")};
		}

		if (t.wait == Infinity && t.lastNote != null && t.lastNote.note.ended) Instructions[0xFF]();
	}

	function noteOn(num) {
		if (num == 0) return; //NOP
		var velocity = forcableValue(true);
		var length = forcableValueFunc(false, readVariableLength);
		if (length == 0) length = Infinity;	
		t.lastNote = player.playNote(t, velocity, length, num);
		if (t.noteWait) t.wait += length;
	}

	function ticksToMs(ticks) {
		return (ticks/48)*(60000/player.bpm);
	}

	function readVariableLength() {
		var read = prog[pc++];
		var value = read&0x7F;
		while (read & 0x80) {
			var read = prog[pc++];
			value = (value<<7) | (read&0x7F);
		}
		return value;

	}

	function calculateCurrentTime() {
		return player.baseAudioTime+ticksToMs(t.wait-player.remainder)/1000;
	}

	var InstArgs = [ //starts at 0x80
		[readVariableLength], [readVariableLength], [], [], [], [], [], [], [], [], [], [], [], [], [], [], //0x80-0x8F
		[], [], [], [read8, read24], [read24], [read24], [], [], [], [], [], [], [], [], [], [], //0x90-0x9F
		[read8, readSpecial, read16, read16], [read8, readSpecial], [], [], [], [], [], [], [], [], [], [], [], [], [], [],
		[read8, read8], [read8, read8], [read8, read8], [read8, read8], [read8, read8], [read8, read8], [read8, read8], [], [read8, read8], [read8, read8], [read8, read8], [read8, read8], [read8, read8], [read8, read8], [], [], //0xB0-0xBF
		[read8], [read8], [read8], [read8], [read8], [read8], [read8], [read8], [read8], [read8], [read8], [read8], [read8], [read8], [read8], [read8], 
		[read8], [read8], [read8], [read8], [read8], [read8], [read8], [], [], [], [], [], [], [], [], [],
		[read16], [read16], [read16], [], [], [], [], [], [], [], [], [], [], [], [], [], 
		[], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], 
	]

	var Instructions = [];

	Instructions[0xFE] = function() { //track definition
		player.trackAlloc = read16();
	}

	Instructions[0x93] = function() { //track definition
		var trackID = prog[pc++];
		var newPC = prog[pc++];
		newPC |= prog[pc++]<<8;
		newPC |= prog[pc++]<<16;

		var bit = 1<<trackID;
		if ((!(player.trackStarted&bit)) && (player.trackAlloc&bit)) {
			player.trackStarted |= bit;		
			player.startThread(newPC);
		}
	}

	Instructions[0x80] = function() { //rest
		var length = forcableValueFunc(false, readVariableLength);
		t.wait += length;
	}

	Instructions[0x81] = function() { //bank or program change
		var dat = forcableValueFunc(false, readVariableLength);
		t.program = dat&0x7F;
		var bank = dat>>7;
		if (bank != 0) player.loadBank(bank);
	}

	Instructions[0x94] = function() { //JUMP
		var newPC = prog[pc++];
		newPC |= prog[pc++]<<8;
		newPC |= prog[pc++]<<16;
		pc = newPC;
	}

	Instructions[0x95] = function() { //CALL
		var newPC = prog[pc++];
		newPC |= prog[pc++]<<8;
		newPC |= prog[pc++]<<16;
		t.stack.push(pc);
		pc = newPC;
	}

	Instructions[0xFD] = function() { //RETURN
		if (t.stack.length == 0) Instructions[0xFF]();
		pc = t.stack.pop();
	}

	//LOGIC INSTRUCTIONS

	Instructions[0xA0] = function() { //random
		force = true; //this command forces the input to the next command to be a generated random number
		forceCommand = prog[pc++];
		if (forceCommand < 0x80 || (forceCommand >= 0xB0 && forceCommand <= 0xBD)) forceSpecial = prog[pc++];
		var min = reads16();
		var max = reads16();
		forceValue = Math.floor(Math.random()*(max-min+1))+min;
	}

	Instructions[0xA1] = function() { //from var
		force = true; //this command forces the input to the next command to be from a variable. use with caution probably!
		forceCommand = prog[pc++];
		if (forceCommand < 0x80 || (forceCommand >= 0xB0 && forceCommand <= 0xBD)) forceSpecial = prog[pc++];
		forceValue = player.vars[prog[pc++]];
	}

	function varInst(inst){
		var varNum = forcableValue(true);
		var arg = forcableValue();
		if (arg & 0x80) arg -= 256;
		if (inst == 0xB4 && arg == 0) return;
		varFunc[inst-0xB0](varNum, arg)
	}

	var varFunc = [ //"=", "+=", "-=", "*=", "/=", "[Shift]", "[Rand]"
		function(a, b) { player.vars[a] = b },
		function(a, b) { player.vars[a] += b },
		function(a, b) { player.vars[a] -= b },
		function(a, b) { player.vars[a] *= b },
		function(a, b) { player.vars[a] = Math.floor(player.vars[a]/b) },
		function(a, b) { 
			if (b < 0) player.vars[a] = player.vars[a]>>(-b);
			else player.vars[a] = player.vars[a]<<b;
		},
		function(a, b) {
			if (b < 0) player.vars[a] = -(Math.floor(Math.random()*256)%(1-b));
			else player.vars[a] = -(Math.floor(Math.random()*256)%(b+1));
		}
	]

	Instructions[0xB0] = varInst;
	Instructions[0xB1] = varInst;
	Instructions[0xB2] = varInst;
	Instructions[0xB3] = varInst;
	Instructions[0xB4] = varInst;
	Instructions[0xB5] = varInst;
	Instructions[0xB6] = varInst;

	function boolInst(inst){
		var varNum = forcableValue(true);
		var arg = forcableValue();
		if (arg & 0x80) arg -= 256;
		comparisonResult = boolFunc[inst-0xB8](varNum, arg);
	}

	var boolFunc = [
		function(a, b) { return player.vars[a] == b },
		function(a, b) { return player.vars[a] >= b },
		function(a, b) { return player.vars[a] > b },
		function(a, b) { return player.vars[a] <= b },
		function(a, b) { return player.vars[a] < b },
		function(a, b) { return player.vars[a] != b },
	]

	Instructions[0xB8] = boolInst;
	Instructions[0xB9] = boolInst;
	Instructions[0xBA] = boolInst;
	Instructions[0xBB] = boolInst;
	Instructions[0xBC] = boolInst;
	Instructions[0xBD] = boolInst;

	Instructions[0xA2] = function() { //if#
		if (!comparisonResult) {
			//skip next
			var inst = prog[pc++];
			if (inst < 0x80) {
				read8();
				readVariableLength();
			} else {
				var cmds = InstArgs[inst-0x80];
				var last = 0;
				for (var i=0; i<cmds.length; i++) {
					last = cmds[i](last);
				}
			}
		}
	}

	//END LOGIC INSTRUCTIONS

	Instructions[0xC0] = function() { var value = forcableValue(); setPan((value-64)/64) } //pan
	Instructions[0xC1] = function() { var value = forcableValue(); t.gain.gain.setValueAtTime((value/0x7F)*VOLMUL, calculateCurrentTime()); } //volume
	Instructions[0xC2] = function() { var value = forcableValue(); player.masterGain.gain.setValueAtTime(value/0x7F, calculateCurrentTime()); } //master volume
	Instructions[0xC3] = function() { t.transpose = forcableValue(); if (t.transpose & 0x80) t.transpose -= 256; } //transpose
	Instructions[0xC4] = function() { 
		t.pitchBend = forcableValue(); 
		if (t.pitchBend & 128) t.pitchBend -= 256;
		if (t.lastNote != null) {
			t.lastNote.pitched = true;
			player.updateNoteFreq(t, t.lastNote);
		}
	} //pitch bend
	Instructions[0xC5] = function() { t.pitchBendRange = prog[pc++]; } //pitch bend range
	Instructions[0xC6] = function() { var value = prog[pc++]; } //track priority

	Instructions[0xC7] = function() { t.noteWait = (prog[pc++]>0); } //mono/poly

	Instructions[0xC8] = function() { t.tie = prog[pc++]; if (t.lastNote != null) player.cutNoteShort(t, t.lastNote); t.lastNote = null; } //tie
	Instructions[0xC9] = function() { t.portaKey = prog[pc++]; } //portamento control
	Instructions[0xCA] = function() { var value = forcableValue(); } //modulation depth
	Instructions[0xCB] = function() { var value = forcableValue(); } //modulation speed
	Instructions[0xCC] = function() { var value = prog[pc++]; } //modulation type
	Instructions[0xCD] = function() { var value = prog[pc++]; } //modulation range
	Instructions[0xCE] = function() { t.portaKey = (t.portaKey&0x7F)|((!prog[pc++])<<7); } //portamento on/off
	Instructions[0xCF] = function() { t.portaTime = forcableValue(); } //portamento time
	Instructions[0xD0] = function() { t.attack = forcableValue(); } //attack rate
	Instructions[0xD1] = function() { t.decay = forcableValue(); } //decay rate
	Instructions[0xD2] = function() { t.sustain = forcableValue(); } //sustain rate
	Instructions[0xD3] = function() { t.release = forcableValue(); } //release rate

	Instructions[0xD4] = function() { t.loopTimes = forcableValue(); t.loopPtr = pc; } //loop start
	Instructions[0xFC] = function() { if (t.loopTimes-- > 0) pc = t.loopPtr; } //loop end

	Instructions[0xD5] = function() { var value = forcableValue(); } //expression
	Instructions[0xD6] = function() { var value = prog[pc++]; } //print variable
	Instructions[0xE0] = function() { var value = prog[pc++]; value |= prog[pc++]<<8 } //modulation delay

	Instructions[0xE1] = function() { 
		var value = prog[pc++]; 
		value |= prog[pc++]<<8;
		player.setTempo(value);
	} //set BPM

	Instructions[0xE3] = function() { t.sweepPitch = forcableValueFunc(false, reads16); } //sweep pitch

	Instructions[0xFF] = function() { 
		if (t.lastNote != null) player.cutNoteShort(t, t.lastNote);
		player.terminateThread(t); 
		t.dead = true; 
	} //end of track

	function read16() {
		var value = prog[pc++]; 
		value |= prog[pc++]<<8;
		return value;
	}

	function reads16() {
		var value = read16();
		if (value & 0x8000) value -= 0x10000;
		return value;
	}

	function read8() {
		return prog[pc++];
	}

	function readSpecial(last) {
		if (last < 0x80 || (last >= 0xB0 && last < 0xBD)) return prog[pc++]; 
		else return 0;
	}

	function read24() {
		var value = prog[pc++];
		value |= prog[pc++]<<8;
		value |= prog[pc++]<<16;
		return value;
	}

	function forcableValueFunc(special, func) {
		if (force) return special?forceSpecial:forceValue;
		else return func();
	}

	function forcableValue(special) {
		if (force) return special?forceSpecial:forceValue;
		else return prog[pc++];
	}

	function setPan(value) {
		t.pan = value;
		if (value > 0) {
			gainR.gain.value = 1;
			gainL.gain.value = 1-value;
		} else {
			gainR.gain.value = 1+value;
			gainL.gain.value = 1;
		}
	}

	function noteToFreq(n) {
		return Math.pow(2, (n-49)/12)*440;
	}
}	