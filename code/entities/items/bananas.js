window.BananaC = function(item, scene, type) {
    this.canBeHeld = true;
    this.canBeDropped = true;
    this.isDestructive = false;
    item.minBounceVel = 0;

    this.collideKart = collideKart;

    function collideKart(kart) {
        item.deadTimerLength = 20;
        kart.damage(MKDSCONST.DAMAGE_SPIN);
    }
}

window.BananaGroupC = function(item, scene, type) {
    this.canBeHeld = false;
    this.canBeDropped = 'func';
    this.rotationPeriod = 45;

    item.colRadius = -Infinity;
    item.enablePhysics = false;

    this.draw = draw;

    function draw(mvMatrix, pMatrix) {
        //the group itself is invisible - the bananas draw individually
    }
}

window.FakeBoxC = function(item, scene, type) {
    this.canBeHeld = true;
    this.canBeDropped = true;
    this.isDestructive = false;
    this.isSolid = true;
    var model = scene.gameRes.fakeBox;

    this.draw = draw;

    function draw(view, pMatrix) {
        mat4.translate(mat, view, t.pos);
        mat4.translate(mat, view, [0, 16, 0]);
        
        /* adjust to make it rest on a corner
        if (t.angle[2] != 0) mat4.rotateZ(mat, mat, t.angle[2]*(Math.PI/180));
        if (t.angle[1] != 0) mat4.rotateY(mat, mat, t.angle[1]*(Math.PI/180));
        if (t.angle[0] != 0) mat4.rotateX(mat, mat, t.angle[0]*(Math.PI/180));
        */
        
        mat4.scale(mat, mat, vec3.scale([], t.scale, 16));
        model.draw(mat, pMatrix, animMat);
    }
}

window.BombC = null;
