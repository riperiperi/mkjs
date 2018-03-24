//
// nitroEmitter.js
//--------------------
// Implemtents the generic nitro particle emitter.
// by riperiperi
//

window.NitroEmitter = function(scene, targ, emitterID, vector, offset) {
    var t = this;
    t.update = update;
    t.draw = draw;

    var pRes = scene.gameRes.RaceEffect;
    var emitter = (emitterID == -1)?null:pRes.particles[emitterID];
    t.attached = targ; //an entity with pos and vel.

    if (vector == null) vector = [0, 1, 0];
    if (offset == null) offset = [0,0,0];
    t.offset = offset;
    t.vector = vector;
    t.pctParticle = 0;
    t.time = 0;
    t.dead = false;
    t.curPrio = 0;
    t.doNotDelete = (emitter == null);
    t.pause = false;

    t.setEmitter = setEmitter;
    t.clearEmitter = clearEmitter;

    var particleList = [emitterID, -1, -1, -1];

    function setEmitter(emitterID, prio) {
        particleList[prio] = emitterID;
        if (t.curPrio <= prio) {
            //activate this emitter immediately.
            t.curPrio = prio;
            t.dead = false;
            emitter = pRes.particles[emitterID];
            t.time = 0;
        }
    }

    function clearEmitter(prio) {
        //if (t.curPrio > prio) return; //this emitter cannot be unset
        if (prio == t.curPrio) {
            findNextEmitter();
        } else {
            particleList[prio] = -1;
        }
    }

    function findNextEmitter() {
        particleList[t.curPrio] = -1;
        var em = t.curPrio-1;
        while (em >= 0) {
            if (particleList[em] != -1) {
                t.dead = false;
                emitter = pRes.particles[particleList[em]];
                t.time = 0;
                t.curPrio = em;
                return;
            }
            em--;
        }
        if (em == -1) {
            t.curPrio = 0;
            emitter = null;
            dead = true;
        }
        t.curPrio = em;
    }

    function update(scene) {
        if (emitter == null || t.dead || t.pause) return;
        if ((t.time % (emitter.frequency)) == 0 && t.time >= emitter.delay) {
            //should we create new particles? fractional logic for doing this
            t.pctParticle += emitter.particleChance;
            while (t.pctParticle >= 1) {

                var attach = (emitter.flag & 0x8000) > 0;

                t.pctParticle -= 1;
                //create a new particle
                //TODO: make these transform with the target's world matrix
                var pos = vec3.create();
                //add offset
                vec3.add(pos, pos, t.offset);
                //add emitter properties
                vec3.add(pos, pos, emitter.position);
                var spread = [Math.random()*2-1, Math.random()*2-1, Math.random()*2-1];
                var spreadMode = (emitter.flag & 0xF);
                if (spreadMode == 2) {
                    spread[1] = 0; //spread is only in xz direction
                }
                vec3.normalize(spread, spread);
                if (spreadMode == 0) {
                    spread = [0,0,0];
                }
                vec3.scale(spread, spread, Math.random()*emitter.areaSpread*2);
                vec3.add(pos, pos, spread);

                vec3.scale(pos, pos, 16);
                if (!attach) {
                    if (targ.mat != null) {
                        vec3.transformMat4(pos, pos, targ.mat);
                    } else {
                        vec3.add(pos, pos, targ.pos);
                    }
                }

                //inherit velocity
                var vel = (attach)?vec3.create():vec3.clone(targ.vel);
                vec3.scale(vel, vel, 1/32);

                var vector = vec3.clone(t.vector);
                if (!attach) {
                    if (targ.mat != null) {
                        //tranform our vector by the target matrix
                        var mat = targ.mat;
                        var org = [];
                        mat4.getTranslation(org, mat);
                        mat[12] = 0;
                        mat[13] = 0;
                        mat[14] = 0;

                        vec3.transformMat4(vector, vector, mat);

                        mat[12] = org[0];
                        mat[13] = org[1];
                        mat[14] = org[2];
                    }
                }
                vec3.normalize(vector, vector);
                vec3.add(vel, vel, vec3.scale([], vector, emitter.velocity));

                var xz = [Math.random()*2-1, 0, Math.random()*2-1];
                vec3.normalize(xz, xz);
                vec3.scale(xz, xz, Math.random()*emitter.randomxz);
                vec3.add(vel, vel, xz);

                var rotVel = ((emitter.rotVelFrom + ((Math.random()*emitter.rotVelTo-emitter.rotVelFrom) | 0))/65535) * Math.PI*2;
                var dir = ((emitter.flag & 0x2000) > 0)?(Math.random()*Math.PI*2):0;
                var duration = emitter.duration + emitter.duration * emitter.varDuration/0xFF * (Math.random() * 2 - 1);
                var scaleMod = (emitter.varScale/0xFF * (Math.random() * 2 - 1)) + 1;

                var scale = [scaleMod * emitter.size, scaleMod * emitter.size * emitter.aspect];

                var particle = new NitroParticle(scene, emitter, pos, vel, dir, rotVel, duration, scale, (attach?t.attached:null));
                particle.ovel = (attach)?vec3.create():vec3.scale([], targ.vel, 1/32);

                scene.particles.push(particle);
            }


            var pos = vec3.clone(targ.pos);

        }
        t.time++;

        if (t.time == emitter.emitterLifetime) {
            t.dead = true;
            if (!t.doNotDelete) scene.removeParticle(t);
            else {
                findNextEmitter();
            }
        }
    }

    function draw(view, pMatrix, gl) {

    }
}