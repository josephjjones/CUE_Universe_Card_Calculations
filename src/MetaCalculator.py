from src.Constants import *

def calculateMeta(cards):
    if cards is None:
        return
    for cardName in cards:
        _calculateCardMeta(cards[cardName])
    return
    
def _calculateCardMeta(card):
    card[BONUS_POWER] = 0
    card[BONUS_ENERGY] = 0
    card[THEIR_BONUS_POWER] = 0
    card[THEIR_BONUS_ENERGY] = 0
    card[DIFFICULTY] = _getCardDifficulty(card)

    if card[ABILITY_TYPE] == AbilityType.Power:
            card[BONUS_POWER], card[THEIR_BONUS_POWER] = _getMaxBonusPower(card)
    elif card[ABILITY_TYPE] == AbilityType.Energy or card[ABILITY_TYPE] == AbilityType.Steal:
            card[BONUS_ENERGY], card[THEIR_BONUS_ENERGY] = _getMaxBonusEnergy(card)
    elif card[ABILITY_TYPE] == AbilityType.CardCost:
        card[BONUS_ENERGY], card[THEIR_BONUS_ENERGY] = _getMaxReducedCost(card)
    card[PREDICTED_ENERGY] = card[ENERGY_COST] - card[BONUS_ENERGY]
    card[PREDICTED_POWER] = card[POWER] + card[BONUS_POWER] - card[THEIR_BONUS_POWER]
    card[BASE_EFFICIENCY], card[PREDICTED_EFFICIENCY] = _getEfficiency(
        card[ENERGY_COST], card[BONUS_ENERGY], card[POWER],
        card[BONUS_POWER], card[THEIR_BONUS_ENERGY], card[THEIR_BONUS_POWER],
        card[DIFFICULTY]
    )

    return

def _getCardDifficulty(card):
    if (card[ABILITY_TYPE] == AbilityType.Nil):
        return 0
    difficulty = 0
    if card[ACTIVATION] == Activation.PlayedWith: # rest always happen
            difficulty += 1 #always happens no difficulty
    
    if card[ACTIVATION] == Activation.AfterTurn and card[CONDITION] == Condition.LosingRound:
        difficulty += 3
    elif card[ACTIVATION] == Activation.Drawn and card[CONDITION] in [Condition.WinningRound, Condition.LosingRound, Condition.TyingRound]:
        difficulty += 3 #too random to predict easily
    elif card[CONDITION] in [Condition.WinningRound, Condition.LosingRound]:
        difficulty += 1
    elif card[CONDITION] in [Condition.WinTurn, Condition.LoseTurn]:
        difficulty += 2
    elif card[CONDITION] in [Condition.TieTurn, Condition.TyingRound]:
        difficulty += 10 #Nearly impossible to predict
    elif card[CONDITION] == Condition.MatchingArena:
        difficulty += 4

    if card[COMBO_TYPE] in [ComboType.All, ComboType.Nil, ComboType.ThisCard]:
        difficulty += 0 #Every Time
    elif card[COMBO_TYPE] == ComboType.Category:
        difficulty += 1
    elif card[COMBO_TYPE] == ComboType.Subcategory:
        difficulty += 3
    elif card[COMBO_TYPE] == ComboType.SpecificCard:
        difficulty += 2

    return difficulty

class Target(Enum):
    Nil = auto()
    Both = auto()
    You = auto()
    Oppenent = auto()

    @staticmethod
    def get(card):
        if card[YOUR_BONUS] != 0:
            if card[THEIR_BONUS] != 0:
                return Target.Both
            else:
                return Target.You
        elif card[THEIR_BONUS] != 0:
            return Target.Oppenent
        return Target.Nil

