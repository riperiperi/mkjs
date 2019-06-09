//item state for a kart. not an entity, just supplemental to one.

window.KartItems = function(kart, scene) {
	var t = this;
	t.heldItem = null; //held item, or item that is bound to us. (bound items have hold type 'func', eg. triple shell)
	t.currentItem = null; //string name for item
	t.specificItem = null;
	t.empty = true;
	t.cycleTime = 0;
	t.totalTime = 230;

	var maxItemTime = 230;
	var minItemTime = 80;
	var carouselSfx = null;
	var lastItemState = false;
	var holdAppearDelay = 15;

    var hurtExplodeDelay = 105; //turn right slightly, huge double backflip, small bounces.
	var hurtFlipDelay = 80; //turn right slightly, bounce twice, forward flip
	var hurtSpinDelay = 40; //counter clockwise spin

	t.getItem = getItem;
	t.update = update;

	var specialItems = ["star"];

	function sfx(id) {
		if (kart.local) {
			return nitroAudio.playSound(id, {volume: 2}, 0, null);
		}
		return null;
	}

	function getItem(specific) {
		if (!t.empty) return false;
		else {
			//begin carousel
			t.cycleTime = 0;
			t.totalTime = (specific) ? 60 : maxItemTime;
			if (specific) t.specificItem = specific;
			t.empty = false;

			carouselSfx = sfx(62);
		}
	}

	function createItem() {
		var item = scene.items.createItem(t.currentItem, kart);
		return item;
	}

	function release(input) {
		if (t.heldItem != null) {
			t.heldItem.release(input.airTurn);
		}
		t.heldItem = null;
		kart.playCharacterSound(7);
	}

	function update(input) {
		var pressed = (input.item && !lastItemState);
		var released = (lastItemState && !input.item);
		if (!t.empty) {
			if (t.currentItem == null) {
				//carousel
				t.cycleTime++;
				if (t.cycleTime >= t.totalTime) {
					if (carouselSfx != null) nitroAudio.kill(carouselSfx);

					//decide on an item
					var item = "banana"; //koura_g, banana, f_box, koura_group, koura_group-bomb-7
					sfx((specialItems.indexOf(item) == -1) ? 63 : 64);
					t.currentItem = item;
				} else {
					//if item button is pressed, we speed up the carousel
					if (pressed && t.heldItem == null) {
						t.totalTime = Math.max(minItemTime, t.totalTime - 20);
					}
				}
			} else if (t.heldItem == null) {
				if (pressed) {
					//fire?
					t.heldItem = createItem();
					//t.currentItem = null;
					//t.empty = true;

					if (t.heldItem.canBeHeld()) {
						//begin holding
					} else {
						release(input);
					}
					pressed = false;
				}
			}
		}

		//todo: if held item has been destroyed, stop holding it.

		if (t.heldItem != null) {
			if (t.heldItem.dead) {
				t.heldItem = null;
			} else {
				//t.heldItem.updateHold(kart);
				if (released) {
					if (t.heldItem.canBeHeld() !== 'func') release(input);
				} else if (pressed) {
					//special release: triple shells, bananas. object stays bound when released
					t.heldItem.release(input.airTurn);
					kart.playCharacterSound(7);
					if (t.heldItem.dead) t.heldItem = null;
				}
			}
		}
		lastItemState = input.item;
	}
}