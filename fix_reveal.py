"""Fixes Studyspace: sections stay invisible after sign-in.
Run from the project root:  py fix_reveal.py
Safe to run twice."""
from pathlib import Path

path = Path("frontend/src/App.jsx")
src = path.read_text(encoding="utf-8")

# Step 1: undo the mangled edit from the earlier commit (it hit the WRONG effect).
bad = ("  useEffect(() => {\n"
       "  if (!authenticated) return undefined;\n"
       "  const sections = NAV_ITEMS\n"
       "    async function loadWorkspace() {")
good = ("  useEffect(() => {\n"
        "    if (!authenticated) return undefined;\n"
        "    async function loadWorkspace() {")
if bad in src:
    src = src.replace(bad, good)
    print("Repaired the loadWorkspace effect.")

# Step 2: guard the REVEAL effect (the one that uses IntersectionObserver).
start = ("  useEffect(() => {\n"
         "    const sections = NAV_ITEMS\n")
start_fixed = ("  useEffect(() => {\n"
               "    if (!authenticated) return undefined;\n"
               "    const sections = NAV_ITEMS\n")
if start_fixed not in src:
    assert src.count(start) == 1, "Could not find the reveal effect start"
    src = src.replace(start, start_fixed)
    print("Added the authenticated guard to the reveal effect.")

# Step 3: make that effect re-run after sign-in.
end = ('      window.removeEventListener("resize", updateProgress);\n'
       "    };\n"
       "  }, []);")
end_fixed = end.replace("[]", "[authenticated]")
if end_fixed not in src:
    assert src.count(end) == 1, "Could not find the reveal effect end"
    src = src.replace(end, end_fixed)
    print("Changed the reveal effect dependencies to [authenticated].")

path.write_text(src, encoding="utf-8")
print("Done. Now: git add -A; git commit; git push")