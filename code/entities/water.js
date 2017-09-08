//
// water.js
//--------------------
// Provides multiple types of traffic. 
// by RHY3756547
//
// includes:
// render stuff idk
//

window.ObjWater = function(obji, scene) {
	var obji = obji;
	var res = [];

	var t = this;

	t.pos = vec3.clone(obji.pos);
	//t.angle = vec3.clone(obji.angle);
	t.scale = vec3.clone(obji.scale);

	t.requireRes = requireRes;
	t.provideRes = provideRes;
	t.update = update;
	t.draw = draw;
	var frame = 0;

	function draw(view, pMatrix) {
		if (nitroRender.flagShadow) return;
		var waterM = mat4.create();

		gl.enable(gl.STENCIL_TEST);
		gl.stencilMask(0xFF);

		gl.stencilFunc(gl.ALWAYS, 1, 0xFF);
		gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE); //when depth test passes for water lower layer, pixel is already drawn, do not cover it with the white overlay (set stencil bit)

		var height = (t.pos[1])+6.144+Math.sin(frame/150)*12.288 //0.106

		mat4.translate(waterM, view, [Math.sin(frame/180)*96, height-3.072, Math.cos(frame/146)*96])
		nitroRender.setAlpha(0x0A/31);
		res.mdl[0].drawPoly(mat4.scale([], waterM, [16, 16, 16]), pMatrix, 0, 0); //water

		if (res.mdl[1] != null) {
			mat4.translate(waterM, view, [-Math.sin((frame+30)/180)*96, height-3, Math.cos((frame+100)/146)*96])
			nitroRender.setAlpha(0x02/31);
			res.mdl[1].draw(mat4.scale([], waterM, [16, 16, 16]), pMatrix); //water white detail part. stencil should do nothing here, since it's in the same position as the above.
		}

		gl.stencilFunc(gl.EQUAL, 0, 0xFF);
		gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

		if (!obji.ID == 9) {
			mat4.translate(waterM, view, [0, height, 0])
			nitroRender.setAlpha(0x10/31);
			res.mdl[0].drawPoly(mat4.scale([], waterM, [16, 16, 16]), pMatrix, 0, 1); //white shore wash part, water is stencil masked out
		}

		gl.disable(gl.STENCIL_TEST);

		nitroRender.setAlpha(1);
	}

	function update() {
		frame = (frame+1)%197100; //it's a big number but yolo... we have the technology...
	}

	function requireRes() { //scene asks what resources to load
		switch (obji.ID) {
			case 0x0001:
				return {mdl:[{nsbmd:"beach_waterC.nsbmd"}, {nsbmd:"beach_waterA.nsbmd"}]};
			case 0x0003:
				return {mdl:[{nsbmd:"town_waterC.nsbmd"}, {nsbmd:"town_waterA.nsbmd"}]};
			case 0x0006:
				return {mdl:[{nsbmd:"yoshi_waterC.nsbmd"}]};
			case 0x0009:
				return {mdl:[{nsbmd:"hyudoro_waterC.nsbmd"}, {nsbmd:"hyudoro_waterA.nsbmd"}]};
			case 0x000C:
				return {mdl:[{nsbmd:"mini_stage3_waterC.nsbmd"}, {nsbmd:"mini_stage3_waterA.nsbmd"}]};
		}	
	}

	function provideRes(r) {
		res = r; //...and gives them to us. :)
	}

}