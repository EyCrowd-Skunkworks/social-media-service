const puppeteer = require('puppeteer');
//const StealthPlugin = require('puppeteer-extra-plugin-stealth');
require('dotenv').config();

//puppeteer.use(StealthPlugin());

async function scrapeInstagram(handle) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // 1️⃣ Go to login page
  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });

  // 2️⃣ Enter credentials
  await page.type('input[name="username"]', process.env.INSTAGRAM_USER, { delay: 50 });
  await page.type('input[name="password"]', process.env.INSTAGRAM_PASS, { delay: 50 });

  await page.click('button[type="submit"]');

  // 3️⃣ Wait for home page to load
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

// Close first "Not Now"
try {
  await page.waitForXPath('//button[text()="Not Now"]', { timeout: 5000 });
  const [button1] = await page.$x('//button[text()="Not Now"]');
  if (button1) await button1.click();
  console.log('Closed Save Login Info pop-up.');
} catch (err) {
  console.log('No Save Login Info pop-up.');
}

// Close second "Not Now" if shown
try {
  await page.waitForXPath('//button[text()="Not Now"]', { timeout: 5000 });
  const [button2] = await page.$x('//button[text()="Not Now"]');
  if (button2) await button2.click();
  console.log('Closed Notifications pop-up.');
} catch (err) {
  console.log('No Notifications pop-up.');
}



  // 4️⃣ Go to target profile
  await page.goto(`https://www.instagram.com/${handle}/`, { waitUntil: 'networkidle2' });

  // 5️⃣ Wait for posts
await smartScroll(page);
// await page.waitForSelector('a[href^="/p/"]', { timeout: 10000 });

// Test: log all links
// const allLinks = await page.evaluate(() =>
//   Array.from(document.querySelectorAll('a')).map(a => a.href)
// );
// console.log('All found links:', allLinks);

const allLinks = await page.evaluate(() =>
  Array.from(document.querySelectorAll('a')).map(a => a.href)
);

const posts = allLinks.filter(
  href => href.includes('/p/') || href.includes('/reel/')
).map(href => ({ postUrl: href }));

console.log('Scraped posts:', posts);


  await browser.close();
  return posts.slice(0, 10);
}

async function smartScroll(page, minPosts = 30) {
  let previousHeight = 0;
  let postsCount = 0;
  let tries = 0;

  while (postsCount < minPosts && tries < 10) {
    postsCount = await page.evaluate(() =>
      document.querySelectorAll('a[href^="/p/"], a[href^="/reel/"]').length
    );

    previousHeight = await page.evaluate('document.body.scrollHeight');
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    await new Promise(r => setTimeout(r, 1500)); 
    const newHeight = await page.evaluate('document.body.scrollHeight');

    if (newHeight === previousHeight) {
      break; // no more new posts loading
    }
    tries++;
  }
}




module.exports = { scrapeInstagram };






