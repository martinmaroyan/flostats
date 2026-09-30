#!/usr/bin/env python3
"""Extract wrestler placements per weight class for FloWrestling events.

Single-event mode (prints to stdout):
    python3 extract_placements.py <eventId>

Year-batch mode (writes JSON file with all MIAA + New England Interscholastic
tournaments for the given year):
    python3 extract_placements.py --year 2026
    python3 extract_placements.py --year 2026 -o miaa_2026.json
"""

import argparse
import json
import re
import sys
from collections import defaultdict
from urllib.parse import urlencode
from urllib.request import Request, urlopen

WRESTLERS_URL = "https://floarena-api.flowrestling.org/wrestlers/"
EVENTS_URL = "https://arena.flowrestling.org/events/past"
INCLUDE = "bracketPlacements.weightClass"


def http_get_json(url):
	req = Request(url, headers={"Accept": "application/json"})
	with urlopen(req, timeout=60) as resp:
		return json.loads(resp.read().decode("utf-8"))


def fetch_all_wrestlers(event_id):
	"""Paginate JSON:API ``links.next`` until exhausted, collecting data + included."""
	data = []
	included = {}
	url = f"{WRESTLERS_URL}?{urlencode({'eventId': event_id, 'include': INCLUDE})}"
	while url:
		payload = http_get_json(url)
		data.extend(payload.get("data") or [])
		for obj in payload.get("included") or []:
			included[(obj["type"], obj["id"])] = obj
		url = (payload.get("links") or {}).get("next")
	return data, included


def relationship_ids(obj, name):
	rel = ((obj.get("relationships") or {}).get(name) or {}).get("data")
	if rel is None:
		return []
	if isinstance(rel, list):
		return [(r["type"], r["id"]) for r in rel]
	return [(rel["type"], rel["id"])]


def event_placements(event_id):
	"""Return ordered weight classes, each with placements 1..N for an event."""
	wrestlers, included = fetch_all_wrestlers(event_id)
	groups = defaultdict(lambda: {"name": None, "sequence": 0, "rows": []})

	for wrestler in wrestlers:
		attrs = wrestler.get("attributes") or {}
		identity_person_id = attrs.get("identityPersonId")
		full_name = (
			attrs.get("fullName")
			or f"{attrs.get('firstName', '')} {attrs.get('lastName', '')}".strip()
			or "(unknown)"
		)

		bp_refs = relationship_ids(wrestler, "bracketPlacements")
		best = None
		wcid = attrs.get("weightClassId")
		for key in bp_refs:
			bp = included.get(key)
			if not bp:
				continue
			placement = (bp.get("attributes") or {}).get("placement")
			if placement is None:
				continue
			if best is None or placement < best:
				best = placement
				wc_refs = relationship_ids(bp, "weightClass")
				if wc_refs:
					wcid = wc_refs[0][1]

		if best is None or wcid is None:
			continue

		entry = groups[wcid]
		wc = included.get(("weightClass", wcid))
		if wc:
			wc_attrs = wc.get("attributes") or {}
			entry["name"] = wc_attrs.get("name") or wcid
			entry["sequence"] = wc_attrs.get("sequence") or 0
		else:
			entry["name"] = entry["name"] or wcid
		entry["rows"].append({
			"placement": best,
			"fullName": full_name,
			"identityPersonId": identity_person_id,
		})

	weight_classes = []
	for wcid in sorted(groups, key=lambda k: (groups[k]["sequence"], groups[k]["name"] or "")):
		entry = groups[wcid]
		# Dedupe within a weight class by identityPersonId, keeping best (lowest) placement.
		seen = {}
		for row in entry["rows"]:
			key = row["identityPersonId"] or (row["fullName"], row["placement"])
			if key not in seen or row["placement"] < seen[key]["placement"]:
				seen[key] = row
		placements = sorted(seen.values(), key=lambda r: r["placement"])
		weight_classes.append({
			"weightClassId": wcid,
			"name": entry["name"],
			"sequence": entry["sequence"],
			"placements": placements,
		})
	return weight_classes


