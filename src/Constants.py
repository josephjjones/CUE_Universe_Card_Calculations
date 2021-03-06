import re
from enum import Enum, auto
from collections import namedtuple

Phrase = namedtuple('MappedPhrase', ['phrase','enum'])

# Base Headers
CATEGORY="Album"
SUBCATEGORY="Collection"
CARD_NAME="Name"
RARITY="Rarity"
ENERGY_COST="Energy Cost"
POWER="Power"
CARD_TYPE="Type" #limited card/fusion ingredient
ABILITY="Ability"

# Parsed Headers: Values that are calculated directly from the ABILITY field
ABILITY_TYPE="Ability Type"
ACTIVATION="Activation Time"
CONDITION="Activation Condition"
AWARD_TYPE="When Awarded"
YOUR_BONUS="Your Bonus"
THEIR_BONUS="Their Bonus"
COMBO_TYPE="Combo Type"
COMBO_VALUE="Combo Value"

# Meta Headers: Values calculated based on the parsed headers
BONUS_POWER="Bonus Power"
BONUS_ENERGY="Bonus Energy"
THEIR_BONUS_POWER="Their Bonus Power"
THEIR_BONUS_ENERGY="Their Bonus Energy"
PREDICTED_ENERGY="Predicted Energy"
PREDICTED_POWER="Predicted Power"
BASE_EFFICIENCY="Base Efficiency"
PREDICTED_EFFICIENCY="Predicted Efficiency"
DIFFICULTY="Difficulty"

class AbilityType(Enum):
    Nil = 0
    Energy = auto()
    Power = auto()
    CardCost = auto()
    Steal = auto() #might need its own value depending on other parsing factors

    @staticmethod
    def parse(ability):
        phrases = [
            Phrase("cost", AbilityType.CardCost),
            Phrase("steal", AbilityType.Steal),
            Phrase("power", AbilityType.Power),
            Phrase("energy", AbilityType.Energy),
        ]

        for phrase in phrases:
            if (ability.find(phrase.phrase) != -1):
                return phrase.enum

        return AbilityType.Nil

class Activation(Enum):
    Nil = 0
    Drawn = auto()
    PlayedWith = auto()
    Played = auto()
    AfterTurn = auto()
    InHand = auto()

    @staticmethod
    def parse(ability):
        phrases = [
            Phrase("played with", Activation.PlayedWith),
            Phrase("play this with", Activation.PlayedWith),
            Phrase("play this alongside", Activation.PlayedWith),
            Phrase("play alongside this", Activation.PlayedWith),
            Phrase("returned to your deck", Activation.AfterTurn),
            Phrase("returns to your deck", Activation.AfterTurn),
            Phrase("into your deck", Activation.AfterTurn),
            Phrase("while in your hand", Activation.InHand),
            Phrase("while this card is in your hand", Activation.InHand),
            Phrase("when drawn", Activation.Drawn),
            Phrase("when played", Activation.Played),
            Phrase("played", Activation.Played),
            Phrase("play this", Activation.Played),
            Phrase("drawn", Activation.Drawn),
            Phrase("draw", Activation.Drawn),
        ]

        for phrase in phrases:
            if (ability.find(phrase.phrase) != -1):
                return phrase.enum

        return Activation.Nil

class Condition(Enum):
    Nil = 0
    WinningRound = auto()
    LosingRound = auto()
    TyingRound = auto()

    WinTurn = auto()
    LoseTurn = auto()
    TieTurn = auto()

    FirstTurn = auto()
    MatchingArena = auto()


    @staticmethod
    def parse(ability):
        phrases = [
            Phrase("first turn", Condition.FirstTurn),
            Phrase("matching arena", Condition.MatchingArena),

            Phrase("lose a turn", Condition.LoseTurn),
            Phrase("lose the turn", Condition.LoseTurn),
            Phrase("lose this turn", Condition.LoseTurn),
            Phrase("lost this turn", Condition.LoseTurn),
            Phrase("win a turn", Condition.WinTurn),
            Phrase("win the turn", Condition.WinTurn),
            Phrase("win this turn", Condition.WinTurn),
            Phrase("won this turn", Condition.WinTurn),

            Phrase("winning the round", Condition.WinningRound),
            Phrase("winning this round", Condition.WinningRound),
            Phrase("losing the round", Condition.LosingRound),
            Phrase("losing this round", Condition.LosingRound),
            Phrase("the round is tied", Condition.TyingRound),
        ]

        for phrase in phrases:
            if (ability.find(phrase.phrase) != -1):
                return phrase.enum

        return Condition.Nil



