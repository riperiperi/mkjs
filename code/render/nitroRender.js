//
// nitroRender.js
//--------------------
// Provides an interface with which NSBMD models can be drawn to a fst canvas.
// by RHY3756547
//
// includes: gl-matrix.js (glMatrix 2.0)
// /formats/nitro.js --passive requirement from other nitro formats
// /formats/nsbmd.js
// /formats/nsbta.js
// /formats/nsbtx.js
//

window.nitroRender = new function() {
	var gl, frag, vert, nitroShader;
	var cVec, color, texCoord, norm;
	var vecMode, vecPos, vecNorm, vecTx, vecCol, vecNum, vecMat, curMat;
	var texWidth, texHeight, alphaMul = 1;

	this.cullModes = [];

	this.billboardID = 0; //incrememts every time billboards need to be updated. cycles &0xFFFFFF to avoid issues
	this.lastMatStack = null; //used to check if we need to send the matStack again. will be used with a versioning system in future.

	this.last = {}; //obj: the last vertex buffers drawn

	var optimiseTriangles = true; //improves draw performance by >10x on most models.

	var modelBuffer;
	var shaders = [];

	this.renderDispList = renderDispList;
	this.setAlpha = setAlpha;
	this.getViewWidth = getViewWidth;
	this.getViewHeight = getViewHeight;

	this.flagShadow = false;

	var parameters = {
		0: 0, 
		0x10:1, 0x11:0, 0x12:1, 0x13:1, 0x14:1, 0x15:0, 0x16:16, 0x17:12, 0x18:16, 0x19:12, 0x1A:9, 0x1B:3, 0x1C:3, //matrix commands
		0x20:1, 0x21:1, 0x22:1, 0x23:2, 0x24:1, 0x25:1, 0x26:1, 0x27:1, 0x28:1, 0x29:1, 0x2A:1, 0x2B:1, //vertex commands
		0x30:1, 0x31:1, 0x32:1, 0x33:1, 0x34:32, //material param
		0x40:1, 0x41:0, //begin or end vertices
		0x50:1, //swap buffers
		0x60:1, //viewport
		0x70:3, 0x71:2, 0x72:1 //tests
	}

	var instructions = {};

	instructions[0x14] = function(view, off) { //restore to matrix, used constantly for bone transforms
		curMat = view.getUint8(off);
	}

	instructions[0x20] = function(view, off) { //color
		var dat = view.getUint16(off,true);
		color[0] = (dat&31)/31;
		color[1] = ((dat>>5)&31)/31;
		color[2] = ((dat>>10)&31)/31;
	}

	instructions[0x21] = function(view, off) { //normal
		var dat = view.getUint32(off, true);
		norm[0] = tenBitSign(dat);
		norm[1] = tenBitSign(dat>>10);
		norm[2] = tenBitSign(dat>>20);
	}

	instructions[0x22] = function(view, off) { //texcoord
		texCoord[0] = (view.getInt16(off, true)/16)/texWidth;
		texCoord[1] = (view.getInt16(off+2, true)/16)/texHeight;
	}

	instructions[0x23] = function(view, off) { //xyz 16 bit
		cVec[0] = view.getInt16(off, true)/4096;
		cVec[1] = view.getInt16(off+2, true)/4096;
		cVec[2] = view.getInt16(off+4, true)/4096;
		pushVector();
	}

	instructions[0x24] = function(view, off) { //xyz 10 bit
		var dat = view.getUint32(off, true);
		cVec[0] = tenBitSign(dat);
		cVec[1] = tenBitSign(dat>>10);
		cVec[2] = tenBitSign(dat>>20);
		pushVector();
	}

	instructions[0x25] = function(view, off) { //xy 16 bit
		cVec[0] = view.getInt16(off, true)/4096;
		cVec[1] = view.getInt16(off+2, true)/4096;
		pushVector();
	}


	instructions[0x26] = function(view, off) { //xz 16 bit
		cVec[0] = view.getInt16(off, true)/4096;
		cVec[2] = view.getInt16(off+2, true)/4096;
		pushVector();
	}


	instructions[0x27] = function(view, off) { //yz 16 bit
		cVec[1] = view.getInt16(off, true)/4096;
		cVec[2] = view.getInt16(off+2, true)/4096;
		pushVector();
	}

	instructions[0x28] = function(view, off) { //xyz 10 bit relative
		var dat = view.getUint32(off, true);
		cVec[0] += relativeSign(dat);
		cVec[1] += relativeSign(dat>>10);
		cVec[2] += relativeSign(dat>>20);
		pushVector();
	}

	instructions[0x40] = function(view, off) { //begin vtx
		var dat = view.getUint32(off, true);
		vecMode = dat;
		
		if (!optimiseTriangles) {
			vecPos = [];
			vecNorm = [];
			vecTx = [];
			vecCol = [];
			vecMat = [];
		}
		vecNum = 0;
	}

	instructions[0x41] = function(view, off) { //end vtx
		if (!optimiseTriangles) pushStrip();
	}

	function setAlpha(alpha) { //for fading specific things out or whatever
		alphaMul = alpha;
	}

	function getViewWidth(){
		return gl.viewportWidth;
	}

	function getViewHeight() {
		return gl.viewportHeight;
	}

	function pushStrip() { //push the last group of triangles to the buffer. Should do this on matrix change... details fourthcoming
		var modes = (optimiseTriangles)?[gl.TRIANGLES, gl.TRIANGLES, gl.TRIANGLES, gl.TRIANGLES]:[gl.TRIANGLES, gl.TRIANGLES, gl.TRIANGLE_STRIP, gl.TRIANGLE_STRIP];
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

		modelBuffer.strips.push({
			posArray: posArray,
			vPos: pos,
			vTx: tx,
			vCol: col,
			vMat: mat,
			vNorm: norm,
			verts: vecPos.length/3,
			mode: modes[vecMode]
		})
	}

	function pushVector() {
		if (vecMode == 1 && vecNum%4 == 3) { //quads - special case
			vecPos = vecPos.concat(vecPos.slice(vecPos.length-9, vecPos.length-6)).concat(vecPos.slice(vecPos.length-3));
			vecNorm = vecNorm.concat(vecNorm.slice(vecNorm.length-9, vecNorm.length-6)).concat(vecNorm.slice(vecNorm.length-3));
			vecTx = vecTx.concat(vecTx.slice(vecTx.length-6, vecTx.length-4)).concat(vecTx.slice(vecTx.length-2));
			vecCol = vecCol.concat(vecCol.slice(vecCol.length-12, vecCol.length-8)).concat(vecCol.slice(vecCol.length-4));
			vecMat = vecMat.concat(vecMat.slice(vecMat.length-3, vecMat.length-2)).concat(vecMat.slice(vecMat.length-1));
		}

		if (optimiseTriangles && (vecMode > 1) && (vecNum > 2)) { //convert tri strips to individual triangles so we get one buffer per polygon
			vecPos = vecPos.concat(vecPos.slice(vecPos.length-6));
			vecNorm = vecNorm.concat(vecNorm.slice(vecNorm.length-6));
			vecTx = vecTx.concat(vecTx.slice(vecTx.length-4));
			vecCol = vecCol.concat(vecCol.slice(vecCol.length-8));
			vecMat = vecMat.concat(vecMat.slice(vecMat.length-2));
		}

		vecNum++;

		vecPos = vecPos.concat(cVec);
		vecTx = vecTx.concat(texCoord);
		vecCol = vecCol.concat(color);
		vecNorm = vecNorm.concat(norm);
		vecMat.push(curMat);

	}

	function tenBitSign(val) {
		val &= 1023;
		if (val & 512) return (val-1024)/64;
		else return val/64;
	}
	function relativeSign(val) {
		val &= 1023;
		if (val & 512) return (val-1024)/4096;
		else return val/4096;
	}

	this.init = function(ctx) {
		gl = ctx;
		this.gl = gl;
		
		shaders = nitroShaders.compileShaders(gl);

		this.nitroShader = shaders[0];
		this.cullModes = [gl.FRONT_AND_BACK, gl.FRONT, gl.BACK];
	}

	this.prepareShader = function() {
		//prepares the shader so no redundant calls have to be made. Should be called upon every program change.
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		this.last = {};
		gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(this.nitroShader.samplerUniform, 0);
	}

	this.setShadowMode = function(sTex, fsTex, sMat, fsMat) {
		this.nitroShader = shaders[1];
		var shader = shaders[1];
		gl.useProgram(shader);

		gl.uniformMatrix4fv(shader.shadowMatUniform, false, sMat);
		gl.uniformMatrix4fv(shader.farShadowMatUniform, false, fsMat);
		gl.uniform1f(shader.lightIntensityUniform, 0.3);

		this.resetShadOff();
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, sTex);
		gl.uniform1i(shader.lightSamplerUniform, 1);

		gl.activeTexture(gl.TEXTURE2);
		gl.bindTexture(gl.TEXTURE_2D, fsTex);
		gl.uniform1i(shader.farLightSamplerUniform, 2);

		this.setColMult([1, 1, 1, 1]);
		this.prepareShader();
	}

	this.resetShadOff = function() {
		var shader = shaders[1];
		gl.uniform1f(shader.shadOffUniform, 0.00005+((mobile)?0.0005:0));
		gl.uniform1f(shader.farShadOffUniform, 0.0005);
	}

	this.unsetShadowMode = function() {
		this.nitroShader = shaders[0];
		gl.useProgram(this.nitroShader);

		this.setColMult([1, 1, 1, 1]);
		this.prepareShader();
	}

	this.setColMult = function(color) {
		gl.useProgram(this.nitroShader);
		gl.uniform4fv(this.nitroShader.colMultUniform, color);
	}

	this.updateBillboards = function(view) {
		this.billboardID = (this.billboardID+1)%0xFFFFFF;

		var nv = mat4.clone(view);
		nv[12] = 0;
		nv[13] = 0;
		nv[14] = 0; //nullify translation
		var nv2 = mat4.clone(nv);
		this.billboardMat = mat4.invert(nv, nv);
		nv2[4] = 0;
		nv2[5] = 1; //do not invert y axis view
		nv2[6] = 0;
		this.yBillboardMat = mat4.invert(nv2, nv2);
	}

	function renderDispList(disp, tex, startStack) { //renders the display list to a form of vertex buffer. The idea is that NSBTA and NSBCA can still be applied to the buffer at little performance cost. (rather than recompiling the model)
		modelBuffer = {
			strips: []
			/* strip entry format:
				vPos: glBuffer,
				vTx: glBuffer,
				vCol: glBuffer,
				verts: int count of vertices,
				mode: (eg. gl.TRIANGLES, gl.TRIANGLESTRIP)
				mat: transformation matrix to apply. unused atm as matrix functions are unimplemented
			*/
		} //the nitroModel will store this and use it for rendering instead of the display list in future.

		curMat = startStack; //start on root bone
		var shader = nitroRender.nitroShader;
		var gl = nitroRender.gl;
		var off=0;
		var view = new DataView(disp);

		texWidth = tex.width;
		texHeight = tex.height;

		cVec = [0,0,0];
		norm = [0,1,0];
		texCoord = [0,0];
		color = [1,1,1,alphaMul]; //todo: polygon attributes

		vecMode = 0;
		vecNum = 0;
		vecPos = []; 
		vecNorm = [];
		vecTx = []; 
		vecCol = [];
		vecMat = [];

		while (off < disp.byteLength) {
			var ioff = off;
			off += 4;
			for (var i=0; i<4; i++) {
				var inst = view.getUint8(ioff++);
				if (instructions[inst] != null) {
					instructions[inst](view, off);
				} else {
					if (inst != 0) alert("invalid instruction 0x"+(inst.toString(16)));
				}
				var temp = parameters[inst];
				off += (temp == null)?0:temp*4;
			}
		}

		if (optimiseTriangles) pushStrip();

		return modelBuffer;
	}

};

