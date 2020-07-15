/**
 * @OnlyCurrentDoc Limits the script to only accessing the current sheet.
 * 
 * SIMULATE_TURN
 * TODO: 13 For card cost cards only subtract energy possible
 * 
 * General Maintainance
 * TODO: 4 optimize card meta to only calculates for new cards
 * TODO: 8 make a list of all custom functions with full description/document the params in code
 * TODO: 10 Refactor to make all usability testable offline
 * TODO: 12 Add Parameters to the Selection lists page to get rid of all magic numbers
 * 
 * Card List
 * TODO: 6 Rework difficulty
 * TODO: 9 Cards: New Cards 
 * 
 * Cool Combos
 * TODO: Propigate Error Message when thrown from getBonusPower
 * TODO: Add difficulty rating to combo based on additional conditions
 * TODO: copy calculated values for combos with no additional_options
 * 
 * Decks
 * TODO: Add Custimation for Starting Energy, Energy Per Turn, and Special Bonuses
 * 
 * Error Handling
 * TODO: Catch thrown error from simulate turn's helper function
 * TODO: Card Meta: all errors behave the same way
 */

/**
 * A special function that runs when the spreadsheet is open, used to add a
 * custom menu to the spreadsheet.
 */
function onOpen() {
    let spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let menuItems = [
        { name: 'Card Indices', functionName: 'calculateCardIndices' },
        { name: 'Card Meta', functionName: 'calculateCardMeta' },
        { name: 'Card Combos', functionName: 'calculateCombos'}
    ];
    spreadsheet.addMenu('Meta Calculations', menuItems);
    calculateCardIndices();
}

/**
 * calculateCardIndices is a helper function that maps card names to there row index */
function calculateCardIndices() {
    let spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let cardIndices = {};
    let subcategories = {};
    
    spreadsheet.getRange("'Card List'!$A$2:$A")
        .getValues()
        .forEach(
            (item, index) => {
                cardIndices[item[0]] = index + 2; //map card name to index
                subcategories[item[2]] = item[1]; //map Subcategory to Category
            }
        );
    PropertiesService.getDocumentProperties().setProperties(cardIndices);
    PropertiesService.getDocumentProperties().setProperties(subcategories);
}

/**
 * calculateCardMeta is a helper function that adds the formula to calculate card info every 100 rows, so that the calculation timeout is not exceeded
 */
function calculateCardMeta() {
    let sheet = SpreadsheetApp.getActiveSpreadsheet();
    sheet.getRange("'Card List'!N2:Y1000").clearContent();
    var cell = sheet.getRange("'Card List'!N2");
    cell.setFormula("=GROUP_GET_CARD_META(A2:A100)");

    cell = sheet.getRange("'Card List'!N101");
    cell.setFormula("=GROUP_GET_CARD_META(A101:A200)");

    cell = sheet.getRange("'Card List'!N201");
    cell.setFormula("=GROUP_GET_CARD_META(A201:A300)");

    cell = sheet.getRange("'Card List'!N301");
    cell.setFormula("=GROUP_GET_CARD_META(A301:A400)");

    cell = sheet.getRange("'Card List'!N401");
    cell.setFormula("=GROUP_GET_CARD_META(A401:A500)");

    cell = sheet.getRange("'Card List'!N501");
    cell.setFormula("=GROUP_GET_CARD_META(A501:A600)");

    cell = sheet.getRange("'Card List'!N601");
    cell.setFormula("=GROUP_GET_CARD_META(A601:A700)");
    sheet.getRange("'Card List'!N2:Y1000").copyTo(sheet.getRange("'Card List'!N2"), { contentsOnly: true });
}

function getCategory_(subcategory) {
    const category = PropertiesService.getDocumentProperties().getProperty(subcategory);
    return category ? category : subcategory;
}

function addToBestOfCategory(category_map, card, isSubcategory, duo) {
    const comparison_type = isSubcategory ? 'subcategory' : 'category';
    if (category_map[card[comparison_type]] == undefined) {
        category_map[card[comparison_type]] = {
            singles:{
                efficiency:[],
                power:[], //Put Energy Power and Cardname here
            },
            duos:{
                efficiency:null, //will be populated with {card1:, card2:, efficiency:, sametype: boolean}
                power:null,
            },
        };
    }
    const challengers = category_map[card[comparison_type]];
    let challenger_power = card.predicted_power;
    let challenger_energy = card.predicted_energy;
    if (card.combo_type == "Specific Card") {
        if (duo == undefined) return;
        challenger_power = card.power; // The combo value will be calculated in duos
        // Calculate and Add to Duos
        let sametype = card[comparison_type] == duo[comparison_type]; // For combo purposes I ignore duos outside of the category if one in is available
        let duo_power = challenger_power + card.your_bonus + (
            ["Subcategory", "Category"].includes(duo.combo_type) ? duo.power : ( (duo.combo_type != "Specific Card" || duo.combo_value == card.name) ? duo.predicted_power: duo.power )
        );
        let duo_energy = challenger_energy + duo.predicted_energy;
        let duo_efficiency = duo_energy > 0 ? duo_power/duo_energy : duo_power + 10 * (-duo_energy);
        if (challengers.duos.efficiency == undefined || 
            (!challengers.duos.efficiency.sametype && sametype) || 
            (duo_efficiency > challengers.duos.efficiency.efficiency)) {

            challengers.duos.efficiency = {
                card1: card.name, card2: duo.name, efficiency: duo_efficiency, sametype: sametype
            }
        }
        if (challengers.duos.power == undefined || 
            (!challengers.duos.power.sametype && sametype) || 
            (duo_power > challengers.duos.power.power)) {

            challengers.duos.power = {
                card1: card.name, card2: duo.name, power: duo_power, sametype: sametype
            }
        }
    } else if (card.combo_type == "Subcategory" && getCategory_(card.combo_value) != card[comparison_type]) {
        challenger_power = card.power; // Not able to make use of both combos at once
        challenger_energy = card.energy;
    } else if (card.combo_type == "Category" && card.category != getCategory_(card.combo_value)) {
        challenger_power = card.power; // Not able to make use of both combos at once
        challenger_energy = card.energy;
    }

    let challenger_efficiency = challenger_energy > 0 ? challenger_power/challenger_energy : challenger_power + 10 * (-challenger_energy);
    for (let i = 0; i < 10; i++) {
        if (i >= challengers.singles.efficiency.length) {
            challengers.singles.efficiency.push({efficiency: challenger_efficiency, name: card.name});
            break;
        } else if (challenger_efficiency > challengers.singles.efficiency[i].efficiency) {
            challengers.singles.efficiency.splice(i, 0, {efficiency: challenger_efficiency, name: card.name});
            break;
        }
    }
    challengers.singles.efficiency = challengers.singles.efficiency.slice(0, 10);

    for (let i = 0; i < 10; i++) {
        if (i >= challengers.singles.power.length) {
            challengers.singles.power.push({power: challenger_power, name: card.name});
            break;
        } else if (challenger_power > challengers.singles.power[i].power) {
            challengers.singles.power.splice(i, 0, {power: challenger_power, name: card.name});
            break;
        }
    }
    challengers.singles.power = challengers.singles.power.slice(0, 10);
}