def _getMaxBonusPower(card):
    your_multiplier = 0
    their_multiplier = 0
    
    if card[COMBO_TYPE] == ComboType.Nil:
        if card[AWARD_TYPE] in [AwardType.ThisTurn, AwardType.NextTurn]:
            your_multiplier += 1
            their_multiplier += 1
        elif card[AWARD_TYPE] in [AwardType.ThisAndNextTurn, AwardType.PerTurnRound]:
            your_multiplier += 2
            their_multiplier += 2
        elif card[AWARD_TYPE] == AwardType.PerTurnGame:
            your_multiplier += 5
            their_multiplier += 5
        else: # UntilPlayed, Game, and Round should only be used for card bonuses
            return card[YOUR_BONUS], card[THEIR_BONUS]
        if card[ACTIVATION] == Activation.InHand:
            your_multiplier *= 3 # Special Case Activation, this could be higher but would be limiting your flow probs
            their_multiplier *= 3
    elif card[COMBO_TYPE] == ComboType.All: # The remaining cases are card bonus types
        if card[ACTIVATION] == Activation.PlayedWith:
            your_multiplier += 2
            their_multiplier += 2

        elif card[AWARD_TYPE] in [AwardType.ThisTurn, AwardType.NextTurn]:
            your_multiplier += 3
            their_multiplier += 3
        elif card[AWARD_TYPE] in [AwardType.UntilPlayed, AwardType.Round, AwardType.ThisAndNextTurn]:
            your_multiplier += 5
            their_multiplier += 5
            if card[ACTIVATION] == Activation.AfterTurn:
                #After turn conditions assume you played at least 2 cards this turn
                your_multiplier -= 2
                their_multiplier -= 3 # They are unlikely to try and play cards that have a negative bonus
        elif card[AWARD_TYPE] == AwardType.Game:
            your_multiplier += 10
            their_multiplier += 10
            if card[ACTIVATION] == Activation.AfterTurn:
                your_multiplier -= 4
                their_multiplier -= 6
        else: # PerTurnRound and PerTurnGame not used for card bonuses
            # TODO print error
            return card[YOUR_BONUS], card[THEIR_BONUS]

        if card[ACTIVATION] == Activation.InHand:
            your_multiplier *= 2 #Activates twice probably
            their_multiplier *= 2

    elif card[COMBO_TYPE] == ComboType.Category:
        if card[ACTIVATION] == Activation.PlayedWith:
            your_multiplier += 2 #exeptions to behavior
        elif card[AWARD_TYPE] == AwardType.ThisTurn:
            if card[ACTIVATION] == Activation.AfterTurn: return card[YOUR_BONUS], card[THEIR_BONUS]
            your_multiplier += 3
            their_multiplier += 2
            if card[CATEGORY] != card[COMBO_VALUE]: your_multiplier -= 1
        elif card[AWARD_TYPE] == AwardType.NextTurn:
            your_multiplier += 3
            their_multiplier += 1
        elif card[AWARD_TYPE] in [AwardType.UntilPlayed, AwardType.Round, AwardType.ThisAndNextTurn]:
            your_multiplier += 4
            their_multiplier += 2
            if card[ACTIVATION] == Activation.AfterTurn: your_multiplier -= 2 #After turn conditions assume you played at least 2 cards this turn
            elif card[CATEGORY] != card[COMBO_VALUE]: your_multiplier -= 1
        elif card[AWARD_TYPE] == AwardType.Game:
            your_multiplier += 8
            their_multiplier += 4
            if card[ACTIVATION] == Activation.AfterTurn: your_multiplier -= 4 #After turn conditions assume you played at least 2 cards this turn
            elif card[CATEGORY] != card[COMBO_VALUE]: your_multiplier -= 2
        else: # PerTurnRound and PerTurnGame are not valid card bonuses
            return card[YOUR_BONUS], card[THEIR_BONUS]

        if card[ACTIVATION] == Activation.InHand:
            your_multiplier *= 2
            their_multiplier *= 2 # Special Case Activation, this could be higher but would be limiting your flow probs

    elif card[COMBO_TYPE] == ComboType.Subcategory:
        if card[ACTIVATION] == Activation.PlayedWith: your_multiplier += 2 #exceptions to behavior
        elif card[AWARD_TYPE] == AwardType.ThisTurn:
            if card[ACTIVATION] == Activation.AfterTurn: return card[YOUR_BONUS], card[THEIR_BONUS]
            your_multiplier += 3
            their_multiplier += 1 #It is hard to guess subcategory that they will play
            if card[SUBCATEGORY] != card[COMBO_VALUE]: your_multiplier -= 1
        elif card[AWARD_TYPE] == AwardType.NextTurn:
            your_multiplier += 2 #It is hard to only play two cards and have 3 of a single subcategory in your hand
            their_multiplier += 1
        elif card[AWARD_TYPE] in [AwardType.UntilPlayed, AwardType.Round, AwardType.ThisAndNextTurn]:
            your_multiplier += 3 # Could be 5 but that is unrealistic
            their_multiplier += 1
            if card[ACTIVATION] == Activation.AfterTurn: your_multiplier -= 1 #After turn conditions assume you played at least 2 cards this turn
            elif card[SUBCATEGORY] != card[COMBO_VALUE]: your_multiplier -= 1
        elif card[AWARD_TYPE] == AwardType.Game:
            your_multiplier += 8 # Could be 10 but that mean your whole hand was a single subcategory
            their_multiplier *= 2
            if card[ACTIVATION] == Activation.AfterTurn: your_multiplier -= 4 #After turn conditions assume you played at least 2 cards this turn
            elif card[SUBCATEGORY] != card[COMBO_VALUE]: your_multiplier -= 2
        else: # PerTurnRound and PerTurnGame are not valid card bonuses
            return card[YOUR_BONUS], card[THEIR_BONUS]

        if card[ACTIVATION] == Activation.InHand:
            your_multiplier += 1
            their_multiplier += 1 # Special Case Activation, this could be higher but would be limiting your flow probs

    elif card[COMBO_TYPE] in [ComboType.SpecificCard, ComboType.ThisCard]:
        if card[AWARD_TYPE] in [AwardType.ThisTurn, AwardType.NextTurn, AwardType.UntilPlayed, AwardType.Round, AwardType.ThisAndNextTurn]:
            your_multiplier += 1
            their_multiplier += 0
        elif card[AWARD_TYPE] == AwardType.Game:
            your_multiplier += 2
            their_multiplier += 0
        else: # PerTurnRound and PerTurnGame are not valid card bonuses
            return card[YOUR_BONUS], card[THEIR_BONUS]
    else:
        return card[YOUR_BONUS], card[THEIR_BONUS]

    if card[CONDITION] == Condition.MatchingArena:
        your_multiplier *= 0.5 # only 50% because you can get the bonus at most once per game
        their_multiplier *= 0.5

    return card[YOUR_BONUS]*your_multiplier, card[THEIR_BONUS]*their_multiplier

