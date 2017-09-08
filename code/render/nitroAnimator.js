//
// nitroAnimator.js
//--------------------
// Runs nsbca animations and provides matrix stacks that can be used with nitroRender to draw them.
// by RHY3756547
//
// includes: gl-matrix.js (glMatrix 2.0)
// /formats/*
//

window.nitroAnimator = function(bmd, bca) {
	var t = this;
	t.bmd = bmd;
	t.bca = bca;
	var bmd = bmd;
	var bca = bca;
	t.setFrame = setFrame;
	t.setAnim = setAnim;
	t.getLength = getLength;

	var matBufEmpty = new Float32Array(31*16);
	var workingMat = mat4.create();

	var temp = mat4.create();
	var off=0;
	var objMats = [];
	for (var i=0; i<31; i++) {
		matBufEmpty.set(temp, off);
		objMats.push(mat4.create());
		off += 16;
	}

	var matBuf = new Float32Array(31*16);
	var matStack = {built: true, dat: matBuf};

	function setAnim(b) {
		bca = b;
		t.bca = b;
	}

	function getLength(anim) {
		return bca.animData.objectData[anim].frames;
	}

	function setFrame(anim, modelind, frame) {

		var b = bca.animData.objectData[anim];

		var fLow = Math.floor(frame);
		var fHigh = Math.ceil(frame);
		var iterp = frame%1;

		var model = bmd.modelData.objectData[modelind];
		var fallback = model.objects.objectData;

		for (var i=0; i<b.trans.length; i++) {
			var mat = objMats[i];
			mat4.identity(mat);

			var a = b.trans[i]; //animated transforms
			var fa = fallback[i]; //fallback

			var translate;
			if (a.translate != null) {
				translate = [];
				if (a.tlExtra[0] != null) {
					var f = frame * a.tlExtra[0].speed;
					var fLow = Math.floor(f)%a.translate[0].length;
					var fHigh = Math.ceil(f)%a.translate[0].length;
					var p = f%1;
					translate[0] = a.translate[0][fHigh]*(p) + a.translate[0][fLow]*(1-p);
				} else translate[0] = a.translate[0][0];

				if (a.tlExtra[1] != null) {
					var f = frame * a.tlExtra[1].speed;
					var fLow = Math.floor(f)%a.translate[1].length;
					var fHigh = Math.ceil(f)%a.translate[1].length;
					var p = f%1;
					translate[1] = a.translate[1][fHigh]*(p) + a.translate[1][fLow]*(1-p);
				} else translate[1] = a.translate[1][0];

				if (a.tlExtra[2] != null) {
					var f = frame * a.tlExtra[2].speed;
					var fLow = Math.floor(f)%a.translate[2].length;
					var fHigh = Math.ceil(f)%a.translate[2].length;
					var p = f%1;
					translate[2] = a.translate[2][fHigh]*(p) + a.translate[2][fLow]*(1-p);
				} else translate[2] = a.translate[2][0];
			} else {
				translate = fa.translate;
			}

			var rotate;
			if (a.rotate != null) {
				if (a.rotExtra != null) {
					var f = frame * a.rotExtra.speed;
					var fLow = Math.floor(f)%a.rotate.length;
					var fHigh = Math.ceil(f)%a.rotate.length;
					var p = f%1;

					var r1 = parseRotation(a.rotate[fLow]);
					var r2 = parseRotation(a.rotate[fHigh]);
					rotate = lerpMat3(r1, r2, p);
				} else {
					rotate = parseRotation(a.rotate[0]);
				}
			} else {
				rotate = fa.pivot;
			}

			var scale;
			if (a.scale != null) {
				scale = [];
				if (a.scExtra[0] != null) {
					var f = frame * a.scExtra[0].speed;
					var fLow = Math.floor(f)%a.scale[0].length;
					var fHigh = Math.ceil(f)%a.scale[0].length;
					var p = f%1;
					scale[0] = a.scale[0][fHigh].s1*(p) + a.scale[0][fLow].s1*(1-p);
				} else scale[0] = a.scale[0][0].s1;

				if (a.scExtra[1] != null) {
					var f = frame * a.scExtra[1].speed;
					var fLow = Math.floor(f)%a.scale[1].length;
					var fHigh = Math.ceil(f)%a.scale[1].length;
					var p = f%1;
					scale[1] = a.scale[1][fHigh].s1*(p) + a.scale[1][fLow].s1*(1-p);
				} else scale[1] = a.scale[1][0].s1;

				if (a.scExtra[2] != null) {
					var f = frame * a.scExtra[2].speed;
					var fLow = Math.floor(f)%a.scale[2].length;
					var fHigh = Math.ceil(f)%a.scale[2].length;
					var p = f%1;
					scale[2] = a.scale[2][fHigh].s1*(p) + a.scale[2][fLow].s1*(1-p);
				} else scale[2] = a.scale[2][0].s1;
			} else {
				scale = fa.scale;
			}

			mat4.translate(mat, mat, translate);
			mat4.multiply(mat, mat, mat4FromMat3(rotate));
			mat4.scale(mat, mat, scale);
		}

		generateMatrixStack(model, matBuf)
		return matStack;
	}

	function generateMatrixStack(model, targ) {
		var matrices = []

		var objs = model.objects.objectData;
		var cmds = model.commands;
		var curMat = mat4.create();
		var lastStackID = 0;

		for (var i=0; i<cmds.length; i++) {
			var cmd = cmds[i];
			if (cmd.restoreID != null) curMat = mat4.clone(matrices[cmd.restoreID]);
			var o = objs[cmd.obj];
			mat4.multiply(curMat, curMat, objMats[cmd.obj]);
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

	function mat4FromMat3(mat) {
		dest = mat4.create();
		
		dest[0] = mat[0];
		dest[1] = mat[1];
		dest[2] = mat[2];
		dest[3] = 0;

		dest[4] = mat[3];
		dest[5] = mat[4];
		dest[6] = mat[5];
		dest[7] = 0;

		dest[8] = mat[6];
		dest[9] = mat[7];
		dest[10] = mat[8];
		dest[11] = 0;

		dest[12] = 0;
		dest[13] = 0;
		dest[14] = 0;
		dest[15] = 1;
		
		return dest;
	}

	function parseRotation(rot) {
		if (rot.pivot) {
			var flag = rot.param;
			var pivot = [0,0,0,0,0,0,0,0,0];
			var mode = flag&15;
			var neg = (flag>>4)&15;
			var A = rot.a;
			var B = rot.b;

			pivot[mode] = (neg&1)?-1:1;
			var horiz = mode%3;
			var vert = Math.floor(mode/3)
			var left = (horiz==0)?1:0; var top = ((vert==0)?1:0)*3;
			var right = (horiz==2)?1:2; var btm = ((vert==2)?1:2)*3;
			pivot[left+top] = A;
			pivot[right+top] = B;
			pivot[left+btm] = (neg&2)?-B:B;
			pivot[right+btm] = (neg&4)?-A:A;
			return pivot;
		} else {
			return rot.mat;
		}
	}

	function lerpMat3(m1, m2, p) { //this is probably a dumb idea, but it's not the worst thing i've come up with...
		var q = 1-p;

		return [
			m1[0]*q+m2[0]*p, m1[1]*q+m2[1]*p, m1[2]*q+m2[2]*p, 
			m1[3]*q+m2[3]*p, m1[4]*q+m2[4]*p, m1[5]*q+m2[5]*p, 
			m1[6]*q+m2[6]*p, m1[7]*q+m2[7]*p, m1[8]*q+m2[8]*p, 
		]
	}
}