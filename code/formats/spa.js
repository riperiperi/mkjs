//
// spa.js
//--------------------
// Reads spa files. Based off of code from MJDS Course Modifier, which was very incomplete but at least got the textures.
// Reverse engineered most of the emitter stuff.
// by RHY3756547
//

window.spa = function(input) {
    var t = this;
    this.load = load;
    this.getTexture = getTexture;

    var colourBuffer;

    function load(input) {
        colourBuffer = new Uint32Array(4);
        var view = new DataView(input);
        var header = null;
        var offset = 0;

        var stamp = readChar(view, 0x0)+readChar(view, 0x1)+readChar(view, 0x2)+readChar(view, 0x3);
        if (stamp != " APS") throw "SPA invalid. Expected ' APS', found "+stamp;
        offset += 4;

        var version = readChar(view, offset)+readChar(view, offset+1)+readChar(view, offset+2)+readChar(view, offset+3);
        offset += 4;

        var particleCount = view.getUint16(offset, true);
        var particleTexCount = view.getUint16(offset+2, true);
        var unknown = view.getUint32(offset+4, true);
        var unknown2 = view.getUint32(offset+8, true);
        var unknown3 = view.getUint32(offset+12, true);

        var firstTexOffset = view.getUint32(offset+16, true);
        var pad = view.getUint32(offset+20, true);

        offset += 24;
        if (version == "12_1") {
            t.particles = [];
            for (var i=0; i<particleCount; i++) {
                t.particles[i] = readParticle(view, offset);
                t.particles[i].parent = t;
                offset = t.particles[i].nextOff;
            }
        }

        offset = firstTexOffset;
        t.particleTextures = [];
        for (var i=0; i<particleTexCount; i++) {
            t.particleTextures[i] = readParticleTexture(view, offset);
            offset = t.particleTextures[i].nextOff;
        }

        //window.debugParticle = true;
        if (window.debugParticle) {
            for (var i=0; i<particleCount; i++) {
                var text = document.createElement("textarea");
                var p = t.particles[i];
                p.parent = null;
                text.value = JSON.stringify(p, true, 4);
                p.parent = t;
                text.style.width = 500;
                text.style.height = 200;
                

                var obj = t.particleTextures[p.textureId];
                if (p.texAnim) obj = t.particleTextures[p.texAnim.textures[0]];
                if (obj == null) {
                    continue;
                }
                var test = readTexWithPal(obj.info, obj);
                document.body.appendChild(document.createElement("br"));
                document.body.appendChild(document.createTextNode(i+":"));
                document.body.appendChild(test);
                document.body.appendChild(text);

            }
        }
    }

    function getTexture(id, gl) {
        var t = this;
        var obj = t.particleTextures[id];
        if (obj == null) {
            return null;
        }
        if (obj.glTex == null) {
            var canvas = readTexWithPal(obj.info, obj);
            var m = obj.info;
            if (m.flipX || m.flipY) {
                var fC = document.createElement("canvas");
                var ctx = fC.getContext("2d");
                fC.width = (m.flipX)?canvas.width*2:canvas.width;
                fC.height = (m.flipY)?canvas.height*2:canvas.height;
                ctx.drawImage(canvas, 0, 0);
                ctx.save();
                if (m.flipX) {
                    ctx.translate(2*canvas.width, 0);
                    ctx.scale(-1, 1);
                    ctx.drawImage(canvas, 0, 0);
                    ctx.restore();
                    ctx.save();
                }
                if (m.flipY) {
                    ctx.translate(0, 2*canvas.height);
                    ctx.scale(1, -1);
                    ctx.drawImage(fC, 0, 0);
                    ctx.restore();
                }
                var t = loadTex(fC, gl, !m.repeatX, !m.repeatY);
                t.realWidth = canvas.width;
                t.realHeight = canvas.height;
                obj.glTex = t;
            } else {
                var t = loadTex(canvas, gl, !m.repeatX, !m.repeatY);
                t.realWidth = canvas.width;
                t.realHeight = canvas.height;
                obj.glTex = t;
            }
        }
        return obj.glTex;
    }

    function loadTex(img, gl, clampx, clampy) { //general purpose function for loading an image into a texture.
        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        if (clampx) gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        if (clampy) gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        texture.width = img.width;
        texture.height = img.height;

        gl.bindTexture(gl.TEXTURE_2D, null);
        return texture;
    }

    function readParticle(view, off) {
        var obj = {};
        var ParticleFlags =
        {
            Type0: 0,
            //1: random sphere
            //2: random ground
            //3: rotation invariant
            //4+: unpredictable past here
            Type1: 0x10, //spark type
            Type2: 0x20, //3d, makes rotation around billboard axis
            Type3: 0x30, //spark 3d
            Type4: 0x40, //billboard
            Type5: 0x80, //billboard but ignores ground setting? maybe 2d
            ScaleAnim: 0x100,
            ColorAnimation: 0x200,
            OpacityAnimation: 0x400,
            TextureAnimation: 0x800,
            Unknown: 0x1000,
            RandomDirection: 0x2000,
            CrashGame: 0x4000,
            AttachedToEmitter: 0x8000,
            Bit16: 0x10000,
            Bit21: 0x200000,
            Bit22: 0x400000,
            Bit23: 0x800000,
            Gravity: 0x1000000,
            Bit25: 0x2000000, //balloon? perhaps sine rotation (as it flies away)
            Bit26: 0x4000000,
            Bit27: 0x8000000,
            Bit28: 0x10000000,
            Bit29: 0x20000000
        }

        obj.ParticleFlags = ParticleFlags;
        obj.flag = view.getUint32(off, true);
        obj.position = [view.getInt32(off+0x4, true)/4096, view.getInt32(off+0x8, true)/4096, view.getInt32(off+0xC, true)/4096];
        //this is just hilarious at this point
        //the best approach here is to look at each particle on a case by case basis, seeing how each particle behaves ingame
        obj.particleChance = view.getInt32(off+0x10, true)/4096;    //if less than 1, pct chance a particle will appear on that frame. >1 means more than one particle will appear.
        obj.areaSpread = view.getInt32(off+0x14, true)/4096;    //x and z
        //^ particle count?
        obj.unknown3 = view.getInt32(off+0x18, true)/4096;   //unknown (does not change anything for grass)

        //not sure what this vector is for. grass it's (0, 1, 0), smoke it's (-0.706787109375, 0, -0.707275390625) billboard alignment vector? (it's a bit crazy for powerslide)
        obj.vector = [view.getInt16(off+0x1C, true)/4096, view.getInt16(off+0x1E, true)/4096, view.getInt16(off+0x20, true)/4096];
        obj.color = view.getUint16(off+0x22, true); //15 bit, usually 32767 for white.
        obj.randomxz = view.getUint32(off+0x24, true)/4096; //random xz velocity intensity
        obj.velocity = view.getUint32(off+0x28, true)/4096; //initial velocity related (along predefined vector)
        obj.size = view.getUint32(off+0x2C, true)/4096; //size
        obj.aspect = view.getUint16(off+0x30, true) / 4096; //aspect

        //frame delay before activation (x2)
        //rotational velocity from (x2)
        //rotational velocity to (x2)
        obj.delay = view.getUint16(off+0x32, true);
        obj.rotVelFrom = view.getInt16(off+0x34, true);
        obj.rotVelTo = view.getInt16(off+0x36, true);

        obj.scX = view.getInt16(off+0x38, true)/0x8000; //??? (0) //scale center offset?
        obj.scY = view.getInt16(off+0x3A, true)/0x8000; //??? (4B) //scale center offset?
        obj.emitterLifetime = view.getUint16(off+0x3C, true); //stop emitting particles after this many frames
        obj.duration = view.getUint16(off+0x3E, true); 

        obj.varScale = view.getUint8(off+0x40, true);
        obj.varDuration = view.getUint8(off+0x42, true);
        obj.varUnk1 = view.getUint8(off+0x44, true); //usually like 1-8
        obj.varUnk2 = view.getUint8(off+0x46, true); //usually like 128 (hahaa)

        obj.frequency = view.getUint8(off+0x44, true); //create particle every n frames
        obj.opacity = view.getUint8(off+0x45, true); //opacity (0-1F)
        obj.yOffIntensity = view.getUint8(off+0x46, true); //y offset intensity (seems to include updraft and gravity. 124 for smoke, 120 for grass. 128 is probably 1x)
        obj.textureId = view.getUint8(off+0x47, true);
        obj.unknown21 = view.getUint32(off+0x48, true); //negative number makes grass disappear (1 for grass, smoke)
        obj.unknown22 = view.getUint32(off+0x4C, true); //some numbers make grass disappear (0x458d00 for grass, 0x74725f60 for smoke)
        obj.xScaleDelta = view.getInt16(off+0x50, true)/4096; //x scale delta for some reason. usually 0
        obj.yScaleDelta = view.getInt16(off+0x52, true)/4096; //y scale delta for some reason. usually 0
        obj.unknown25 = view.getUint32(off+0x54, true); //FFFFFFFF makes run at half framerate. idk? usually 0
        off += 0x58;

        if ((obj.flag & ParticleFlags.ScaleAnim) != 0)
        {
            obj.scaleAnim = [];
            //1.000 (doesn't seem to do anything important, but occasionally is between start and end)
            //start scale
            //end scale
            //???? (seems to affect the interpolation. cubic params?)
            //flags (1: random scale for one frame? everything above it might be cubic params)
            //???? (0x4B)

            obj.scaleAnim = {
                unkBase: view.getUint16(off, true)/4096,
                scaleFrom: view.getUint16(off+2, true)/4096,
                scaleTo: view.getUint16(off+4, true)/4096,
                fromZeroTime: view.getUint8(off+6, true)/0xFF, //time to dedicate to an animation from zero size
                holdTime: view.getUint8(off+7, true)/0xFF, //time to dedicate to holding state at the end.
                flagParam: view.getUint16(off+8, true),
                unk4b: view.getUint16(off+10, true),
            };
            off += 12;
        }
        if ((obj.flag & ParticleFlags.ColorAnimation) != 0)
        {
            obj.colorAnim = {
                colorFrom: view.getUint16(off, true), //color from 
                colorTo: view.getUint16(off+2, true), //color to (seems to be same as base color)
                framePct: view.getUint16(off+4, true), //frame pct to become color to (FFFF means always from, 8000 is about the middle)
                unknown: view.getUint16(off+6, true), //unknown, 00FF for fire?
                flags: view.getUint32(off+8, true), //flags (1: binary select color, 4: smooth blend)
            };
            off += 12;
        }
        if ((obj.flag & ParticleFlags.OpacityAnimation) != 0)
        {
            //opacity

            //intensity x2 (0FFF to 0000. smoke is 0bff. 1000 breaks it, i'm assuming it pushes opacity from 1f to 20 (overflow to 0))
            //random flicker
            //unknown (negative byte breaks it)
            //startfade x2
            //cubic param? x2
            obj.opacityAnim = {
                intensity: view.getUint16(off, true),
                random: view.getUint8(off+2, true),
                unk: view.getUint8(off+3, true),
                startFade: view.getUint16(off+4, true), //0-FFFF. seems to be the pct of duration where the anim starts.
                param: view.getUint16(off+6, true),
            }
            off += 8;
        }
        if ((obj.flag & ParticleFlags.TextureAnimation) != 0)
        {
            var textures = [];
            for (var i=0; i<8; i++) textures[i] = view.getUint8(off+i);
            obj.texAnim = {
                textures: textures,
                frames: view.getUint8(off+8),
                unknown1: view.getUint8(off+9), //128 - duration of particle. 37 - blue spark? (7 frames for 7 duration effect)
                unknown2: view.getUint16(off+10, true), //1 - random frame? 
            }
            off += 12;
        }
        if ((obj.flag & ParticleFlags.Bit16) != 0)
        {
            obj.Bit16 = [];
            for (var i=0; i<20; i++) obj.Bit16[i] = view.getUint8(off+i);
            off += 20;
        }
        if ((obj.flag & ParticleFlags.Gravity) != 0)
        {

            //gravity
            //x wind
            //gravity (signed 16, -1 is down, leaves are FFEA (-22/4096))
            //z wind
            //pad?
            obj.gravity = [
                view.getInt16(off, true)/4096,
                view.getInt16(off+2, true)/4096,
                view.getInt16(off+4, true)/4096,
                view.getInt16(off+6, true)/4096, //pad, should be ignored by vec3 ops
            ];

            off += 8;
        }
        if ((obj.flag & ParticleFlags.Bit25) != 0)
        {
            //seems to be 4 int 16s typically in some kind of pattern.
            obj.Bit25 = [];
            for (var i=0; i<8; i++) obj.Bit25[i] = view.getUint8(off+i);
            off += 8;
        }
        if ((obj.flag & ParticleFlags.Bit26) != 0)
        {
            obj.Bit26 = [];
            for (var i=0; i<16; i++) obj.Bit26[i] = view.getUint8(off+i);
            off += 16;
        }
        if ((obj.flag & ParticleFlags.Bit27) != 0)
        {
            obj.Bit27 = [];
            for (var i=0; i<4; i++) obj.Bit27[i] = view.getUint8(off+i);
            off += 4;
        }
        if ((obj.flag & ParticleFlags.Bit28) != 0)
        {
            obj.Bit28 = [];
            for (var i=0; i<8; i++) obj.Bit28[i] = view.getUint8(off+i);
            off += 8;
        }
        if ((obj.flag & ParticleFlags.Bit29) != 0)
        {
            obj.Bit29 = [];
            for (var i=0; i<16; i++) obj.Bit29[i] = view.getUint8(off+i);
            off += 16;
        }

        obj.nextOff = off;
        return obj;
    }

    function readParticleTexture(view, off) {
        var obj = {};
        obj.stamp = readChar(view, off+0x0)+readChar(view, off+0x1)+readChar(view, off+0x2)+readChar(view, off+0x3);
        if (obj.stamp != " TPS") throw "SPT invalid (particle texture in SPA). Expected ' TPS', found "+obj.stamp;

        var flags = view.getUint16(off+4, true);
        obj.info = {
            pal0trans: true,//z(flags>>3)&1, //weirdly different format
            format: ((flags)&7),
            height: 8 << ((flags>>8)&0xF),
            width: 8 << ((flags>>4)&0xF),
            repeatX: (flags>>12)&1,
            repeatY: (flags>>13)&1,
            flipX: (flags>>14)&1,
            flipY: (flags>>15)&1,
        }
        obj.flags = flags;

        obj.unknown = view.getUint16(off+6, true);
        obj.texDataLength = view.getUint32(off+8, true);
        obj.palOff = view.getUint32(off+0xC, true);
        obj.palDataLength = view.getUint32(off+0x10, true);
        obj.unknown2 = view.getUint32(off+0x14, true);
        obj.unknown3 = view.getUint32(off+0x18, true);
        obj.unknown4 = view.getUint32(off+0x1C, true);

        obj.texData = view.buffer.slice(off+32, off+32+obj.texDataLength);
        off += 32+obj.texDataLength;
        obj.palData = view.buffer.slice(off, off+obj.palDataLength);

        obj.nextOff = off+obj.palDataLength;

        //var test = readTexWithPal(obj.info, obj);
        //document.body.appendChild(test);

        return obj;
    }


//modified from NSBTX.js - should probably refactor to use be generic between both

    function readTexWithPal(tex, data) {
        var format = tex.format; 
        var trans = tex.pal0trans;

        if (format == 5) return readCompressedTex(tex, data); //compressed 4x4 texture, different processing entirely

        var off = 0;//tex.texOffset;
        var palView = new DataView(data.palData);
        var texView = new DataView(data.texData);
        var palOff = 0;//pal.palOffset;

        var canvas = document.createElement("canvas");
        canvas.width = tex.width;
        canvas.height = tex.height;
        var ctx = canvas.getContext("2d");
        var img = ctx.getImageData(0, 0, tex.width, tex.height);
        
        var total = tex.width*tex.height;
        var databuf;
        for (var i=0; i<total; i++) {
            var col;
            if (format == 1) { //A3I5 encoding. 3 bits alpha 5 bits pal index
                var dat = texView.getUint8(off++)
                col = readPalColour(palView, palOff, dat&31, trans);
                col[3] = (dat>>5)*(255/7);

            } else if (format == 2) { //2 bit pal
                if (i%4 == 0) databuf = texView.getUint8(off++);
                col = readPalColour(palView, palOff, (databuf>>((i%4)*2))&3, trans)

            } else if (format == 3) { //4 bit pal
                if (i%2 == 0) {
                    databuf = texView.getUint8(off++);
                    col = readPalColour(palView, palOff, databuf&15, trans)
                } else {
                    col = readPalColour(palView, palOff, databuf>>4, trans)
                }

            } else if (format == 4) { //8 bit pal
                col = readPalColour(palView, palOff, texView.getUint8(off++), trans)

            } else if (format == 6) { //A5I3 encoding. 5 bits alpha 3 bits pal index
                var dat = texView.getUint8(off++)
                col = readPalColour(palView, palOff, dat&7, trans);
                col[3] = (dat>>3)*(255/31);

            } else if (format == 7) { //raw color data
                col = texView.getUint16(off, true);
                colourBuffer[0] = Math.round(((col&31)/31)*255)
                colourBuffer[1] = Math.round((((col>>5)&31)/31)*255)
                colourBuffer[2] = Math.round((((col>>10)&31)/31)*255)
                colourBuffer[3] = Math.round((col>>15)*255);
                col = colourBuffer;
                off += 2;

            } else {
                console.log("texture format is none, ignoring")
                return canvas;
            }
            img.data.set(col, i*4);
        }
        ctx.putImageData(img, 0, 0)
        return canvas;
    }

    function readCompressedTex(tex) { //format 5, 4x4 texels. I'll keep this well documented so it's easy to understand.
        throw "compressed tex not supported for particles! (unknowns for tex data offsets and lengths?)";
        var off = 0;//tex.texOffset;
        var texView = new DataView(compData); //real texture data - 32 bits per 4x4 block (one byte per 4px horizontal line, each descending 1px)
        var compView = new DataView(compInfoData); //view into compression info - informs of pallete and parameters.
        var palView = new DataView(data.palData); //view into the texture pallete
        var compOff = off/2; //info is 2 bytes per block, so the offset is half that of the tex offset.
        var palOff = 0;//pal.palOffset;
        var transColor = new Uint8Array([0, 0, 0, 0]); //transparent black

        var canvas = document.createElement("canvas");
        canvas.width = tex.width;
        canvas.height = tex.height;
        var ctx = canvas.getContext("2d");
        var img = ctx.getImageData(0, 0, tex.width, tex.height);

        var w = tex.width>>2; //iterate over blocks, block w and h is /4.
        var h = tex.height>>2;

        for (var y=0; y<h; y++) {
            for (var x=0; x<w; x++) {
                //inside block
                var bInfo = compView.getUint16(compOff, true); //block info

                var addr = (bInfo & 0x3fff); //offset to relevant pallete
                var mode = ((bInfo >> 14) & 3); 

                var finalPo = palOff+addr*4;
                var imgoff = x*4+(y*w*16);
                for (var iy=0; iy<4; iy++) {
                    var dat = texView.getUint8(off++);
                    for (var ix=0; ix<4; ix++) { //iterate over horiz lines
                        var part = (dat>>(ix*2))&3;
                        var col;

                        switch (mode) {
                            case 0: //value 3 is transparent, otherwise pal colour
                                if (part == 3) col = transColor;
                                else col = readPalColour(palView, finalPo, part);
                                break;
                            case 1: //average mode - colour 2 is average of 1st two, 3 is transparent. 0&1 are normal.
                                if (part == 3) col = transColor;
                                else if (part == 2) col = readFractionalPal(palView, finalPo, 0.5);
                                else col = readPalColour(palView, finalPo, part);
                                break;
                            case 2: //pal colour
                                col = readPalColour(palView, finalPo, part);
                                break;
                            case 3: //5/8 3/8 mode - colour 2 is 5/8 of col0 plus 3/8 of col1, 3 is 3/8 of col0 plus 5/8 of col1. 0&1 are normal.
                                if (part == 3) col = readFractionalPal(palView, finalPo, 3/8);
                                else if (part == 2) col = readFractionalPal(palView, finalPo, 5/8);
                                else col = readPalColour(palView, finalPo, part);
                                break;
                        }

                        img.data.set(col, (imgoff++)*4)
                    }
                    imgoff += tex.width-4;
                }
                compOff += 2; //align off to next block
            }
        }

        ctx.putImageData(img, 0, 0)
        return canvas;
    }

    function readPalColour(view, palOff, ind, pal0trans) {
        var col = view.getUint16(palOff+ind*2, true);
        var f = 255/31;
        colourBuffer[0] = Math.round((col&31)*f)
        colourBuffer[1] = Math.round(((col>>5)&31)*f)
        colourBuffer[2] = Math.round(((col>>10)&31)*f)
        colourBuffer[3] = (pal0trans && ind == 0)?0:255;
        return colourBuffer;
    }

    function readFractionalPal(view, palOff, i) {
        var col = view.getUint16(palOff, true);
        var col2 = view.getUint16(palOff+2, true);
        var ni = 1-i;
        var f = 255/31;
        colourBuffer[0] = Math.round((col&31)*f*i + (col2&31)*f*ni)
        colourBuffer[1] = Math.round(((col>>5)&31)*f*i + ((col2>>5)&31)*f*ni)
        colourBuffer[2] = Math.round(((col>>10)&31)*f*i + ((col2>>10)&31)*f*ni)
        colourBuffer[3] = 255;
        return colourBuffer;
    }

    //end NSBTX


    function readChar(view, offset) {
        return String.fromCharCode(view.getUint8(offset));
    }

    if (input != null) {
        load(input);
    }
}