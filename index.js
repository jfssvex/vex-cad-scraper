require("dotenv").config();
const puppeteer = require("puppeteer");
const http = require("http");
const fs = require("fs");

async function retry(promiseFactory, retryCount) {
  try {
    return await promiseFactory();
  } catch (error) {
    if (retryCount <= 0) {
      throw error;
    }
    return await retry(promiseFactory, retryCount - 1);
  }
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
  });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(0);

  // Download V5 Parts
  await page.goto("https://www.vexrobotics.com/v5/products/view-all", {
    waitUntil: "networkidle2",
  });

  // Close shipping notice modal
  await page.click("a.js-modal-close");

  // Load all the pages
  const loadMoreSelector = "button.ais-infinite-hits--showmoreButton";
  await page.waitForSelector(loadMoreSelector);
  let disabled = await page.$eval(loadMoreSelector, (item) => item.disabled);

  while (!disabled) {
    await page
      .click(loadMoreSelector, { waitUntil: "networkidle2" })
      .catch(() => {});
    await page.waitForTimeout(100);
    await page
      .waitForSelector(loadMoreSelector, { visible: true, timeout: 2000 })
      .catch(() => {
        page.reload();
      });
    disabled = await page.$eval(loadMoreSelector, (item) => item.disabled);
    console.log(disabled);
  }

  // Store results
  const resultLinks = await page.$$eval(".result", (results) =>
    results.map((result) => result.href)
  );

  const cadFiles = {};
  // Iterate through results
  for (const link of resultLinks) {
    console.log(`Loading ${link}...`);
    await retry(
      () =>
        page.goto(link, {
          waitUntil: "networkidle2",
        }),
      5
    );

    // Get Product Name
    const pageTitle = await page.$eval("span.base", (text) => text.textContent);

    const cadFileSelector = "#tab-label-cad-title";

    let cadLinksExist = true;
    // If selector is gone, set clickable to false
    await page
      .waitForSelector(cadFileSelector, { visible: true, timeout: 1000 })
      .catch(() => {
        cadLinksExist = false;
      });

    if (cadLinksExist) {
      const cadDownloadActions = await page.$$eval(
        "div.cad-actions",
        (groups) =>
          groups.map((group) => group.children.item(1).getAttribute("onclick"))
      );
      const urlRegex = /((\w+:\/\/)[-a-zA-Z0-9:@;?&=\/%\+\.\*!\(\),\$_\{\}\^~\[\]`#|]+)/;
      const cadDownloadLinks = cadDownloadActions.map(
        (action) => urlRegex.exec(action)[0]
      );
      console.log("Files found: ");
      console.log(cadDownloadLinks);
      cadFiles[pageTitle] = cadDownloadLinks;
    }
  }

  await browser.close();
})();
