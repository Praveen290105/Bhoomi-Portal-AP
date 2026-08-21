# Approach, Challenges, Assumptions, Limitations

## Overall approach

The MeeBhoomi portal exposes no public API, so this is UI automation of
the real click-path a citizen follows on
[meebhoomi.ap.gov.in](https://meebhoomi.ap.gov.in/) to retrieve a ROR-1B
record. The build process was recon-first, not code-first:

1. **Explored the live site by hand before writing any automation.**
   Rather than guessing at form structure from documentation, the flow
   was walked manually end-to-end first — homepage → OTP login →
   post-login menu → the actual ROR-1B form → a real generated report —
   to confirm the exact URLs, form fields, and captcha types involved
   before any selector was written.
2. **Playwright over raw HTTP requests.** The site is a server-rendered
   form with cascading dropdowns (District → Mandal → Village, each
   depending on the previous selection) and session-based login state.
   Driving a real browser handles that reliably; hand-crafting the
   underlying HTTP requests and replicating session/cookie handling
   would be fragile for uncertain benefit.
3. **Dynamic dropdown values, not hardcoded ones.** District, Mandal,
   Village, and the final Pattadar (owner) list are all read live from
   the page's own `<option>` elements and printed to the terminal at
   run time, so the tool works for any district/mandal/village/owner
   combination, not just the one used during testing.
4. **Human-in-the-loop for OTP and both captchas, by design.** See
   "Challenges" below for the reasoning — this was a deliberate
   engineering decision, not something left incomplete.
5. **Defensive, multi-path handling of the final report.** The portal
   was observed, across multiple runs, to return the report three
   different ways — as a real file download, in a new browser tab, or
   rendered inline on the same page. The script checks for all three in
   order and, if none apply, falls back to taking its own PDF snapshot
   of the page via Chrome DevTools Protocol (`Page.printToPDF`), so the
   tool doesn't fail just because the portal's exact output mechanism
   varies between sessions.
6. **Session reuse across multiple documents.** Since OTP login is the
   slowest and most manual part of the flow, the script loops and lets
   the user pull additional ROR-1B documents in the same logged-in
   session instead of repeating the OTP step every single time.

## Challenges you encountered

- **No public API.** Everything is a server-rendered form; the browser
  UI is the only integration point available.
- **The site resists inspection.** Right-click is disabled on form
  elements, and standard DevTools shortcuts were unreliable during
  exploration. This ruled out the usual "right-click → Inspect" way of
  gathering selectors, and selectors had to be found through Playwright's
  own locator tooling and direct trial runs against the live form
  instead.
- **OTP-gated access.** It was confirmed early on (via the portal's own
  embedded chat-assistant script, which documents the intended user
  flow) that ROR-1B retrieval requires logging in with a mobile number
  and SMS OTP. This isn't optional or bypassable without a live phone in
  the loop, so it's treated as a genuine, necessary manual step rather
  than something to route around.
- **Two different captchas, two different judgment calls.**
  - The **login-screen captcha** is distorted alphanumeric text — a
    real anti-bot control specifically guarding the OTP step. This was
    deliberately left for a human to solve rather than attempting
    OCR/auto-solving against it: it's the portal's explicit control on
    that exact step, and defeating it programmatically is a different
    thing entirely from automating navigation around it.
  - The **form-page captcha** (on the ROR-1B form itself) is a simple
    two-number addition problem (e.g. `33+33=`) rendered as a distorted
    image. This is a structurally weaker case — a tiny, fixed character
    set of digits, `+`, and `=` — and an OCR-based solver (image
    preprocessing plus Tesseract) was prototyped and tested against real
    captured samples. It produced correct reads only inconsistently
    (roughly 50-90% confidence depending on preprocessing parameters),
    which wasn't reliable enough to trust unattended. Rather than ship a
    partially-working auto-solver that could silently submit a wrong
    answer, this was also left as a quick manual step — a predictable,
    honest script beats a flaky "automated" one.
- **Cascading dropdowns with no fixed values.** District, Mandal,
  Village, and Pattadar options are only knowable once the previous
  selection has loaded, so the script always queries the live
  `<option>` elements and waits for them to actually populate
  (`options.length > 1`) before proceeding, instead of assuming any
  fixed set of values.
- **Inconsistent report delivery.** The final report did not always
  arrive the same way between runs (download vs. new tab vs. inline),
  which is why the capture logic checks multiple paths rather than
  assuming one.

## Assumptions you made

- A human is present and available at the keyboard for the entire run —
  this tool is not built to run unattended or on a schedule, given the
  OTP and captcha steps.
- The person running the tool is retrieving records they are legitimately
  entitled to access — via their own registered mobile number, the same
  access a citizen already has by using the portal manually themselves.
- District/Mandal/Village/Pattadar are selected per run via terminal
  prompts against live-fetched lists, rather than pre-configured in a
  file — trading a little convenience for always being correct against
  whatever the portal currently offers, since these lists (and their
  underlying values) are not guaranteed stable over time.

## Limitations and future improvements

- **OTP login and both captchas require manual action every run.** This
  is intentional for the login captcha; for the arithmetic captcha, it's
  a practical compromise pending a more reliable OCR pipeline (see
  below).
- **Arithmetic-captcha OCR is not production-ready yet**, but the
  groundwork suggests it's solvable: the prototype (image preprocessing
  with Jimp + Tesseract.js) confirmed the problem is *tractable* — a
  small, fixed character set on a fairly consistent background — but
  would need further work (e.g. per-character segmentation instead of
  whole-line OCR, or a small custom-trained classifier, given how
  constrained the character set is) before it should run unattended.
- **No automated retries/backoff** for transient network failures beyond
  the timeouts already built into individual `waitFor` calls.
- **No automated test suite.** The live form is both OTP- and
  captcha-gated, which makes conventional CI testing impractical;
  verification has been manual, against the real, live portal.
- **Selectors are tied to the portal's current markup** (element IDs
  like `#dl_district`, `#dl_Pattdar`, `#btn_submit`) as observed in
  August 2026. Government portals can change without notice, so these
  may need revisiting if the site is updated.
- If the portal ever exposes a documented/official API or a bulk-export
  facility, that should be preferred over UI automation entirely.
