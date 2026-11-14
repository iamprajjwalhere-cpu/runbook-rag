"""Makes every .reveal section visible with a pure-CSS animation, so the page
can never stay blank even if the JavaScript observer fails.
Run from the project root:  py fix_failsafe.py   (safe to run twice)"""
from pathlib import Path

path = Path("frontend/src/App.css")
css = path.read_text(encoding="utf-8")

old = """.reveal {
  opacity: 0;
  transform: translateY(18px);
  transition: opacity var(--motion-slow) cubic-bezier(0.2, 0.7, 0.2, 1), transform var(--motion-slow) cubic-bezier(0.2, 0.7, 0.2, 1);
}

.reveal.is-visible {
  opacity: 1;
  transform: translateY(0);
}
"""
new = """/* Failsafe: the animation always ends fully visible, with or without JavaScript. */
.reveal {
  animation: reveal-in var(--motion-slow) cubic-bezier(0.2, 0.7, 0.2, 1) both;
}

@keyframes reveal-in {
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .reveal { animation: none; }
}
"""
if new in css:
    print("Already applied.")
else:
    assert css.count(old) == 1, "Could not find the .reveal rules - send me lines 155-170 of App.css"
    path.write_text(css.replace(old, new), encoding="utf-8")
    print("Applied the CSS failsafe.")