import glob
import json
import os


data = {}


for work in glob.glob(
    "/Users/daniel/Downloads/shakespeares-works_TXT_FolgerShakespeare/*.txt"
):
    with open(work) as raw_work:
        data[os.path.basename(work)] = raw_work.read()

with open("/Users/daniel/Desktop/complete_shakespeare.json", "w") as out:
    json.dump(data, out)
