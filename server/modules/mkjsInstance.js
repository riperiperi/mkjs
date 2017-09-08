function mkjsInstance(config, instanceConfig, wss) {
	var userID = 0;
	var sockets = [];
	var kartInf = [];
	var relkDat = [];
	var t = this;

	var upInt = setInterval(update, 16.667);

	function update() {

		//generate and send kart dat packet
		if (relkDat.length != 0) {
			var d = new ArrayBuffer(3+relkDat.length*0x62);
			var arr = new Uint8Array(d);
			var view = new DataView(d);
			arr[0] = 32;
			view.setUint16(1, relkDat.length, true);
			var off = 3;
			for (var i=0; i<relkDat.length; i++) {
				view.setUint16(off, relkDat[i].k, true)
				var cpy = new Uint8Array(relkDat[i].d);
				arr.set(cpy, off+2);
				off += 0x62;
			}

			for (var i=0; i<sockets.length; i++) {
				sockets[i].send(d)
			}
			relkDat = [];
		}

	}

	//HANDLERS BELOW

	function addKart(cli) {
		var c = JSON.parse(JSON.stringify(cli.credentials));
		c.active = true;
		cli.kartID = kartInf.length;
		kartInf.push(c);

		for (var i=0; i<sockets.length; i++) {
			if (sockets[i] != cli) sockets[i].send(JSON.stringify({
				t:"+",
				k:c
			}))
		}
	}

	this.addClient = function(clientSocket) {
		console.log("added client")
		sockets.push(clientSocket);
		clientSocket.credentials.userID = userID++;

		addKart(clientSocket);

		sendInstanceInfo(clientSocket);

		//sendClientID(clientSocket);
	}

	function sendInstanceInfo(clientSocket) {
		clientSocket.send(JSON.stringify({
			t:"*",
			k:kartInf,
			p:clientSocket.kartID,
			c:"mkds/"+Math.floor(Math.random()*36),
			r: 1,
			m: 1
		}))
	}

	function sendToClient(cli, dat) {
		//this function is just here to double check if the client socket hasn't mysteriously closed yet.
		//occasionally a socket can close and we will still be sending data before the "onclose" event for that socket fires.
		//todo: check if there is a reliable way to determine if a socket has closed

		try {
			cli.send(dat);
		} catch(err) {
			console.warn("WARN: failed to send packet to a client. They may have already disconnected.")
		}
	}

	this.removeClient = function(clientSocket) {
		//attempt to remove client -- may not be in this instance!
		var ind = sockets.indexOf(clientSocket);
		if (ind != -1) sockets.splice(ind, 1); //shouldn't cause any problems.

		if (clientSocket.kartID != null) {
			//tell all other clients that this client's kart is now inactive.
			var dat = JSON.stringify({
				t:"-",
				k:clientSocket.kartID
			});
			kartInf[clientSocket.kartID].active = false;
			for (var i=0; i<sockets.length; i++) sockets[i].send(dat)
		}

		if (sockets.length == 0) t.resetInstance();
	}

	function toArrayBuffer(buffer) { //why are you making my life so difficult :(
		var ab = new ArrayBuffer(buffer.length);
		var view = new Uint8Array(ab);
		for (var i = 0; i < buffer.length; ++i) {
			view[i] = buffer[i];
		}
		return ab;
	}

	this.handleMessage = function(cli, data, flags) {
		if (sockets.indexOf(cli) == null) {
			socket.send(JSON.stringify(
				{
					t: "!",
					m: "FATAL ERROR: Server does not recognise client! Are you connecting to the wrong instance?"
				}
			));
		} else {
			var d = toArrayBuffer(data);
			if (flags.binary) {
				//binary data
				var view = new DataView(d);
				var handler = binH[view.getUint8(0)];
				if (handler != null) handler(cli, view);
			} else {
				//JSON string
				var obj;
				try {	
					obj = JSON.parse(d);
				} catch (err) {
					debugger; //packet recieved from server is bullshit
					return;
				}
				var handler = wsH["$"+obj.t];
				if (handler != null) handler(cli, obj);
			}
		}
	}

	var binH = [];
	binH[32] = function(cli, view) {
		if (cli.kartID != null) relkDat.push({k:cli.kartID, d:view.buffer.slice(1)});
	}

	this.resetInstance = function() {
		console.log("instance reset")
		userID = 0;
		kartInf = [];
		relkDat = [];
		for (var i=0; i<sockets.length; i++) {
			sockets[i].credentials.userID = userID++; //reassign user IDs to clients.
			sendClientID(sockets[i]);
		}
	}

	function sendClientID(socket) {
		socket.send(JSON.stringify(
			{
				t: "#",
				i: socket.credentials.userID
			}
		));
	}
}

exports.mkjsInstance = mkjsInstance;