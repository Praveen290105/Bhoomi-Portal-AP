    const { chromium } = require("playwright");
    const prompt = require("prompt-sync")();
    const path = require("path");
    const fs = require("fs");
    const Tesseract = require('tesseract.js');
    const sharp = require('sharp');
    const configPath = path.join(__dirname, 'config.json');
    let configList = [];
    if (fs.existsSync(configPath)) {
        const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (Array.isArray(parsed)) {
            configList = parsed;
        } else {
            configList = [parsed];
            console.log("⚠️  config.json is a single object, not a list - treating it as a 1-entry list.");
        }
        console.log(`✓ Config loaded from config.json (${configList.length} job(s))`);
    } else {
        console.log("⚠️ config.json not found - you'll be prompted for every value manually.");
    }
    function findDropdownOption(options, configValue) {
        if (!configValue) return null;
        const target = String(configValue).trim().toLowerCase();

        let match = options.find(o => o.value.trim().toLowerCase() === target);
        if (match) return match;

        match = options.find(o => o.text.trim().toLowerCase() === target);
        if (match) return match;

        match = options.find(o => o.text.toLowerCase().includes(target));
        return match || null;
    }

    /** Fallback used when no config value is set (or nothing matched it): first real, non-placeholder option. */
    function firstValidOption(options) {
        return options.find(o => o.value && o.value !== "-1" && o.value !== "0" && o.text && !o.text.includes("--")) || null;
    }
    function resolveRequiredOption(options, jobValue, label) {
        if (jobValue) {
            const match = findDropdownOption(options, jobValue);
            if (!match) {
                throw new Error(
                    `${label} "${jobValue}" was not found among the available options ` +
                    `(see the table printed just above for what's actually there). Check config.json.`
                );
            }
            return match;
        }
        const fallback = firstValidOption(options);
        if (!fallback) {
            throw new Error(`No valid ${label.toLowerCase()} options found`);
        }
        return fallback;
    }

    (async () => {
        const browser = await chromium.launch({
            channel: "chrome",
            headless: false,
        });
        const context = await browser.newContext({
            acceptDownloads: true
        });
        const page = await context.newPage();
        page.setDefaultTimeout(200000);
        const downloadDir = path.join(__dirname, "downloads");
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }
        async function savePageAsPDF(targetPage, filePath) {
            const client = await targetPage.context().newCDPSession(targetPage);
            const { data } = await client.send("Page.printToPDF", {
                printBackground: true,
                format: "A4"
            });
            fs.writeFileSync(filePath, Buffer.from(data, "base64"));
        }
        try {
            console.log("Opening MeeBhoomi website...");
            await page.goto("https://meebhoomi.ap.gov.in/", {
                waitUntil: "networkidle"
            });
            console.log("\n========================================");
            console.log("Complete the following manually:");
            console.log("1. Enter your mobile number");
            console.log("2. Click Get OTP");
            console.log("3. Enter OTP");
            console.log("4. Enter CAPTCHA");
            console.log("5. Click VERIFY OTP");
            console.log("========================================");
            prompt("\nAfter successful login press ENTER here...");
            await page.waitForLoadState("networkidle").catch(() => {});
            await page.waitForTimeout(2000);
            
            let continueSession = true;
            let documentCount = 0;
            
            while (continueSession) {
                documentCount++;

                const job = configList[documentCount - 1];
                if (!job) {
                    throw new Error(
                        `No entry at index ${documentCount - 1} in config.json ` +
                        `(the list only has ${configList.length} entries). Stopping here.`
                    );
                }

                console.log(`\n${"=".repeat(50)}`);
                console.log(`📄 Document #${documentCount}`);
                console.log(`${"=".repeat(50)}\n`);
                
                const rorMenuLocator = page.getByRole("listitem").filter({ hasText: "మీ 1-బి/గ్రామ 1-బి" });
                
                // Try to click menu (works for both first and subsequent documents)
                try {
                    const isMenuVisible = await rorMenuLocator.first().isVisible().catch(() => false);
                    if (isMenuVisible) {
                        console.log("📍 Clicking ROR-1B menu...");
                        await rorMenuLocator.first().click({ timeout: 10000 });
                    } else if (documentCount === 1) {
                        console.log("\nCouldn't find/click the '1-B' menu item automatically.");
                        console.log("Here are all list items currently visible on the page:\n");

                        const listItems = await page.locator("li").evaluateAll(els =>
                            els
                                .map(el => (el.innerText || "").trim())
                                .filter(t => t.length > 0)
                        );
                        console.log(listItems);
                        console.log("\nIf you see a parent menu that needs to be hovered/clicked first, do that,");
                        console.log("then click on the '1-B' / ROR option manually in the browser.");
                        prompt("After clicking it, press ENTER here to continue...");
                    } else {
                        console.log("📄 Menu not visible, navigating directly to Adangal page...");
                        await page.goto("https://meebhoomi.ap.gov.in/VAdangal/AdangalPage", {
                            waitUntil: "networkidle"
                        });
                    }
                } catch (e) {
                    if (documentCount === 1) {
                        console.log("⚠️  Menu click failed. Here are available list items:");
                        const listItems = await page.locator("li").evaluateAll(els =>
                            els.map(el => (el.innerText || "").trim()).filter(t => t.length > 0)
                        );
                        console.log(listItems);
                        prompt("Please click the ROR-1B menu manually, then press ENTER here...");
                    } else {
                        console.log("📄 Navigating directly to Adangal page...");
                        await page.goto("https://meebhoomi.ap.gov.in/VAdangal/AdangalPage", {
                            waitUntil: "networkidle"
                        });
                    }
                }

                await page.waitForSelector("#dl_district");
                const districts = await page.locator("#dl_district option").evaluateAll(options =>
                    options.map(option => ({
                        value: option.value,
                        text: option.textContent.trim()
                    }))
                );

                console.log("\n========== DISTRICTS ==========");
                console.table(districts);
                // Select district for this job (by code OR name); throws if job.district is set but not found
                let selectedDistrict = resolveRequiredOption(districts, job.district, "District");
                console.log(`✓ Auto-selecting District: "${selectedDistrict.text}"...`);
                await page.locator("#dl_district").selectOption(selectedDistrict.value);
                await page.waitForTimeout(500); // Wait for dropdown change to trigger
                await page.waitForFunction(() => {
                    const ddl = document.querySelector("#dl_mandal");
                    return ddl && ddl.options.length > 1;
                }, { timeout: 10000 });
                console.log(`✓ District selected. Mandals loaded.\n`);
                const mandals = await page.locator("#dl_mandal option").evaluateAll(options =>
                    options.map(option => ({
                        value: option.value,
                        text: option.textContent.trim()
                    }))
                );

                console.log("========== MANDALS ==========");
                console.table(mandals);
                // Select mandal for this job (by code OR name); throws if job.mandal is set but not found
                let selectedMandal = resolveRequiredOption(mandals, job.mandal, "Mandal");
                console.log(`✓ Auto-selecting Mandal: "${selectedMandal.text}"...`);
                await page.locator("#dl_mandal").selectOption(selectedMandal.value);
                await page.waitForTimeout(500); // Wait for dropdown change to trigger
                await page.waitForFunction(() => {
                    const ddl = document.querySelector("#dl_village");
                    return ddl && ddl.options.length > 1;
                }, { timeout: 10000 });
                console.log(`✓ Mandal selected. Villages loaded.\n`);
                const villages = await page.locator("#dl_village option").evaluateAll(options =>
                    options.map(option => ({
                        value: option.value,
                        text: option.textContent.trim()
                    }))
                );
                console.log("========== VILLAGES ==========");
                console.table(villages);
                // Select village for this job (by code OR name); throws if job.village is set but not found
                let selectedVillage = resolveRequiredOption(villages, job.village, "Village");
                console.log(`✓ Auto-selecting Village: "${selectedVillage.text}"...`);
                await page.locator("#dl_village").selectOption(selectedVillage.value);
                await page.waitForTimeout(500); // Wait for dropdown change to trigger
                await page.waitForLoadState("domcontentloaded");
                
                // Only need to click ROR-1B on first document if accessed via menu
                if (documentCount === 1) {
                    const ror1bVisible = await page.getByText("ROR-1B", { exact: true }).isVisible().catch(() => false);
                    if (ror1bVisible) {
                        console.log("\nSelecting ROR-1B...");
                        await page.getByText("ROR-1B", { exact: true }).click();
                    }
                } else {
                    console.log("✓ Already on ROR-1B page");
                }
                
                // Wait for Khata section
                try {
                    await page.locator("#lblkhata").waitFor({ timeout: 5000 });
                    console.log("Selecting Khata...");
                    await page.locator("#lblkhata").click();
                } catch (e) {
                    console.log("✓ Khata already selected");
                }
                
                await page.waitForFunction(() => {
                    const ddl = document.querySelector("#dl_Pattdar");
                    return ddl && ddl.options.length > 1;
                }, { timeout: 10000 });
                console.log(`✓ Village selected. Pattadars loaded.\n`);
                
                const pattadars = await page.locator("#dl_Pattdar option").evaluateAll(options =>
                    options.map(option => ({
                        value: option.value,
                        text: option.textContent.trim()
                    }))
                );

                console.log("========== PATTADARS ==========");
                pattadars.forEach((p, index) => {
                    console.log(`${index} | value = "${p.value}" | text = "${p.text}"`);
                });
                let selectedPattadar = resolveRequiredOption(pattadars, job.pattadar, "Pattadar");

                console.log(`✓ Auto-selecting Pattadar: "${selectedPattadar.text}" (value=${selectedPattadar.value})\n`);
                await page.locator("#dl_Pattdar").selectOption({ value: selectedPattadar.value });
                await page.waitForTimeout(500);
                console.log(`✓ All dropdown selections complete!\n`);
                // ===== CAPTCHA BLOCK =====
                console.log("\n" + "=".repeat(50));
                console.log("Starting CAPTCHA recognition...");
                console.log("=".repeat(50));
                let solved = false;
                for (let attempt = 1; attempt <= 2; attempt++) {
                try { 
                        console.log(`\n🔍 CAPTCHA Attempt ${attempt}...`);
                        console.log("\n🔍 Capturing correct CAPTCHA..."); 
                        const captchaElement = page.locator('#m_imgCaptcha'); 
                        await captchaElement.screenshot({ path: 'captcha.png' }); 
                        await sharp('captcha.png') 
                            .resize(300) 
                            .grayscale() 
                            .normalize() 
                            .sharpen() 
                            .threshold(120) 
                            .toFile('processed.png'); 

                        const { data: { text } } = await Tesseract.recognize('processed.png', 'eng'); 
                        console.log("OCR RAW:", text); 

                        // Extract number (A + A pattern) 
                        const cleaned = text.replace(/[^0-9]/g, ''); 
                        console.log("CLEANED:", cleaned); 

                    if (cleaned.length >= 2) { 
                        const num = parseInt(cleaned.substring(0, 2)); 
                        const answer = num * 2; 

                        console.log("✅ CAPTCHA Solved:", answer); 

                        await page.fill('#txt_Captch', answer.toString()); 
                        solved = true;
                        break;

                    } else { 
                        throw new Error("OCR failed"); 
                    } 

                } catch (err) { 

                    console.log("⚠️ Auto CAPTCHA failed, refreshing..."); 

                    await page.click('#refCaptcha'); // refresh captcha 
                    await page.waitForTimeout(1000);

                    // 👉 ONLY show manual after second failure
                    if (attempt === 2) {
                        console.log("👉 Please enter CAPTCHA manually in browser."); 
                        prompt("After entering CAPTCHA, press ENTER here..."); 
                    }
                }
            }
                console.log("\nSubmitting request...");
                const downloadPromise = page.waitForEvent("download", { timeout: 30000 }).catch(() => null);
                const newPagePromise = context.waitForEvent("page", { timeout: 30000 }).catch(() => null);
                try {
                    const submitBtn = page.locator("#btn_submit");
                    await submitBtn.scrollIntoViewIfNeeded();
                    await submitBtn.click({ timeout: 8000 });
                } catch (e) {
                    console.log("\nNormal click failed:", e.message.split('\n')[0]);
                    console.log("Trying to force-click through any overlay...");
                    try {
                        await page.locator("#btn_submit").click({ timeout: 8000, force: true });
                    } catch (e2) {
                        console.log("\nForce-click also failed:", e2.message.split('\n')[0]);

                        // Last resort: bypass Playwright's actionability checks entirely
                        // and trigger a real DOM click via the page's own JS engine.
                        try {
                            const clicked = await page.evaluate(() => {
                                const btn = document.querySelector('#btn_submit');
                                if (!btn) return false;
                                btn.click();
                                return true;
                            });
                            if (clicked) {
                                console.log("✓ Clicked #btn_submit directly via page.evaluate().");
                            } else {
                                throw new Error("#btn_submit not found in DOM at all");
                            }
                        } catch (e3) {
                            console.log("\nDirect DOM click also failed:", e3.message);
                            console.log("Couldn't click the submit button automatically.");
                            console.log("Here are all buttons / clickable inputs currently on the page:\n");

                            const clickables = await page.locator("button, input[type=submit], input[type=button], a.btn, .btn").evaluateAll(
                                els => els.map(el => ({
                                    tag: el.tagName,
                                    text: (el.innerText || el.value || "").trim(),
                                    id: el.id,
                                    class: el.className,
                                    disabled: el.disabled || false,
                                }))
                            );
                            console.table(clickables);

                            console.log("\nPlease click the correct SUBMIT/VIEW button manually in the browser.");
                            prompt("After clicking it, press ENTER here to continue...");
                        }
                    }
                }

                const [download, newPage] = await Promise.all([downloadPromise, newPagePromise]);

                if (download) {
                    const suggestedName = download.suggestedFilename() || `ROR1B_${Date.now()}.pdf`;
                    const savePath = path.join(downloadDir, suggestedName);
                    await download.saveAs(savePath);
                    console.log(`\n✅ Report downloaded successfully to: ${savePath}`);
                } else if (newPage) {
                    await newPage.waitForLoadState("domcontentloaded");
                    console.log(`\n✅ Report opened in a new tab: ${newPage.url()}`);
                    try {
                        const pdfPath = path.join(downloadDir, `ROR1B_${Date.now()}.pdf`);
                        await savePageAsPDF(newPage, pdfPath);
                        console.log(`✅ Also saved a PDF copy to: ${pdfPath}`);
                    } catch (pdfErr) {
                        console.log("Could not auto-save PDF from the new tab (this is fine if it already downloaded).");
                    }
                } else {
                
                    console.log("\nNo download or new tab detected — checking if the report rendered on the same page...");
                    await page.waitForLoadState("networkidle").catch(() => {});
                    await page.waitForTimeout(2000);
                    const reportVisible = await page
                        .getByText(/ROR ?-? ?1 ?b report/i)
                        .first()
                        .isVisible()
                        .catch(() => false);
                    if (!reportVisible) {
                        console.log("\n⚠️  The report did not actually render - the submission likely failed");
                        console.log("(most often because the captcha answer was wrong, so the portal silently");
                        console.log("rejected it without any error/download/new-tab event).");
                        console.log("\nPlease check the captcha in the browser, correct it if needed, and click");
                        console.log("the submit button (క్లిక్ చేయండి) yourself.");
                        prompt("After the report is visible in the browser, press ENTER here to continue...");

                        const nowVisible = await page
                            .getByText(/ROR ?-? ?1 ?b report/i)
                            .first()
                            .isVisible()
                            .catch(() => false);
                        if (!nowVisible) {
                            throw new Error(
                                "Report still not visible after manual retry - skipping PDF save for this document " +
                                "rather than saving an incorrect snapshot."
                            );
                        }
                    }

                    const pdfFrameUrl = await page.evaluate(() => {
                        const iframe = document.querySelector("iframe[src*='.pdf'], embed[src*='.pdf'], object[data*='.pdf']");
                        return iframe ? (iframe.src || iframe.data) : null;
                    }).catch(() => null);

                    if (pdfFrameUrl) {
                        console.log(`Found embedded PDF at: ${pdfFrameUrl}`);
                        try {
                            const pdfResponse = await context.request.get(pdfFrameUrl);
                            const pdfPath = path.join(downloadDir, `ROR1B_${Date.now()}.pdf`);
                            fs.writeFileSync(pdfPath, await pdfResponse.body());
                            console.log(`✅ Report PDF saved to: ${pdfPath}`);
                        } catch (fetchErr) {
                            console.log("Could not fetch the embedded PDF directly, falling back to page snapshot.");
                            const pdfPath = path.join(downloadDir, `ROR1B_${Date.now()}.pdf`);
                            await savePageAsPDF(page, pdfPath);
                            console.log(`✅ Saved a PDF snapshot of the report page to: ${pdfPath}`);
                        }
                    } else {
                        const pdfPath = path.join(downloadDir, `ROR1B_${Date.now()}.pdf`);
                        await savePageAsPDF(page, pdfPath);
                        console.log(`✅ Saved a PDF snapshot of the report page to: ${pdfPath}`);
                    }
                }
                
                console.log(`\n✅ Document #${documentCount} Complete!`);
                
                // After download, wait for page to settle and redirect
                console.log("\n⏳ Waiting for page to load after download...");
                await page.waitForLoadState("networkidle").catch(() => {});
                await page.waitForTimeout(2000);
                
                // Check if page redirected back to menu page and auto-select ROR-1B
                const ror1bMenuLink = page.getByRole("listitem").filter({ hasText: "మీ 1-బి/గ్రామ 1-బి" });
                const isMenuPageVisible = await ror1bMenuLink.first().isVisible().catch(() => false);
                
                if (isMenuPageVisible) {
                    console.log("📄 Page redirected to menu, auto-selecting ROR-1B...");
                    try {
                        await ror1bMenuLink.first().click({ timeout: 10000 });
                        await page.waitForLoadState("networkidle").catch(() => {});
                        
                        // Auto-click ROR-1B tab if available
                        const ror1bTab = page.getByText("ROR-1B", { exact: true });
                        const isRor1bTabVisible = await ror1bTab.isVisible().catch(() => false);
                        if (isRor1bTabVisible) {
                            console.log("✓ Auto-selecting ROR-1B document...");
                            await ror1bTab.click();
                            await page.waitForLoadState("domcontentloaded");
                        }
                    } catch (e) {
                        console.log("⚠️  Could not auto-select ROR-1B, continuing...");
                    }
                } else {
                    console.log("✓ Already on ROR-1B page, no redirect needed");
                }
                const hasNextJob = documentCount < configList.length;

                if (!hasNextJob) {
                    continueSession = false;
                    console.log("\n✅ Reached the end of config.json - no more entries to process.");
                } else {
                    const anotherDoc = prompt("\n📋 Do you want to get another ROR-1B document? (yes/no): ").toLowerCase().trim();
                    if (anotherDoc === 'yes' || anotherDoc === 'y') {
                        continueSession = true;
                        console.log("\nNavigating to menu for next document...\n");
                    } else {
                        continueSession = false;
                        console.log("\n👋 Closing session...");
                    }
                }
            } 
            console.log(`\n${"=".repeat(50)}`);
            console.log(`📊 Session Complete! Downloaded ${documentCount} document(s)`);
            console.log(`${"=".repeat(50)}\n`);
        } catch (error) {
            console.log("\nError:");
            console.error(error);
        } finally {
            await browser.close();
        }
    })();
