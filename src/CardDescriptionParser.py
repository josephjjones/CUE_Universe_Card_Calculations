import csv
import sys
from src.Constants import *
from src.MetaCalculator import calculateMeta

class CardDescriptionParser:
    cards = {}
    categoryLists = {} #dictionaries from category to a set of cards
    subcategoryLists = {}

    def __init__(self):
        return
    
    def parseCardFile(self, filename, delimeter="\t"):
        categoryIndex = 0
        subcategoryIndex = 1
        cardNameIndex = 2
        rarityIndex = 3
        energyCostIndex = 4
        powerIndex = 5
        typeIndex = 7
        abilityIndex = 8


        with open(filename) as cardFile:
            cardReader = csv.reader(cardFile, delimiter=delimeter, quotechar='"')
            while(True): # TODO add check just in case CATEGORY is not found
                row = cardReader.__next__()
                if(row[0] == CATEGORY):
                    for index, header in enumerate(row):
                        if(header == CATEGORY): categoryIndex=index
                        elif(header == SUBCATEGORY): subcategoryIndex=index
                        elif(header == CARD_NAME): cardNameIndex=index
                        elif(header == RARITY): rarityIndex=index
                        elif(header == POWER): powerIndex=index
                        elif(header == CARD_TYPE): typeIndex=index
                        elif(header == ABILITY): abilityIndex=index
                    break
            category = ""
            subcategory = ""
            for card in cardReader:
                if(card[categoryIndex]): category=card[categoryIndex]
                if(card[subcategoryIndex]): subcategory=card[subcategoryIndex]

                cardName = card[cardNameIndex]
                if(cardName == ""): continue
                try:
                    self.cards[cardName] = {
                        CARD_NAME: cardName,
                        CATEGORY: category,
                        SUBCATEGORY: subcategory,
                        ENERGY_COST: int(card[energyCostIndex]),
                        POWER: int(card[powerIndex]),
                        ABILITY: card[abilityIndex],
                        ABILITY_TYPE: AbilityType.Nil,
                        ACTIVATION: Activation.Nil,
                        CONDITION: Condition.Nil,
                        AWARD_TYPE: AwardType.Nil,
                        YOUR_BONUS: 0,
                        THEIR_BONUS: 0,
                        COMBO_TYPE: ComboType.Nil,
                        COMBO_VALUE: None,
                    }
                except ValueError:
                    print(cardName, "failed to parse Energy cost and Power", file=sys.stderr)
                    continue
                self.calculateRarity(cardName, card[rarityIndex], card[typeIndex])
                self.parseAbility(self.cards[cardName])
                if category not in self.categoryLists:
                    self.categoryLists[category] = []
                if subcategory not in self.subcategoryLists:
                    self.subcategoryLists[subcategory] = []
                self.categoryLists[category].append(cardName)
                self.subcategoryLists[subcategory].append(cardName)

            for cardName in self.cards:
                card = self.cards[cardName]
                card[COMBO_TYPE], card[COMBO_VALUE] = ComboType.parse(card, self.categoryLists.keys(), self.subcategoryLists.keys(), self.cards.keys())
        
        calculateMeta(self.cards)
        # calculateCombos
        return

    def calculateRarity(self, cardName, rarity, cardType):
        rarityValue = 0
        if(rarity in Rarities):
            rarityValue = Rarities[rarity]
        else:
            print(cardName, "'s Rarity was unrecognized. Rarity: ", rarity, file=sys.stderr)
            self.cards[cardName][RARITY] = 0
            return
        
        if(cardType in RarityModifiers):
            rarityValue *= RarityModifiers[cardType]
        else:
            print(cardName, "'s Type was unrecognized. Type: ", cardType, file=sys.stderr)

        self.cards[cardName][RARITY] = rarityValue
        return

