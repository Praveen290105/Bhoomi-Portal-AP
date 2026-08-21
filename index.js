const { chromium } = require("playwright");
const prompt = require("prompt-sync")();
const path = require("path");
const fs = require("fs");
(async () => {
    const browser = await chromium.launch({
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
        const mobile = prompt("Enter Mobile Number: ");
        await page.getByRole("textbox", {
            name: "Mobile number"
        }).fill(mobile);
        await page.getByRole("button", {
            name: "Get OTP"
        }).click();
        console.log("\n========================================");
        console.log("Complete the following manually:");
        console.log("1. Enter OTP");
        console.log("2. Enter CAPTCHA");
        console.log("3. Click VERIFY OTP");
        console.log("========================================");
        prompt("\nAfter successful login press ENTER here...");
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(2000);
        
        let continueSession = true;
        let documentCount = 0;
        
        while (continueSession) {
            documentCount++;
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
            const districtInput = prompt("\nEnter the District value (e.g. 22 for PALNADU): ");
            const selectedDistrict = districts.find(d => d.value === districtInput || d.text.toLowerCase().includes(districtInput.toLowerCase()));
            if (!selectedDistrict) {
                throw new Error(`District not found for input: "${districtInput}"`);
            }
            console.log(`\nSelecting District: "${selectedDistrict.text}"...\n`);
            await page.locator("#dl_district").selectOption(selectedDistrict.value);
            await page.waitForFunction(() => {
                const ddl = document.querySelector("#dl_mandal");
                return ddl && ddl.options.length > 1;
            });
            const mandals = await page.locator("#dl_mandal option").evaluateAll(options =>
                options.map(option => ({
                    value: option.value,
                    text: option.textContent.trim()
                }))
            );

            console.log("\n========== MANDALS ==========");
            console.table(mandals);
            const mandalInput = prompt("\nEnter the Mandal value (e.g. 3 for PIDUGURALLA): ");
            const selectedMandal = mandals.find(m => m.value === mandalInput || m.text.toLowerCase().includes(mandalInput.toLowerCase()));
            if (!selectedMandal) {
                throw new Error(`Mandal not found for input: "${mandalInput}"`);
            }
            console.log(`\nSelecting Mandal: "${selectedMandal.text}"...\n`);
            await page.locator("#dl_mandal").selectOption(selectedMandal.value);
            await page.waitForFunction(() => {
                const ddl = document.querySelector("#dl_village");
                return ddl && ddl.options.length > 1;
            });
            const villages = await page.locator("#dl_village option").evaluateAll(options =>
                options.map(option => ({
                    value: option.value,
                    text: option.textContent.trim()
                }))
            );
            console.log("\n========== VILLAGES ==========");
            console.table(villages);
            const villageInput = prompt("\nEnter the Village value (e.g. 2203009 for JULAKALLU): ");
            const selectedVillage = villages.find(v => v.value === villageInput || v.text.toLowerCase().includes(villageInput.toLowerCase()));
            if (!selectedVillage) {
                throw new Error(`Village not found for input: "${villageInput}"`);
            }
            console.log(`\nSelecting Village: "${selectedVillage.text}"...`);
            await page.locator("#dl_village").selectOption(selectedVillage.value);
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
            });
            const pattadars = await page.locator("#dl_Pattdar option").evaluateAll(options =>
                options.map(option => ({
                    value: option.value,
                    text: option.textContent.trim()
                }))
            );

            console.log("\n========== PATTADARS ==========");
            pattadars.forEach((p, index) => {
                console.log(`${index} | value = "${p.value}" | text = "${p.text}"`);
            });
            const userInput = prompt(
                "\nEnter the Pattadar ID shown in parentheses (e.g. 998 from 'Name (998)'), " +
                "or type the name exactly: "
            );

            let selectedPattadar = null;
            const trimmedInput = userInput.trim();

            if (/^\d+$/.test(trimmedInput)) {
                selectedPattadar = pattadars.find(p => {
                    const match = p.text.match(/\((\d+)\)\s*$/);
                    return match && match[1] === trimmedInput;
                });
                if (!selectedPattadar && pattadars[Number(trimmedInput)]) {
                    selectedPattadar = pattadars[Number(trimmedInput)];
                }
            } else {
            
                const normalize = (s) => s.replace(/\s+/g, " ").trim();
                const target = normalize(userInput);

                selectedPattadar = pattadars.find(p => normalize(p.text) === target);
                if (!selectedPattadar) {
                    selectedPattadar = pattadars.find(p =>
                        normalize(p.text).toLowerCase().includes(target.toLowerCase())
                    );
                }
            }

            if (!selectedPattadar) {
                throw new Error(
                    `Could not find a matching Pattadar for input: "${userInput}". ` +
                    `Please re-run and enter the exact INDEX number shown in the list.`
                );
            }

            console.log(`\nSelecting Pattadar: "${selectedPattadar.text}" (value=${selectedPattadar.value})`);
            await page.locator("#dl_Pattdar").selectOption({ value: selectedPattadar.value });
            console.log("\nEnter the CAPTCHA shown in the browser.");
            prompt("After entering CAPTCHA, press ENTER here...");

            console.log("\nSubmitting request...");
            const downloadPromise = page.waitForEvent("download", { timeout: 30000 }).catch(() => null);
            const newPagePromise = context.waitForEvent("page", { timeout: 30000 }).catch(() => null);
            try {
                const submitBtn = page.locator("#btn_submit");
                await submitBtn.scrollIntoViewIfNeeded();
                await submitBtn.click({ timeout: 8000 });
            } catch (e) {
                console.log("\nNormal click failed, trying to force-click through any overlay...");
                try {
                    await page.locator("#btn_submit").click({ timeout: 8000, force: true });
                } catch (e2) {
                    console.log("\nCouldn't click the submit button automatically.");
                    console.log("Here are all buttons / clickable inputs currently on the page:\n");

                    const clickables = await page.locator("button, input[type=submit], input[type=button], a.btn, .btn").evaluateAll(
                        els => els.map(el => ({
                            tag: el.tagName,
                            text: (el.innerText || el.value || "").trim(),
                            id: el.id,
                            class: el.className
                        }))
                    );
                    console.table(clickables);

                    console.log("\nPlease click the correct SUBMIT/VIEW button manually in the browser.");
                    prompt("After clicking it, press ENTER here to continue...");
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
               
                console.log("\nNo download or new tab detected — report likely rendered on the same page.");
                await page.waitForLoadState("networkidle").catch(() => {});
                await page.waitForTimeout(2000);

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
            
            // Ask if user wants another document
            const anotherDoc = prompt("\n📋 Do you want to get another ROR-1B document? (yes/no): ").toLowerCase().trim();
            if (anotherDoc === 'yes' || anotherDoc === 'y') {
                continueSession = true;
                console.log("\nNavigating to menu for next document...\n");
            } else {
                continueSession = false;
                console.log("\n👋 Closing session...");
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
