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
4. **Human-in-the-loop for OTP and login captcha.** The login screen's
  OTP and captcha are completed in the browser. The form-page arithmetic
  captcha uses a best-effort OCR attempt and switches to manual input if
  OCR cannot produce a usable result.
5. **Defensive, multi-path handling of the final report.** The portal
   was observed, across multiple runs, to return the report three
   different ways — as a real file download, in a new browser tab, or
   rendered inline on the same page. The script checks for all three in
   order and, if none apply, falls back to taking its own PDF snapshot
   of the page via Chrome DevTools Protocol (`Page.printToPDF`), so the
   tool doesn't fail just because the portal's exact output mechanism
   varies between sessions.
6. **Configuration-driven batch jobs with session reuse.** `config.json`
  contains the District, Mandal, Village, and Pattadar for each document.
  The script processes those jobs in order and asks before it moves to
  the next job, allowing one OTP-authenticated session to retrieve
  multiple documents.

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
    arithmetic image. The script captures the image, preprocesses it with
    Sharp, and sends it to Tesseract for a best-effort attempt. The current
    logic extracts the first two recognized digits and assumes a repeated
    addend pattern, then enters twice that number. It refreshes the captcha
    and retries once on recognition failure; after the second failure it
    asks the user to enter the captcha manually in the browser. OCR output
    can be inaccurate, so users should verify the browser state if a
    submission is rejected.
- **Cascading dropdowns with no fixed values.** District, Mandal,
  Village, and Pattadar options are only knowable once the previous
  selection has loaded. The script queries live `<option>` elements,
  waits for them to populate (`options.length > 1`), prints them for
  diagnostics, and matches each configured job value by option value,
  exact text, or text inclusion.
- **Inconsistent report delivery.** The final report did not always
  arrive the same way between runs (download vs. new tab vs. inline),
  which is why the capture logic checks multiple paths rather than
  assuming one.

## Assumptions you made

- A human is present and available at the keyboard for login and any
  failed form-captcha OCR attempt; this tool is not built to run
  unattended or on a schedule.
- The person running the tool is retrieving records they are legitimately
  entitled to access — via their own registered mobile number, the same
  access a citizen already has by using the portal manually themselves.
- `config.json` contains an array of jobs. Each job supplies `district`,
  `mandal`, `village`, and `pattadar`; these values are checked against
  live-fetched portal options before selection. A missing value falls back
  to the first non-placeholder option, while a supplied but unmatched
  value stops the run with an error.
- Google Chrome is installed locally. Playwright launches it using the
  `chrome` channel rather than a Playwright-downloaded browser build.

## Limitations and future improvements

- **OTP login and the login captcha require manual action every run.**
  The form captcha is attempted automatically but can still require manual
  entry when OCR fails.
- **Arithmetic-captcha OCR is heuristic.** It recognizes an image after
  resize, grayscale, normalization, sharpening, and thresholding. The
  current parser only supports the repeated-addend pattern it expects; a
  changed captcha format or inaccurate OCR can lead to a rejected form,
  which the script reports and hands back to the user for manual retry.
- **No automated retries/backoff** for transient network failures beyond
  the timeouts already built into individual `waitFor` calls. Only
  form-captcha OCR gets a second attempt after a refresh.
- **No automated test suite.** The live form is both OTP- and
  captcha-gated, which makes conventional CI testing impractical;
  verification has been manual, against the real, live portal.
- **Selectors are tied to the portal's current markup** (element IDs
  like `#dl_district`, `#dl_Pattdar`, `#m_imgCaptcha`, and `#btn_submit`)
  as observed in August 2026. Government portals can change without
  notice, so these may need revisiting if the site is updated.
- If the portal ever exposes a documented/official API or a bulk-export
  facility, that should be preferred over UI automation entirely.
