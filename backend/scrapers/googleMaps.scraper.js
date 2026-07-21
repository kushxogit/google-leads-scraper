const { chromium } = require('playwright');

async function scrape({ query, niche, area, limit, headless, onLead, onLog }) {
  let browser;
  try {
    onLog(`Starting Google Maps scraper for query: "${query}"`);
    const remoteBrowserEndpoint = process.env.BROWSER_WS_ENDPOINT?.trim();
    let context;

    if (remoteBrowserEndpoint) {
      onLog("Connecting to the managed Chromium browser...");
      browser = await chromium.connectOverCDP(remoteBrowserEndpoint);
      context = browser.contexts()[0] || (await browser.newContext());
    } else {
      browser = await chromium.launch({ headless: headless === 1 });
      context = await browser.newContext();
    }

    const page = await context.newPage();

    onLog(`Browser opened. Navigating to Google Maps...`);
    await page.goto('https://www.google.com/maps', { waitUntil: 'domcontentloaded' });

    // Sometimes Google shows a consent dialog in Europe/some regions. Try to click "Accept all" if it exists.
    try {
      const consentButton = await page.waitForSelector('button:has-text("Accept all")', { timeout: 3000 });
      if (consentButton) {
        await consentButton.click();
        onLog('Clicked consent button');
      }
    } catch (e) {
      // Ignore if no consent dialog
    }

    // Wait for the search box. Try a few common selectors for Google Maps search box.
    const searchBoxSelector = 'input#searchboxinput, input[name="q"], input.searchboxinput';
    await page.waitForSelector(searchBoxSelector, { timeout: 15000 });
    await page.fill(searchBoxSelector, query);
    await page.press(searchBoxSelector, 'Enter');

    onLog(`Search submitted. Waiting for results...`);
    
    // Wait for the results feed or an error/no results
    await page.waitForSelector('div[role="feed"]', { timeout: 15000 }).catch(() => null);
    
    const feed = await page.$('div[role="feed"]');
    if (!feed) {
      onLog('No results feed found. Search might have returned no results or layout changed.');
      return;
    }

    onLog('Results found. Starting to extract leads...');
    
    let extractedCount = 0;
    const processedUrls = new Set();
    let scrollAttempts = 0;

    while (extractedCount < limit && scrollAttempts < 20) {
      // Find all listing links currently in the feed
      const links = await page.$$('div[role="feed"] > div > div > a');
      
      let newLeadsFound = false;

      for (const link of links) {
        if (extractedCount >= limit) break;

        const href = await link.getAttribute('href');
        if (!href || processedUrls.has(href)) continue;
        
        processedUrls.add(href);
        newLeadsFound = true;

        try {
          const prevUrl = page.url();
          
          // Scroll the link into view to trigger lazy loading of its details if needed
          await link.scrollIntoViewIfNeeded();
          await page.waitForTimeout(500); // polite delay
          
          // Click to open details in the side panel
          await link.evaluate(el => el.click());
          
          // Wait for the URL to change indicating the new profile is loading
          await page.waitForFunction((url) => document.location.href !== url, prevUrl, { timeout: 5000 }).catch(() => null);
          
          // Wait an extra second for React to swap the DOM elements in the side panel
          await page.waitForTimeout(1000);
          
          // Wait for the title in the details panel to appear
          await page.waitForSelector('h1.DUwDvf', { timeout: 5000 }).catch(() => null);

          // Extract details
          const businessName = await page.$eval('h1.DUwDvf', el => el.innerText).catch(() => '');
          if (!businessName) continue; // Not a valid listing?

          const address = await page.$$eval('button[data-item-id="address"]', els => els.length > 0 ? els[0].innerText : '').catch(() => '');
          let website = await page.$$eval('a[data-item-id="authority"]', els => els.length > 0 ? els[0].getAttribute('href') : 'N/A').catch(() => 'N/A');
          const phone = await page.$$eval('button[data-tooltip="Copy phone number"]', els => els.length > 0 ? els[0].innerText : '').catch(() => '');
          const ratingStr = await page.$$eval('div.F7nice > span > span', els => els.length > 0 ? els[0].innerText : '').catch(() => '');
          const reviewsStr = await page.$$eval('div.F7nice > span:nth-child(2) > span > span', els => els.length > 0 ? els[0].innerText : '').catch(() => '');
          
          let rating = null;
          let reviews = null;
          if (ratingStr) {
            rating = parseFloat(ratingStr.replace(',', '.'));
          }
          if (reviewsStr) {
            reviews = parseInt(reviewsStr.replace(/[^\d]/g, ''), 10);
          }

          if (website && website !== 'N/A') {
             // clean up tracking params or keep as is.
          }

          const lead = {
            businessName,
            niche,
            area,
            phone,
            email: '', // Not easily scrapable from maps directly
            website,
            address,
            rating,
            reviews,
            source: 'Google Maps',
            sourceUrl: href
          };

          onLog(`Found: ${businessName}`);
          await onLead(lead);
          extractedCount++;

        } catch (err) {
          onLog(`Error extracting a lead: ${err.message}`);
        }
      }

      if (!newLeadsFound) {
        // scroll the feed
        onLog('Scrolling for more results...');
        await feed.evaluate(el => el.scrollBy(0, 1000));
        await page.waitForTimeout(2000);
        
        // check if end of list
        const endOfList = await page.$('span:has-text("You\'ve reached the end of the list.")');
        if (endOfList) {
          onLog('Reached the end of the list.');
          break;
        }
        scrollAttempts++;
      } else {
        scrollAttempts = 0; // reset if we found new items
      }
    }

    onLog(`Scraping completed. Extracted ${extractedCount} leads.`);

  } catch (err) {
    onLog(`Scraper failed: ${err.message}`);
    throw err;
  } finally {
    if (browser) {
      await browser.close();
      onLog('Browser closed.');
    }
  }
}

module.exports = { scrape };
