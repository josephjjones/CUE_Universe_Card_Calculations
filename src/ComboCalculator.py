from src.Constants import *

def calculateCombos(cards):
    seen_combos = Set()
    combos = []
    additional_options = [] #This is a list that mirrors combos with data validation to add a dropdown to select other options

    category_map = {}
    category_bonuses = []
    for cardName in cards:
        card = cards[cardName]
        if card[CATEGORY] == "": continue
        duo = None
        if card[COMBO_TYPE] == ComboType.SpecificCard:
            combo = [card[CARD_NAME], card[COMBO_VALUE], ""]
            combined = card[COMBO_VALUE]+card[CARD_NAME] if card[CARD_NAME] > card[COMBO_VALUE] else card[CARD_NAME]+card[COMBO_VALUE]

            duo = cards[card[COMBO_VALUE]]
            if combined not in seen_combos:
                seen_combos.add(combined)
                combos.append(combo)
                if duo[COMBO_TYPE] == ComboType.SpecificCard and duo[COMBO_VALUE] != card[CARD_NAME]: #Three card combo
                    combo = [card[CARD_NAME], card[COMBO_VALUE], duo[COMBO_VALUE]]
                    combined = combineComboNames(combo)
                    if combined not in seen_combos:
                        seen_combos.add(combined)
                        combos.append(combo)
        elif (card[COMBO_TYPE] == "Category" or card[COMBO_TYPE] == "Subcategory") and card[YOUR_BONUS] > 0:
            category_bonuses.append(cardName)

        addToBestOfCategory(category_map, card, false, duo)
        addToBestOfCategory(category_map, card, true, duo) # Add to subcategory
    })

    category_bonuses.forEach((index) => {
        card = cards[index]
        combo = [card[CARD_NAME]]
        if (!category_map[card[COMBO_VALUE]]) return #For Plant Life

        bestValues = category_map[card[COMBO_VALUE]].singles
        bestValues.efficiency.forEach((comboOption) => {
            if (combo.length == 3) return
            if (comboOption[CARD_NAME] !== card[CARD_NAME]) combo.append(comboOption[CARD_NAME])
        })
        while(combo.length < 3) combo.append("")
        combos.append(combo)
        combo = [card[CARD_NAME]]
        additional_options.append(
            SpreadsheetApp.newDataValidation()
            .requireValueInList(bestValues.efficiency.map((comboOption)=>comboOption[CARD_NAME]), true)
            .setAllowInvalid(false)
            .setHelpText('Choose Top Efficiency for '+card[COMBO_VALUE])
            .build())

        bestValues.power.forEach((comboOption) => {
            if (combo.length == 3) return
            if (comboOption[CARD_NAME] !== card[CARD_NAME]) combo.append(comboOption[CARD_NAME])
        })
        while(combo.length < 3) combo.append("")
        combos.append(combo)
        additional_options.append(
            SpreadsheetApp.newDataValidation()
            .requireValueInList(bestValues.power.map((comboOption)=>comboOption[CARD_NAME]), true)
            .setAllowInvalid(false)
            .setHelpText('Choose Top Power for '+card[COMBO_VALUE])
            .build())

        if (category_map[card[COMBO_VALUE]].duos.efficiency) {
            combos.append([card[CARD_NAME], category_map[card[COMBO_VALUE]].duos.efficiency.card1, category_map[card[COMBO_VALUE]].duos.efficiency.card2])
            additional_options.append(null)
            if (category_map[card[COMBO_VALUE]].duos.efficiency.card1 != category_map[card[COMBO_VALUE]].duos.power.card1) {
                combos.append([card[CARD_NAME], category_map[card[COMBO_VALUE]].duos.power.card1, category_map[card[COMBO_VALUE]].duos.power.card2])
                additional_options.append(null)
            }
        }
    })

    # Remove current values from the spread sheet
    const combo_range = spreadsheet.getRange("'Cool Combos'!A11:Y300")
    combo_range.clearContent()
    combo_range.clearDataValidations()

    combos.forEach((combo, index) => {
        const row = combo_range.offset(index, 0, 1, 3)
        row.setValues([combo])
        if (additional_options[index] !== null) {
            row.offset(0,1,1,2).setDataValidation(additional_options[index])
        }
        row.offset(0,3,1,1).setFormula("=SIMULATE_TURN(A"+row.getRow()+":C"+row.getRow()+")")
    })