#Ability Type	Activation	When Awarded	Your Bonus	Their Bonus	Combo Type	Combo Value	Description
    def parseAbility(self, card):
        ability = card[ABILITY]
        if(ability==""):
            return

        # Trim ability to just be the words after the colon, and make all lower case for simplified parsing
        searchIndex = ability.find(" - ")
        if(searchIndex != -1): ability = ability[searchIndex+3:]
        else: print(card[CARD_NAME], " failed to remove ability name (NonFatal)", file=sys.stderr)
        card[ABILITY] = ability
        ability = ability.lower()

        # Parse Meta Ability Headers
        #TODO: add error checking for when one of these return Nil
        card[ABILITY_TYPE] = AbilityType.parse(ability)
        if card[ABILITY_TYPE] == AbilityType.Nil:
            if not self.specialCase(card):
                print(card[CARD_NAME], " failed to parse Ability Type", file=sys.stderr)
            return
        card[ACTIVATION] = Activation.parse(ability)
        if card[ACTIVATION] == Activation.Nil:
            if not self.specialCase(card):
                print(card[CARD_NAME], " failed to parse Activation", file=sys.stderr)
            return
        card[CONDITION] = Condition.parse(ability)
        card[AWARD_TYPE] = AwardType.parse(ability, card[ACTIVATION])
        if card[AWARD_TYPE] == Activation.Nil:
            print(card[CARD_NAME], " failed to parse Award Type", file=sys.stderr)
            return

        self.parseBonuses(card)
        return

    def parseBonuses(self, card):
        ability = card[ABILITY].lower()

        bonus = None
        for word in ability.split():
            try:
                bonus = int(word)
                break #TODO Check for input with two bonus values
            except ValueError:
                continue
        
        if bonus is None:
            if ability.find("double") != -1:
                bonus = card[POWER]
            elif ability.find("triple") != -1:
                bonus = card[POWER] * 2
            else:
                print(card[CARD_NAME], "failed to parse bonus value", file=sys.stderr)
                return
        
        if card[ABILITY_TYPE] == AbilityType.Steal:
            card[YOUR_BONUS] = bonus
            card[THEIR_BONUS] = -bonus
            return
        elif card[ABILITY_TYPE] == AbilityType.CardCost:
            if ability.find(" less") != -1:
                bonus = -bonus
            if ability.find(" reduc") != -1:
                bonus = -bonus
        bonuses = namedtuple("bonuses", ["phrase","yours","theirs"])
        phrases = [
            bonuses("you and your opponent", bonus, bonus),
            bonuses("both players", bonus, bonus),
            bonuses("opponent", 0, bonus),
            bonuses("your cards", bonus, 0),
            bonuses("all cards remaining in your hand", bonus, 0),
            bonuses("all", bonus, bonus),
        ]

        for phrase in phrases:
            if ability.find(phrase.phrase) != -1:
                card[YOUR_BONUS] = phrase.yours
                card[THEIR_BONUS] = phrase.theirs
                return

        card[YOUR_BONUS] = bonus
        card[THEIR_BONUS] = 0
        return

    def specialCase(self, card):
        if card[CARD_NAME] == "Mary Celeste":
            card[ACTIVATION] = Activation.Played
            card[CONDITION] = Condition.LosingRound
            card[AWARD_TYPE] = AwardType.ThisTurn
            card[YOUR_BONUS] = -70
            card[THEIR_BONUS] = 0
            card[COMBO_TYPE] = ComboType.Nil
            card[COMBO_VALUE] = None
            return True
        elif card[CARD_NAME] == "Paper":
            card[ACTIVATION] = Activation.Nil
            card[CONDITION] = Condition.Nil
            card[AWARD_TYPE] = AwardType.Nil
            card[YOUR_BONUS] = 0
            card[THEIR_BONUS] = 0
            card[COMBO_TYPE] = ComboType.Nil
            card[COMBO_VALUE] = None
            return True
        return False

    def printCards(self):
        print(
            CATEGORY,
            SUBCATEGORY,
            CARD_NAME,
            ENERGY_COST,
            POWER,
            ABILITY_TYPE,
            ACTIVATION,
            CONDITION,
            AWARD_TYPE,
            YOUR_BONUS,
            THEIR_BONUS,
            COMBO_TYPE,
            COMBO_VALUE,
            ABILITY,
            
            BONUS_POWER,
            BONUS_ENERGY,
            THEIR_BONUS_POWER,
            THEIR_BONUS_ENERGY,
            PREDICTED_ENERGY,
            PREDICTED_POWER,
            BASE_EFFICIENCY,
            PREDICTED_EFFICIENCY,
            DIFFICULTY, sep='\t'
        )
        for card in self.cards.values():
            print(
                card[CATEGORY],
                card[SUBCATEGORY],
                card[CARD_NAME],
                card[ENERGY_COST],
                card[POWER],
                card[ABILITY_TYPE],
                card[ACTIVATION],
                card[CONDITION],
                card[AWARD_TYPE],
                card[YOUR_BONUS],
                card[THEIR_BONUS],
                card[COMBO_TYPE],
                card[COMBO_VALUE],
                card[ABILITY],
                
                card[BONUS_POWER],
                card[BONUS_ENERGY],
                card[THEIR_BONUS_POWER],
                card[THEIR_BONUS_ENERGY],
                card[PREDICTED_ENERGY],
                card[PREDICTED_POWER],
                card[BASE_EFFICIENCY],
                card[PREDICTED_EFFICIENCY],
                card[DIFFICULTY], sep='\t'
            )
        return

#TODO Special Cases
# Specific cards that give a bonus even when in the deck
# Cards that give bonuses to Apollo 11 or other cards that have a number in their name


#TODO Fixes to cards once I have edit access
# change ability name delimiter from : to -
#  Flamingos
#  Mount Olympus

# mispelling Limitied Card -> Limited Card
#  Snow Leopard
#  Lion
#  Leopard

# add power
#  Diamond Tetra

# add description
#  Golden Gate Bridge

# In Ancient Greece Apollo 11 should be Apollo
# Oceans category should be Oceans and Seas

# Category and Subcategory corrections
#  Bottlenose Dolphin - Ability capitalisation and spelling
#  Blue Poison Dart Frog - correct spelling

# Many power and energy fixes required

#TODO Add Tests for edge cases/problem types
#TODO Vet spelling and correct bad upstream data
#TODO Parameterize all bonus calculations (no magic numbers)
#TODO Fix Predicted Power Calculations that are negative for both players
#TODO Update energy efficiency calculations to net skyrocket through the roof so fast 