//combineComboNames alphabatizes three cards then puts them in a string
function combineComboNames(card_names) {
    if (card_names[0] > card_names[1]) {
        if (card_names[2] > card_names[0]) {
            return card_names[1] + card_names[0] + card_names[2]; 
        } else {
            if ( card_names[1] > card_names[2] ) {
                return card_names[2] + card_names[1] + card_names[0];
            } else {
                return card_names[1] + card_names[2] + card_names[0];
            }
        }
    } else if (card_names[1] > card_names[2]) {
        if (card_names[2] > card_names[0]) {
            return card_names[0] + card_names[2] + card_names[1]; 
        } else {
            return card_names[2] + card_names[0] + card_names[1];
        }
    } else {
        return card_names[0] + card_names[1] + card_names[2];
    }
}

/**
 * calculateCombos depends on indices and meta being generated
 * It parses for all specific card combos and category and subcategory
 * 
 */
function calculateCombos() {
    let spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let seen_combos = new Set();
    let combos = [];
    let additional_options = []; //This is a list that mirrors combos with data validation to add a dropdown to select other options
    const cards = spreadsheet.getRange("'Card List'!A2:Y")
                             .getValues()
                             .map((card) => map_card_info(card));
    let category_map = {};
    let category_bonuses = [];
    cards.forEach((card, index) => {
        if(card.category == undefined) return;
        let duo;
        if(card.combo_type == "Specific Card") {
            let combo = [card.name, card.combo_value, ""];
            let combined = card.name > card.combo_value ? card.combo_value+card.name : card.name+card.combo_value;
            let index = parseInt(PropertiesService.getDocumentProperties().getProperty(card.combo_value))-2;
            duo = cards[index];
            if (!seen_combos.has(combined)) {
                seen_combos.add(combined);
                combos.push(combo); additional_options.push(null);
                if(cards[index].combo_type == "Specific Card" && duo.combo_value != card.name) { //Three card combo
                    combo = [card.name, card.combo_value, duo.combo_value];
                    combined = combineComboNames(combo);
                    if (!seen_combos.has(combined)) {
                        seen_combos.add(combined);
                        combos.push(combo); additional_options.push(null);
                    }
                }
            }
        } else if (card.combo_type == "Category" || card.combo_type == "Subcategory" && card.your_bonus > 0) {
            category_bonuses.push(index);
        }
        addToBestOfCategory(category_map, card, false, duo);
        addToBestOfCategory(category_map, card, true, duo); // Add to subcategory
    });

    category_bonuses.forEach((index) => {
        let card = cards[index];
        let combo = [card.name];
        if (!category_map[card.combo_value]) return; //For Plant Life

        let bestValues = category_map[card.combo_value].singles;
        bestValues.efficiency.forEach((comboOption) => {
            if (combo.length == 3) return;
            if (comboOption.name !== card.name) combo.push(comboOption.name)
        });
        while(combo.length < 3) combo.push("");
        combos.push(combo);
        combo = [card.name];
        additional_options.push(
            SpreadsheetApp.newDataValidation()
            .requireValueInList(bestValues.efficiency.map((comboOption)=>comboOption.name), true)
            .setAllowInvalid(false)
            .setHelpText('Choose Top Efficiency for '+card.combo_value)
            .build());

        bestValues.power.forEach((comboOption) => {
            if (combo.length == 3) return;
            if (comboOption.name !== card.name) combo.push(comboOption.name)
        });
        while(combo.length < 3) combo.push("");
        combos.push(combo);
        additional_options.push(
            SpreadsheetApp.newDataValidation()
            .requireValueInList(bestValues.power.map((comboOption)=>comboOption.name), true)
            .setAllowInvalid(false)
            .setHelpText('Choose Top Power for '+card.combo_value)
            .build());

        if (category_map[card.combo_value].duos.efficiency) {
            combos.push([card.name, category_map[card.combo_value].duos.efficiency.card1, category_map[card.combo_value].duos.efficiency.card2]);
            additional_options.push(null);
            if (category_map[card.combo_value].duos.efficiency.card1 != category_map[card.combo_value].duos.power.card1) {
                combos.push([card.name, category_map[card.combo_value].duos.power.card1, category_map[card.combo_value].duos.power.card2]);
                additional_options.push(null);
            }
        }
    });

    // Remove current values from the spread sheet
    const combo_range = spreadsheet.getRange("'Cool Combos'!A11:Y300")
    combo_range.clearContent();
    combo_range.clearDataValidations();

    combos.forEach((combo, index) => {
        const row = combo_range.offset(index, 0, 1, 3);
        row.setValues([combo]);
        if (additional_options[index] !== null) {
            row.offset(0,1,1,2).setDataValidation(additional_options[index]);
        }
        row.offset(0,3,1,1).setFormula("=SIMULATE_TURN(A"+row.getRow()+":C"+row.getRow()+")");
    });
}

/**
 * A custom function that converts rarity to a numeric value.
 *
 * @param {String} The string rarity.
 * @return {Number} The rarity value.
 * @customfunction
 */
