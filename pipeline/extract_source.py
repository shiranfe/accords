"""Extract a seed song's negina source from its TypeScript data file.

The app keeps seed songs as template literals in src/data/*.ts; the pipeline
needs them as plain .txt. Keeping this a script (not a manual copy) guarantees
the chord sequence the pipeline validates is byte-identical to the one the app
renders — the editor's review mode requires the two to line up 1:1.

Usage:
    python extract_source.py --ts ../src/data/samiVeSumo.ts --const samiVeSumoSource --out cache/src-seed-sami-ve-sumo.txt
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ts", required=True, help="TypeScript data file")
    parser.add_argument("--const", required=True, dest="const_name", help="Exported const holding the source")
    parser.add_argument("--out", required=True, help="Output .txt path")
    args = parser.parse_args()

    text = Path(args.ts).read_text(encoding="utf-8")
    pattern = re.escape(args.const_name) + r"\s*=\s*`(.*?)`\s*;"
    match = re.search(pattern, text, re.S)
    if not match:
        print(f"const {args.const_name} not found in {args.ts}", file=sys.stderr)
        return 1

    body = match.group(1)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(body, encoding="utf-8")

    chords = sum(
        len(line.strip()[1:].split())
        for line in body.splitlines()
        if line.strip().startswith(":")
    )
    sections = len(re.findall(r"^%.+%$", body, re.M))
    print(f"{chords} chords, {sections} sections -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
