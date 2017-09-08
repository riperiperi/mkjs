//
// controlDefault.js
//--------------------
// Provides default (keyboard) controls for kart. In future there will be an AI controller and default will support gamepad.
// by RHY3756547
//
// includes: main.js
//

window.controlNetwork = function() {

	var t = this;
	var kart;

	this.local = false;
	this.turn = 0;
	this.airTurn = 0;
	this.binput = 0;

	this.setKart = function(k) {
		kart = k;
		t.kart = k;
	}
	this.fetchInput = fetchInput;

	function fetchInput() {
		//local controllers generally just return input and handle items - the network controller restores kart data from the stream sent from the server. Obviously this data needs to be verified by the server...

		return {
			accel: t.binput&1, //x
			decel: t.binput&2, //z
			drift: t.binput&4, //s
			item: false,//keysArray[65], //a

			//-1 to 1, intensity.
			turn: t.turn,//(keysArray[37]?-1:0)+(keysArray[39]?1:0),
			airTurn: t.airTurn//(keysArray[40]?-1:0)+(keysArray[38]?1:0) //air excitebike turn, doesn't really have much function
		};
	}

}