class AwardType(Enum):
    Nil = 0
    ThisTurn = auto()
    NextTurn = auto()
    UntilPlayed = auto()
    PerTurnRound = auto()
    PerTurnGame = auto()
    ThisAndNextTurn = auto()
    Round = auto()
    Game = auto()
    NextTwoTurns = auto()

    @staticmethod
    def parse(ability, activation):
        if activation == Activation.InHand:
            return AwardType.ThisTurn
        phrases = []
        if (ability.find("/turn") != -1 or ability.find("per turn") != -1):
            phrases = [
                Phrase("next two turns", AwardType.NextTwoTurns),
                Phrase("end of the round", AwardType.PerTurnRound),
                Phrase("remainder of this round", AwardType.PerTurnRound),
                Phrase("rest of this round", AwardType.PerTurnRound),
                Phrase("rest of the round", AwardType.PerTurnRound),
                Phrase("game", AwardType.PerTurnGame),
            ]
        else:
            phrases = [
                Phrase("this turn and next turn", AwardType.ThisAndNextTurn),
                Phrase("this turn", AwardType.ThisTurn),
                Phrase("next turn", AwardType.NextTurn),
                Phrase("turn after", AwardType.NextTurn),
                Phrase("until played", AwardType.UntilPlayed),
                Phrase("game", AwardType.Game),
                Phrase("end of the round", AwardType.Round),
                Phrase("remainder of this round", AwardType.Round),
                Phrase("rest of this round", AwardType.Round),
                Phrase("rest of the round", AwardType.Round),
                Phrase(" ", AwardType.ThisTurn), # maybe not best to default to this but shrug
            ]

        for phrase in phrases:
            if (ability.find(phrase.phrase) != -1):
                return phrase.enum

        return AwardType.Nil

class ComboType(Enum):
    Nil = auto()
    All = auto()
    Category = auto()
    Subcategory = auto()
    SpecificCard = auto()
    ThisCard = auto()

    @staticmethod
    def parse(card, categories, subcategories, cards):
        if card[ABILITY_TYPE] in [AbilityType.Energy, AbilityType.Steal]: # This is true for now but could change eg: Play with X to get +3 Energy
            return ComboType.Nil, None
        if card[AWARD_TYPE] in [AwardType.NextTwoTurns, AwardType.Nil, AwardType.PerTurnGame, AwardType.PerTurnRound]:
            return ComboType.Nil, None
        
        ability = card[ABILITY]
        match = re.search(buildGroupRegex(cards), ability)
        if match:
            return ComboType.SpecificCard, match.group(0)
        match = re.search(buildGroupRegex(subcategories), ability)
        if match:
            subcategory = match.group(0)
            if subcategory != 'Energy' or ability.find('Energy cards') != -1:
                return ComboType.Subcategory, subcategory
        match = re.search(buildGroupRegex(categories), ability)
        if match:
            return ComboType.Category, match.group(0)
        ability = ability.lower()
        phrases = [
            Phrase("this card has", ComboType.ThisCard),
            Phrase("all", ComboType.All),
            Phrase("your cards", ComboType.All),
            Phrase("opponent's cards", ComboType.All),
        ]
        for phrase in phrases:
            if (ability.find(phrase.phrase) != -1):
                return phrase.enum, None

        return ComboType.Nil, None

def buildGroupRegex(words):
    return re.compile("\\b("+'|'.join(words)+")\\b")


class Rarity(Enum):
    Common = 1
    Rare = 2
    Epic = 4
    Legendary = 5
    Fusion = 10
    Mythic = 50

Rarities = {
    "Common": Rarity.Common.value,
    "Rare": Rarity.Rare.value,
    "Epic": Rarity.Epic.value,
    "Legendary": Rarity.Legendary.value,
    "Fusion": Rarity.Fusion.value,
    "Mythic": Rarity.Mythic.value,
}

class RarityModifier(Enum):
    Nil = 1
    FusionIngredient = 2
    LimitedCard = 4
    LevelUpReward = 3

RarityModifiers = {
    "": 1,
    "Fusion Ingredient": 2,
    "Limited Card": 4,
    "Limited": 4,
    "Level-Up Reward": 3,
}