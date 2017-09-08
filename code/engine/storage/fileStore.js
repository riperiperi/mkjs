window.fileStore = new (function(){
	var db;
	var indexedDB;

	this.requestGameFiles = requestGameFiles;

	function requestGameFiles(callback) {
		indexedDB = window.indexedDB
                     || window.webkitIndexedDB
                     || window.mozIndexedDB
                     || window.shimIndexedDB;

		var request = indexedDB.open("MKJS_DB", 1);
		request.onerror = window.onerror;

		request.onsuccess = function(event) {
			db = event.target.result;
			loadGameFiles(callback);
		}

		request.onupgradeneeded = function(event) {
			db = event.target.result;
			var objectStore = db.createObjectStore("files", { keyPath: "filename" });
			objectStore.transaction.oncomplete = function(event) {
				loadGameFiles(callback);
			}
		}
	}

	function loadGameFiles(callback) {
		var transaction = db.transaction(["files"]);
		var objectStore = transaction.objectStore("files");
		var request = objectStore.get("mkds.nds");
		request.onerror = function(event) {
			alert("Fatal database error!");
		};
		request.onsuccess = function(event) {
			if (request.result == null) downloadGame(null, callback);
			else callback(request.result.data);
		};
	}

	function downloadGame(url, callback) {
		if (typeof url == "string") {
			var xml = new XMLHttpRequest();
			xml.open("GET", url, true);
			xml.responseType = "arraybuffer";
			xml.onload = function() {
				storeGame(xml.response, callback);
			}
			xml.send();
		} else {
			alert("You need to supply MKJS with a Mario Kart DS ROM to function. Click anywhere on the page to load a file.")
			fileCallback = callback;
			document.getElementById("fileIn").onchange = fileInChange;
			waitForROM = true;
		}
	}

	function fileInChange(e) {
		var bFile = e.target.files[0];
		var bReader = new FileReader();
		bReader.onload = function(e) {
			waitForROM = false; //todo: verify
			storeGame(e.target.result, fileCallback);
		};
		bReader.readAsArrayBuffer(bFile);
	}

	function storeGame(dat, callback) {
		var transaction = db.transaction(["files"], "readwrite");
		var objectStore = transaction.objectStore("files");
		var request = objectStore.put({filename:"mkds.nds", data:dat});

		request.onerror = function(event) {
			alert("Failed to store game locally!");
			callback(dat);
		};
		request.onsuccess = function(event) {
			callback(dat);
		};
	}
})();