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
			-128/1024, 128/1024, -(192-11)/1024, 11/1024
		],
		"start": [ //offset 86 up
			-128/1024, 128/1024, -(192+66)/1024, -66/1024
		]
	}

	var param = params[type];
	if (param == null) param = params["count"]

	mat4.ortho(proj, param[0], param[1], param[2], param[3], -0.001, 10);
	buildOrtho(nitroRender.getViewWidth(), nitroRender.getViewHeight());
	var lastWidth = 0;
	initRes();

	function initRes() {
		var bmd = scene.gameRes.Race.getFile(type+".nsbmd");
		if (bmd == null) bmd = scene.gameRes.RaceLoc.getFile(type+".nsbmd");

		bmd = new nsbmd(bmd);

		var bca = new nsbca(scene.gameRes.Race.getFile(type+".nsbca"));
		anim = new nitroAnimator(bmd, bca);
		length = anim.getLength(0);
		if (type == "count") length *= 3;
		model = new nitroModel(bmd);
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
		model.draw(mat, proj, animMat);
	}

	function update() {
		if (anim != null) {
			animMat = anim.setFrame(0, 0, Math.max(0, animFrame++));
		}
		if (animFrame > length) {
			scene.removeEntity(t);
		}
	}
}