function RARITY_VALUE(rarity) {
    switch (rarity) {
        case "Legendary": return 5;
        case "Epic": return 4;
        case "Rare": return 3;
        case "Common": return 1;
        case "Fusion": return 15;
        case "Limited Legendary": return 10;
        case "Limited Epic": return 9;
        case "Limited Rare": return 8;
        case "Limited Common": return 6;
        case "Mythic": return 50;
    }
    return 1000;
};

/**
 * A custom function that sums a list of rarities to a numeric value.
 *
 * @param {...String} The list of rarity strings.
 * @return {Number} The rarity value.
 * @customfunction
 */
function GROUP_RARITY_VALUES(...args) {
    let result = 0;
    if (!Array.isArray(args)) return RARITY_VALUE(args);
    args.forEach((rarity) => result += RARITY_VALUE(rarity));
    return result;
};

function map_card_info(card_info) {
    let mapped_info = {
        name:           card_info[0],
        category:       card_info[1],
        subcategory:    card_info[2],
        energy:         parseInt(card_info[3]),
        power:          parseInt(card_info[4]),
        rarity:         card_info[5],
        ability_type:   card_info[6],
        activation:     card_info[7],
        when_awarded:   card_info[8],
        your_bonus:     card_info[9] != "" ? parseInt(card_info[9]) : 0,
        their_bonus:    card_info[10]!= "" ? parseInt(card_info[10]): 0,
        combo_type:     card_info[11],
        combo_value:    card_info[12],
    };
    if (card_info.length > 13) {
        mapped_info.description=        card_info[13];
        mapped_info.predicted_energy=   parseInt(card_info[14]);
        mapped_info.predicted_power=    parseInt(card_info[15]);
        mapped_info.predicted_efficiency=     parseFloat(card_info[16]);
        mapped_info.base_efficiency=    parseFloat(card_info[17]);
        mapped_info.difficulty=         parseInt(card_info[18]);
        mapped_info.base_energy=     parseInt(card_info[19]);
        mapped_info.bonus_energy=     parseInt(card_info[20]);
        mapped_info.their_bonus_energy=     parseInt(card_info[21]);
        mapped_info.base_power=     parseInt(card_info[22]);
        mapped_info.bonus_power=     parseInt(card_info[23]);
        mapped_info.their_bonus_power=     parseInt(card_info[24]);
    }
    return mapped_info;
}

 /**
  * A custom function to get card information from the card list
  * @param {string} card_name 
  * @param {string} display One of (vertical, horizontal, mapped)
  * @param {boolean} include_meta 
  * 
  * @customfunction
  */
function GET_CARD_INFO(card_name, display='vertical', include_meta=false) {
    if (!card_name) return null;
    let spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let row = parseInt(PropertiesService.getDocumentProperties().getProperty(card_name));
    let card_info = null;
    if (include_meta) {
        card_info = spreadsheet.getRange("'Card List'!$A" + row + ":$Y" + row).getValues()[0];
    } else {
        card_info = spreadsheet.getRange("'Card List'!$A" + row + ":$M" + row).getValues()[0];
    }
    switch(display) {
        case 'horizontal':
            return [card_info];
        case 'vertical':
            return card_info;
        case 'mapped':
            return map_card_info(card_info);
        default:
            return card_info;
    }
};

/**
 * A function to map activation to difficulty
 *
 * @card_info
 * @return difficulty
 **/
function getCardDifficulty_(card_info) {
    if (card_info.ability_type == "None") return 0;
    let difficulty = 0;
    switch (card_info.activation) {
        case "Drawn":
        case "Played":
        case "After Turn":
        case "In Hand":
        case "":
            break; //always happens no difficulty
        case "Winning Round":
        case "Losing Round":
        case "Tied Round":
            difficulty += 1; //because it is a sure thing at time of playing
            break;
        case "Win Turn":
        case "Lose Turn":
            difficulty += 2;
            break;
        case "Tie Turn":
            difficulty += 10; //Nearly impossible to predict
            break;
        case "Winning After":
            difficulty += 1; //Easy to predict if you are leading the round
            break;
        case "Losing After":
            difficulty += 3; //because it is very hard to predict on the first turn and hard to get and win round on the second, the third the round is lost
            break;
        case "Tying After":
            difficulty += 10; //Nearly impossible to predict
            break;
        case "Losing When Drawn":
            difficulty += 3; //random
            break;
        case "Winning When Drawn":
            difficulty += 3; //random
            break;
        case "Tied When Drawn":
            difficulty += 3; //random
            break;
        case "Played With":
            difficulty += 1;
            break;
        default:
            difficulty += 1000;
    }
    switch (card_info.combo_type) {
        case "All":
        case "None":
        case "This Card":
        case "":
            break; //Every Time
        case "Category":
            difficulty += 1
            break;
        case "Subcategory":
            difficulty += 2;
            break;
        case "Specific Card":
            difficulty += 3;
            break;
        case "Arena":
            difficulty += 5; //Random, slight control
            break;
        default:
            difficulty += 1000;
    }
    return difficulty;
};

function getWording_(condition) {
    const wording_map = {
        "Played":"Played", //Activations, should be preceded by when
        "Played With":"Played With",
        "Winning Round":"Played while Winning The Round",
        "Losing Round":"Played while Losing The Round",
        "Tying Round":"Played while Tying The Round",
        "After Turn":"Returns To Deck",
        "Win Turn":"Played in a Turn you Won",
        "Lose Turn":"Played in a Turn you Lost",
        "Tie Turn":"Played in a Turn you Tied",
        "Winning After":"Winning the Round after being played",
        "Losing After":"Losing the Round after being played",
        "Tied After":"Tying the Round after being played",
        "Drawn":"Drawn",
        "Losing When Drawn":"Losing When Drawn",
        "Winning When Drawn":"Winning When Drawn",
        "Tied When Drawn":"Tied When Drawn",
        "In Hand":"In Hand",
    
        "This Turn":"This Turn", // Award Times preceded by power or energy or ?card cost?
        "Next Turn":"Next Turn",
        "Per Turn Round":"Per Turn This Round",
        "Per Turn Game":"Per Turn This Game",
        "This & Next Turn":"This & Next Turn",
        "Until Played":"Until Played",
        "Game":"This Game",
        "Round":"This Round",
    
        // "None", // Combo Type, should not need rephrasing
        // "All",
        // "Category",
        // "Subcategory",
        // "Specific Card",
        // "This Card",
        // "Arena",
    }
    return wording_map[condition] || condition;
};

