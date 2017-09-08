//
// itemController.js
//--------------------
// An item controller for scenes. Allows items to be synced to multiple clients.
// by RHY3756547
//
// includes: gl-matrix.js (glMatrix 2.0)
//

window.ItemController = function(scene) {
	var t = this;
	t.scene = scene;
	t.items = [];
	t.curInd = 0; //next item index. Max value is insanely high so there shouldn't be much of a problem.
	t.cliID = 0; //client id, used along with item index to specify your items.
	t.time = 0;

	t.addItem = addItem;
	t.changeItem = changeItem;
	t.update = update;
	t.draw = draw;

	var RedShell, Banana, Bomb, BlueShell, Star, MultiItem, Shroom, TripleShroom, QueenShroom, Bullet, Ghost, Squid //these are all null

	var itemFunc = [
		GreenShell,
		RedShell,
		Banana,
		Bomb,
		BlueShell,
		Star,
		MultiItem, //triple shells, lucky 7 if you're into that kind of thing
		Shroom,
		TripleShroom,
		QueenShroom,
		Bullet,
		Ghost,
		Squid
	]

	function update(scene) {
		var itC = t.items.slice(0);
		for (var i=0; i<itC.length; i++) {
			var ent = itC[i];
			ent.update(scene);
		}
	}

	function draw(mvMatrix, pMatrix, gl) {
		for (var i=0; i<t.items.length; i++) {
			var e = t.items[i];
			t.items[i].draw(mvMatrix, pMatrix, gl);
		}
	}

	function addItem(type, ownerKart, params) {
		//sends add item packet. params: itemID, time, params, itemType
		var p = {
			t:"a", 
			i:t.itemID++, 
			c:t.cliID, 
			d:t.time,
			f:type,
			o:ownerKart,
			p:params
		}

		resvPacket(p); //instantly respond to own packets
	}

	function changeItem(item, funcNum, reason, params) {
		//sends change item packet. params: itemID, cliID, function, reason, params
		var p = {
			t:"c", 
			i:item.itemID, 
			c:item.cliID, 
			f:funcNum,
			r:reason,
			p:params
		}

		resvPacket(p); //instantly respond to own packets
	}

	function resvPacket(p) {
		switch (p.t) {
			case "ci":
				var func = itemFunc[p.f];
				if (func != null) {
					var item = new func(scene, scene.karts[p.o], p.d, p.i, p.c, p.p);
					t.items.push(item);
				} else console.error("item id incorrect??")
				break;
			case "~i":
				var it = getItemObj(p.c, p.i);
				if (it != null) {
					var func = it.cFunc[p.f];
					if (func != null) {
						func(p.r, p.p);
					} else console.error("invalid item change function, maybe wrong type?")
				} else console.error("attempt to modify item that is either dead or does not exist")
				break;
		}
	}

	function getItemObj(cli, id) {
		for (var i=0; i<t.items.length; i++) {
			var item = t.items[i];
			if (item.cliID == cli && item.itemID == id) {
				return item;
			}
		}
 	}
}