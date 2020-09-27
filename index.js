const puppeteer = require("puppeteer");
/**
 * Check if element is vitible
 * @param {puppeteer.Page} page Page to check element on
 * @param {string} cssSelector
 */
const isElementClickable = async (page, cssSelector) => {
  let clickable = true;

  // If selector is gone, set clickable to false
  await page
    .waitForSelector(cssSelector, { visible: true, timeout: 2000 })
    .catch(() => {
      clickable = false;
    });

  // If button is disabled, set clickable to false
  if (await page.$eval(cssSelector, (item) => item.disabled)) {
    clickable = false;
  }
  return clickable;
};

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
  });
  const page = await browser.newPage();

  // Download V5 Parts
  await page.goto("https://www.vexrobotics.com/v5/products/view-all", {
    waitUntil: "networkidle2",
  });

  // Close shipping notice modal
  await page.click("a.js-modal-close");
  // Load all the pages
  let loadMoreSelector = "button.ais-infinite-hits--showmoreButton";
  let loadMoreVisible = await isElementClickable(page, loadMoreSelector);
  while (loadMoreVisible) {
    await page.click(loadMoreSelector).catch((err) => {
      console.error(err);
    });
    loadMoreVisible = await isElementClickable(page, loadMoreSelector);
  }

  console.log(await page.$$eval(".result", results => results.map(result => result.href)));

  await browser.close();
})();
