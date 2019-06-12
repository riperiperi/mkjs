//
// controlDefault.js
//--------------------
// Provides default (keyboard) controls for kart. In future there will be an AI controller and default will support gamepad.
// by RHY3756547
//
// includes: main.js
//

function getPlayerControls() {
	if (mobile) return controlMobile;
	else return controlDefault;
}

window.controlDefault = function() {

	var thisObj = this;
	this.local = true;
	var kart;

	this.setKart = function(k) {
		kart = k;
		thisObj.kart = k;
	}
	this.fetchInput = fetchInput;

	function fetchInput() {
		return {
			accel: keysArray[88], //x
			decel: keysArray[90], //z
			drift: keysArray[83], //s
			item: keysArray[65], //a

			//-1 to 1, intensity.
			turn: (keysArray[37]?-1:0)+(keysArray[39]?1:0),
			airTurn: (keysArray[40]?-1:0)+(keysArray[38]?1:0) //air excitebike turn, item fire direction
		};
	}

}

window.controlMobile = function() {
	var thisObj = this;
	this.local = true;
	var kart;
	var item = false;

	this.setKart = function(k) {
		kart = k;
		thisObj.kart = k;
	}
	this.fetchInput = fetchInput;

	function searchForTouch(rect) { //{touch: Touch, enterLeave: number} 1 is enter, leave is 2,
		for (var i=0; i<touches.length; i++) {
			var touch = touches[i];
			var inNow = (touch.x > rect[0] && touch.y > rect[1] && touch.x < rect[2] && touch.y < rect[3]);
			var inBefore = (touch.lastx > rect[0] && touch.lasty > rect[1] && touch.lastx < rect[2] && touch.lasty < rect[3]);

			var active = inNow && !touch.released;

			if (inNow == inBefore && inNow) {
				return {touch: touch, enterLeave: 0, active: active};
			} else if (inNow) {
				return {touch: touch, enterLeave: 1, active: active};
			} else if (inBefore) {
				return {touch: touch, enterLeave: 2, active: active};
			}
		}
		return null;
	}

	function step(start, end, value) {
		return Math.max(0, Math.min(1, (value-start)/(end-start)));
	}

	function fetchInput() {
		var targW = 1136;
		var targH = 640;
		//window.touches array is filled by the game container
		//touches [{x:number (0-1), y:number (0-1), pressed:boolean, released:boolean, lastx:number (0-1), lasty:number (0-1)}]

		//accel unless reverse button is pressed
		var reverse = searchForTouch([955/targW, 320/targH, (955+125)/targW, (320+125)/targH]);
		reverse = (reverse != null) && reverse.active;

		var driftTouch = searchForTouch([780/targW, 468/targH, (780+300)/targW, (468+125)/targH]); //drift button on the right
		var itemTouch = searchForTouch([50/targW, 468/targH, (50+300)/targW, (468+125)/targH]); //touch the button exactly
		var dPadTouch = searchForTouch([0/targW, (468-50)/targH, (0+400)/targW, (468+225)/targH]); //allow for some space

		var turn = 0;
		if (dPadTouch != null && dPadTouch.active) {
			turn = step(0/targW, 400/targW, dPadTouch.touch.x);
			//digitize
			turn = Math.floor(turn*3) - 1;
		}

		var itemDir = 0;
		if (!item) {
			//if we touch the dpad (more exact than direction), start pressing item
			if (itemTouch != null && itemTouch.active && itemTouch.touch.pressed) {
				item = true;
			}
		} else {
			//if we release dpad, fire the item
			if (dPadTouch == null || !dPadTouch.active) {
				if (dPadTouch != null) {
					//set direction based on flick direction or position
					var vel = dPadTouch.touch.lasty - dPadTouch.touch.y;
					if (vel > 2/targH) itemDir = -1; //flicked down
					if (vel < -2/targH) itemDir = 1; //flicked up
				}
				item = false;
			}
		}

		return {
			accel: !reverse, //x
			decel: reverse, //z
			drift: (driftTouch != null && driftTouch.active), //s
			item: item, //a

			//-1 to 1, intensity.
			turn: turn,
			airTurn: itemDir //air excitebike turn, item fire direction
		};
	}

}