function getEfficiency_(energy, energy_bonus, power, power_bonus, their_energy_bonus=0, their_power_bonus=0, difficulty=1) {
    let self_power_per_energy = 10; //VAR
    let their_power_per_energy = 10; //VAR
    let efficiency = {
        base: (energy > 0) ? (power / energy) : (power + (-energy * self_power_per_energy)),
        predicted: (
            (((energy - energy_bonus) > 0) ?
                (power + power_bonus - their_power_bonus - (their_energy_bonus * their_power_per_energy)) / (energy - energy_bonus) : 
                ((power + power_bonus - their_power_bonus) + (-(energy - energy_bonus) * self_power_per_energy) - (their_energy_bonus * their_power_per_energy))
            )
        )
    };
    if (difficulty == 0) {
        efficiency.base = efficiency.predicted;
    } else if (efficiency.base > efficiency.predicted) {
        let temp = efficiency.base;
        efficiency.base = efficiency.predicted;
        efficiency.predicted = temp;
    }
    return [efficiency.base, efficiency.predicted];
};

function signed_(number) {
    return (number>=0 ? "+" : "") + number;
};


// getMaxBonusPower returns the predicted power bonuses for the card and description of the conditions required
function getMaxBonusPower(card) {
    let condition_description = "Error! Condition combination '" + card.activation + "-" + card.when_awarded + "-" + card.combo_type + "' not regonized, update getMaxBonusPower";
    let your_multiplier = 0;
    let their_multiplier = 0;
    let target = "Error! Target not found (getMaxBonusPower).";
    let bonus = 0;
    if (card.your_bonus != 0) {
        if (card.their_bonus != 0) {
            target = " everyone's ";
            bonus = signed_(card.your_bonus) + (card.your_bonus == card.their_bonus ? "" : "/" + signed_(card.their_bonus));
        } else {
            target = " your ";
            bonus = card.your_bonus;
        }
    } else if (card.their_bonus != 0) {
        target = " their ";
        bonus = card.their_bonus;
    }
    switch (card.combo_type) { // Combo Type
        case "None": 
            switch (card.when_awarded) { // Award Type for all activations
                case "This Turn":
                case "Next Turn":
                    your_multiplier += 1;
                    their_multiplier += 1;
                    break;
                case "This & Next Turn":
                case "Per Turn Round":
                    your_multiplier += 2;
                    their_multiplier += 2;
                    break;
                case "Per Turn Game":
                    your_multiplier += 5;
                    their_multiplier += 5;
                    break;
                // case "Until Played":
                // case "Game": //only should be used for card bonuses
                // case "Round":
                default:
                    return [card.your_bonus, card.their_bonus, condition_description];
            }
            if (card.activation == "In Hand") {
                your_multiplier *= 3; // Special Case Activation, this could be higher but would be limiting your flow probs
                their_multiplier *= 3;
            }
            if (card.your_bonus != 0) {
                if (card.their_bonus != 0) {
                    target = " everyone gets ";
                } else {
                    target = " you get ";
                }
            } else if (card.their_bonus != 0) {
                target = " they get ";
            }
            condition_description = "When " + getWording_(card.activation) + target + bonus + " Power " + card.when_awarded;
            break;
        case "All": // The remaining cases are card bonus types
            if(card.activation == "Played With") {
                your_multiplier += 2;
                their_multiplier += 2;
            }
            else switch (card.when_awarded) { // Award Type for all activations
                case "This Turn":
                case "Next Turn":
                    your_multiplier += 3;
                    their_multiplier += 3;
                    break;
                case "Until Played":
                case "Round":
                case "This & Next Turn":
                    your_multiplier += 5;
                    their_multiplier += 5;
                    if (["After Turn","Win Turn","Lose Turn","Tie Turn","Winning After","Losing After","Tied After"].includes(card.activation)) {
                        //After turn conditions assume you played at least 2 cards this turn
                        your_multiplier -= 2;
                        their_multiplier -= 3; // They are unlikely to try and play cards that have a negative bonus
                    }
                    break;
                case "Game":
                    your_multiplier += 10;
                    their_multiplier += 10;
                    if (["After Turn","Win Turn","Lose Turn","Tie Turn","Winning After","Losing After","Tied After"].includes(card.activation)) {
                        your_multiplier -= 4;
                        their_multiplier -= 6;
                    }
                    break;
                // case "Per Turn Round": // Not used for card bonuses
                // case "Per Turn Game":
                default:
                    return [card.your_bonus, card.their_bonus, condition_description];
            }
            if (card.activation == "In Hand") {
                your_multiplier *= 2; //Activates twice probably
                their_multiplier *= 2;
            }
            condition_description = "When " + getWording_(card.activation) + " give " + target + "cards " + bonus + " Power " + card.when_awarded;
            break;
        case "Category":
            if(card.activation == "Played With") {
                your_multiplier += 2; //exeptions to behavior
            }
            else switch (card.when_awarded) { // Award Type for all activations
                case "This Turn":
                    if (["After Turn","Win Turn","Lose Turn","Tie Turn","Winning After","Losing After","Tied After"].includes(card.activation)) return [card.your_bonus, card.their_bonus, condition_description];
                    your_multiplier += 3;
                    their_multiplier += 2;
                    if (card.category != card.combo_value) your_multiplier -= 1;
                    break;
                case "Next Turn":
                    your_multiplier += 3;
                    their_multiplier += 1;
                    break;
                case "Until Played":
                case "Round":
                case "This & Next Turn":
                    your_multiplier += 4;
                    their_multiplier += 2;
                    if (["After Turn","Win Turn","Lose Turn","Tie Turn","Winning After","Losing After","Tied After"].includes(card.activation)) your_multiplier -= 2; //After turn conditions assume you played at least 2 cards this turn
                    else if (card.category != card.combo_value) your_multiplier -= 1;
                    break;
                case "Game":
                    your_multiplier += 8;
                    their_multiplier += 4;
                    if (["After Turn","Win Turn","Lose Turn","Tie Turn","Winning After","Losing After","Tied After"].includes(card.activation)) your_multiplier -= 4; //After turn conditions assume you played at least 2 cards this turn
                    else if (card.category != card.combo_value) your_multiplier -= 2;
                    break;
                // case "Per Turn Round": // Not used for card bonuses
                // case "Per Turn Game":
                default:
                    return [card.your_bonus, card.their_bonus, condition_description];
            }
            if (card.activation == "In Hand") {
                your_multiplier *= 2;
                their_multiplier *= 2; // Special Case Activation, this could be higher but would be limiting your flow probs
            }
            condition_description = "When " + getWording_(card.activation) + " give" + target + card.combo_value + " cards " + bonus + " Power " + card.when_awarded;
            break;
        case "Subcategory":
            if(card.activation == "Played With") your_multiplier += 2; //exceptions to behavior
            else switch (card.when_awarded) { // Award Type for all activations
                case "This Turn":
                    if (["After Turn","Win Turn","Lose Turn","Tie Turn","Winning After","Losing After","Tied After"].includes(card.activation)) return [card.your_bonus, card.their_bonus, condition_description];
                    your_multiplier += 3;
                    their_multiplier += 1; //It is hard to guess subcategory that they will play
                    if (card.subcategory != card.combo_value) your_multiplier -= 1;
                    break;
                case "Next Turn":
                    your_multiplier += 2; //It is hard to only play two cards and have 3 of a single subcategory in your hand
                    their_multiplier += 1;
                    break;
                case "Until Played":
                case "Round":
                case "This & Next Turn":
                    your_multiplier += 3; // Could be 5 but that is unrealistic
                    their_multiplier += 1;
                    if (["After Turn","Win Turn","Lose Turn","Tie Turn","Winning After","Losing After","Tied After"].includes(card.activation)) your_multiplier -= 1; //After turn conditions assume you played at least 2 cards this turn
                    else if (card.subcategory != card.combo_value) your_multiplier -= 1;
                    break;
                case "Game":
                    your_multiplier += 8; // Could be 10 but that mean your whole hand was a single subcategory
                    their_multiplier *= 2;
                    if (["After Turn","Win Turn","Lose Turn","Tie Turn","Winning After","Losing After","Tied After"].includes(card.activation)) your_multiplier -= 4; //After turn conditions assume you played at least 2 cards this turn
                    else if (card.subcategory != card.combo_value) your_multiplier -= 2;
                    break;
                // case "Per Turn Round": // Not used for card bonuses
                // case "Per Turn Game":
                default:
                    return [card.your_bonus, card.their_bonus, condition_description];
            }
            if (card.activation == "In Hand") {
                your_multiplier += 1;
                their_multiplier += 1; // Special Case Activation, this could be higher but would be limiting your flow probs
            }
            condition_description = "When " + getWording_(card.activation) + " give" + target + card.combo_value + " cards " + bonus + " Power " + getWording_(card.when_awarded);
            break;
        case "Specific Card":
            switch (card.when_awarded) { // Award Type for all activations
                case "This Turn":
                case "Next Turn":
                case "Until Played":
                case "Round":
                case "This & Next Turn":
                    your_multiplier += 1;
                    their_multiplier += 0;
                    break;
                case "Game":
                    your_multiplier += 2;
                    their_multiplier += 0;
                    break;
                // case "Per Turn Round": // Not used for card bonuses
                // case "Per Turn Game":
                default:
                    return [card.your_bonus, card.their_bonus, condition_description];
            }
            condition_description = "When " + getWording_(card.activation) + " give " + card.combo_value + " " + bonus + " Power " + getWording_(card.when_awarded);
            break;
        case "This Card":
            switch (card.when_awarded) { // Award Type for all activations
                case "This Turn":
                case "Next Turn":
                case "Until Played":
                case "Round":
                case "This & Next Turn":
                    your_multiplier += 1;
                    break;
                case "Game":
                    your_multiplier += 2;
                    break;
                // case "Per Turn Round": // Not used for card bonuses
                // case "Per Turn Game":
                default:
                    return [card.your_bonus, card.their_bonus, condition_description];
            }
            if (card.their_bonus != 0) {
                return [card.your_bonus, card.their_bonus, condition_description];
            }
            condition_description = "When " + getWording_(card.activation) + " give " + card.combo_type + " " + bonus + " Power " + getWording_(card.when_awarded);
            break;
        case "Arena": // This might need to be moved to an activation condition asuming the Arena will always match the card type
            switch (card.when_awarded) { // Award Type for all activations
                case "This Turn":
                    your_multiplier += 0.5; // only 50% because you can get the bonus at most once per game
                    break;
                case "Next Turn": // I will deal with these cases if/when they arrive
                case "Until Played":
                case "Round":
                case "This & Next Turn":
                // case "Per Turn Round": // Not used for card bonuses
                // case "Per Turn Game":
                default:
                    return [card.your_bonus, card.their_bonus, condition_description];
            }
            if (card.their_bonus != 0) {
                return [card.your_bonus, card.their_bonus, "Error! Target not found (getMaxBonusPower)."];
            }
            condition_description = "When played in a " + card.combo_type + " Arena give this card " + bonus + " Power " + getWording_(card.when_awarded);
            break;
        default:
            return [card.your_bonus, card.their_bonus, condition_description];
    }
    return [card.your_bonus*your_multiplier, card.their_bonus*their_multiplier, condition_description];
}