def _getMaxBonusEnergy(card):
    your_multiplier = 0
    their_multiplier = 0

    if card[COMBO_TYPE] == ComboType.Nil: 
        if card[AWARD_TYPE] in [AwardType.ThisTurn, AwardType.NextTurn]:
            your_multiplier += 1
            their_multiplier += 1
        elif card[AWARD_TYPE] in [AwardType.ThisAndNextTurn, AwardType.PerTurnRound]:
            your_multiplier += 2
            their_multiplier += 2
        elif card[AWARD_TYPE] == AwardType.PerTurnGame:
            your_multiplier += 5
            their_multiplier += 5
        else:
            return card[YOUR_BONUS], card[THEIR_BONUS]

        if card[ACTIVATION] == Activation.InHand:
            your_multiplier *= 3 # Special Case Activation, this could be higher but would be limiting your flow probs
            their_multiplier *= 3

    else:
        return card[YOUR_BONUS], card[THEIR_BONUS]

    return card[YOUR_BONUS]*your_multiplier, card[THEIR_BONUS]*their_multiplier

def _getMaxReducedCost(card):
    your_bonus, their_bonus = _getMaxBonusPower(card)

    your_bonus = -your_bonus
    their_bonus = -their_bonus
    return your_bonus, their_bonus

def _getEfficiency(energy, energy_bonus, power, power_bonus, their_energy_bonus=0, their_power_bonus=0, difficulty=1):
    self_power_per_energy = 10 #VAR
    their_power_per_energy = 10 #VAR
    efficiency_base = (power / energy) if (energy > 0) else (power + (-energy * self_power_per_energy))
    efficiency_predicted = (
        (power + power_bonus - their_power_bonus - (their_energy_bonus * their_power_per_energy)) / (energy - energy_bonus) if
        ((energy - energy_bonus) > 0) else
        ((power + power_bonus - their_power_bonus) + (-(energy - energy_bonus) * self_power_per_energy) - (their_energy_bonus * their_power_per_energy))
    )

    if difficulty == 0:
        efficiency_base = efficiency_predicted
    elif efficiency_base > efficiency_predicted:
        temp = efficiency_base
        efficiency_base = efficiency_predicted
        efficiency_predicted = temp

    return efficiency_base, efficiency_predicted