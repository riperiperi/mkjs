//
// largeSphereCollider.js
//--------------------
// Provides functions to detect collision against sets of triangles for swept ellipsoids and small rays (low cost, used for green shells).
// by RHY3756547
//
// includes: gl-matrix.js (glMatrix 2.0)
// /formats/kcl.js
//

window.lsc = new (function() {

	this.raycast = raycast;
	this.sweepEllipse = sweepEllipse;
	this.pointInTriangle = pointInTriangle; //expose this because its kinda useful

	function raycast(pos, dir, kclO, error, ignoreList) { //used for shells, bananas and spammable items. Much faster than sphere sweep. Error used to avoid falling through really small seams between tris.
		var error = (error==null)?0:error;
		var t=1;
		var tris = getTriList(pos, dir, kclO);
		var colPlane = null;
		var colPoint = null; //can be calculated from t, but we calculate it anyway so why not include
		for (var i=0; i<tris.length; i++) {
			//first, check if we intersect the plane within reasonable t.
			//only if this happens do we check if the point is in the triangle.
			//we would also only do sphere sweep if this happens.

			var tri = tris[i];

			if (ignoreList.indexOf(tri) != -1) continue;

			var planeConst = -vec3.dot(tri.Normal, tri.Vertex1);
			var dist = vec3.dot(tri.Normal, pos) + planeConst;
			var modDir = vec3.dot(tri.Normal, dir);
			if (dist < 0 || modDir == 0) continue; //can't collide with back side of polygons! also can't intersect plane with ray perpendicular to plane
			var newT = -dist/modDir;
			if (newT>0 && newT<t) {
				//we have a winner! check if the plane intersecion point is in the triangle.
				var pt = vec3.add([], pos, vec3.scale([], dir, newT))
				if (pointInTriangle(tri, pt, error)) {
					t = newT;
					colPlane = tri;
					colPoint = pt; //result!
				}
			}
		}

		if (colPlane != null) {
			return {
				t: t,
				plane: colPlane,
				colPoint: colPoint,
				normal: colPlane.Normal
			}
		} else return null;
	}

	function modTri(tri, mat) {
		var obj = {};
		obj.Vertex1 = vec3.transformMat4([], tri.Vertex1, mat);
		obj.Vertex2 = vec3.transformMat4([], tri.Vertex2, mat);
		obj.Vertex3 = vec3.transformMat4([], tri.Vertex3, mat);

		obj.Normal = vec3.transformMat3([], tri.Normal, mat3.fromMat4([], mat));
		vec3.normalize(obj.Normal, obj.Normal);
		obj.CollisionType = tri.CollisionType;
		return obj;
	}

	function scaleTri(tri, eDim) {
		var obj = {};
		obj.Vertex1 = vec3.divide([], tri.Vertex1, eDim);
		obj.Vertex2 = vec3.divide([], tri.Vertex2, eDim);
		obj.Vertex3 = vec3.divide([], tri.Vertex3, eDim);

		obj.Normal = tri.Normal
		obj.CollisionType = tri.CollisionType;
		return obj;
	}

	var t, colPlane, colPoint, emb, edge, colO, planeNormal;

	function sweepEllipse(pos, dir, scn, eDimensions, ignoreList) { //used for karts or things that need to occupy physical space.
		t=1;

		var ed = vec3.divide([], [1, 1, 1], eDimensions);

		var tris = getTriList(pos, dir, scn.kcl);

		var oPos = pos;
		var oDir = dir;

		var pos = vec3.divide([], pos, eDimensions); //need to rescale position to move into ellipsoid space
		var dir = vec3.divide([], dir, eDimensions);
		
		colPlane = null;
		colPoint = null; //can be calculated from t, but we calculate it anyway so why not include
		emb = false;
		edge = false;

		ellipseVTris(pos, dir, tris, eDimensions, ignoreList, true);

		for (var i=0; i<scn.colEnt.length; i++) {
			var c = scn.colEnt[i];
			var col = c.getCollision();

			if (vec3.distance(oPos, c.pos) < c.colRad) {
				ellipseVTris(pos, dir, col.tris, mat4.mul([], mat4.scale([], mat4.create(), ed), col.mat), ignoreList, false, c);
			}
		}

		if (colPlane != null) {	
			var norm = vec3.scale([], dir, t)
			vec3.add(norm, pos, norm);
			vec3.sub(norm, norm, colPoint);

			if (Math.sqrt(vec3.dot(norm, norm)) < 0.98) emb = true;

			vec3.mul(colPoint, colPoint, eDimensions);

			return {
				t: t,
				plane: colPlane,
				colPoint: colPoint,
				normal: norm,
				pNormal: planeNormal,
				embedded: emb,
				object: colO
			}
		} else return null;
	}

	function ellipseVTris(pos, dir, tris, mat, ignoreList, eDims, targ) {
		for (var i=0; i<tris.length; i++) {
			//first, check if we intersect the plane within reasonable t.
			//only if this happens do we check if the point is in the triangle.
			//we would also only do sphere sweep if this happens.

			var oTri = tris[i];
			if (ignoreList.indexOf(oTri) != -1) continue;

			var tri = (eDims)?scaleTri(tris[i], mat):modTri(tris[i], mat);
			var planeConst = -vec3.dot(tri.Normal, tri.Vertex1);
			var dist = vec3.dot(tri.Normal, pos) + planeConst;
			var modDir = vec3.dot(tri.Normal, dir);

			if (dist < 0) continue; //can't collide with back side of polygons! also can't intersect plane with ray perpendicular to plane

			var t0, t1, embedded = false;
			if (modDir == 0) {
				if (Math.abs(dist) < 1) {
					t0 = 0; 
					t1 = 1;
					embedded = true;
				} else {
					t0 = 1000; 
					t1 = 2000;
				}
			} else {
				t0 = (1-dist)/modDir;
				t1 = ((-1)-dist)/modDir;
			}

			if (t0 > t1) { //make sure t0 is smallest value
				var temp = t1;
				t1 = t0;
				t0 = temp;
			}

			if (!(t0>1 || t1<0)) {
				//we will intersect this triangle's plane within this frame.
				//
				// Three things can happen for the earliest intersection: 
				// - sphere intersects plane of triangle (pt on plane projected from new position is inside triangle)
				// - sphere intersects edge of triangle
				// - sphere intersects point of triangle

				if (t0 < 0) { embedded = true; t0 = 0; }
				if (t1 > 1) t1 = 1;

				var newT = t0;

				//sphere intersects plane of triangle
				var pt = [];
				if (embedded) {
					vec3.sub(pt, pos, vec3.scale([], tri.Normal, dist));
				} else {
					vec3.add(pt, pos, vec3.scale([], dir, newT))
					vec3.sub(pt, pt, tri.Normal); //project new position onto plane along normal
				}
				if (pointInTriangle(tri, pt, 0) && newT<t) {
					t = newT;
					colPlane = oTri;
					colPoint = pt; //result!
					colO = targ;
					edge = false;
					emb = embedded;
					planeNormal = tri.Normal;
					continue;
				}

				//no inside intersection check vertices:
				for (var j=1; j<=3; j++) {
					var vert = vec3.sub([], pos, tri["Vertex"+j]);
					var root = getSmallestRoot(vec3.dot(dir, dir), 2*vec3.dot(dir, vert), vec3.dot(vert, vert)-1, t);
					if (root != null) {
						t = root;
						colPlane = oTri;
						colO = targ;
						colPoint = vec3.clone(tri["Vertex"+j]); //result!
						planeNormal = tri.Normal;
						edge = false;
					}
				}

				//... and lines

				for (var j=1; j<=3; j++) {
					var vert = tri["Vertex"+j];
					var nextV = tri["Vertex"+((j%3)+1)];

					var distVert = vec3.sub([], vert, pos);
					var distLine = vec3.sub([], nextV, vert);

					var edgeDist = vec3.dot(distLine, distLine);
					var edgeDotVelocity = vec3.dot(distLine, dir);
					var edgeDotVert = vec3.dot(distVert, distLine);

					var root = getSmallestRoot(
						edgeDist*(-1)*vec3.dot(dir, dir) 			+ 		edgeDotVelocity*edgeDotVelocity, 
						edgeDist*2*vec3.dot(dir, distVert) 			- 		2*edgeDotVelocity*edgeDotVert, 
						edgeDist*(1-vec3.dot(distVert, distVert))	+		edgeDotVert*edgeDotVert, 
						t
					);

					if (root != null) {
						var edgePos = (edgeDotVelocity*root - edgeDotVert)/edgeDist;

						if (edgePos >= 0 && edgePos <= 1) {
							t = root;
							colPlane = oTri;
							colO = targ;
							colPoint = vec3.add([], vert, vec3.scale(distLine, distLine, edgePos)); //result!
							planeNormal = tri.Normal;
							edge = true;
						}
					}
				}

			}
		}
	}

	function getSmallestRoot(a, b, c, upperLimit) {
		var det = (b*b) - 4*(a*c);
		if (det<0) return null; //no result :'(
		else {
			det = Math.sqrt(det);
			var root1 = ((-b)-det)/(2*a)
			var root2 = ((-b)+det)/(2*a)

			if (root1 > root2) { //ensure root1 is smallest
				var temp = root1;
				root1 = root2;
				root2 = temp;
			}

			if (root1>0 && root1<upperLimit) {
				return root1;
			} else if (root2>0 && root2<upperLimit) {
				return root2;
			} else {
				return null;
			}
		}
	}

	function pointInTriangle(tri, point, error) { //barycentric check
		//compute direction vectors to the other verts and the point
		var v0 = vec3.sub([], tri.Vertex3, tri.Vertex1);
		var v1 = vec3.sub([], tri.Vertex2, tri.Vertex1);
		var v2 = vec3.sub([], point, tri.Vertex1);

		//we need to find u and v across the two vectors v0 and v1 such that adding them will result in our point's position
		//where the unit length of both vectors v0 and v1 is 1, the sum of both u and v should not exceed 1 and neither should be negative

		var dot00 = vec3.dot(v0, v0); var dot01 = vec3.dot(v0, v1); var dot02 = vec3.dot(v0, v2);
		var dot11 = vec3.dot(v1, v1); var dot12 = vec3.dot(v1, v2);
		//dot11 and dot00 result in the square of the distance for v0 and v1

		var inverse = 1/(dot00*dot11 - dot01*dot01);
		var u = (dot11*dot02 - dot01*dot12)*inverse;
		var v = (dot00*dot12 - dot01*dot02)*inverse;

		return (u>=-error && v>=-error && (u+v)<1+error);
	}

	function getTriList(pos, diff, kclO) { //gets tris from kcl around a line. currently only fetches from middle point of line, but should include multiple samples for large differences in future.
		var sample = vec3.add([], pos, vec3.scale([], diff, 0.5))
		return kclO.getPlanesAt(sample[0], sample[1], sample[2]);
	}

})();