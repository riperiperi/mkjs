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
	var vecMode, vecPos, vecNorm, vecTx, vecCol, vecNum, vecMat, curMat, stripAlt;
	var texWidth, texHeight, alphaMul = 1;
	var t = this;

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
	this.forceFlatNormals = false; //generate flat normals for this mesh. Used for course model for better shadows.

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
		stripAlt = 0;
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
		if (t.forceFlatNormals && modes[vecMode] == gl.TRIANGLES) {
			//calculate new flat normals for each triangle
			for (var i=0; i<vecPos.length; i+=9) {
				var v1 = [vecPos[i], vecPos[i+1], vecPos[i+2]];
				var v2 = [vecPos[i+3], vecPos[i+4], vecPos[i+5]];
				var v3 = [vecPos[i+6], vecPos[i+7], vecPos[i+8]];

				vec3.sub(v2, v2, v1);
				vec3.sub(v3, v3, v1);
				var newNorm = vec3.cross([], v2, v3);
				vec3.normalize(newNorm, newNorm);
				for (var j=0; j<3; j++) {
					for (var k=0; k<3; k++) {
						vecNorm[i+(j*3)+k] = newNorm[k];
					}
				}
			}
		}

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
			var b = vecMat.length - (((stripAlt % 2) == 0)?1:3);
			var s2 = vecMat.length - (((stripAlt % 2) == 0)?2:1);
			vecPos = vecPos.concat(vecPos.slice(b*3, b*3+3)).concat(vecPos.slice(s2*3, s2*3+3));
			vecNorm = vecNorm.concat(vecNorm.slice(b*3, b*3+3)).concat(vecNorm.slice(s2*3, s2*3+3));
			vecTx = vecTx.concat(vecTx.slice(b*2, b*2+2)).concat(vecTx.slice(s2*2, s2*2+2));
			vecCol = vecCol.concat(vecCol.slice(b*4, b*4+4)).concat(vecCol.slice(s2*4, s2*4+4));
			vecMat = vecMat.concat(vecMat.slice(b, b+1)).concat(vecMat.slice(s2, s2+1));
			stripAlt++;
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
		this.billboardMat = mat4.create();
		this.yBillboardMat = mat4.create();
		
		shaders = nitroShaders.compileShaders(gl);

		this.nitroShader = shaders[0];
		this.cullModes = [gl.FRONT_AND_BACK, gl.FRONT, gl.BACK];
	}

	this.prepareShader = function() {
		//prepares the shader so no redundant calls have to be made. Should be called upon every program change.
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); //gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		this.last = {};
		gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(this.nitroShader.samplerUniform, 0);
	}

	this.setShadowMode = function(sTex, fsTex, sMat, fsMat, dir) {
		this.nitroShader = shaders[1];
		var shader = shaders[1];
		gl.useProgram(shader);

		vec3.normalize(dir, dir);
		gl.uniform3fv(shader.lightDirUniform, dir);
		gl.uniformMatrix4fv(shader.shadowMatUniform, false, sMat);
		gl.uniformMatrix4fv(shader.farShadowMatUniform, false, fsMat);
		gl.uniform1f(shader.lightIntensityUniform, 0.3);

		this.resetShadOff();
		this.setNormalFlip(1);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, sTex);
		gl.uniform1i(shader.lightSamplerUniform, 1);

		gl.activeTexture(gl.TEXTURE2);
		gl.bindTexture(gl.TEXTURE_2D, fsTex);
		gl.uniform1i(shader.farLightSamplerUniform, 2);

		this.setColMult([1, 1, 1, 1]);
		this.prepareShader();
	}

	this.setLightIntensities = function(intensity, shadIntensity) {
		if (intensity == null) intensity = 0.3;
		if (shadIntensity == null) shadIntensity = 1;
		var shader = this.nitroShader;
		gl.useProgram(this.nitroShader);
		gl.uniform1f(shader.lightIntensityUniform, intensity);
		gl.uniform1f(shader.shadLightenUniform, 1-shadIntensity);
	}

	this.setShadBias = function(bias) {
		var shader = this.nitroShader;
		gl.useProgram(this.nitroShader);
		gl.uniform1f(shader.shadOffUniform, bias);
		gl.uniform1f(shader.farShadOffUniform, bias);
	}

	this.setNormalFlip = function(flip) {
		var shader = this.nitroShader;
		gl.useProgram(this.nitroShader);
		gl.uniform1f(shader.normalFlipUniform, flip);
	}

	this.resetShadOff = function() {
		var shader = this.nitroShader;
		gl.useProgram(this.nitroShader);
		gl.uniform1f(shader.shadOffUniform, 0.0005+((mobile)?0.0005:0));
		gl.uniform1f(shader.farShadOffUniform, 0.0020);
	}

	this.unsetShadowMode = function() {
		this.nitroShader = shaders[0];
		gl.useProgram(this.nitroShader);

		this.setColMult([1, 1, 1, 1]);
		this.prepareShader();
	}

	var paused = false;

	this.pauseShadowMode = function() {
		this.nitroShader = shaders[0];
		if (this.nitroShader == shaders[1]) paused = true;
		gl.useProgram(this.nitroShader);

		this.setColMult([1, 1, 1, 1]);
		this.prepareShader();
	}

	this.unpauseShadowMode = function() {
		if (!paused) return;
		this.nitroShader = shaders[1];
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
		stripAlt = 0;
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

function nitroModel(bmd, btx) {
	var bmd = bmd;
	this.bmd = bmd;
	var thisObj = this;
	var loadedTex;
	var texCanvas;
	var tex;
	var texAnim;
	var texPAnim;
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
	this.getBoundingCollisionModel = getBoundingCollisionModel;
	this.getCollisionModel = getCollisionModel;
	this.baseMat = mat4.create();

	modelBuffers = []
	this.modelBuffers = modelBuffers;
	var matBuf = [];
	for (var i=0; i<bmd.modelData.objectData.length; i++) {
		modelBuffers.push(new Array(bmd.modelData.objectData[i].polys.objectData.length));
		matBuf.push({built: false, dat: new Float32Array(31*16)});
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
				mat[i].texInd = tex.length;
				loadMatTex(mat[i], btx);
			}
		}
	}

	function loadMatTex(mat, btx, matReplace) {
		var m = mat;
		if (matReplace) m = matReplace;
		var texI = m.texName;
		var palI = m.palName;

		if (texI == null || palI == null) {
			debugger;
			console.warn("WARNING: material "+i+" in model could not be assigned a texture.");
			/*

			var fC = document.createElement("canvas");
			fC.width = 2;
			fC.height = 2;
			var ctx = fC.getContext("2d")
			ctx.fillStyle = "white";
			ctx.fillRect(0,0,2,2);
			texCanvas.push(fC);
			var t = loadTex(fC, gl, !mat.repeatX, !mat.repeatY);
			t.realWidth = 2;
			t.realHeight = 2;
			tex.push(t);
			*/

			return;
		}

		var truetex = loadedTex.textureInfo.nameToIndex["$" + texI] || 0;
		var truepal = loadedTex.paletteInfo.nameToIndex["$" + palI] || 0;
		var cacheID = truetex+":"+truepal;
		var cached = btx.cache[cacheID];

        tex[mat.texInd] = cacheTex(btx, truetex, truepal, mat);
	}

	function cacheTex(btx, truetex, truepal, m) {
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
				btx.cache[cacheID] = t;
				return t;
			} else {
				texCanvas.push(canvas);
				var t = loadTex(canvas, gl, !m.repeatX, !m.repeatY);
				t.realWidth = canvas.width;
				t.realHeight = canvas.height;
				btx.cache[cacheID] = t;
				return t;
			}
		} else {
			return cached;
		}
	}

	this.loadTexAnim = function(bta) {
		texAnim = bta;
		texFrame = 0;
	}

	this.loadTexPAnim = function(btp) {
		texPAnim = btp;
	}

	this.setFrame = function(frame) {
		texFrame = frame;
	}

	this.setBaseMat = function(mat) {
		thisObj.baseMat = mat;
		thisObj.billboardID = -1;
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

		//var mv = mat4.scale([], mv, [model.head.scale, model.head.scale, model.head.scale]);

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

	function getBoundingCollisionModel(modelind, polyind) { //simple func to get collision model for a model. used when I'm too lazy to define my own... REQUIRES TRI MODE ACTIVE!
		var model = bmd.modelData.objectData[modelind];
		var poly = model.polys.objectData[polyind];
		if (modelBuffers[modelind][polyind] == null) modelBuffers[modelind][polyind] = nitroRender.renderDispList(poly.disp, tex[poly.mat], (poly.stackID == null)?model.lastStackID:poly.stackID);

		var tris = modelBuffers[modelind][polyind].strips[0].posArray;

		var tC = tris.length/3;
		var off = 0;
		var min = [Infinity, Infinity, Infinity];
		var max = [-Infinity, -Infinity, -Infinity];
		for (var i=0; i<tC; i++) {
			var tri = [tris[off++], tris[off++], tris[off++]];
			for (var j=0; j<3; j++) {
				if (tri[j] < min[j]) min[j] = tri[j];
				if (tri[j] > max[j]) max[j] = tri[j];
			}
		}
		//create the bounding box
		out = [
			{ //top
				Vertices: [[max[0], max[1], max[2]], [max[0], max[1], min[2]], [min[0], max[1], min[2]]],
				Normal: [0, 1, 0]
			},
			{
				Vertices: [[min[0], max[1], min[2]], [min[0], max[1], max[2]], [max[0], max[1], max[2]]],
				Normal: [0, 1, 0]
			},

			{ //bottom
				Vertices: [[min[0], min[1], min[2]], [max[0], min[1], min[2]], [max[0], min[1], max[2]] ],
				Normal: [0, -1, 0]
			},
			{
				Vertices: [[max[0], min[1], max[2]], [min[0], min[1], max[2]], [min[0], min[1], min[2]] ],
				Normal: [0, -1, 0]
			},

			{ //back (farthest z)
				Vertices: [[max[0], max[1], max[2]], [max[0], min[1], max[2]], [min[0], min[1], max[2]]],
				Normal: [0, 0, 1]
			},
			{
				Vertices: [[min[0], min[1], max[2]], [min[0], max[1], max[2]], [max[0], max[1], max[2]]],
				Normal: [0, 0, 1]
			},

			{ //front (closest z)
				Vertices: [[min[0], min[1], min[2]], [max[0], min[1], min[2]], [max[0], max[1], min[2]]],
				Normal: [0, 0, -1]
			},
			{
				Vertices: [[max[0], max[1], min[2]], [min[0], max[1], min[2]], [min[0], min[1], min[2]]],
				Normal: [0, 0, -1]
			},

			{ //right (pos x)
				Vertices: [[max[0], max[1], max[2]], [max[0], min[1], max[2]], [max[0], min[1], min[2]]],
				Normal: [1, 0, 0]
			},
			{
				Vertices: [[max[0], min[1], min[2]], [max[0], max[1], min[2]], [max[0], max[1], max[2]]],
				Normal: [1, 0, 0]
			},

			{ //left (neg x)
				Vertices: [[-max[0], min[1], min[2]], [-max[0], min[1], max[2]], [-max[0], max[1], max[2]]],
				Normal: [-1, 0, 0]
			},
			{
				Vertices: [[-max[0], max[1], max[2]], [-max[0], max[1], min[2]], [-max[0], min[1], min[2]]],
				Normal: [-1, 0, 0]
			},
		]
		out.push()
		return {dat:out, scale:model.head.scale};
	}

	function getCollisionModel(modelind, polyind, colType) { //simple func to get collision model for a model. used when I'm too lazy to define my own... REQUIRES TRI MODE ACTIVE!
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
			t.Vertices = [];
			t.Vertices[0] = [tris[off++], tris[off++], tris[off++]];
			t.Vertices[1] = [tris[off++], tris[off++], tris[off++]];
			t.Vertices[2] = [tris[off++], tris[off++], tris[off++]];

			//calculate normal
			var v = vec3.sub([], t.Vertices[1], t.Vertices[0]);
			var w = vec3.sub([], t.Vertices[2], t.Vertices[0]);
			t.Normal = vec3.cross([], v, w);
			t.CollisionType = colType;
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

		//var mv = mat4.scale([], mv, [model.head.scale, model.head.scale, model.head.scale]);

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
		var pmat = poly.mat;
		var matname = model.materials.names[pmat]; //attach tex anim to mat with same name
		if (texPAnim != null) {
			var info = texPAnim.animData.objectData[modelind];
			var anims = texPAnim.animData.objectData[modelind].data;
			var animNum = anims.names.indexOf(matname);
			if (animNum != -1) {
				var offFrame = texFrame % info.duration;
				//we got a match! it's wonderful :')
				var anim = anims.objectData[animNum];
				//look thru frames for the approprate point in the animation
				for (var i=anim.frames.length-1; i>=0; i--) {
					if (offFrame >= anim.frames[i].time) {
						loadMatTex(model.materials.objectData[pmat], btx == null ? bmd.tex : btx, anim.frames[i]);
						/*
						tex[pmat] = cacheTex(btx == null ? bmd.tex : btx, anim.frames[i].tex, anim.frames[i].mat, model.materials.objectData[pmat]);
						*/
						break;
					}
				}
			}
		}

		if (nitroRender.last.tex != tex[pmat]) {
			gl.bindTexture(gl.TEXTURE_2D, tex[pmat]); //load up material texture
			nitroRender.last.tex = tex[pmat];
		}

		var material = model.materials.objectData[pmat];
		nitroRender.setAlpha(material.alpha);

		if (texAnim != null) {
			//generate and send texture matrix from data
			var matname = model.materials.names[pmat]; //attach tex anim to mat with same name
			var anims = texAnim.animData.objectData[modelind].data;
			var animNum = anims.names.indexOf(matname);

			if (animNum != -1) {
				//we got a match! it's wonderful :')
				var anim = anims.objectData[animNum];
				var mat = matAtFrame(texFrame, anim);
				gl.uniformMatrix3fv(shader.texMatrixUniform, false, mat);
			} else {
				gl.uniformMatrix3fv(shader.texMatrixUniform, false, material.texMat);
			}

		} else gl.uniformMatrix3fv(shader.texMatrixUniform, false, material.texMat);	

		if (modelBuffers[modelind][polyind] == null) modelBuffers[modelind][polyind] = nitroRender.renderDispList(poly.disp, tex[poly.mat], (poly.stackID == null)?model.lastStackID:poly.stackID);
		
		if (material.cullMode < 3) {
			gl.enable(gl.CULL_FACE);
			gl.cullFace(nitroRender.cullModes[material.cullMode]);
		} else {
			if (nitroRender.forceFlatNormals) {
				//dual side lighting model, course render mode essentially
				gl.enable(gl.CULL_FACE);
				gl.cullFace(gl.BACK);
				drawModelBuffer(modelBuffers[modelind][polyind], gl, shader);
				nitroRender.setNormalFlip(-1);
				gl.cullFace(gl.FRONT);
				drawModelBuffer(modelBuffers[modelind][polyind], gl, shader);
				nitroRender.setNormalFlip(1);
				return;
			}
			gl.disable(gl.CULL_FACE);
		}
		drawModelBuffer(modelBuffers[modelind][polyind], gl, shader);
	}

	function frameLerp(frame, step, values) {
		if (values.length == 1) return values[0];
		var i = (frame / (1 << step)) % 1;
		var len = values.length
		if (step > 0) len -= 1;
		var frame1 = (frame>>step)%len;
		var from = values[frame1];
		var to = values[frame1+1] || values[frame1];
		return to * i + from * (1-i);
	}

	function matAtFrame(frame, anim) {
		var mat = mat3.create(); //material texture mat is ignored

		mat3.scale(mat, mat, [frameLerp(frame, anim.frameStep.scaleS, anim.scaleS), frameLerp(frame, anim.frameStep.scaleT, anim.scaleT)]);
		mat3.translate(mat, mat, [-frameLerp(frame, anim.frameStep.translateS, anim.translateS), frameLerp(frame, anim.frameStep.translateT, anim.translateT)]);

		return mat;
	}

	function generateMatrixStack(model, targ) { //this generates a matrix stack with the default bones. use nitroAnimator to pass custom matrix stacks using nsbca animations.
		var matrices = [];

		var objs = model.objects.objectData;
		var cmds = model.commands;
		var curMat = mat4.clone(thisObj.baseMat);
		var lastStackID = 0;
		var highestUsed = -1;

		for (var i=0; i<cmds.length; i++) {
			var cmd = cmds[i];
			if (cmd.copy != null) {
				//copy this matrix to somewhere else, because it's bound and is going to be overwritten.
				matrices[cmd.dest] = mat4.clone(matrices[cmd.copy]);
				continue;
			}
			if (cmd.restoreID != null) curMat = mat4.clone(matrices[cmd.restoreID]);
			var o = objs[cmd.obj];
			mat4.multiply(curMat, curMat, o.mat);
			if (o.billboardMode == 1) mat4.multiply(curMat, curMat, nitroRender.billboardMat);
			if (o.billboardMode == 2) mat4.multiply(curMat, curMat, nitroRender.yBillboardMat);

			if (cmd.stackID != null) {
				matrices[cmd.stackID] = mat4.clone(curMat);
				lastStackID = cmd.stackID;
				if (lastStackID > highestUsed) highestUsed = lastStackID;
			} else {
				matrices[lastStackID] = mat4.clone(curMat);
			}
		}

		model.lastStackID = lastStackID;

		var scale = [model.head.scale, model.head.scale, model.head.scale];
		targ.set(matBufEmpty);
		var off=0;
		for (var i=0; i<=highestUsed; i++) {
			if (matrices[i] != null) {
				mat4.scale(matrices[i], matrices[i], scale);
				targ.set(matrices[i], off);
			}
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

	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	if (clampx) gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    if (clampy) gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);

	texture.width = img.width;
	texture.height = img.height;

	gl.bindTexture(gl.TEXTURE_2D, null);
	return texture;
}