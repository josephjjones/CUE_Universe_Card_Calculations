from src.CardDescriptionParser import CardDescriptionParser as Parser
from contextlib import redirect_stdout
import sys

def EvaluateCards(inputFile, outputFile):
    with open(outputFile, 'w') as f:
        with redirect_stdout(f):
            parser = Parser()
            parser.parseCardFile(inputFile)
            parser.printCards()


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage Error")
    EvaluateCards(sys.argv[1],sys.argv[2])