let is_attacking = false;
let is_restocking = false;
let farming_targets;
// Once events are implemented, it will bounce to different targets
// parent.socket.emit("harakiri"); // Test death
let farm = "crab";
const merchant_name = "merchire";
const elixir_name = "elixirluck";
const booster_name = "luckbooster";
const minute = 1000 * 60;
const hour = minute * 60;

// Start the loop by moving the character to the spot
// When we are at the spot, the toon will start attacking the target
check_location_and_move();

/**
 * Overrides the default death logic and moves back our character to the farming spot
 *
 */ 
function handle_death() {
	setTimeout(() => {
		respawn();
		const move_back = () => {
			if (!character.rip) {
				check_location_and_move();
				return;
			}
			setTimeout(move_back, 500);
		}; 
		setTimeout(move_back, 500);
	}, 1000 * 15)
}

/**
 * Moves to the defined farming spot and gives the mob list for it
 *
 */
async function check_location_and_move() {
	switch (farm) {
		case "crab":
			if (character.real_x != -1202.5 && character.real_y != -66) {
				// Not at crab location, need to move
				await smart_move("crab");
			}
			farming_targets = [ "crab", "phoenix" ];
			break;
	}
}	

/**
 * Periodically checks to see if see we have a booster and see if its activated.
 * If not, get a new one.
 *  
 */
async function handle_booster() {
	let booster_index = locate_item(booster_name);

	if (booster_index == -1) {
		try {
			// Move to shop seller
			await smart_move("premium");
			await buy(booster_name);
			activate(locate_item(booster_name));
			await check_location_and_move();
		} catch (error) {
			console.error(`Error occurred when attempting booster logic: ${error}`);
		}
	} else {
		// We have a booster, confirm if its activated
		if (character.items[booster_index]?.expires == null) {
			activate(character_items[booster_index]);
		}
	}
}
setInterval(handle_booster, hour);

/**
 * Periodically checks to see if the our elixir activated, if not activate it.
 *
 */
async function handle_elixir() {
	try {
		if (character.slots?.elixir)
			return;
		let elixir_index = locate_item(elixir_name);

		// Drink the consume x times
		for (let i = 0; i < 4; i++) {
			game_log(`Consuming ${elixir_name}`, "#FFA600");
			consume(elixir_index);
		}

	} catch (error) {
		console.log("Consume error: ", error);
	}
}
setInterval(handle_elixir, minute * 5);

/**
 * Restocks the toon and moves them back to the farm spot
 *
 */
async function restock_toon() {
	// Reset the attack logic, as we are moving away from the farm
	if (is_restocking)
		return;
	is_restocking = true;

	try {
		await move_to_shop();
		await check_location_and_move(farm);
	} finally {
		is_restocking = false;
	}
}

/**
 * Moves the toon to the shop to buy potions if out
 *
 */
async function move_to_shop() {
	const hp_pot_name = character.max_hp < 400 ? "hpot0" : "hpot1";
	const mp_pot_name = character.max_mp < 500 ? "mpot0" : "mpot1";
	const pot_array = [ hp_pot_name, mp_pot_name ];
	const hp_pot_index = locate_item(hp_pot_name);
	const mp_pot_index = locate_item(mp_pot_name);

	await smart_move(-84, -120, "main");

	sell_items();

	for (pot of pot_array) {
		const searched_index = pot.includes("hp") ? hp_pot_index : mp_pot_index;

		if (searched_index == -1) {
			buy(pot, 9999);
		} else {
			if (character.items[searched_index].q != 9999) {
				const bought_pot_slot_index =
					buy(pot, 9999 - character.items[searched_index].q).num;
				if (bought_pot_slot_index)
					swap(searched_index, bought_pot_slot_index);
			}
		}
	}
}

/**
 * Interates through the inventory and sells unwanted items
 *
 */
async function sell_items() {
	let sell_list = [
		"hpamulet",
		"stinger",
		"ringsj",
		"hpbelt",
		"wshoes",
		"wcap",
		"vitscroll",
		"vitearring",
		"cclaw",
		"ink",
		"frogt",
	];

	for (let i = 0; i < character.items.length; i++) {
		if (character.items[i] != null &&
			sell_list.includes(character.items[i].name)) {
			sell(i, 9999);
		}
	}
}