function getMaxBonusEnergy(card) {
    let condition_description = "Error! Condition combination '" + card.activation + "-" + card.when_awarded + "-" + card.combo_type + "' not regonized, update getMaxBonusEnergy";
    let your_multiplier = 0;
    let their_multiplier = 0;
    let target = "Error! Target not found (getMaxBonusPower).";
    let bonus = 0;
    if (card.your_bonus != 0) {
        if (card.their_bonus != 0) {
            target = " everyone gets ";
            bonus = signed_(card.your_bonus) + (card.your_bonus == card.their_bonus ? "" : " / " + signed_(card.their_bonus));
        } else {
            target = " you get ";
            bonus = card.your_bonus;
        }
    } else if (card.their_bonus != 0) {
        target = " they get ";
        bonus = card.their_bonus;
    }
    switch (card.combo_type) { // Combo Type
        case "None": 
            switch (card.when_awarded) { // Award Type for all activations
                case "This Turn":
                case "Next Turn":
                    your_multiplier += 1;
                    their_multiplier += 1;
                    break;
                case "This & Next Turn":
                case "Per Turn Round":
                    your_multiplier += 2;
                    their_multiplier += 2;
                    break;
                case "Per Turn Game":
                    your_multiplier += 5;
                    their_multiplier += 5;
                    break;
                // case "Until Played":
                // case "Game": //only should be used for card bonuses
                // case "Round":
                default:
                    return [card.your_bonus, card.their_bonus, condition_description];
            }
            if (card.activation == "In Hand") {
                your_multiplier *= 3; // Special Case Activation, this could be higher but would be limiting your flow probs
                their_multiplier *= 3;
            }
            condition_description = "When " + getWording_(card.activation) + target + bonus + " Energy " + getWording_(card.when_awarded);
            break;
        case "All": // All are card bonus types
        case "Category":
        case "Subcategory":
        case "Specific Card":
        case "This Card":
        case "Arena":
        default:
            return [card.your_bonus, card.their_bonus, condition_description];
    }
    return [card.your_bonus*your_multiplier, card.their_bonus*their_multiplier, condition_description];
}