SECTIONAL_RE = re.compile(r"^\s*20\d{2}\s+MIAA\s+D[123][A-Z](?:/[A-Z])?\b", re.I)
DIV_STATE_RE = re.compile(r"^\s*20\d{2}\s+MIAA\s+D[123](?:\s+(?:Girls|Boys))?\s+State\s+(?:Tournament|Championships?)\b", re.I)
ALL_STATE_RE = re.compile(r"^\s*20\d{2}\s+MIAA\s+(?:Girls\s+)?All[-\s]State(?:\s+/\s+Girls\s+All[-\s]State)?\s+(?:Tournament|Championships?)\b", re.I)
NEW_ENGLAND_RE = re.compile(r"^\s*20\d{2}\s+New\s+England\s+Interscholastic\s+(?:Girls\s+)?Wrestling\s+Championship\b", re.I)


def categorize(name):
	if not name:
		return "other"
	if SECTIONAL_RE.match(name):
		return "sectional"
	if DIV_STATE_RE.match(name):
		return "divisional_state"
	if ALL_STATE_RE.match(name):
		return "all_state"
	if NEW_ENGLAND_RE.match(name):
		return "new_england"
	return "other"


def fetch_year_events(year):
	url = f"{EVENTS_URL}?{urlencode({'year': year, 'eventType': 'tournaments'})}"
	payload = http_get_json(url)
	return payload.get("response") or []


def print_weight_classes(weight_classes):
	if not weight_classes:
		print("No placements found for this event.", file=sys.stderr)
		return
	for wc in weight_classes:
		print(f"\n=== {wc['name']} ===")
		for p in wc["placements"]:
			print(f"  {p['placement']}. {p['fullName']} ({p['identityPersonId']})")


def run_year_batch(year, out_path):
	events = fetch_year_events(year)
	targets = [e for e in events if "MIAA" in e["name"] or "New England Interscholastic" in e["name"]]
	# Order chronologically so each category lists events in date order.
	targets.sort(key=lambda e: e.get("startDate") or "")

	result = {
		"year": year,
		"tournaments": {
			"sectional": [],
			"divisional_state": [],
			"all_state": [],
			"new_england": [],
		},
	}

	for ev in targets:
		cat = categorize(ev["name"])
		if cat == "other":
			print(f"[skip] {ev['name']}", file=sys.stderr)
			continue
		print(f"[{cat}] {ev['name']}", file=sys.stderr)
		try:
			weight_classes = event_placements(ev["guid"])
		except Exception as exc:
			print(f"  failed: {exc}", file=sys.stderr)
			continue
		entry = {
			"eventId": ev["guid"],
			"name": ev["name"],
			"date": (ev.get("startDate") or "")[:10],
			"location": ev.get("locationName"),
			"weightClasses": weight_classes,
		}
		result["tournaments"][cat].append(entry)

	with open(out_path, "w", encoding="utf-8") as f:
		json.dump(result, f, indent=2, ensure_ascii=False)
	print(f"wrote {out_path}", file=sys.stderr)


def main():
	parser = argparse.ArgumentParser(
		description=__doc__,
		formatter_class=argparse.RawDescriptionHelpFormatter,
	)
	parser.add_argument("event_id", nargs="?", help="FloWrestling event UUID (single-event mode)")
	parser.add_argument("--year", type=int, help="Aggregate MIAA + NE Interscholastic for this year")
	parser.add_argument("-o", "--output", help="Output JSON path for --year mode (default: miaa_<year>.json)")
	args = parser.parse_args()

	if args.year is not None:
		out_path = args.output or f"miaa_{args.year}.json"
		run_year_batch(args.year, out_path)
	elif args.event_id:
		print_weight_classes(event_placements(args.event_id))
	else:
		parser.error("provide an event_id or --year YEAR")


if __name__ == "__main__":
	main()
