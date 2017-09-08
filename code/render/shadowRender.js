//
// shadowRender.js
//--------------------
// Provides a shader to draw a shadowed scene using a depth and color texture. (plus depth texture for light source)
// by RHY3756547
//

window.shadowRender = new function() {
	var shadFrag = "precision highp float;\n\
	\n\
	varying vec2 vTextureCoord;\n\
	varying vec4 color;\n\
	\n\
	uniform sampler2D cSampler;\n\
	uniform sampler2D depSampler;\n\
	uniform sampler2D lightDSampler;\n\
	uniform sampler2D farLightDSampler;\n\
	\n\
	uniform mat4 shadowMat;\n\
	uniform mat4 farShadowMat;\n\
	uniform mat4 invViewProj;\n\
	\n\
	\n\
	vec3 positionFromDepth(vec2 vTex)\n\
	{\n\
        float z = texture2D(depSampler, vTex).r * 2.0 - 1.0;\n\
        float x = vTex.x * 2.0 - 1.0;\n\
        float y = vTex.y * 2.0 - 1.0;\n\
        vec4 vProjectedPos = vec4(x, y, z, 1.0);\n\
		\n\
        // Transform by the inverse projection matrix\n\
        vec4 vPositionVS = invViewProj*vProjectedPos;\n\
		\n\
        // Divide by w to get the view-space position\n\
        return vPositionVS.xyz/vPositionVS.w;\n\
	}\n\
	\n\
	void main(void) {\n\
		vec3 pos = positionFromDepth(vTextureCoord);\n\
		vec4 col = texture2D(cSampler, vTextureCoord);\n\
		\n\
		vec4 lightDist = (shadowMat*vec4(pos, 1.0) + vec4(1, 1, 1, 0)) / 2.0;\n\
		if (lightDist.x<0.0 || lightDist.y<0.0 || lightDist.x>1.0 || lightDist.y>1.0) {\n\
			vec4 flightDist = (farShadowMat*vec4(pos, 1.0) + vec4(1, 1, 1, 0)) / 2.0;\n\
			if (texture2D(farLightDSampler, flightDist.xy).r+0.0005 < flightDist.z) {\n\
				gl_FragColor = col*vec4(0.5, 0.5, 0.7, 1);\n\
			} else {\n\
				gl_FragColor = col;\n\
			}\n\
		} else {\n\
			\n\
			if (texture2D(lightDSampler, lightDist.xy).r+0.00005 < lightDist.z) {\n\
				gl_FragColor = col*vec4(0.5, 0.5, 0.7, 1);\n\
			} else {\n\
				gl_FragColor = col;\n\
			}\n\
		}\n\
		\n\
		if (gl_FragColor.a == 0.0) discard;\n\
	}\n\
	\n\
	"

	var shadVert = "attribute vec3 aVertexPosition;\n\
	attribute vec2 aTextureCoord;\n\
	\n\
	varying vec2 vTextureCoord;\n\
	\n\
	void main(void) {\n\
		gl_Position = vec4(aVertexPosition, 1.0);\n\
		vTextureCoord = vec3(aTextureCoord, 1.0).xy;\n\
	}"

	var shadowShader, vecPosBuffer, vecTxBuffer;

	this.drawShadowed = drawShadowed;

	this.init = function(ctx) {
		gl = ctx;
		this.gl = gl;
		frag = getShader(shadFrag, "frag");
		vert = getShader(shadVert, "vert");

		shadowShader = gl.createProgram();
		gl.attachShader(shadowShader, vert);
		gl.attachShader(shadowShader, frag);
		gl.linkProgram(shadowShader);

		if (!gl.getProgramParameter(shadowShader, gl.LINK_STATUS)) {
			alert("Could not initialise shaders");
		}

		shadowShader.vertexPositionAttribute = gl.getAttribLocation(shadowShader, "aVertexPosition");
		gl.enableVertexAttribArray(shadowShader.vertexPositionAttribute);

		shadowShader.textureCoordAttribute = gl.getAttribLocation(shadowShader, "aTextureCoord");
		gl.enableVertexAttribArray(shadowShader.textureCoordAttribute);

		shadowShader.colTexUniform = gl.getUniformLocation(shadowShader, "cSampler");
		shadowShader.depTexUniform = gl.getUniformLocation(shadowShader, "depSampler");
		shadowShader.lightTexUniform = gl.getUniformLocation(shadowShader, "lightDSampler");
		shadowShader.lightFarTexUniform = gl.getUniformLocation(shadowShader, "farLightDSampler");
		shadowShader.lightViewUniform = gl.getUniformLocation(shadowShader, "shadowMat");
		shadowShader.lightFarViewUniform = gl.getUniformLocation(shadowShader, "farShadowMat");
		shadowShader.camViewUniform = gl.getUniformLocation(shadowShader, "invViewProj");

		this.shadowShader = shadowShader;

		vecPosBuffer = gl.createBuffer();
		vecTxBuffer = gl.createBuffer();

		gl.bindBuffer(gl.ARRAY_BUFFER, vecPosBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(
			[-1, -1, 0, 
			 1, -1, 0,
			 1, 1, 0,

			 1, 1, 0,
			-1, 1, 0,
			-1, -1, 0,  
			]
		), gl.STATIC_DRAW);

		gl.bindBuffer(gl.ARRAY_BUFFER, vecTxBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(
			[
			 0, 0,
			 1, 0,
			 1, 1,

			 1, 1,
			 0, 1,
			 0, 0,
			]
		), gl.STATIC_DRAW);

	}

	function getShader(str, type) {
		var shader;
		if (type == "frag") {
			shader = gl.createShader(gl.FRAGMENT_SHADER);
		} else if (type == "vert") {
			shader = gl.createShader(gl.VERTEX_SHADER);
		} else {
			return null;
		}

		gl.shaderSource(shader, str);
		gl.compileShader(shader);

		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			alert(gl.getShaderInfoLog(shader));
			return null;
		}

		return shader;
	}

	function drawShadowed(colTex, depTex, lightTex, lightFarTex, camView, lightView, lightFarView) {
		var shader = shadowShader;
		gl.useProgram(shader);

		gl.uniformMatrix4fv(shader.lightViewUniform, false, lightView);
		gl.uniformMatrix4fv(shader.lightFarViewUniform, false, lightFarView);
		gl.uniformMatrix4fv(shader.camViewUniform, false, mat4.invert(mat4.create(), camView));

		gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, lightTex); //load up material texture
        gl.uniform1i(shader.lightTexUniform, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, colTex); //load up material texture
        gl.uniform1i(shader.colTexUniform, 1);

        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, depTex); //load up material texture
        gl.uniform1i(shader.depTexUniform, 2);

        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, lightFarTex); //load up material texture
        gl.uniform1i(shader.lightFarTexUniform, 3);


        gl.bindBuffer(gl.ARRAY_BUFFER, vecPosBuffer);
		gl.vertexAttribPointer(shader.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, vecTxBuffer);
		gl.vertexAttribPointer(shader.textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);

		gl.drawArrays(gl.TRIANGLES, 0, 6);
	}
}
