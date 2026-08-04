// TODO:
// LOG resolves from upgrade/compound (Pass/Fail)

let farm = "crab";

const items_to_upgrade = {
	firebow : {target_level : 7},
	fireblade : {target_level : 7},
	firestaff : {target_level : 7},
	dexearring : {target_level : 3},
	intearring : {target_level : 3},
	strearring : {target_level : 3},
};

const DEBUG = true;
const inventory_length = character.items.length;
const farmers = [ "altfire", "firealt", "Garchomp" ];
const locations = {
	"crab" : {x : -1202.5, y : -66}
};

setup_merchant()

function setup_merchant() {
	// Check if we have exisitng state

	let merchant_state = JSON.parse(localStorage.getItem("merchant_state"));
	al_logger("DEBUG", `Merchant State ${JSON.stringify(merchant_state)}`);
	if (merchant_state) {
		switch (merchant_state.farm_type) {
			case "three_server_farm":
				three_server_farm();
				break;
			default:
				three_server_farm();
				break;
		}
	} else {
		// If we have no state, this is a fresh merchant
		three_server_farm();
	}
}

/**
 * Wrappers around console commands that give more information to the user
 * @param {string} type - The type of log to be displayed
 * @param {any} data - Data to be displayed using the logging system
 *
 */
function al_logger(type, data) {
	const timestamp = new Date()
	switch (type) {
		case "DEBUG":
			if (DEBUG)
				console.debug(`${timestamp.toISOString()} [DEBUG] ${data}`);
			break;
		case "ERROR":
			console.error(`${timestamp.toISOString()} [ERROR] ${data}`)
			break;
		case "INFO":
			console.info(`${timestamp.toISOString()} [INFO] ${data}`)
			break;
	}
}

setInterval(() => {
	let pot_index = locate_item("mpot1");
	const mp_usage = 500;

	if ((character.mp <= character.mp_cost ||
		character.mp <= character.max_mp - mp_usage) &&
		!is_on_cooldown("use_mp")) {
		use_skill("use_mp")
	}
}, 100);

function on_cm(name, data) {
	if (farmers.includes(name) && data.message == "location") {
		// If we asked the farmer for a location, we indend to move to it.
		// Get the current farm_type to determine the pattern.
		let merchant_state = JSON.parse(localStorage.getItem("merchant_state"));
		switch (merchant_state.farm_type) {
			case "three_server_farm":
				merchant_state.state = "in-progress";
				localStorage.setItem("merchant_state", JSON.stringify(merchant_state));
				three_server_farm(name, data);
				break;
		}
	}
}

async function three_server_farm(name = "", data = {}) {
	let merchant_state = JSON.parse(localStorage.getItem("merchant_state"));

	if (!merchant_state || merchant_state.state == "complete") {
		localStorage.setItem("merchant_state", JSON.stringify({
			farm_type : "three_server_farm",
			farmers_to_check : farmers,
			state : "location"
		}));
		change_server_to_farmer(farmers[0]);
	} else if (merchant_state.state == "location") {
		const farmer = merchant_state.farmers_to_check[0];
		al_logger("DEBUG", `Sending location message to ${farmer}`);
		send_cm(farmer, {message : "send_location"});
	} else if (merchant_state.state == "in-progress") {
		await smart_move({x : data.x, y : data.y, map : data.map});
		use_skill("mluck", name);
		merchant_state.farmers_to_check.shift(); // Remove the first index

		if (merchant_state.farmers_to_check.length == 0) {
			al_logger("INFO", "Finished moving to farmers");
			merchant_state.state = "complete"
			localStorage.setItem("merchant_state", JSON.stringify(merchant_state));
			setTimeout(three_server_farm, (1000 * 60) * 60);
			const town_again = () => {
				if (character.real_x == locations[farm].x &&
					character.real_y == locations[farm].y) {
					use_skill("use_town");
					setTimeout(town_again, 3000);
				}
			} setTimeout(town_again, 3000);
		} else {
			merchant_state.state = "location";
			localStorage.setItem("merchant_state", JSON.stringify(merchant_state));
			change_server_to_farmer(merchant_state.farmers_to_check[0]);
		}
	}
}

