//
// !! all UI objects assume you have forced positive y as down!
//

window.uiPlace = function(gl) {

	var WHITE = [1, 1, 1, 1];

	var frontBuf = {	
		pos: gl.createBuffer(),
		col: gl.createBuffer(),
		tx: gl.createBuffer()
	}

	var backBuf = {
		pos: gl.createBuffer(),
		col: gl.createBuffer(),
		tx: gl.createBuffer()
	}

	var backActive = false;

	function setPlace(num) {
		if (nun < 10) {

		} else {
			var tens = Math.floor(num/10)%10;
			var suffix = (tens == 1)?3:(Math.min(3, (num-1)%10));
		}
	}

	function genVertRect(targ, dx, dy, dwidth, dheight, sx, sy, swidth, sheight, z, cornerColours) { //y is down positive. we adjust texture coords to fit this.
		var cornerColours = cornerColours
		if (cornerColours == null) cornerColours = [WHITE, WHITE, WHITE, WHITE];

		var vpos = targ.vpos;
		var vcol = targ.vcol;
		var vtx = targ.vtx;

		// tri 1
		//
		// 1        2
		// ---------
		// |      /
		// |    /
		// |  /
		// |/
		//
		// 3
		//

		vpos.push(dx);
		vpos.push(dy);
		vpos.push(z);
		vcol = vcol.concat(vcol, cornerColours[0]);
		vtx.push(sx);
		vtx.push(1-sy);

		vpos.push(dx+dwidth);
		vpos.push(dy);
		vpos.push(z);
		vcol = vcol.concat(vcol, cornerColours[1]);
		vtx.push(sx+swidth);
		vtx.push(1-sy);

		vpos.push(dx);
		vpos.push(dy+dheight);
		vpos.push(z);
		vcol = vcol.concat(vcol, cornerColours[2]);
		vtx.push(sx);
		vtx.push(1-(sy+sheight));

		//tri 2
		//
		//			1
		//        /|
		//      /  |
		//    /    |
		//  /      |
		// --------- 3
		// 2

		vpos.push(dx+dwidth);
		vpos.push(dy);
		vpos.push(z);
		vcol = vcol.concat(vcol, cornerColours[1]);
		vtx.push(sx+swidth);
		vtx.push(1-sy);

		vpos.push(dx);
		vpos.push(dy+dheight);
		vpos.push(z);
		vcol = vcol.concat(vcol, cornerColours[2]);
		vtx.push(sx);
		vtx.push(1-(sy+sheight));

		vpos.push(dx+dwidth);
		vpos.push(dy+dheight);
		vpos.push(z);
		vcol = vcol.concat(vcol, cornerColours[2]);
		vtx.push(sx+swidth);
		vtx.push(1-(sy+sheight));

	}
}