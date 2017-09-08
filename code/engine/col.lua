-- collision ported to lua for pico 8

function ellipseVTri(pos, dir, tri)
	-- tri format: v1,v2,v3,normal
	local planeConst = -v_dot(tri[4], tri[1])
	local dist = v_dot(tri[4], pos) + planeConst
	local modDir = v_dot(tri[4], dir)

	if (dist < 0) return

	local t0, t1, embedded = false
	if (modDir == 0) then
		if (abs(dist) < 1) then
			t0 = 0 
			t1 = 1
			embedded = true
		else
			t0 = 1000 
			t1 = 2000
		end
	else
		t0 = (1-dist)/modDir
		t1 = ((-1)-dist)/modDir
	end

	if (t0 > t1) then
		local temp = t1
		t1 = t0
		t0 = temp
	end

	if (not (t0>1 or t1<0)) then
		if (t0 < 0) then 
			embedded = true 
			t0 = 0 
		end
		if (t1 > 1) t1 = 1

		local newT = t0

		local pt = v_cln(pos)
		if (embedded) then
			local tmp=v_cln(tri[4])
			v_scl(tmp,dist)
			v_sub(pt, tmp)
		else
			local tmp=v_cln(dir)
			v_scl(tmp,newT)
			v_add(pt, tmp)
			v_sub(pt, tri[4]) 
		end
		if (pointInTriangle(tri, pt, 0) and newT<t) then
			t = newT
			colPlane = tri
			colPoint = pt
			edge = false
			emb = embedded
			return
		end

		for j=1,3,1 do
			local vert = v_cln(pos)
			v_sub(vert, tri[j])
			local root = getSmallestRoot(v_dot(dir, dir), 2*v_dot(dir, vert), v_dot(vert, vert)-1, t)
			if (root ~= -1) then
				t = root
				colPlane = tri
				colPoint = v_cln(tri[j])
				edge = false
			end
		end

		for j=1,3,1 do
			local vert = tri[j]

			local distVert = v_cln(vert)
			distVert = v_sub(distVert, pos)
			local distLine = v_cln(tri[((j%3)+1)])
			distLine = v_sub(distLine, vert)

			local edgeDist = v_dot(distLine, distLine)
			local edgeDotVelocity = v_dot(distLine, dir)
			local edgeDotVert = v_dot(distVert, distLine)

			local root = getSmallestRoot(
				edgeDist*(-1)*v_dot(dir, dir) 				+ 		edgeDotVelocity*edgeDotVelocity, 
				edgeDist*2*v_dot(dir, distVert) 			- 		2*edgeDotVelocity*edgeDotVert, 
				edgeDist*(1-v_dot(distVert, distVert))		+		edgeDotVert*edgeDotVert, 
				t
			)

			if (root ~= -1) then
				local edgePos = (edgeDotVelocity*root - edgeDotVert)/edgeDist

				if (edgePos >= 0 and edgePos <= 1) then
					t = root
					colPlane = tri
					v_scl(distLine,edgePos)
					colPoint = v_cln(vert)
					v_add(colPoint,distLine)
					edge = true
					end
				end
			end
		end
	end
end

function getSmallestRoot(a, b, c, upperLimit)
	local det = (b*b) - 4*(a*c)
	if (det<0) then return -1
	else 
		det = sqrt(det)
		local root1 = ((-b)-det)/(2*a)
		local root2 = ((-b)+det)/(2*a)

		if (root1 > root2) then
			local temp = root1
			root1 = root2
			root2 = temp
		end

		if (root1>0 && root1<upperLimit) then
			return root1
		elseif (root2>0 && root2<upperLimit) then
			return root2
		else
			return -1
		end
	end
end

function pointInTriangle(tri, point, err) 
	local v0 = v_cln(tri[3])
	v_sub(v0, tri[1])
	local v1 = v_cln(tri[2])
	v_sub(v1, tri[1])
	local v2 = v_cln(point)
	v_sub(v2, tri[1])

	local dot00 = v_dot(v0, v0) 
	local dot01 = v_dot(v0, v1) 
	local dot02 = v_dot(v0, v2)
	local dot11 = v_dot(v1, v1) 
	local dot12 = v_dot(v1, v2)

	local inv = 1/(dot00*dot11 - dot01*dot01)
	local u = (dot11*dot02 - dot01*dot12)*inv
	local v = (dot00*dot12 - dot01*dot02)*inv

	return (u>=-err && v>=-err && (u+v)<1+err)
}