//item state for a kart. not an entity, just supplemental to one.

window.KartItems = function(kart, scene) {
	var t = this;
	t.heldItem = null; //of type Item
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

    var hurtExplodeDelay = 105 //turn right slightly, huge double backflip, small bounces.
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

	function update(input) {
		var pressed = (input.item && !lastItemState);
		if (!t.empty) {
			if (t.currentItem == null) {
				//carousel
				t.cycleTime++;
				if (t.cycleTime >= t.totalTime) {
					if (carouselSfx != null) nitroAudio.kill(carouselSfx);

					//decide on an item
					var item = "koura_g";
					sfx((specialItems.indexOf(item) == -1) ? 63 : 64);
					t.currentItem = item;
				} else {
					//if item button is pressed, we speed up the carousel
					if (pressed) {
						t.totalTime = Math.max(minItemTime, t.totalTime - 20);
					}
				}
			} else {
				if (pressed) {
					//fire?
					t.currentItem = null;
					t.empty = true;
					kart.playCharacterSound(7);
				}
			}

		}
		lastItemState = input.item;
	}
}