function getMaxReducedCost(card) {
    let your_bonus = 0;
    let their_bonus = 0
    let condition_description = "";
    let less_or_more = "";
    [your_bonus, their_bonus, condition_description] = getMaxBonusPower(card);
    if (your_bonus >= 0 && their_bonus >= 0) less_or_more = " more";
    else if (your_bonus <= 0 && their_bonus <= 0) less_or_more = " less";
    condition_description = condition_description.replace("getMaxBonusPower", "getMaxReducedCost"); // for errors
    condition_description = condition_description.replace(/ ([0-9-\+\/]*) Power/, " Cards cost $1"+less_or_more);
    condition_description = condition_description.replace(/ give | get | gets | gives /g, " ");
    your_bonus = -your_bonus;
    their_bonus = -their_bonus;
    return [your_bonus, their_bonus, condition_description];
}

/**
 * A custom function to calculate card meta information based on the card list
 *
 * @card_name Name of the card you want to analyze
 * @display One of (horizontal, vertical, mapped)
 * @return Efficiency, Max Points, Max Energy, Max Efficiency, Difficulty, Partial
 * @customfunction
 **/
function GET_CARD_META(card_name, display='horizontal') {
    if (!card_name) return [];
    let card = GET_CARD_INFO(card_name, 'mapped');
    let meta = {
        difficulty: getCardDifficulty_(card),
    };
    meta.bonus_power = 0;
    meta.bonus_energy = 0;
    meta.their_bonus_power = 0;
    meta.their_bonus_energy = 0;
    meta.description = "No Ability";
    switch (card.ability_type) {
        case "Power":
            [meta.bonus_power, meta.their_bonus_power, meta.description] = getMaxBonusPower(card);
            break;
        case "Energy":
            [meta.bonus_energy, meta.their_bonus_energy, meta.description] = getMaxBonusEnergy(card);
            break;
        case "Card Cost":
            [meta.bonus_energy, meta.their_bonus_energy, meta.description] = getMaxReducedCost(card);
            // meta.bonus_energy = -meta.bonus_energy; //TODO: fix getMaxReducedCost to return matching information
            // meta.their_bonus_energy = -meta.their_bonus_energy;
            break;
    }
    meta.predicted_energy = card.energy - meta.bonus_energy;
    meta.predicted_power = card.power + meta.bonus_power - meta.their_bonus_power;
    [meta.base_efficiency, meta.predicted_efficiency] =
        getEfficiency_(card.energy, meta.bonus_energy, card.power,
                      meta.bonus_power, meta.their_bonus_energy, meta.their_bonus_power,
                      meta.difficulty);

    switch(display) {
        case 'mapped':
            return meta;
        case 'vertical':
            return [meta.description, meta.predicted_energy, meta.predicted_power, meta.predicted_efficiency, meta.base_efficiency, meta.difficulty,
                    card.energy, meta.bonus_energy, meta.their_bonus_energy, card.power, meta.bonus_power, meta.their_bonus_power];
        case 'horizontal':
        default:
            return [[meta.description, meta.predicted_energy, meta.predicted_power, meta.predicted_efficiency, meta.base_efficiency, meta.difficulty,
                     card.energy, meta.bonus_energy, meta.their_bonus_energy, card.power, meta.bonus_power, meta.their_bonus_power]];
    }
}

/**
 *
 * @customfunction
 */
function GROUP_GET_CARD_META(cards) {
    let result = [];
    cards.forEach((cardRow) => {
        cardRow.forEach((card) => result.push(GET_CARD_META(card, 'vertical')));
    });
    return result;
};

/**
 * 
 * TODO include what turn in the round it is
 * TODO include what round in the game
 * TODO include arena type
 * 
 * @param {*} card
 * @param {*} cards
 * @param {*} num_played
 * @param {*} bonuses
 */
