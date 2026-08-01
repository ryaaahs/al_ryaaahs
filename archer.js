let is_attacking = true;
const farming_targets = ["crab", "phoenix"];
const merchant_name = "merchire";
const elixir_name = "elixirluck";

move_to_combat()

/**
* Periodically checks to see if the our elixir activated, if not activate it.
*
*/ 
async function handle_elixir() {
	try 
	{
        	if (character.slots?.elixir) return;
        	let elixir_index = locate_item(elixir);

        	// Drink the consume x times
        	for (let i = 0; i < 4; i++) 
		{
            		game_log(`Consuming ${elixir}`, "#FFA600");
            		consume(elixir_index);
        	}
        
    	}  
	catch (error) 
	{
        	console.log("Consume error: ", error);
    	}
}
setInterval(handle_elixir, (1000 * 60) * 5);

/**
* Moves the toon to the shop to buy potions if out
*
*/
async function move_to_shop() {
    	await smart_move(-84, -120, "main");
    	let pot_name = "";
    	let pot_index = "";
    
    	if (character.max_mp < 500) 
    	{
        	pot_name = "mpot0";
        	pot_index = locate_item(pot_name);
    	}
    	else 
    	{
        	pot_name = "mpot1";
        	pot_index = locate_item(pot_name);
    	}
    
	if (pot_index == -1) 
    	{
        	buy(pot_name, 9999);
    	} 
    	else 
    	{
        	let pot_slot = buy(pot_name, 9999 - character.items[pot_index].q).num;
        	swap(pot_index, pot_slot);
    	}
  
	await sell_items()
}

async function move_to_combat() {
	await smart_move("crab");
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

  	for (let i=0; i < character.items.length; i++) 
	{
	  	if (character.items[i] != null && sell_list.includes(character.items[i].name)) 
		{
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
setInterval(async function()
{  
    	let pot_index = "";
	let mp_usage = 0;

    	if (character.esize <= 2 && !smart.moving) 
    	{
		await move_to_shop();
		await move_to_combat();
	}
	
	let hp_usage = 400;
	
    	if (character.max_mp < 500) 
	{
        	pot_index = locate_item("mpot0");
        	mp_usage = 300;
    	} 
	else 
	{
        	pot_index = locate_item("mpot1");
        	mp_usage = 500;
    	}
    
	if (pot_index == -1 && !smart.moving) 
	{
	    await move_to_shop();
	    await move_to_combat();
	}
	
	if (character.hp <= character.max_hp - hp_usage && !is_on_cooldown("use_hp"))
	{
		use_skill("use_hp")
	} else if ((character.mp <= character.mp_cost || character.mp <= character.max_mp - mp_usage) && !is_on_cooldown("use_mp")) 
	{
		use_skill("use_mp")
	}
	
	loot();

    if (!smart.moving) 
    {
        clear_drawings();
        draw_circle(character.x, character.y, character.range, 2, 0xFF0000);
        
	if (!is_attacking) 
	{
            is_attacking = true
            attack_target(get_mob_targets());
        }
    }
}, 1000 * 0.25); // Loops every 1/4 second

/**
* Determines what attack style to use against the collection of targets 
* @param {array} targets - Array of entity targets to attack
*
*/ 
async function attack_target(targets) 
{ 
    if (targets.length === 0 || smart.moving) 
    {
        is_attacking = false
        return
    }
    
    change_target(targets[0]);
    
    try 
    {
        if ((targets.length == 5 && targets.every((m) => is_in_range(m, "attack"))) && character.mp > G.skills["5shot"].mp && character.level >= G.skills["5shot"].level) 
	{
            if (!is_on_cooldown("5shot") && targets.every((target) => get_entity(target.id))) {
                game_log(`Five Shot`, "#FFA600");
                await use_skill("5shot", targets)
                reduce_cooldown("5shot", Math.min(...parent.pings))
            }

        } 
	else if ((targets.length >= 3 && targets.every((m) => is_in_range(m, "attack"))) && character.mp > G.skills["3shot"].mp && character.level >= G.skills["3shot"].level) 
	{
            if (!is_on_cooldown("3shot") && targets.every((target) => get_entity(target.id))) {
                game_log(`Three Shot`, "#FFA600");
                await use_skill("3shot", targets.slice(0, 3))
                reduce_cooldown("3shot", Math.min(...parent.pings))
            }

        } 
	else if (targets.length >= 1 && is_in_range(targets[0], "attack") && character.mp > character.mp_cost) 
	{
            if (can_attack(targets[0]) && !is_on_cooldown("attack") && get_entity(targets[0].id)) 
	    {
                game_log(`Single Shot`, "#FFA600");
                await attack(targets[0])
                reduce_cooldown("attack", Math.min(...parent.pings))
            }
        }
    } 
    catch(e) 
    {
        console.error(e);
    }

    setTimeout(() => attack_target(get_mob_targets()), Math.max(100, parent.next_skill["attack"].getTime() - Date.now()));
}
attack_target(get_mob_targets()); 

/**
* Grabs a collection of mobs that fit our farmiong targets
*
*/
function get_mob_targets() 
{
    let targets = [];

    for (const id in parent.entities) 
    {
        const mob = parent.entities[id];
        if (!mob || mob.type !== "monster" || mob.dead) continue;

        if (farming_targets.includes(mob.mtype) || mob.target === character.name) 
	{
            targets.push(mob);
        }
    }

    targets = targets.sort((a, b) => 
    {
        a_distance = distance(character, a);
        b_distance = distance(character, b);

        return a_distance - b_distance;
    }).slice(0, 5)

    return targets;
}

/**
* Allows us to handle code messages from our toons
* https://adventure.land/docs/guide/X.sub-cm
* @param {string} name - Name of the toon we are getting the code message from
* @param {object} data - Data object that contains the data payload to parse
* 
*/ 
function on_cm(name, data)
{
	if(name == merchant_name) 
	{
		switch(data.message)
		{
			case "send_location":
				send_cm(merchant_name, 
				{
					message: "location", 
					x: character.real_x,
					y: character.real_y,
					map: character.map
				});
			break;
		}
	}
}

