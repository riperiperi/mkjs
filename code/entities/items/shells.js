window.GreenShellC = function(item, scene) {
	this.canBeHeld = true;
	this.canBeDropped = true;
	this.isDestructive = true;
}

window.RedShellC = function(item, scene) {
	this.canBeHeld = true;
	this.canBeDropped = true;
	this.isDestructive = true;
}

window.ShellGroupC = function(item, scene, type) {
	this.canBeHeld = false;
	this.canBeDropped = 'func';
	this.rotationPeriod = 45;

	this.draw = draw;

	function draw(mvMatrix, pMatrix) {
		//the group itself is invisible - the shells draw individually
	}
}

window.BlueShellC = null;