function getBonuses_(card, cards, num_played, bonuses) {
    let your_bonus = card.your_bonus;
    let their_bonus = card.their_bonus;
    //Assume activation has already taken place
    if (card.ability_type == "Energy") {
        switch (card.combo_type) { // Combo Type
            case "None": 
                switch (card.when_awarded) { // Award Type for all activations
                    case "This Turn":
                        bonuses.bonus_energy += your_bonus;
                        bonuses["opponent_energy"] += their_bonus;
                        break;
                    case "Next Turn":
                        bonuses.bonus_energy_future += your_bonus;
                        bonuses["opponentEne_fgy"] += their_bonus;
                        break;
                    case "This & Next Turn":
                        bonuses.bonus_energy += your_bonus;
                        bonuses.bonus_energy_future += your_bonus;
                        bonuses["opponentEne_fgy"] += their_bonus * 2;
                        break;
                    case "Per Turn Round":
                        bonuses.bonus_energy_future += your_bonus * 2;
                        bonuses["opponentEne_fgy"] += their_bonus * 2;
                        break;
                    case "Per Turn Game":
                        bonuses.bonus_energy_future += your_bonus * 5;
                        bonuses["opponentEne_fgy"] += their_bonus * 5;
                        break;
                    // case "Until Played":
                    // case "Game": //only should be used for card bonuses
                    // case "Round":
                    default:
                        throw "Unable to get Energy bonus for " + card.name;
                }
                break;
            case "All": // All are card bonus types
            case "Category":
            case "Subcategory":
            case "Specific Card":
            case "This Card":
            case "Arena":
            default:
                throw "Unable to get Energy bonus for " + card.name;
        }
    } else if (card.ability_type == "Power") {
        let conditions = [];
        let calculate = true;

        switch (card.combo_type) { // Combo Type
            case "None": 
                calculate = false;
                switch (card.when_awarded) {
                    case "This Turn":
                        bonuses["bonus_power"] += your_bonus;
                        bonuses["opponent_power"] += their_bonus;
                        break;
                    case "Next Turn":
                        bonuses["bonus_power_future"] += your_bonus;
                        bonuses["opponent_power"] += their_bonus;
                        break;
                    case "This & Next Turn":
                        bonuses["bonus_power"] += your_bonus;
                        bonuses["bonus_power_future"] += your_bonus;
                        bonuses["opponent_power"] += their_bonus * 2;
                        break;
                    case "Per Turn Round":
                        bonuses["bonus_power_future"] += your_bonus * 2;
                        bonuses["opponent_power"] += their_bonus * 2;
                        break;
                    case "Per Turn Game":
                        bonuses["bonus_power_future"] += your_bonus * 5;
                        bonuses["opponent_power"] += their_bonus * 5;
                        break;
                    // case "Until Played":
                    // case "Game": //only should be used for card bonuses
                    // case "Round":
                    default:
                        throw "Unable to get Power bonus for " + card.name;
                }
                break;
            case "All": // The remaining cases are card bonus types
                break;
            case "Category":
                conditions.push((card_info, index) => card_info.category == card.combo_value);
                break;
            case "Subcategory":
                conditions.push((card_info, index) => card_info.subcategory == card.combo_value);
                break;
            case "Specific Card":
                conditions.push((card_info, index) => card_info.name == card.combo_value);
                break;
            case "This Card":
                conditions.push((card_info, index) => card_info.name == card.name);
                if (their_bonus != 0) {
                    throw "Unable to get Power bonus for " + card.name;
                }
                break;
            case "Arena": 
                throw "Arena Power Bonuses not calculated";
            default:
                throw "Unable to get Power bonus for " + card.name;
        }
        if (calculate) {
            if(card.activation == "Played With") 
                conditions.push((card_info, index) => card_info.name != card.name); //self is not included
            if(["After Turn","Win Turn","Lose Turn","Tie Turn","Winning After","Losing After","Tied After"].includes(card.activation)) 
                conditions.push((card_info, index) => index >= num_played);
            switch (card.when_awarded) {
                case "This Turn":
                    conditions.push((card_info, index) => index < num_played);
                    break;
                case "Next Turn":
                    conditions.push((card_info, index) => index >= num_played);
                    break;
                case "Until Played":
                case "Round":
                case "This & Next Turn": //No new conditions
                    break;
                case "Game": //Could add case of playing twice but will not for now
                    break;
                // case "Per Turn Round": // Not used for card bonuses
                // case "Per Turn Game":
                default:
                    throw "Unable to get Power bonus for " + card.name;
            }

            for(let i = 0; i < 5; i++) {
                let flag = true;
                conditions.forEach((condition) => flag = flag && condition(cards[i], i));
                if (flag) {
                    if (i < num_played) {
                        bonuses["bonus_power"] += your_bonus;
                        //bonuses["opponent_power"] += their_bonus; //this needs to be approximated until we include what the oppenent is playing
                    } else {
                        bonuses["bonus_power_future"] += your_bonus;
                        //bonuses["opponent_power"] += their_bonus;
                    }
                }
            }
        }
    } else if (card.ability_type == "Card Cost") {
        let conditions = [];
        let calculate = true;

        switch (card.combo_type) { // Combo Type
            case "All": // The remaining cases are card bonus types
                break;
            case "Category":
                conditions.push((card_info, index) => card_info.category == card.combo_value);
                break;
            case "Subcategory":
                conditions.push((card_info, index) => card_info.subcategory == card.combo_value);
                break;
            case "Specific Card":
                conditions.push((card_info, index) => card_info.name == card.combo_value);
                break;
            case "This Card":
                conditions.push((card_info, index) => card_info.name == card.name);
                if (their_bonus != 0) {
                    throw "Unable to get Card Cost bonus for " + card.name;
                }
                break;
            case "Arena": 
            case "None": 
            default:
                throw "Unable to get Card Cost bonus for " + card.name;
        }
        if (calculate) {
            if(card.activation == "Played With") 
                conditions.push((card_info, index) => card_info.name != card.name); //self is not included
            if(["After Turn","Win Turn","Lose Turn","Tie Turn","Winning After","Losing After","Tied After"].includes(card.activation)) 
                conditions.push((card_info, index) => index >= num_played);
            switch (card.when_awarded) {
                case "This Turn":
                    conditions.push((card_info, index) => index < num_played);
                    break;
                case "Next Turn":
                    conditions.push((card_info, index) => index >= num_played);
                    break;
                case "Until Played":
                case "Round":
                case "This & Next Turn": //No new conditions
                    break;
                case "Game": //Could add case of playing twice but will not for now
                    break;
                // case "Per Turn Round": // Not used for card bonuses
                // case "Per Turn Game":
                default:
                    throw "Unable to get Card Cost bonus for " + card.name;
            }

            for(let i = 0; i < 5; i++) {
                let flag = true;
                conditions.forEach((condition) => flag = flag && condition(cards[i], i));
                if (flag) {
                    if (i < num_played) {
                        bonuses.bonus_energy -= your_bonus;
                        //bonuses["opponent_energy"] += their_bonus;
                    } else {
                        bonuses.bonus_energy_future -= your_bonus;
                        //bonuses["opponentE_fergy"] += their_bonus;
                    }
                }
            }
        }

    }
}

