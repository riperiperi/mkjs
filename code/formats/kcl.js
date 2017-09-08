//
// kcl.js
//--------------------
// Loads kcl files and provides a variety of functions for accessing and using the data.
// by RHY3756547
//
// includes: gl-matrix.js (glMatrix 2.0)
//

window.kcl = function(input, mkwii) {
	//todo, support versions for other games (MKWii etc)

	this.load = load;
	this.getPlanesAt = getPlanesAt;

	var vertexOffset, normalOffset, planeOffset, octreeOffset, unknown1, topLeftVec,
		xMask, yMask, zMask, coordShift, yShift, zShift, unknown2, trisMapped = 0, 
		//decoded data
		planes, octree, end, mkwiiMode //little endian for ds, big endian for wii

	var sf, mouseX = 0, mouseY = 0, offx, offz, loaded = false //for testing
	var Fixed32Point = 4096;

	if (input != null) {
		//handle input, load kcl from data
		if (typeof input == "string") {
			var xml = new XMLHttpRequest();
			xml.responseType = "arraybuffer";
			xml.open("GET", input, true);
			xml.onload = function() {
				load(xml.response);
			}
			xml.send();
		} else {
			load(input, mkwii);
		}
	}

	window.onmousemove = function(evt) {
		mouseX = evt.pageX;
		mouseY = evt.pageY;
	}

	this.scopeEval = function(code) {return eval(code)} //for debug purposes
	//canvas = document.getElementById("canvas");
	//ctx = canvas.getContext("2d");
	//setInterval(render, 16);

	function readBigDec(view, off, mkwii) {
		if (mkwii) return view.getFloat32(off);
		else return view.getInt32(off, end)/Fixed32Point;
	}

	function load(buffer, mkwii) {
		var mkwii = mkwii;
		if (mkwii == null) mkwii = false;
		end = !mkwii;
		mkwiiMode = mkwii;
		var time = Date.now();
		//loads kcl from an array buffer.
		var view = new DataView(buffer);
		vertexOffset = view.getUint32(0x00, end);
		normalOffset = view.getUint32(0x04, end);
		planeOffset = view.getUint32(0x08, end);
		octreeOffset = view.getUint32(0x0C, end);
		unknown1 = readBigDec(view, 0x10, mkwii); 
		var vec = vec3.create();
		vec[0] = readBigDec(view, 0x14, mkwii);
		vec[1] = readBigDec(view, 0x18, mkwii);
		vec[2] = readBigDec(view, 0x1C, mkwii);
		topLeftVec = vec;
		xMask = view.getUint32(0x20, end);
		yMask = view.getUint32(0x24, end);
		zMask = view.getUint32(0x28, end);
		coordShift = view.getUint32(0x2C, end);
		yShift = view.getUint32(0x30, end);
		zShift = view.getUint32(0x34, end);
		unknown2 = readBigDec(view, 0x38, mkwii);

		//read planes, there should be as many as there is 16 byte spaces between planeOffset+0x10 and octreeOffset
		offset = planeOffset+0x10;
		planes = [null]; //0 index is empty
		var minx=0, maxx=0, minz=0, maxz=0;
		while (offset < octreeOffset) {
			planes.push(new Plane(view, offset));
			offset += 0x10; 
			var vert = planes[planes.length-1].Vertex1;
			if (vert[0] < minx) minx=vert[0];
			if (vert[0] > maxx) maxx=vert[0];
			if (vert[2] < minz) minz=vert[2];
			if (vert[2] > maxz) maxz=vert[2];
		}

		console.log("minx: "+minx+" maxx: "+maxx+" minz: "+minz+" maxz: "+maxz)

		//var sfx = canvas.width/(maxx-minx);
		//var sfy = canvas.height/(maxz-minz);
		//offx = -((minx+maxx)/2);
		//offz = -((minz+maxz)/2);
		//sf = Math.min(sfx, sfy)*0.8;
		octree = []

		var rootNodes = ((~xMask >> coordShift) + 1) * ((~yMask >> coordShift) + 1) * ((~zMask >> coordShift) + 1);

		for (var i=0; i<rootNodes; i++) {
			var off = octreeOffset+i*4;
			octree.push(decodeCube(octreeOffset, off, view));
		}
		loaded = true;
		//alert("process took "+(Date.now()-time)+"ms");
	}

	function render() {
		if (!loaded) return;
		ctx.save();
		ctx.clearRect(0, 0, canvas.width, canvas.height)
		ctx.translate(canvas.width/2, canvas.height/2);
		ctx.scale(sf, sf);
		ctx.translate(offx, offz);
		ctx.strokeStyle = "#000000";
		ctx.lineWidth = 5;
		testDrawPlanes(planes);

		var test = getPlanesAt(((mouseX-canvas.width/2)/sf)-offx, topLeftVec[1]+Math.random()*(~yMask), ((mouseY-canvas.height/2)/sf)-offz);
		ctx.strokeStyle = "#FF0000";
		ctx.lineWidth = 20;
		testDrawPlanes(test);

		ctx.strokeStyle = "#000000";
		ctx.lineWidth = 3;
		drawOctreeBorders();

		ctx.restore();

		/*if (test5 != null) {
			ctx.lineWidth = 0.01;
			ctx.save();
			ctx.translate(canvas.width/2, canvas.height/2);
			ctx.scale(sf, sf);
			ctx.translate(offx, offz);
			ctx.scale(1024, 1024);

			ctx.strokeStyle = "#0000FF";
			var mdl = test5.modelBuffers[0];
			for (var i=0; i<mdl.length; i++) {
				var strip = mdl[i].strips[0];
				var off = 0;
				for (var j=0; j<strip.verts/3; j++) {
					ctx.beginPath();

					ctx.moveTo(strip.posArray[off], strip.posArray[off+2]);
					ctx.lineTo(strip.posArray[off+3], strip.posArray[off+5]);
					ctx.lineTo(strip.posArray[off+6], strip.posArray[off+8]);

					ctx.closePath();
					ctx.stroke();
					off += 9;
				}
			}
			ctx.restore();
		}*/

		
	}

	function drawOctreeBorders() {
		var size = 1<<coordShift;
		for (var x=0; x<((~xMask >> coordShift) + 1); x++) {
			for (var z=0; z<((~zMask >> coordShift) + 1); z++) {
				ctx.strokeRect(topLeftVec[0]+size*x, topLeftVec[2]+size*z, size, size);
			}
		}
	}

	function testDrawPlanes(planes) {
		for (var i=1; i<planes.length; i++) {
			var plane = planes[i];
			ctx.beginPath();

			ctx.moveTo(plane.Vertex1[0], plane.Vertex1[2]);
			ctx.lineTo(plane.Vertex2[0], plane.Vertex2[2]);
			ctx.lineTo(plane.Vertex3[0], plane.Vertex3[2]);

			ctx.closePath();
			ctx.stroke();
		}

	}

	function getPlanesAt(x, y, z) {
		x -= topLeftVec[0];
		y -= topLeftVec[1];
		z -= topLeftVec[2];
		if (x<0 || y<0 || z<0) return []; //no collision
		else {
			x = Math.floor(x);
			y = Math.floor(y);
			z = Math.floor(z);
			if ((x&xMask)>0 || (y&yMask)>0 || (z&zMask)>0) return []; //no collision

			var index = (x>>coordShift)|((y>>coordShift)<<yShift)|((z>>coordShift)<<zShift)
			return traverseOctree(octree[index], x, y, z, coordShift-1);
		}
	}

	function traverseOctree(node, x, y, z, shift) {
		if (node.leaf) return node.realTris;
		//otherwise we're a node! find next index and traverse
		var index = ((x>>shift)&1)|(((y>>shift)&1)<<1)|(((z>>shift)&1)<<2);
		return traverseOctree(node.items[index], x, y, z, shift-1);
	}

	function decodeCube(baseoff, off, view) {
		var data = view.getUint32(off, end);
		var off2 = baseoff+(data&0x7FFFFFFF);
		if (off2 >= view.byteLength) {
			return {
				leaf: true,
				tris: [],
				realTris: []	
			}
		}
		if (data&0x80000000) { //is a leaf.
			off2 += 2;
			var tris = [];
			var realTris = [];
			while (true) {
				var read = view.getUint16(off2, end);
				if (read == 0) break; //zero terminated
				tris.push(read);
				realTris.push(planes[read]);
				trisMapped += 1;
				off2 += 2;
			}
			return {
				leaf: true,
				tris: tris,
				realTris: realTris
			}
		} else { //contains 8 more cubes
			var cubes = [];
			var boff = off2;
			for (var i=0; i<8; i++) {
				cubes.push(decodeCube(boff, off2, view));
				off2 += 4;
			}	
			return {
				leaf: false,
				items: cubes
			}
		}
	}

	function Plane(view, offset) {
		this.Len = readBigDec(view, offset, mkwiiMode);
		this.Vertex1 = readVert(view.getUint16(offset+0x4, end), view);
		this.Normal = readNormal(view.getUint16(offset+0x6, end), view);
		this.NormalA = readNormal(view.getUint16(offset+0x8, end), view);
		this.NormalB = readNormal(view.getUint16(offset+0xA, end), view);
		this.NormalC = readNormal(view.getUint16(offset+0xC, end), view);
		this.CollisionType = view.getUint16(offset+0xE, end);

		var crossA = vec3.cross(vec3.create(), this.NormalA, this.Normal);
		var crossB = vec3.cross(vec3.create(), this.NormalB, this.Normal);

		this.Vertex2 = vec3.scaleAndAdd(vec3.create(), this.Vertex1, crossB, (this.Len/vec3.dot(crossB, this.NormalC)));
		this.Vertex3 = vec3.scaleAndAdd(vec3.create(), this.Vertex1, crossA, (this.Len/vec3.dot(crossA, this.NormalC)));
	}

	function readVert(num, view) {
		var vec = vec3.create();
		var loc = vertexOffset+num*0xC;
		vec[0] = readBigDec(view, loc, mkwiiMode);
		vec[1] = readBigDec(view, loc+0x4, mkwiiMode);
		vec[2] = readBigDec(view, loc+0x8, mkwiiMode);
		return vec;
	}

	function readNormal(num, view) {
		var mkwii = mkwiiMode;
		var vec = vec3.create();
		if (mkwii) {
			var loc = normalOffset+num*0xC;
			vec[0] = view.getFloat32(loc);
			vec[1] = view.getFloat32(loc+0x4);
			vec[2] = view.getFloat32(loc+0x8);
		} else {
			var loc = normalOffset+num*0x6;
			vec[0] = view.getInt16(loc, end)/4096; //fixed point 
			vec[1] = view.getInt16(loc+0x2, end)/4096;
			vec[2] = view.getInt16(loc+0x4, end)/4096;
		}
		return vec;
	}
}