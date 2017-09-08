//
// controlDefault.js
//--------------------
// Provides default (keyboard) controls for kart. In future there will be an AI controller and default will support gamepad.
// by RHY3756547
//
// includes: main.js
//

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
			airTurn: (keysArray[40]?-1:0)+(keysArray[38]?1:0) //air excitebike turn, doesn't really have much function
		};
	}

}