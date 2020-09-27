require("dotenv").config();
const puppeteer = require("puppeteer");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const sanitize = require("sanitize-filename");
const util = require("util");

const mkdir = util.promisify(fs.mkdir);

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
  const { PREFIX } = process.env;
  const browser = await puppeteer.launch({
    headless: true,
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
      .catch(() => { });
    await page.waitForTimeout(100);
    await page.waitForSelector(loadMoreSelector, {
      visible: true,
      timeout: 2000,
    });
    disabled = await page.$eval(loadMoreSelector, (item) => item.disabled);
    console.log(disabled);
  }

  // Store results
  const resultLinks = await page.$$eval(".result", (results) =>
    results.map((result) => result.href)
  );

  // Iterate through results
  for (const link of resultLinks) {
    console.log(`Loading ${link}...`);
    await retry(() => page.goto(link), 5);

    // Get Product Name
    const pageTitle = await page.$eval("span.base", (text) => text.textContent);

    const cadFileSelector = "#tab-label-cad-title";
    const filenameRegex = /filename="(.*)"/;

    let cadLinksExist = true;
    // If selector is gone, set clickable to false
    await page
      .waitForSelector(cadFileSelector, { visible: true, timeout: 1000 })
      .catch(() => {
        cadLinksExist = false;
      });

    if (cadLinksExist) {
      const cadFiles = await (await page.$("ul.cad-files")).$$("li");

      let heading = "";

      for (const key in cadFiles) {
        if (await cadFiles[key].$("h5")) {
          // Item was actually a heading, use this as a subfolder
          heading = await cadFiles[key].$eval("h5", el => el.textContent);
          console.log(`Found heading ${heading}, creating subfolder...`)
        } else {
          // Create path for file
          const pagePath = path.join(PREFIX, sanitize(pageTitle), sanitize(heading));
          await mkdir(pagePath, { recursive: true });

          // Extract url

          // Get the download link
          const url = await cadFiles[key].$eval("a", el => el.href);

          // Get file
          const response = await axios.get(url);
          const filename = filenameRegex.exec(
            response.headers["content-disposition"]
          )[1];
          const filepath = path.join(
            pagePath,
            sanitize(filename)
          );
          console.log(`Downloaded from ${url} with at path ${filepath}`);

          // Write file to disk
          const file = fs.createWriteStream(filepath);
          file.write(response.data);
          file.close();
        }
      }
    }
  }

  await browser.close();
})();
