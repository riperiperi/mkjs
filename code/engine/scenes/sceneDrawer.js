//
// sceneDrawer.js
//--------------------
// Provides functions to draw scenes in various ways.
// by RHY3756547
//

window.sceneDrawer = new function() {
	var gl, shadowTarg;

	var shadowRes = 2048;

	this.init = function(gl) {
		gl = gl;
		shadowTarg = createRenderTarget(gl, shadowRes, shadowRes, true);
	}

	this.drawWithShadow = function(gl, scn, x, y, width, height) {
		if (scn.lastWidth != width || scn.lastHeight != height) {
			scn.lastWidth = width;
			scn.lastHeight = height;
			scn.renderTarg = createRenderTarget(gl, width, height, true);
		}

		var view = scn.camera.getView(scn, width, height);
		var viewProj = mat4.mul(view.p, view.p, view.mv);

		var shadMat = scn.shadMat;

		if (scn.farShad == null) {
			scn.farShad = createRenderTarget(gl, shadowRes*2, shadowRes*2, true);
			gl.viewport(0, 0, shadowRes*2, shadowRes*2);
			gl.bindFramebuffer(gl.FRAMEBUFFER, scn.farShad.fb);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
			gl.colorMask(false, false, false, false);
			scn.draw(gl, scn.farShadMat, true);
		}

		gl.viewport(0, 0, shadowRes, shadowRes);
		gl.bindFramebuffer(gl.FRAMEBUFFER, shadowTarg.fb);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
		gl.colorMask(false, false, false, false);
		scn.draw(gl, shadMat, true);

		gl.viewport(0, 0, width, height);
		gl.bindFramebuffer(gl.FRAMEBUFFER, scn.renderTarg.fb);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
		gl.colorMask(true, true, true, true);
		scn.draw(gl, viewProj, false);

		scn.sndUpdate(view.mv);

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);

		gl.viewport(x, y, width, height);
		shadowRender.drawShadowed(scn.renderTarg.color, scn.renderTarg.depth, shadowTarg.depth, scn.farShad.depth, viewProj, shadMat, scn.farShadMat)
	}

	this.drawTest = function(gl, scn, x, y, width, height) {

		var view = scn.camera.view; //scn.camera.getView(scn, width, height);

		var viewProj = mat4.mul(mat4.create(), view.p, view.mv);
		view = {p: viewProj, mv: view.mv};

		var shadMat = scn.shadMat;

		nitroRender.unsetShadowMode();
		nitroRender.flagShadow = true;
		nitroRender.updateBillboards(scn.lightMat);

		if (scn.farShad == null) {
			scn.farShad = createRenderTarget(gl, shadowRes*2, shadowRes*2, true);
			gl.viewport(0, 0, shadowRes*2, shadowRes*2);
			gl.bindFramebuffer(gl.FRAMEBUFFER, scn.farShad.fb);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
			gl.colorMask(false, false, false, false);
			scn.draw(gl, scn.farShadMat, true);
		}

		gl.viewport(0, 0, shadowRes, shadowRes);
		gl.bindFramebuffer(gl.FRAMEBUFFER, shadowTarg.fb);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
		gl.colorMask(false, false, false, false);
		scn.draw(gl, shadMat, true);

		nitroRender.setShadowMode(shadowTarg.depth, scn.farShad.depth, shadMat, scn.farShadMat);
		nitroRender.flagShadow = false;

		nitroRender.updateBillboards(view.mv);
		gl.viewport(x, y, width, height);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
		gl.colorMask(true, true, true, true);
		scn.draw(gl, viewProj, false);

		scn.sndUpdate(view.mv);

	}

	function createRenderTarget(gl, xsize, ysize, depth) {
		var depthTextureExt = gl.getExtension("WEBGL_depth_texture");
		if (!depthTextureExt) alert("depth texture not supported! we're DOOMED! jk we'll just have to add a fallback for people with potato gfx");

		var colorTexture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, colorTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, xsize, ysize, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

		var depthTexture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, depthTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, xsize, ysize, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);

		var framebuffer = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTexture, 0);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0);

		return {
			color: colorTexture,
			depth: depthTexture,
			fb: framebuffer
		}
	}
}