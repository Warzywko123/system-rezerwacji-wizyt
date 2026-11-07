// Generuje PDF sprawozdania z sprawozdanie.html: node docs/sprawozdanie/build.cjs [nazwa.pdf]
// Wymaga Playwright z przeglądarką Chromium.
const path = require('node:path');
const { chromium } = require('playwright');

const out = path.join(__dirname, process.argv[2] ?? 'sprawozdanie.pdf');
const footer = `
  <div style="width:100%; font-family:Inter, sans-serif; font-size:7.5pt; color:#7b8794; padding:0 19mm; display:flex; justify-content:space-between;">
    <span>System rezerwacji wizyt online — sprawozdanie końcowe</span>
    <span>strona <span class="pageNumber"></span> z <span class="totalPages"></span></span>
  </div>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`file://${path.join(__dirname, 'sprawozdanie.html')}`);
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: out,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: footer,
  });
  await browser.close();
  console.log(`PDF: ${out}`);
})();
