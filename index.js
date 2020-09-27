const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Download V5 Parts
  await page.goto('https://www.vexrobotics.com/v5/products/view-all');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });

  // Load all the pages
  while (await page.$('button.ais-infinite-hits--showmoreButton') !== null) {
      await page.click('button.ais-infinite-hits--showmoreButton');
      await page.waitForNavigation({ waitUntil: 'networkidle0' });
  }

  await page.screenshot({path: 'example.png'});


  await browser.close();
})();