/**
 * Combat loop for the toon
 * Handles the following:
 * Inventory management (Needs to be pass to the merchant
 * Potion usage
 *
 */
setInterval(async function() {
	let pot_index = "";
	let mp_usage;
	let hp_usage = 400;

	if (character.rip) return;

	if (character.esize <= 2 && !smart.moving && !is_restocking)
		restock_toon();

	if (character.max_mp < 500) {
		pot_index = locate_item("mpot0");
		mp_usage = 300;
	} else {
		pot_index = locate_item("mpot1");
		mp_usage = 500;
	}

	if (pot_index == -1 && !smart.moving && !is_restocking)
		restock_toon();

	if (character.hp <= (character.max_hp * 0.5) && !is_on_cooldown("use_hp"))
		use_skill("use_hp");
	else if ((character.mp <= character.mp_cost ||
		character.mp <= character.max_mp - mp_usage) &&
		!is_on_cooldown("use_mp"))
		use_skill("use_mp");

	loot();

	// clear_drawings();
	// draw_circle(character.x, character.y, character.range, 2, 0xFF0000);

	if (!is_attacking && farming_targets) {
		is_attacking = true;
		attack_target(get_mob_targets());
	}
}, 1000 * 0.25); // Loops every 1/4 second

/**
 * Determines what attack style to use against the collection of targets
 * @param {array} targets - Array of entity targets to attack
 *
 */
async function attack_target(targets) {
	if (targets.length === 0) {
		is_attacking = false;
		return;
	}

	change_target(targets[0]);

	try {
		if ((targets.length == 5 &&
			targets.every((m) => is_in_range(m, "attack"))) &&
			character.mp > G.skills["5shot"].mp &&
			character.level >= G.skills["5shot"].level) {
			if (!is_on_cooldown("5shot") &&
				targets.every((target) => get_entity(target.id))) {
				game_log(`Five Shot`, "#FFA600");
				await use_skill("5shot", targets);
				reduce_cooldown("5shot", Math.min(...parent.pings));
			}

		} else if ((targets.length >= 3 &&
			targets.every((m) => is_in_range(m, "attack"))) &&
			character.mp > G.skills["3shot"].mp &&
			character.level >= G.skills["3shot"].level) {
			if (!is_on_cooldown("3shot") &&
				targets.every((target) => get_entity(target.id))) {
				game_log(`Three Shot`, "#FFA600");
				await use_skill("3shot", targets.slice(0, 3));
				reduce_cooldown("3shot", Math.min(...parent.pings));
			}

		} else if (targets.length >= 1 && is_in_range(targets[0], "attack") &&
			character.mp > character.mp_cost) {
			if (can_attack(targets[0]) && !is_on_cooldown("attack") &&
				get_entity(targets[0].id)) {
				game_log(`Single Shot`, "#FFA600");
				await attack(targets[0]);
				reduce_cooldown("attack", Math.min(...parent.pings));
			}
		}
	} catch (error) {
		console.error(`Attack target errored: ${JSON.stringify(error)}`);
		is_attacking = false;
		return;
	}

	setTimeout(() => attack_target(get_mob_targets()),
		Math.max(100, parent.next_skill["attack"].getTime() - Date.now()));
}

/**
 * Grabs a collection of mobs that fit our farmiong targets
 *
 */
function get_mob_targets() {
	let targets = [];

	for (const id in parent.entities) {
		const mob = parent.entities[id];
		if (!mob || mob.type !== "monster" || mob.dead)
			continue;

		if (farming_targets.includes(mob.mtype) || mob.target === character.name) {
			targets.push(mob);
		}
	}

	targets = targets
		.sort((a, b) => {
			a_distance = distance(character, a);
			b_distance = distance(character, b);

			return a_distance - b_distance;
		})
		.slice(0, 5);

	return targets;
}

/**
 * Allows us to handle code messages from our toons
 * https://adventure.land/docs/guide/X.sub-cm
 * @param {string} name - Name of the toon we are getting the code message from
 * @param {object} data - Data object that contains the data payload to parse
 *
 */
function on_cm(name, data) {
	if (name == merchant_name) {
		switch (data.message) {
			case "send_location":
				send_cm(merchant_name, {
					message : "location",
					x : character.real_x,
					y : character.real_y,
					map : character.map
				});
				break;
		}
	}
}
