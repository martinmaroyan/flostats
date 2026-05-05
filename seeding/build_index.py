#!/usr/bin/env python3
"""Transform event-centric ``miaa_<year>.json`` files into person-keyed indexes.

Each output index contains every wrestler who earned criteria-#2 points at the
given year's MA postseason, deduped to their *highest-paying* placement (per
the PDF rule "points are only awarded for the highest tournament placed at").

Output: ``../public/seeding/<year>.json`` for each input file. The web app
fetches these directly as static assets.

Usage:
    python3 build_index.py                # build all miaa_*.json
    python3 build_index.py --year 2026    # build a single year
"""

import argparse
import datetime as dt
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.normpath(os.path.join(HERE, "..", "public", "seeding"))

TYPE_MAP = {
	"sectional": "sectional",
	"divisional_state": "divisionalState",
	"all_state": "allState",
	"new_england": "newEngland",
}


def points_for(type_: str, place: int) -> int:
	if type_ == "sectional":
		if place in (1, 2): return 6
		if place in (3, 4): return 2
		if place == 5: return 1
		return 0
	if type_ == "divisionalState":
		if place in (1, 2): return 16
		if place in (3, 4): return 12
		if place in (5, 6): return 10
		if place == 7: return 8
		return 0
	if type_ == "allState":
		if place in (1, 2): return 25
		if place in (3, 4): return 22
		if place in (5, 6): return 20
		if place == 7: return 18
		return 0
	if type_ == "newEngland":
		if place in (1, 2): return 34
		if 3 <= place <= 6: return 28
		return 0
	return 0


def build_one(source_path: str) -> dict:
	with open(source_path, encoding="utf-8") as f:
		src = json.load(f)

	year = src["year"]
	by_person: dict[str, dict] = {}

	for src_type, events in src.get("tournaments", {}).items():
		typ = TYPE_MAP.get(src_type)
		if typ is None:
			continue
		for ev in events:
			ev_name = ev.get("name", "")
			ev_date = ev.get("date")
			for wc in ev.get("weightClasses", []):
				wc_name = wc.get("name")
				for pl in wc.get("placements", []):
					person_id = pl.get("identityPersonId")
					place = pl.get("placement")
					if not person_id or not place:
						continue
					pts = points_for(typ, place)
					if pts <= 0:
						continue
					placement_entry = {
						"type": typ,
						"tournament": ev_name,
						"date": ev_date,
						"weightClass": wc_name,
						"place": place,
						"points": pts,
					}
					rec = by_person.setdefault(person_id, {
						"fullName": pl.get("fullName"),
						"highestType": typ,
						"highestPoints": pts,
						"placements": [],
					})
					if not rec.get("fullName") and pl.get("fullName"):
						rec["fullName"] = pl["fullName"]
					rec["placements"].append(placement_entry)
					if pts > rec["highestPoints"]:
						rec["highestPoints"] = pts
						rec["highestType"] = typ

	# Sort each person's placements by descending points, then date.
	for rec in by_person.values():
		rec["placements"].sort(key=lambda p: (-p["points"], p.get("date") or ""))

	return {
		"year": year,
		"builtAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
		"source": os.path.basename(source_path),
		"personCount": len(by_person),
		"byPerson": by_person,
	}


def write_index(idx: dict) -> str:
	os.makedirs(OUT_DIR, exist_ok=True)
	out_path = os.path.join(OUT_DIR, f"{idx['year']}.json")
	with open(out_path, "w", encoding="utf-8") as f:
		json.dump(idx, f, separators=(",", ":"), ensure_ascii=False)
	return out_path


def main():
	parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
	parser.add_argument("--year", type=int, help="Build only this year's index")
	args = parser.parse_args()

	if args.year is not None:
		sources = [os.path.join(HERE, f"miaa_{args.year}.json")]
	else:
		sources = sorted(glob.glob(os.path.join(HERE, "miaa_*.json")))

	if not sources:
		print("no source files found", file=sys.stderr)
		sys.exit(1)

	manifest = []
	for src in sources:
		if not os.path.exists(src):
			print(f"missing: {src}", file=sys.stderr)
			continue
		idx = build_one(src)
		out = write_index(idx)
		print(f"{os.path.basename(src)} -> {out}  ({idx['personCount']} people)", file=sys.stderr)
		manifest.append({"year": idx["year"], "personCount": idx["personCount"], "builtAt": idx["builtAt"]})

	# Manifest so the SPA can discover available years without a directory listing.
	manifest.sort(key=lambda m: m["year"])
	with open(os.path.join(OUT_DIR, "manifest.json"), "w", encoding="utf-8") as f:
		json.dump({"indexes": manifest}, f, indent=2)
	print(f"wrote manifest with {len(manifest)} entries", file=sys.stderr)


if __name__ == "__main__":
	main()
