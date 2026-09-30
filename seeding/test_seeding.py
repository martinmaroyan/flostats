"""Regression checks for the offline placement tools and published indexes."""
import contextlib
import io
import json
import os
import tempfile
import unittest
from unittest.mock import patch

import build_index
import extract_placements


class SeedingTests(unittest.TestCase):
    def test_published_indexes_match_sources(self):
        manifest_path = os.path.join(build_index.OUT_DIR, "manifest.json")
        with open(manifest_path, encoding="utf-8") as f:
            manifest = json.load(f)
        for entry in manifest["indexes"]:
            year = entry["year"]
            with self.subTest(year=year):
                rebuilt = build_index.build_one(os.path.join(build_index.HERE, f"miaa_{year}.json"))
                with open(os.path.join(build_index.OUT_DIR, f"{year}.json"), encoding="utf-8") as f:
                    published = json.load(f)
                self.assertEqual(rebuilt["byPerson"], published["byPerson"])
                self.assertEqual(entry["personCount"], rebuilt["personCount"])

    def test_single_year_build_preserves_other_manifest_years(self):
        with tempfile.TemporaryDirectory() as directory:
            for year in (2025, 2026):
                with open(os.path.join(directory, f"{year}.json"), "w", encoding="utf-8") as f:
                    json.dump({"year": year, "personCount": 0, "builtAt": "test", "byPerson": {}}, f)
            with patch.object(build_index, "OUT_DIR", directory), patch("sys.argv", ["build_index.py", "--year", "2026"]), contextlib.redirect_stderr(io.StringIO()):
                build_index.main()
            with open(os.path.join(directory, "manifest.json"), encoding="utf-8") as f:
                self.assertEqual([entry["year"] for entry in json.load(f)["indexes"]], [2025, 2026])

    def test_best_placement_keeps_its_weight_class(self):
        wrestler = {"attributes": {"identityPersonId": "athlete", "fullName": "Athlete", "weightClassId": "original"}, "relationships": {"bracketPlacements": {"data": [{"type": "bracketPlacement", "id": "best"}, {"type": "bracketPlacement", "id": "worse"}]}}}
        included = {}
        for name, place in (("best", 1), ("worse", 3)):
            included[("bracketPlacement", name)] = {"attributes": {"placement": place}, "relationships": {"weightClass": {"data": {"type": "weightClass", "id": name}}}}
        with patch.object(extract_placements, "fetch_all_wrestlers", return_value=([wrestler], included)):
            result = extract_placements.event_placements("event")
        self.assertEqual(result[0]["weightClassId"], "best")
        self.assertEqual(result[0]["placements"][0]["placement"], 1)


if __name__ == "__main__":
    unittest.main()