function change_server_to_farmer(farmer_name) {
	const character_list = get_characters();
	if (farmers.includes(farmer_name)) {
		for (farm_character of character_list) {
			if (farm_character.name == farmer_name) {
				const server = farm_character.server.split("_")[1];
				const server_name =
					server.includes("ASIA") ? "ASIA" : server.substring(0, 2);
				// Move to their server
				change_server(
					server_name,
					server.substring(server_name == "ASIA" ? 4 : 2, server.length));
			}
		}
		// Move to their location
		// Provide them the buff

		// Later
		// Take loot from them
		// Sell the loot
		// Store the content within bank
		// Bank loop (Upgrade / combine)
	}
}

/**
 * Parses through the inventory and either upgrades/compounds based on
 * items_to_upgrade list
 *
 */
async function upgrade_inventory() {
	al_logger("DEBUG", "Starting Upgrade Process");
	for (let i = 0; i < inventory_length; i++) {
		al_logger("DEBUG", `Current Inventory Index: ${i}`);
		// Working with an upgradable item
		if (character.items[i] &&
			(character.items[i]?.level || character.items[i].level == 0)) {
			let item_name = character.items[i].name;

			al_logger("DEBUG", `Item Name: ${item_name}`)
			al_logger("DEBUG", `Item Level: ${character.items[i].level}`)

			if (items_to_upgrade[character.items[i].name]) {
				if (G.items[character.items[i].name].upgrade) {
					let scroll_index;

					while (character.items[i] &&
						character.items[i].level <
						items_to_upgrade[character.items[i].name].target_level) {
						// Check the grade of the item for the scroll
						scroll_index =
							locate_item(`scroll${item_grade(character.items[i])}`);
						if (scroll_index == -1)
						break;

						al_logger("INFO", `Upgrading item "${item_name}" at index ${i}`)
						try {
							if (!is_on_cooldown("massproduction"))
								await use_skill("massproduction");
							await upgrade(i, scroll_index);
						} catch (e) {
							al_logger("ERROR", `Failed to upgrade item ${e}: ${e.response}`);
							al_logger("DEBUG", `Item Name: ${item_name}`);
							al_logger("DEBUG", `Index: ${i}`);
							al_logger("DEBUG", `Scroll Index: ${scroll_index}`);
						}
					}
				} else if (G.items[character.items[i].name].compound) {
					// Look through through all items in the inventory
					let scroll_index;
					let item_group = [ i ];

					// Check the grade of the item for the scroll
					scroll_index =
						locate_item(`cscroll${item_grade(character.items[i])}`);

					// Interate through all the inventory items to get the other two items
					// for compound
					for (let j = 0; j < inventory_length; j++) {
						if (j == i)
							continue;

						if (character.items[j]) {
							if (character.items[j].name == character.items[i].name &&
								character.items[j].level == character.items[i].level) {
								item_group.push(j);
							}
						}

						if (item_group.length == 3) {
							al_logger("DEBUG", `Attempting to compound items`);
							al_logger("DEBUG", `Item Group: ${item_group}`);
							al_logger("DEBUG", `Item Group Length: ${item_group.length}`);

							al_logger("INFO", `Compounding item "${item_name}" at index ${i}`)
							try {
								if (!is_on_cooldown("massproduction"))
									await use_skill("massproduction");
								await compound(item_group[0], item_group[1], item_group[2],
									scroll_index);

								// Confirm we still have the item
								if (character.items[i]) {
									// Reset the values to recheck again
									j = 0;
									item_group = [ i ];
									// Check the grade of the item for the scroll
									scroll_index =
										locate_item(`cscroll${item_grade(character.items[i])}`);
									continue;
								}
								break;
							} catch (e) {
								al_logger("ERROR",
									`Failed to compound item: ${e}: ${e.response}`);
								al_logger("DEBUG", `Item Name: ${item_name}`);
								al_logger("DEBUG", `Index: ${i}`);
								al_logger("DEBUG", `Scroll Index: ${scroll_index}`);
								break;
							}
						}
					}
				}
			}
		}
	}
}
