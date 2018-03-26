//
// nitroParticle.js
//--------------------
// Implements a generic nitro particle. Currently positioned and updated in software for debug
// simplicity - but should be moved to vertex shader in future.
// by riperiperi
//

window.NitroParticle = function(scene, emitter, pos, vel, dir, dirVel, duration, scale, attached) {
    var t = this;
    t.update = update;
    t.draw = draw;

    t.time = 0;
    t.duration = duration | 0;
    t.pos = vec3.add(pos, pos, [0, 0, 0]);
    t.vel = vel;
    t.dirVel = dirVel; //float
    t.dir = dir; //float
    t.attached = attached;
    t.scale = scale; //vec2
    t.emitter = emitter;

    t.aScale = 1;
    //decode 16 bit color into float
    t.baseColor = convertCol(emitter.color);
    t.baseColor[3] = emitter.opacity / 0x1F;
    t.aColor = vec4.clone(t.baseColor);

    t.frame = emitter.textureId;
    if (t.emitter.texAnim)
        t.frame = t.emitter.texAnim.textures[0];

    function convertCol(col) {
        return [
        ((col&31)/31), 
        (((col>>5)&31)/31),
        (((col>>10)&31)/31),
        1 //Math.round((col>>15)*255);
        ];
    }

    function update(scene) {
        var particlePct = t.time / t.duration;

        t.pos[0] += t.vel[0] * 16;
        t.pos[1] += t.vel[1] * (t.emitter.yOffIntensity/128) * 16;
        t.pos[2] += t.vel[2] * 16;
        if (t.emitter.gravity) {
            vec3.add(t.vel, t.vel, t.emitter.gravity);
        }
        if (t.emitter.colorAnim) {
            var ca = t.emitter.colorAnim;
            var from = convertCol(ca.colorFrom);
            var to = convertCol(ca.colorTo);
            var pctFloat = (ca.framePct/0xFFFF);
            vec4.lerp(t.aColor, from, to, Math.max(0, (particlePct - pctFloat)/(1 - pctFloat)));
            t.aColor[3] = t.emitter.opacity/0x1F;
        } else {
            t.aColor = vec4.clone(t.baseColor);
        }
        if (t.emitter.opacityAnim) {
            var oa = t.emitter.opacityAnim;
            var pctFade = oa.startFade / 0xFFFF;
            var opaMul = 1-Math.max(0, (particlePct - pctFade)/(1 - pctFade));
            t.aColor[3] = opaMul;// * oa.intensity/0x0FFF;
            //vec4.scale(t.aColor, t.aColor, opaMul);
        }
        if (t.emitter.texAnim) {
            var ta = t.emitter.texAnim;
            var frame = 0;
            if ((ta.unknown1 & 128) > 0) {
                //select frame based on particle duration
                var frame = ta.textures[Math.min((particlePct * ta.frames) | 0, ta.frames-1)];
            } else {
                //repeating anim with framerate
                //not sure what framerate is, but its likely in the unknowns.
                var frame = ta.textures[(t.time % ta.frames)];
            }
            t.frame = frame;
        }

        t.dir += t.dirVel;

        if (t.time++ >= t.duration) scene.removeParticle(t);
    }

    function draw(view, pMatrix, gl) {
        var particlePct = t.time / t.duration;

        var pos = t.pos;
        var vel = t.vel;

        if (t.attached != null) {
            pos = vec3.transformMat4([], pos, t.attached.mat);

            
            //tranform our vector by the target matrix
            var mat = t.attached.mat;
            var org = [];

            mat4.getTranslation(org, mat);
            mat[12] = 0;
            mat[13] = 0;
            mat[14] = 0;

            vel = vec3.transformMat4([], vel, mat);

            mat[12] = org[0];
            mat[13] = org[1];
            mat[14] = org[2];
            
        }

        var mat = mat4.translate(mat4.create(), view, pos);
            
        var bbMode = t.emitter.flag & 0xF0;

        if (bbMode == 0x10) { //spark, billboards towards camera
            var camPos = scene.camera.view.pos;

            camPos = vec3.sub([], camPos, pos);
            vec3.normalize(camPos, camPos);

            var n = vec3.sub([], vel, t.ovel);
            vec3.normalize(n,n);
            mat4.multiply(mat, mat, mat4.invert([], mat4.lookAt([], [0,0,0], camPos, n)));
            
        } else if (bbMode == 0x20) { //no billboard
            mat4.rotateY(mat, mat, t.dir);
        } else if (bbMode == 0x30) { //spark, no billboard
            var camPos = scene.camera.view.pos;

            camPos = vec3.sub([], camPos, pos);
            vec3.normalize(camPos, camPos);

            var n = vec3.sub([], vel, t.ovel);
            vec3.normalize(n,n);
            mat4.multiply(mat, mat, mat4.invert([], mat4.lookAt([], [0,0,0], camPos, n)));
            mat4.rotateY(mat, mat, t.dir);
        } else { //billboard
            mat4.multiply(mat, mat, nitroRender.billboardMat);
            mat4.rotateZ(mat, mat, t.dir);
        }
        var finalScale = 1;
        if (t.emitter.scaleAnim) {
            var sa = t.emitter.scaleAnim;
            if (particlePct < sa.fromZeroTime) {
                var fzPct = particlePct / sa.fromZeroTime;
                finalScale = sa.scaleFrom * fzPct;
            } else {
                var rescaledPct = Math.min(1, (particlePct - sa.fromZeroTime) / (1-(sa.fromZeroTime + sa.holdTime*(1-sa.fromZeroTime))));
                finalScale = sa.scaleFrom * (1-rescaledPct) + sa.scaleTo * rescaledPct;
            }
        }
        mat4.scale(mat, mat, vec3.scale([], [t.scale[0], t.scale[1], 1], 12*finalScale));
        mat4.translate(mat, mat, [t.emitter.xScaleDelta, t.emitter.yScaleDelta, 0]);

        drawGeneric(mat, pMatrix, gl);
    }

    var MAT3I = mat3.create();
    var MAT4I = mat4.create();
    function drawGeneric(mv, project, gl) {
        var shader = nitroRender.nitroShader;
        if (!nitroRender.flagShadow) {
            gl.uniform1f(shader.shadOffUniform, 0.001);
            gl.uniform1f(shader.lightIntensityUniform, 0);
        }
        if (window.VTX_PARTICLE == null) genGlobalVtx(gl);
        var obj = window.VTX_PARTICLE;

        nitroRender.setColMult(t.aColor);

        gl.uniformMatrix4fv(shader.mvMatrixUniform, false, mv);
        gl.uniformMatrix4fv(shader.pMatrixUniform, false, project);
        //matrix stack unused, just put an identity in slot 0
        gl.uniformMatrix4fv(shader.matStackUniform, false, MAT4I);

        var frame = t.emitter.parent.getTexture(t.frame, gl);
        gl.bindTexture(gl.TEXTURE_2D, frame);
        //texture matrix not used
        gl.uniformMatrix3fv(shader.texMatrixUniform, false, MAT3I);
        if (obj != nitroRender.last.obj) {
            gl.bindBuffer(gl.ARRAY_BUFFER, obj.vPos);
            gl.vertexAttribPointer(shader.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, obj.vTx);
            gl.vertexAttribPointer(shader.textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, obj.vCol);
            gl.vertexAttribPointer(shader.colorAttribute, 4, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, obj.vMat);
            gl.vertexAttribPointer(shader.matAttribute, 1, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, obj.vNorm);
            gl.vertexAttribPointer(shader.normAttribute, 3, gl.FLOAT, false, 0, 0);
            nitroRender.last.obj = obj;
        }

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        nitroRender.setColMult([1, 1, 1, 1]);
        if (!nitroRender.flagShadow) {
            nitroRender.resetShadOff();
            gl.uniform1f(shader.lightIntensityUniform, 0.3);
        }
    }

    function genGlobalVtx(gl) {
        var vecPos = [-1,-1,0, 1,-1,0, -1,1,0, 1,1,0];
        var vecTx = [1,1, 0,1, 1,0, 0,0];
        var vecCol = [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1];
        var vecMat = [0,0,0,0];
        var vecNorm = [0,1,0, 0,1,0, 0,1,0, 0,1,0];

        var pos = gl.createBuffer();
        var col = gl.createBuffer();
        var tx = gl.createBuffer();
        var mat = gl.createBuffer();
        var norm = gl.createBuffer();

        var posArray = new Float32Array(vecPos);

        gl.bindBuffer(gl.ARRAY_BUFFER, pos);
        gl.bufferData(gl.ARRAY_BUFFER, posArray, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, tx);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vecTx), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, col);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vecCol), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, mat);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vecMat), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, norm);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vecNorm), gl.STATIC_DRAW);

        window.VTX_PARTICLE = {
            posArray: posArray,
            vPos: pos,
            vTx: tx,
            vCol: col,
            vMat: mat,
            vNorm: norm,
            verts: vecPos.length/3,
        };
    }
}