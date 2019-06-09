//
// race3DUI.js
//--------------------
// by RHY3756547
//
// includes:
// render stuff idk
//

window.Race3DUI = function(scene, type, animStart) {
	//type: count, goal, start, lose, win
	var forceBill;
	var obji = obji;
	var res = [];

	var t = this;

	t.pos = vec3.clone([0,0,0]);

	t.update = update;
	t.draw = draw;

	var mat = mat4.create();
	var frame = 0;
	var anim = null;
	var animFrame = 0;
	if (animStart != null) animFrame = animStart;
	var animMat = null;
	var model = null;
	var proj = mat4.create();
	var length = 0;

	var params = {
		"count": [ //offset 21 down
			-128/1024, 128/1024, -(96)/1024, 96/1024
		],
		"start": [ //offset 86 up
			-128/1024, 128/1024, -(96)/1024, 96/1024
		],
		"goal": [ //why are these all so different?
			-128/1024, 128/1024, -(96)/1024, 96/1024
			//-128/1024, 128/1024, -(512 + 64)/1024, -(512 - 128)/1024
		],

		//animations seem completely broken for these two (quickly files off screen after start)
		//right now the vertical range of the viewport is large to try figure out where the hell it's going?
		"win": [
			-128/1024, 128/1024, -(96)/1024, 96/1024
			//-128/1024, 128/1024, -(1024)/1024, 1024/1024
		],
		"lose": [
			-128/1024, 128/1024, -(96)/1024, 96/1024
			//-128/1024, 128/1024, -(1024)/1024, 1024/1024
		],
	}

	var param = params[type];
	if (param == null) param = params["count"];

	mat4.ortho(proj, param[0], param[1], param[2], param[3], -0.001, 10);
	buildOrtho(nitroRender.getViewWidth(), nitroRender.getViewHeight());
	var lastWidth = 0;
	initRes();

	function initRes() {
		var bmd = scene.gameRes.Race.getFile(type+".nsbmd");
		if (bmd == null) bmd = scene.gameRes.RaceLoc.getFile(type+".nsbmd");

		bmd = new nsbmd(bmd);

		var bca = new nsbca(scene.gameRes.Race.getFile(type+".nsbca"));
		var btp = scene.gameRes.Race.getFile(type+".nsbtp");
		if (btp != null) btp = new nsbtp(btp);
		anim = new nitroAnimator(bmd, bca);
		length = anim.getLength(0);
		if (type == "count") length *= 3;
		model = new nitroModel(bmd);
		model.loadTexPAnim(btp)
	}

	function buildOrtho(width, height) {
		lastWidth = width;
		var ratio = width / height;
		var w = (param[3]-param[2]) * ratio/2;
		mat4.ortho(proj, -w, w, param[2], param[3], -0.001, 10);
	}

	function draw(view, pMatrix) {
		if (nitroRender.flagShadow || animFrame < 0) return;
		var width = nitroRender.getViewWidth();
		if (width != lastWidth) buildOrtho(width, nitroRender.getViewHeight());
		mat4.translate(mat, view, t.pos);
		nitroRender.pauseShadowMode();
		model.draw(mat, proj, animMat);
		nitroRender.unpauseShadowMode();
	}

	function update() {
		if (anim != null) {
			model.setFrame(animFrame);
			animMat = anim.setFrame(0, 0, Math.max(0, animFrame++));
		}
		if (animFrame > length) {
			scene.removeEntity(t);
		}
	}
}