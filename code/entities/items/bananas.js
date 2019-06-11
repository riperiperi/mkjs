window.BananaC = function(item, scene, type) {
    var t = this;
    this.canBeHeld = true;
    this.canBeDropped = true;
    this.isDestructive = false;
    item.floorBounce = 0;

    this.collideKart = collideKart;
    this.onRest = onRest;
    this.update = update;

    function collideKart(kart) {
        item.deadTimer = 1;
        kart.damage(MKDSCONST.DAMAGE_SPIN);
    }

    function onRest(normal) {
        nitroAudio.playSound(219, {volume: 2}, 0, item);
    }

    function update(argument) {
        if (!item.held && item.colRadius < 6) {
            item.colRadius += 0.2;
            if (item.colRadius > 6) item.colRadius = 6;
        }
        if (item.groundTime < 30) {
            var t = (1-item.groundTime/29);
            var s = Math.sin(item.groundTime * Math.PI/14);

            var sprMat = mat4.create();
            mat4.translate(sprMat, sprMat, [0, -1/6, 0]);
            mat4.scale(sprMat, sprMat, [1 + s * 0.6 * t, 1 - s * 0.6 * t, 1]);
            mat4.translate(sprMat, sprMat, [0, 1/6, 0]);

            item.sprMat = sprMat;
        } else {
            item.sprMat = null;
        }
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
    var t = this;
    this.canBeHeld = true;
    this.canBeDropped = true;
    this.isDestructive = false;
    this.isSolid = false;
    item.floorBounce = 0;
    item.airResist = 0.98;

    this.collideKart = collideKart;
    this.onRest = onRest;
    this.update = update;
    this.draw = draw;

    this.xyScale = [1,1];
    this.dir = 0;

    function collideKart(kart) {
        item.deadTimer = 1;
        nitroAudio.playSound(250, {volume: 2}, 0, item);
        kart.damage(MKDSCONST.DAMAGE_FLIP);
    }

    function onRest(normal) {
        nitroAudio.playSound(251, {volume: 2}, 0, item);
    }

    function update(argument) {
        if (item.held) {
            t.dir = -(item.owner.physicalDir + item.owner.driftOff / 4);
        }
        if (!item.held && item.colRadius < 8) {
            item.colRadius += 0.2;
            if (item.colRadius > 8) item.colRadius = 8;
        }
        if (item.groundTime < 20) {
            var linear = (1-item.groundTime/19);
            var s = Math.sin(item.groundTime * Math.PI/8);

            t.xyScale = [1 + s * 0.25 * linear, 1 - s * 0.25 * linear];
        } else {
            t.xyScale = [1,1];
        }
    }

    function draw(mvMatrix, pMatrix) {
        var mat = mat4.translate(mat4.create(), mvMatrix, vec3.add(vec3.create(), item.pos, [0, item.colRadius*1.5 * t.xyScale[1], 0]));

        var scale = 2*item.colRadius * (1 - item.holdTime/7);
        mat4.scale(mat, mat, [scale*t.xyScale[0], scale*t.xyScale[1], scale*t.xyScale[0]]);
        mat4.rotateY(mat, mat, t.dir);
        mat4.rotateZ(mat, mat, Math.PI/-6);
        mat4.rotateY(mat, mat, Math.PI/6);
        mat4.rotateX(mat, mat, Math.PI/-6);
        
        var mdl = scene.gameRes.items.fakeBox;
        mdl.draw(mat, pMatrix);
    }
}

window.BombC = function(item, scene, type) {
    var t = this;
    this.canBeHeld = true;
    this.canBeDropped = true;
    this.isDestructive = true;

    this.explodeTime = 0;

    this.collideKart = collideKart;
    this.onRest = onRest;
    this.update = update;

    function collideKart(kart) {
        item.deadTimer = 1;
        kart.damage(MKDSCONST.DAMAGE_EXPLODE);
    }

    function onRest(normal) {
    }

    function update(argument) {
        if (item.deadTimer > 0 && t.explodeTime == 0) {
            //begin explosion
            t.explodeTime = 1;
        }
        if (!item.held && item.colRadius < 6) {
            item.colRadius += 0.2;
            if (item.colRadius > 6) item.colRadius = 6;
        }
    }
}