/**
 * A custom function that takes up to 5 cards, and returns information about playing them together
 * @param cards list of up to 5 card names represents your hand, if less than 5 are included the rest of the hand will be asumed 0 Energy, 0 Power categoryless cards. 
 *
 *
 * @customfunction
 **/
function SIMULATE_TURN(cards, num_played=3, display='horizontal') {
    var cards_info = cards[0].map((card_name) => {
      return card_name != null && card_name != "" ? GET_CARD_INFO(card_name, 'mapped', true) : null;
    });
    for(let i = 0; i < 3; i++) {
        if (cards_info[i] == null) {
            num_played = i;
            break;
        }
    };
    let result = {
        base_energy: 0,
        base_power: 0,
        base_efficiency: 0,
        predicted_energy: 0,
        predicted_power: 0,
        predicted_efficiency: 0,
        bonus_energy: 0,
        bonus_power: 0,
        bonus_energy_future: 0,
        bonus_power_future: 0,
        opponent_energy: 0,
        opponent_power: 0,
        with_opponent_efficiency: 0,
    };


    // Draw Cards
    cards_info.forEach((card) => {
        if (card != null && ["Drawn","Losing When Drawn","Winning When Drawn","Tied When Drawn","In Hand"].includes(card.activation)) {
            try{
                getBonuses_(card, cards_info, num_played, result);
            } catch(err_str) {

            }
        }
    });


    // Play Cards
    for(let i = 0; i < num_played; i++) {
        let card = cards_info[i];
        if (card == null) {num_played = i; break;};
        result["base_energy"] += card.energy;
        result["base_power"] += card.power;
        if (["Played","Played With","Winning Round","Losing Round","Tying Round"].includes(card.activation)) {
            try{
                getBonuses_(card, cards_info, num_played, result);
            } catch(err_str) {

            }
        }
    }


    // Return Cards to Deck
    for(let i = 0; i < num_played; i++) {
        let card = cards_info[i];
        if(["After Turn","Win Turn","Lose Turn","Tie Turn","Winning After","Losing After","Tied After"].includes(card.activation)) {
            try{
                getBonuses_(card, cards_info, num_played, result);
            } catch(err_str) {

            }
        }
    }
    [result.base_efficiency, result.predicted_efficiency] = 
        getEfficiency_(result.base_energy, result.bonus_energy + result.bonus_energy_future, 
                       result.base_power, result.bonus_power+result.bonus_power_future,
                       result.opponent_energy, result.opponent_power);
    result.predicted_energy = result.base_energy - result.bonus_energy - result.bonus_energy_future;
    result.predicted_power = result.base_power + result.bonus_power + result.bonus_power_future - result.opponent_power;
    result_array = [
        result.base_energy,
        result.base_power,
        result.base_efficiency,
        result.predicted_energy,
        result.predicted_power,
        result.predicted_efficiency,
        result.bonus_energy,
        result.bonus_power,
        result.bonus_energy_future,
        result.bonus_power_future,
        result.opponent_energy,
        result.opponent_power,
    ]
    switch(display) {
        case 'mapped':
            return result;
        case 'vertical':
            return result_array;
        case 'horizontal':
        default:
            return [result_array];
    }
};

/**
 * 
 * @param {*} cards 
 * @customfunction
 */
function GROUP_SIMULATE_TURN(cards) {
    let result = [];
    cards.forEach((cardRow) => {
        result.push(SIMULATE_TURN([cardRow], 3, "vertical"));
    });
    return result;
}

/**
 * Analyze Decks returns various calculated values about a deck
 * 
 * @param {string[18]} cards List of 18 Cards
 * @param {string} display One of (horizontal, vertical, mapped)
 * @customfunction
 */
function ANALYZE_DECK(cards, display='vertical') {
    let rarity=0, base_energy=0, base_power=0, predicted_energy=0, predicted_power=0, cycle=0, power_per_turn=0, difficulty=0;
    const energy_per_turn = 7; //VAR
    const starting_energy = 7; //VAR
    cards.forEach((row) => row.forEach((card) => {
        let info = GET_CARD_INFO(card, 'mapped', true);
        if (!info) return; // TODO report error rather than just returning
        rarity += RARITY_VALUE(info.rarity);
        difficulty += info.difficulty;
        base_energy += info.base_energy;
        base_power += info.base_power;
        predicted_energy += info.predicted_energy;
        predicted_power += info.predicted_power;
    }));

    cycle = (predicted_energy) / energy_per_turn;
    power_per_turn = predicted_power / (cycle > 6 ? cycle : 6);

    switch(display) {
        case "mapped":
            return {
                rarity: rarity,
                base_energy: base_energy,
                base_power: base_power,
                predicted_energy: predicted_energy,
                predicted_power: predicted_power,
                cycle: cycle,
                power_per_turn: power_per_turn,
                difficulty: difficulty,
            };
        case "horizontal":
            return [[rarity, base_energy, base_power, predicted_energy, predicted_power, cycle, power_per_turn, difficulty]];
        case "vertical":
        default:
            return [rarity, base_energy, base_power, predicted_energy, predicted_power, cycle, power_per_turn, difficulty];
    };
};

/*
0  Card
1  Category
2  Subcategory
3  Energy
4  Power
5  Rarity
6  Ability Type
7  Activation
8  When Awarded
9  Your Bonus
10 Their Bonus
11 Combo Type
12 Combo Value

13,0  description
14,1  predicted_energy
15,2  predicted_power
16,3  predicted_efficiency
17,4  base_efficiency
18,5  difficulty

*/