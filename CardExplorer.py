from src.CardDescriptionParser import CardDescriptionParser as Parser
from contextlib import redirect_stdout
import sys

def ParseCards(inputFile, outputFile):
    with open(outputFile, 'w') as f:
        with redirect_stdout(f):
            parser = Parser()
            parser.parseCardFile(inputFile)
            parser.printCards()


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage Error")
    elif sys.argv[1] == "parse":
        ParseCards(sys.argv[2],sys.argv[3])