function nitroModel(bmd, btx, remap) {
	var bmd = bmd;
	this.bmd = bmd;
	var thisObj = this;
	var loadedTex;
	var texCanvas;
	var tex;
	var texAnim;
	var texFrame;
	var modelBuffers;
	var collisionModel = [];
	var matBufEmpty = new Float32Array(31*16);

	var temp = mat4.create();
	var off=0;
	for (var i=0; i<31; i++) {
		matBufEmpty.set(temp, off);
		off += 16;
	}
	temp = null;

	var texMap = { tex:{}, pal:{} };
	//var matStack;
	this.draw = draw;
	this.drawPoly = externDrawPoly;
	this.drawModel = externDrawModel;
	this.getCollisionModel = getCollisionModel;

	modelBuffers = []
	this.modelBuffers = modelBuffers;
	var matBuf = [];
	for (var i=0; i<bmd.modelData.objectData.length; i++) {
		modelBuffers.push(new Array(bmd.modelData.objectData[i].polys.objectData.length));
		matBuf.push({built: false, dat: new Float32Array(31*16)});
	}

	if (remap != null) {
		setTextureRemap(remap);
	}

	if (btx != null) {
		loadTexture(btx);
	} else if (bmd.tex != null) {
		loadTexture(bmd.tex)
	} else {
		loadWhiteTex();

	}


function loadWhiteTex(btx) { //examines the materials in the loaded model and generates textures for each.
		var gl = nitroRender.gl; //get gl object from nitro render singleton
		loadedTex = btx;
		texCanvas = [];
		tex = [];
		var models = bmd.modelData.objectData;
		for (var j=0; j<models.length; j++) {
			var model = models[j];
			var mat = model.materials.objectData
			for (var i=0; i<mat.length; i++) {
				var m = mat[i];
				
				var fC = document.createElement("canvas");
				fC.width = 2;
				fC.height = 2;
				var ctx = fC.getContext("2d")
				ctx.fillStyle = "black";
				ctx.globalAlpha=0.33;
				ctx.fillRect(0,0,2,2);
				texCanvas.push(fC);
				var t = loadTex(fC, gl, !m.repeatX, !m.repeatY);
				t.realWidth = 2;
				t.realHeight = 2;
				tex.push(t);
			}
		}
	}

	function loadTexture(btx) { //examines the materials in the loaded model and generates textures for each.
		var gl = nitroRender.gl; //get gl object from nitro render singleton
		loadedTex = btx;
		texCanvas = [];
		tex = [];
		var models = bmd.modelData.objectData;
		for (var j=0; j<models.length; j++) {
			var model = models[j];
			var mat = model.materials.objectData
			for (var i=0; i<mat.length; i++) {
				var m = mat[i];
				var texI = mat[i].tex;
				var palI = mat[i].pal;
				//remap below
				var nTex = texMap.tex[texI];
				var nPal = texMap.pal[palI];
				if ((texI == null && nTex == null) || (palI == null && nPal == null)) {
					debugger;
					console.warn("WARNING: material "+i+" in model could not be assigned a texture.")

					var fC = document.createElement("canvas");
					fC.width = 2;
					fC.height = 2;
					var ctx = fC.getContext("2d")
					ctx.fillStyle = "white";
					ctx.fillRect(0,0,2,2);
					texCanvas.push(fC);
					var t = loadTex(fC, gl, !m.repeatX, !m.repeatY);
					t.realWidth = 2;
					t.realHeight = 2;
					tex.push(t);

					continue;
				}

				var truetex = (nTex==null)?texI:nTex;
				var truepal = (nPal==null)?palI:nPal;
				var cacheID = truetex+":"+truepal;
				var cached = btx.cache[cacheID];

				if (cached == null) {
					var canvas = btx.readTexWithPal(truetex, truepal);
					if (m.flipX || m.flipY) {
						var fC = document.createElement("canvas");
						var ctx = fC.getContext("2d");
						fC.width = (m.flipX)?canvas.width*2:canvas.width;
						fC.height = (m.flipY)?canvas.height*2:canvas.height;

						ctx.drawImage(canvas, 0, 0);
						ctx.save();
						if (m.flipX) {
							ctx.translate(2*canvas.width, 0);
							ctx.scale(-1, 1);
							ctx.drawImage(canvas, 0, 0);
							ctx.restore();
							ctx.save();
						}
						if (m.flipY) {
							ctx.translate(0, 2*canvas.height);
							ctx.scale(1, -1);
							ctx.drawImage(fC, 0, 0);
							ctx.restore();
						}
						texCanvas.push(fC);
						var t = loadTex(fC, gl, !m.repeatX, !m.repeatY);
						t.realWidth = canvas.width;
						t.realHeight = canvas.height;
						tex.push(t);
						btx.cache[cacheID] = t;
					} else {
						texCanvas.push(canvas);
						var t = loadTex(canvas, gl, !m.repeatX, !m.repeatY);
						t.realWidth = canvas.width;
						t.realHeight = canvas.height;
						tex.push(t);
						btx.cache[cacheID] = t;
					}
				} else {
					tex.push(cached);
				}
			}
		}
	}

	function setTextureRemap(remap) {
		texMap = remap;
		if (loadedTex != null) loadTexture(loadedTex)
	}

	this.loadTexAnim = function(bta) {
		texAnim = bta;
		texFrame = 0;
	}

	this.setFrame = function(frame) {
		texFrame = frame;
	}

	function externDrawModel(mv, project, mdl) {
		var models = bmd.modelData.objectData;
		drawModel(models[mdl], mv, project, mdl);
	}

	function externDrawPoly(mv, project, modelind, poly, matStack) {
		var models = bmd.modelData.objectData;
		var model = models[modelind];

		var polys = model.polys.objectData;
		var matStack = matStack;
		if (matStack == null) {
			matStack = matBuf[modelind];

			if (((thisObj.billboardID != nitroRender.billboardID) && bmd.hasBillboards) || (!matStack.built)) {
				nitroRender.lastMatStack = null;
				generateMatrixStack(model, matStack.dat);
				matStack.built = true;
				thisObj.billboardID = nitroRender.billboardID;
			}
		}

		var shader = nitroRender.nitroShader;

		var mv = mat4.scale([], mv, [model.head.scale, model.head.scale, model.head.scale]);

		gl.uniformMatrix4fv(shader.mvMatrixUniform, false, mv);
		gl.uniformMatrix4fv(shader.pMatrixUniform, false, project);
		if (matStack != nitroRender.lastMatStack) {
			gl.uniformMatrix4fv(shader.matStackUniform, false, matStack.dat);
			nitroRender.lastMatStack = matStack;
		}

		drawPoly(polys[poly], modelind, poly);
	}

	function draw(mv, project, matStack) {
		var models = bmd.modelData.objectData;
		for (var j=0; j<models.length; j++) {
			drawModel(models[j], mv, project, j, matStack);
		}
	}

	function getCollisionModel(modelind, polyind) { //simple func to get collision model for a model. used when I'm too lazy to define my own... REQUIRES TRI MODE ACTIVE!
		if (collisionModel[modelind] == null) collisionModel[modelind] = [];
		if (collisionModel[modelind][polyind] != null) return collisionModel[modelind][polyind];
		var model = bmd.modelData.objectData[modelind];
		var poly = model.polys.objectData[polyind];
		if (modelBuffers[modelind][polyind] == null) modelBuffers[modelind][polyind] = nitroRender.renderDispList(poly.disp, tex[poly.mat], (poly.stackID == null)?model.lastStackID:poly.stackID);

		var tris = modelBuffers[modelind][polyind].strips[0].posArray;

		var out = [];
		var tC = tris.length/9;
		var off = 0;
		for (var i=0; i<tC; i++) {
			var t = {}
			t.Vertex1 = [tris[off++], tris[off++], tris[off++]];
			t.Vertex2 = [tris[off++], tris[off++], tris[off++]];
			t.Vertex3 = [tris[off++], tris[off++], tris[off++]];

			//calculate normal
			var v = vec3.sub([], t.Vertex2, t.Vertex1);
			var w = vec3.sub([], t.Vertex3, t.Vertex1);
			t.Normal = vec3.cross([], v, w)
			vec3.normalize(t.Normal, t.Normal);
			out.push(t);
		}
		collisionModel[modelind][polyind] = {dat:out, scale:model.head.scale};
		return collisionModel[modelind][polyind];
	}

	function drawModel(model, mv, project, modelind, matStack) {
		var polys = model.polys.objectData;
		var matStack = matStack;
		if (matStack == null) {
			matStack = matBuf[modelind];

			if (((thisObj.billboardID != nitroRender.billboardID) && bmd.hasBillboards) || (!matStack.built)) {
				nitroRender.lastMatStack = null;
				generateMatrixStack(model, matStack.dat);
				matStack.built = true;
				thisObj.billboardID = nitroRender.billboardID;
			}
		}
		var shader = nitroRender.nitroShader;

		var mv = mat4.scale([], mv, [model.head.scale, model.head.scale, model.head.scale]);

		gl.uniformMatrix4fv(shader.mvMatrixUniform, false, mv);
		gl.uniformMatrix4fv(shader.pMatrixUniform, false, project);
		if (matStack != nitroRender.lastMatStack) {
			gl.uniformMatrix4fv(shader.matStackUniform, false, matStack.dat);
			nitroRender.lastMatStack = matStack;
		}

		for (var i=0; i<polys.length; i++) {
			drawPoly(polys[i], modelind, i);
		}
	}

	function drawPoly(poly, modelind, polyind) {
		var shader = nitroRender.nitroShader;
		var model = bmd.modelData.objectData[modelind];
		var gl = nitroRender.gl;

		//texture 0 SHOULD be bound, assuming the nitrorender program has been prepared
        if (nitroRender.last.tex != tex[poly.mat]) {
        	gl.bindTexture(gl.TEXTURE_2D, tex[poly.mat]); //load up material texture
        	nitroRender.last.tex = tex[poly.mat];
        }

		var material = model.materials.objectData[poly.mat];
		nitroRender.setAlpha(material.alpha)

		if (texAnim != null) {
			//generate and send texture matrix from data
			var matname = model.materials.names[poly.mat]; //attach tex anim to mat with same name
			var anims = texAnim.animData.objectData[modelind].data;
			var animNum = anims.names.indexOf(matname);

			if (animNum != -1) {
				//we got a match! it's wonderful :')
				var anim = anims.objectData[animNum];
				var mat = mat3.create(); //material texture mat is ignored
				mat3.scale(mat, mat, [anim.scaleS[(texFrame>>anim.frameStep.scaleS)%anim.scaleS.length], anim.scaleT[(texFrame>>anim.frameStep.scaleT)%anim.scaleT.length]]);
				mat3.translate(mat, mat, [-anim.translateS[(texFrame>>anim.frameStep.translateS)%anim.translateS.length], anim.translateT[(texFrame>>anim.frameStep.translateT)%anim.translateT.length]]) //for some mystery reason I need to negate the S translation
				gl.uniformMatrix3fv(shader.texMatrixUniform, false, mat);
			} else {
				gl.uniformMatrix3fv(shader.texMatrixUniform, false, material.texMat);
			}

		} else gl.uniformMatrix3fv(shader.texMatrixUniform, false, material.texMat);	

        if (modelBuffers[modelind][polyind] == null) modelBuffers[modelind][polyind] = nitroRender.renderDispList(poly.disp, tex[poly.mat], (poly.stackID == null)?model.lastStackID:poly.stackID);
        drawModelBuffer(modelBuffers[modelind][polyind], gl, shader);
	}

function generateMatrixStack(model, targ) { //this generates a matrix stack with the default bones. use nitroAnimator to pass custom matrix stacks using nsbca animations.
		var matrices = [];

		var objs = model.objects.objectData;
		var cmds = model.commands;
		var curMat = mat4.create();
		var lastStackID = 0;

		for (var i=0; i<cmds.length; i++) {
			var cmd = cmds[i];
			if (cmd.restoreID != null) curMat = mat4.clone(matrices[cmd.restoreID]);
			var o = objs[cmd.obj];
			mat4.multiply(curMat, curMat, o.mat);
			if (o.billboardMode == 1) mat4.multiply(curMat, curMat, nitroRender.billboardMat);
			if (o.billboardMode == 2) mat4.multiply(curMat, curMat, nitroRender.yBillboardMat);
			if (cmd.stackID != null) {
				matrices[cmd.stackID] = mat4.clone(curMat);
				lastStackID = cmd.stackID;
			} else {
				matrices[lastStackID] = mat4.clone(curMat);
			}
		}

		model.lastStackID = lastStackID;

		targ.set(matBufEmpty);
		var off=0;
		for (var i=0; i<31; i++) {
			if (matrices[i] != null) targ.set(matrices[i], off);
			off += 16;
		}

		return targ;
	}

	function drawModelBuffer(buf, gl, shader) {
		for (var i=0; i<buf.strips.length; i++) {
			var obj = buf.strips[i];

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

			gl.drawArrays(obj.mode, 0, obj.verts);
		}
	}
}

function loadTex(img, gl, clampx, clampy) { //general purpose function for loading an image into a texture.
	var texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	if (clampx) gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    if (clampy) gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	texture.width = img.width;
	texture.height = img.height;

	gl.bindTexture(gl.TEXTURE_2D, null);
	return texture;
}