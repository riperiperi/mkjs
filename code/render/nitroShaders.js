//
// nitroShaders.js
//--------------------
// Dynamically compiles all shader modes of the nitro renderer.
// by RHY3756547
//

window.nitroShaders = new (function() {

	var t = this;

	this.defaultFrag = "precision highp float;\n\
	\n\
	varying vec2 vTextureCoord;\n\
	varying vec4 color;\n\
	\n\
	uniform sampler2D uSampler;\n\
	\n\
	float indexValue() {\n\
	    int x = int(mod(gl_FragCoord.x, 4.0));\n\
	    int y = int(mod(gl_FragCoord.y, 4.0));\n\
	    int i = (x + y * 4);\n\
	    if (i == 0) return 0.0;\n\
	    else if (i == 1) return 8.0;\n\
	    else if (i == 2) return 2.0;\n\
	    else if (i == 3) return 10.0;\n\
	    else if (i == 4) return 12.0;\n\
	    else if (i == 5) return 4.0;\n\
	    else if (i == 6) return 14.0;\n\
	    else if (i == 7) return 6.0;\n\
	    else if (i == 8) return 3.0;\n\
	    else if (i == 9) return 11.0;\n\
	    else if (i == 10) return 1.0;\n\
	    else if (i == 11) return 9.0;\n\
	    else if (i == 12) return 15.0;\n\
	    else if (i == 13) return 7.0;\n\
	    else if (i == 14) return 13.0;\n\
	    else if (i == 15) return 5.0;\n\
	}\n\
	\n\
	float dither(float color) {\n\
	    float closestColor = (color < 0.5) ? 0.0 : 1.0;\n\
	    float secondClosestColor = 1.0 - closestColor;\n\
	    float d = indexValue();\n\
	    float distance = abs(closestColor - color);\n\
	    return (distance < d) ? closestColor : secondClosestColor;\n\
	}\n\
	\n\
	void main(void) {\n\
		gl_FragColor = texture2D(uSampler, vTextureCoord)*color;\n\
		if (gl_FragColor.a < 1.0 && (gl_FragColor.a == 0.0 || dither(gl_FragColor.a) == 0.0)) discard;\n\
	}"

	this.defaultVert = "attribute vec3 aVertexPosition;\n\
	attribute vec2 aTextureCoord;\n\
	attribute vec4 aColor;\n\
	attribute float matrixID;\n\
	attribute vec3 aNormal;\n\
	\n\
	uniform mat4 uMVMatrix;\n\
	uniform mat4 uPMatrix;\n\
	uniform mat3 texMatrix;\n\
	uniform mat4 matStack[16];\n\
	\n\
	uniform vec4 colMult;\n\
	\n\
	varying vec2 vTextureCoord;\n\
	varying vec4 color;\n\
	\n\
	\n\
	void main(void) {\n\
		gl_Position = uPMatrix * uMVMatrix * matStack[int(matrixID)] * vec4(aVertexPosition, 1.0);\n\
		vTextureCoord = (texMatrix * vec3(aTextureCoord, 1.0)).xy;\n\
		vec3 adjNorm = normalize(vec3(uMVMatrix * matStack[int(matrixID)] * vec4(aNormal, 0.0)));\n\
		float diffuse = 0.7-dot(adjNorm, vec3(0.0, -1.0, 0.0))*0.3;\n\
		\n\
		color = aColor*colMult;\n\
		color = vec4(color.x*diffuse, color.y*diffuse, color.z*diffuse, color.w);\n\
	}"

	this.shadFrag = "precision highp float;\n\
	\n\
	varying vec2 vTextureCoord;\n\
	varying vec4 color;\n\
	varying vec4 lightDist;\n\
	varying vec4 fLightDist;\n\
	\n\
	uniform float shadOff; \n\
	uniform float farShadOff; \n\
	uniform sampler2D lightDSampler;\n\
	uniform sampler2D farLightDSampler;\n\
	\n\
	uniform sampler2D uSampler;\n\
	\n\
	float shadowCompare(sampler2D map, vec2 pos, float compare, float so) {\n\
		float depth = texture2D(map, pos).r;\n\
		return smoothstep(compare-so, compare, depth);\n\
	}\n\
	\n\
	float shadowLerp(sampler2D depths, vec2 size, vec2 uv, float compare, float so){\n\
		vec2 texelSize = vec2(1.0)/size;\n\
		vec2 f = fract(uv*size+0.5);\n\
		vec2 centroidUV = floor(uv*size+0.5)/size;\n\
		\n\
		float lb = shadowCompare(depths, centroidUV+texelSize*vec2(0.0, 0.0), compare, so);\n\
		float lt = shadowCompare(depths, centroidUV+texelSize*vec2(0.0, 1.0), compare, so);\n\
		float rb = shadowCompare(depths, centroidUV+texelSize*vec2(1.0, 0.0), compare, so);\n\
		float rt = shadowCompare(depths, centroidUV+texelSize*vec2(1.0, 1.0), compare, so);\n\
		float a = mix(lb, lt, f.y);\n\
		float b = mix(rb, rt, f.y);\n\
		float c = mix(a, b, f.x);\n\
		return c;\n\
	}\n\
	\n\
	void main(void) {\n\
		vec4 col = texture2D(uSampler, vTextureCoord)*color;\n\
		\n\
		vec2 ldNorm = abs((lightDist.xy)-vec2(0.5, 0.5));\n\
		float dist = max(ldNorm.x, ldNorm.y);\n\
		\n\
		if (dist > 0.5) {\n\
			gl_FragColor = col*mix(vec4(0.5, 0.5, 0.7, 1.0), vec4(1.0, 1.0, 1.0, 1.0), shadowLerp(farLightDSampler, vec2(4096.0, 4096.0), fLightDist.xy, fLightDist.z-farShadOff, farShadOff*2.0));\n\
		} else if (dist > 0.4) {\n\
			float lerp1 = shadowLerp(farLightDSampler, vec2(4096.0, 4096.0), fLightDist.xy, fLightDist.z-farShadOff, farShadOff*2.0);\n\
			float lerp2 = shadowLerp(lightDSampler, vec2(2048.0, 2048.0), lightDist.xy, lightDist.z-shadOff, shadOff*4.0);\n\
			\n\
			gl_FragColor = col*mix(vec4(0.5, 0.5, 0.7, 1.0), vec4(1.0, 1.0, 1.0, 1.0), mix(lerp2, lerp1, (dist-0.4)*10.0));\n\
		} else {\n\
			gl_FragColor = col*mix(vec4(0.5, 0.5, 0.7, 1.0), vec4(1.0, 1.0, 1.0, 1.0), shadowLerp(lightDSampler, vec2(2048.0, 2048.0), lightDist.xy, lightDist.z-shadOff, shadOff*4.0));\n\
		}\n\
		\n\
		if (gl_FragColor.a == 0.0) discard;\n\
	}\n\
	"

	this.shadVert = "attribute vec3 aVertexPosition;\n\
	attribute vec2 aTextureCoord;\n\
	attribute vec4 aColor;\n\
	attribute float matrixID;\n\
	attribute vec3 aNormal;\n\
	\n\
	uniform mat4 uMVMatrix;\n\
	uniform mat4 uPMatrix;\n\
	uniform mat3 texMatrix;\n\
	uniform mat4 matStack[16];\n\
	\n\
	uniform vec4 colMult;\n\
	\n\
	uniform mat4 shadowMat;\n\
	uniform mat4 farShadowMat;\n\
	uniform float lightIntensity; \n\
	\n\
	varying vec2 vTextureCoord;\n\
	varying vec4 color;\n\
	varying vec4 lightDist;\n\
	varying vec4 fLightDist;\n\
	\n\
	\n\
	void main(void) {\n\
		vec4 pos = uMVMatrix * matStack[int(matrixID)] * vec4(aVertexPosition, 1.0);\n\
		gl_Position = uPMatrix * pos;\n\
		vTextureCoord = (texMatrix * vec3(aTextureCoord, 1.0)).xy;\n\
		\n\
		lightDist = (shadowMat*pos + vec4(1, 1, 1, 0)) / 2.0;\n\
		fLightDist = (farShadowMat*pos + vec4(1, 1, 1, 0)) / 2.0;\n\
		vec3 adjNorm = normalize(vec3(uMVMatrix * matStack[int(matrixID)] * vec4(aNormal, 0.0)));\n\
		float diffuse = (1.0-lightIntensity)-dot(adjNorm, vec3(0.0, -1.0, 0.0))*lightIntensity;\n\
		\n\
		color = aColor*colMult;\n\
		color = vec4(color.x*diffuse, color.y*diffuse, color.z*diffuse, color.w);\n\
	}"

	var dFrag = {
		begin: "precision highp float;\n\
			\n\
			varying vec2 vTextureCoord;\n\
			varying vec4 color;\n\
			\n\
			uniform sampler2D uSampler;\n",

		main: "\n\
			gl_FragColor = texture2D(uSampler, vTextureCoord)*color;\n\
			if (gl_FragColor.a == 0.0) discard;\n",

		extra: "",

	}

	var dVert = {
		begin: "attribute vec3 aVertexPosition;\n\
			attribute vec2 aTextureCoord;\n\
			attribute vec4 aColor;\n\
			attribute float matrixID;\n\
			\n\
			uniform mat4 uMVMatrix;\n\
			uniform mat4 uPMatrix;\n\
			uniform mat3 texMatrix;\n\
			uniform mat4 matStack[16];\n\
			\n\
			uniform vec4 colMult;\n\
			\n\
			varying vec2 vTextureCoord;\n\
			varying vec4 color;\n\
			\n\
			\n",

		main: "\n\
			vec4 pos = uMVMatrix * matStack[int(matrixID)] * vec4(aVertexPosition, 1.0);\n\
			gl_Position = uPMatrix * pos;\n\
			vTextureCoord = (texMatrix * vec3(aTextureCoord, 1.0)).xy;\n\
			\n\
			lightDist = (shadowMat*pos + vec4(1, 1, 1, 0)) / 2.0;\n\
			fLightDist = (farShadowMat*pos + vec4(1, 1, 1, 0)) / 2.0;\n\
			\n\
			color = aColor*colMult;\n\
		",

		extra: ""
	}



	var lightVert = {

		begin: "attribute vec3 aNormal;\n",

		main: "vec3 adjNorm = normalize(vec3(uMVMatrix * matStack[int(matrixID)] * vec4(aNormal, 0.0)));\n\
		float diffuse = 0.7-dot(adjNorm, vec3(0.0, -1.0, 0.0))*0.3;\n\
		color = vec4(color.x*diffuse, color.y*diffuse, color.z*diffuse, color.w);\n",

		extra: ""

	}

	var lightFrag = {
		begin: "",
		main:"",
		end:""
	}

	var sdVert = {
		begin: "uniform mat4 shadowMat;\n\
			uniform mat4 farShadowMat;\n\
			\n\
			varying vec4 lightDist;\n\
			varying vec4 fLightDist;\n",

		main: "lightDist = (shadowMat*pos + vec4(1, 1, 1, 0)) / 2.0;\n\
			fLightDist = (farShadowMat*pos + vec4(1, 1, 1, 0)) / 2.0;\n"
	}

	var sdFrag = {
		begin: "varying vec4 lightDist;\n\
			varying vec4 fLightDist;\n\
			\n\
			uniform float shadOff; \n\
			uniform float farShadOff; \n\
			uniform sampler2D lightDSampler;\n\
			uniform sampler2D farLightDSampler;\n",

		main: "if (lightDist.x<0.0 || lightDist.y<0.0 || lightDist.x>1.0 || lightDist.y>1.0) {\n\
				if (texture2D(farLightDSampler, fLightDist.xy).r+farShadOff < fLightDist.z) {\n\
					gl_FragColor = gl_FragColor*vec4(0.5, 0.5, 0.7, 1);\n\
				}\n\
			} else {\n\
				if (texture2D(lightDSampler, lightDist.xy).r+shadOff < lightDist.z) {\n\
					gl_FragColor = gl_FragColor*vec4(0.5, 0.5, 0.7, 1);\n\
				}\n\
			}\n",

		extra: ""
	}

	var baseConf = {
			frag: this.defaultFrag, vert: this.defaultVert,
			uniforms: [
				["pMatrixUniform", "uPMatrix"],
				["matStackUniform", "matStack"],
				["mvMatrixUniform", "uMVMatrix"],
				["texMatrixUniform", "texMatrix"],
				["samplerUniform", "uSampler"],
				["colMultUniform", "colMult"],
			],
			attributes: [
				["vertexPositionAttribute", "aVertexPosition"],
				["textureCoordAttribute", "aTextureCoord"],
				["colorAttribute", "aColor"],
				["matAttribute", "matrixID"],
				["normAttribute", "aNormal"]
			]
	};

	var config = [];

	var fragParts = [
		dFrag,
		lightFrag,
		sdFrag
	]

	var shadUnif = [
		["shadowMatUniform", "shadowMat"],
		["farShadowMatUniform", "farShadowMat"],
		["lightIntensityUniform", "lightIntensity"],

		["shadOffUniform", "shadOff"],
		["farShadOffUniform", "farShadOff"],

		["lightSamplerUniform", "lightDSampler"],
		["farLightSamplerUniform", "farLightDSampler"]
	]

	config[0] = baseConf;

	config[1] = {frag: this.shadFrag, vert: this.shadVert, uniforms: baseConf.uniforms.slice(0), attributes: baseConf.attributes.slice(0)};
	config[1].uniforms = config[1].uniforms.concat(shadUnif);

	function makeShader(source, base, id) { //makes shaders using flags

	}

	function combineGLSL(shaderParts) {
		var out = "";

		for (var i=0; i<shaderParts.length; i++) out += shaderParts[i].begin;
		out += "\nvoid main(void) {\n";

		for (var i=0; i<shaderParts.length; i++) out += shaderParts[i].main;
		out += "\n}\n";

		for (var i=0; i<shaderParts.length; i++) out += shaderParts[i].extra;

		return out;
	}

	this.compileShaders = function(gl) {
		t.shaders = [];
		for (var i=0; i<config.length; i++) {
			var conf = config[i];
			frag = getShader(gl, conf.frag, "frag");
			vert = getShader(gl, conf.vert, "vert");

			var shader = gl.createProgram();
			gl.attachShader(shader, vert);
			gl.attachShader(shader, frag);
			gl.linkProgram(shader);

			if (!gl.getProgramParameter(shader, gl.LINK_STATUS)) {
				alert("Could not initialise shaders");
			}

			for (var j=0; j<conf.attributes.length; j++) {
				var a = conf.attributes[j];
				shader[a[0]] = gl.getAttribLocation(shader, a[1]);
				gl.enableVertexAttribArray(shader[a[0]]);
			}

			for (var j=0; j<conf.uniforms.length; j++) {
				var a = conf.uniforms[j];
				shader[a[0]] = gl.getUniformLocation(shader, a[1]);
			}

			t.shaders.push(shader);
		}
		return t.shaders;
	}

	function getShader(gl, str, type) {
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

})();