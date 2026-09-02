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
4. For each entry in `config.json`, the script navigates to the ROR-1B
   form and loads the live **District**, **Mandal**, **Village**, and
   **Pattadar** options through the portal's cascading dropdowns
5. The configured location and Pattadar are matched against those live
   options and selected automatically; the available options are printed
   so a changed portal value is easy to diagnose
6. The form-page CAPTCHA is automated during the ROR-1B request
7. The script submits the form and saves the resulting report as a PDF into
   `downloads/`, handling three different ways the portal can return the
   report (a real file download, a new tab, or an inline/embedded PDF)
8. Asks before starting the next configured job, reusing the logged-in
   session so you're not forced to redo OTP login for every document

## Setup

```bash
npm install
```

The script uses the locally installed Google Chrome browser through
Playwright's `chrome` channel. Install Google Chrome before running it.

Define one or more document jobs in `config.json`:

```json
[
   {
      "district": "PALNADU",
      "mandal": "PIDUGURALLA",
      "village": "JULAKALLU",
      "pattadar": "1983"
   }
]
```

Each value can be the portal option's value, its full displayed text, or a
unique portion of the displayed text. Values are matched against options
loaded from the live portal, not against a hardcoded list.

## Running

```bash
node index.js
```

Follow the terminal prompts. For OTP and the login-screen CAPTCHA, switch to
the browser and complete those steps before returning to the terminal. The
form CAPTCHA is automated during the request.

Downloaded/saved PDFs land in `downloads/`.

## Example session

```
Opening MeeBhoomi website...
Complete the following manually:
Enter Mobile Number: 9xxxxxxxxx
1. Enter OTP
2. Enter CAPTCHA
3. Click VERIFY OTP
========================================
After successful login press ENTER here...

==================================================
Document #1
==================================================

========== DISTRICTS ==========
...live options printed here...
Auto-selecting District: "PALNADU"...

========== MANDALS ==========
...live options printed here...
Auto-selecting Mandal: "PIDUGURALLA"...

========== VILLAGES ==========
...live options printed here...
Auto-selecting Village: "JULAKALLU"...

========== PATTADARS ==========
...live options printed here...
Auto-selecting Pattadar: "... (1983)"...

CAPTCHA: 33+33 =
CAPTCHA answer: 66

Submitting request...
Report downloaded successfully to: downloads/ROR1B_....pdf

Do you want to get another ROR-1B document? (yes/no): yes
```

## Project structure

```
index.js         # the full Playwright automation
config.json      # location and Pattadar selection for each job
downloads/       # saved ROR-1B PDFs land here (created automatically)
Approach.md      # approach, challenges, assumptions, limitations
```

## Known limitations

See [docs/APPROACH.md](docs/APPROACH.md) for the full discussion. In short:
- OTP login and the login-screen captcha require a human at the keyboard
- The form CAPTCHA is automated during the request workflow
- Every `config.json` entry must match a currently available portal option;
   renamed or removed options cause that job to stop with an error
- Built and verified against the portal's structure as of August 2026;
  like any government portal, its markup can change without notice
