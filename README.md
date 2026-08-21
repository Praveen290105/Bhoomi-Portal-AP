# MeeBhoomi ROR-1B Automation

Automates retrieval of the **ROR-1B** land record from the Andhra
Pradesh MeeBhoomi portal ([meebhoomi.ap.gov.in](https://meebhoomi.ap.gov.in/)),
using [Playwright](https://playwright.dev/) to drive a real browser through
the portal's actual flow: login → District/Mandal/Village selection →
ROR-1B → Khata/Pattadar selection → captcha → submit → save as PDF.

**Author:** [Praveen](https://github.com/Praveen290105)

## What it does

1. Opens the MeeBhoomi homepage in a real, visible browser
2. You type your mobile number into the terminal; the script fills it in
   and clicks **Get OTP**
3. You complete the OTP and the login-screen captcha **in the browser**
   (the script waits for you)
4. The script navigates to the ROR-1B form and lists the available
   **Districts** in the terminal — you type the value/name you want
5. Same for **Mandal** and **Village**, each populated dynamically based
   on your previous selection (true cascading dropdowns — Mandal only
   loads its real options once a District is chosen, same for Village)
6. Script selects **ROR-1B**, opens the Khata section, and lists the
   available **Pattadars (owners)** registered under that village — you
   pick one, by ID, list index, or name
7. You solve the on-page arithmetic captcha and press Enter in the
   terminal
8. Script submits the form and saves the resulting report as a PDF into
   `downloads/`, handling three different ways the portal can return the
   report (a real file download, a new tab, or an inline/embedded PDF)
9. Asks if you want to fetch another document in the same logged-in
   session, so you're not forced to redo OTP login for every document

## Setup

```bash
npm install
npm run install-browsers   # downloads the Chromium build Playwright needs
```

## Running

```bash
npm start
```

Follow the terminal prompts. Whenever the script asks you to act **in the
browser window** (OTP, login captcha, form captcha), switch to it, do
that one step, then return to the terminal to continue.

Downloaded/saved PDFs land in `downloads/`.

## Example session

```
Opening MeeBhoomi website...
Enter Mobile Number: 9xxxxxxxxx
========================================
Complete the following manually:
1. Enter OTP
2. Enter CAPTCHA
3. Click VERIFY OTP
========================================
After successful login press ENTER here...

========== DISTRICTS ==========
┌─────────┬────────┬───────────────────────┐
│ (index) │ value  │ text                  │
├─────────┼────────┼───────────────────────┤
│    0    │  '22'  │ 'Palnadu - పల్నాడు'    │
...
Enter the District value (e.g. 22 for PALNADU): 22

========== MANDALS ==========
...
Enter the Mandal value (e.g. 3 for PIDUGURALLA): 3

========== VILLAGES ==========
...
Enter the Village value (e.g. 2203009 for JULAKALLU): 2203009

========== PATTADARS ==========
0 | value = "..." | text = "NAME (998)"
...
Enter the Pattadar ID shown in parentheses (e.g. 998 from 'Name (998)'), or type the name exactly: 998

Enter the CAPTCHA shown in the browser.
After entering CAPTCHA, press ENTER here...

Submitting request...
✅ Report downloaded successfully to: downloads/ROR1B_....pdf

📋 Do you want to get another ROR-1B document? (yes/no): no
👋 Closing session...
```

## Project structure

```
index.js        # the full automation
downloads/       # saved ROR-1B PDFs land here (created automatically)
docs/
  APPROACH.md    # approach, challenges, assumptions, limitations
```

## Known limitations

See [docs/APPROACH.md](docs/APPROACH.md) for the full discussion. In short:
- OTP login and both captchas on the site require a human at the
  keyboard, by design
- District/Mandal/Village/Pattadar are selected by typing a value from a
  printed list each run, rather than pre-configured
- Built and verified against the portal's structure as of August 2026;
  like any government portal, its markup can change without notice
