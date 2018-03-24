//
// itemboxShard.js
//--------------------
// by RHY3756547
//

window.ItemShard = function(scene, targ, model) {
    var t = this;
    t.update = update;
    t.draw = draw;

    t.time = 0;
    t.pos = vec3.clone(targ.pos);
    t.vel = vec3.add([], targ.vel, [(Math.random()-0.5)*5, Math.random()*7, (Math.random()-0.5)*5]);
    t.dirVel = [(Math.random()-0.5), (Math.random()-0.5), (Math.random()-0.5)];
    t.dir = [Math.random()*2*Math.PI, Math.random()*2*Math.PI, Math.random()*2*Math.PI];
    t.scale = Math.random()+0.5;
    t.scale = [t.scale, t.scale, t.scale];

    function update(scene) {
        vec3.add(t.pos, t.pos, t.vel);
        vec3.add(t.vel, t.vel, [0, -0.17, 0]);
        vec3.add(t.dir, t.dir, t.dirVel);

        if (t.time++ > 30) scene.removeParticle(t);
    }

    function draw(view, pMatrix, gl) {
        var mat = mat4.translate(mat4.create(), view, t.pos);
            
        mat4.rotateZ(mat, mat, t.dir[2]);
        mat4.rotateY(mat, mat, t.dir[1]);
        mat4.rotateX(mat, mat, t.dir[0]);

        mat4.scale(mat, mat, vec3.scale([], t.scale, 16));
        model.draw(mat, pMatrix);
    }

}