const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function scrapeTikTok(handle) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  console.log(`🔗 Opening TikTok profile: ${handle}`);
  await page.goto(`https://www.tiktok.com/@${handle}`, { waitUntil: 'networkidle2' });

  try {
    await page.waitForSelector('button[data-e2e="accept-button"]', { timeout: 5000 });
    await page.click('button[data-e2e="accept-button"]');
    console.log('Clicked Accept Cookies');
  } catch {}

  const playlistSelector = 'a[href*="/playlist/"]';
  await page.waitForSelector(playlistSelector, { timeout: 20000 });
  console.log('Found playlist link');

  await page.click(playlistSelector);
  console.log('Clicked playlist link');

  // Wait for playlist page container to confirm it's open
  await new Promise(resolve => setTimeout(resolve, 3000));


  // Lazy load: scroll until videos appear
  let found = false;
  for (let i = 0; i < 10; i++) {
    const posts = await page.$$eval('a[href*="/video/"]', els => els.length);
    if (posts > 0) {
      found = true;
      break;
    }
    console.log(`🔄 Scrolling to load... (${i + 1})`);
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(1000);
  }

  if (!found) {
    await page.screenshot({ path: 'debug_no_posts.png' });
    throw new Error('Could not find video posts after scrolling.');
  }

  // Extract video links
  const posts = await page.evaluate(() => {
    const links = [];
    document.querySelectorAll('a[href*="/video/"]').forEach(a => {
      links.push({ postUrl: a.href });
    });
    return Array.from(new Set(links.map(JSON.stringify))).map(JSON.parse);
  });

  console.log(`✅ Found ${posts.length} TikTok video(s)`);
  await browser.close();
  return posts.slice(0, 10);
}

module.exports = { scrapeTikTok };


// const puppeteer = require('puppeteer-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// puppeteer.use(StealthPlugin());

// async function scrapeTikTok(handle) {
//   const browser = await puppeteer.launch({ headless: false });
//   const page = await browser.newPage();

//   await page.setUserAgent(
//     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
//     '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
//   );

//   console.log(`🔗 Opening TikTok profile: ${handle}`);
//   await page.goto(`https://www.tiktok.com/@${handle}`, {
//     waitUntil: 'networkidle2',
//   });

//   // Accept cookie banner
//   try {
//     await page.waitForSelector('button[data-e2e="accept-button"]', { timeout: 5000 });
//     await page.click('button[data-e2e="accept-button"]');
//     console.log('✅ Clicked Accept Cookies');
//   } catch {}

//   await page.waitForSelector('div[data-e2e="playlist-card"]', { timeout: 15000 });
//   console.log('✅ Playlist cards found');

//   await page.click('div[data-e2e="playlist-card"]');
//   console.log('🔗 Clicked first playlist');

//   try {
//     await page.waitForSelector('a[href*="/video/"]', { timeout: 20000 });
//     console.log('✅ Playlist videos loaded');
//   } catch {
//     await page.screenshot({ path: 'debug_error.png' });
//     throw new Error('Playlist failed to load.');
//   }

//   const posts = await page.evaluate(() => {
//     const links = [];
//     document.querySelectorAll('a[href*="/video/"]').forEach(a => {
//       const url = a.href;
//       if (url) links.push(url);
//     });
//     return Array.from(new Set(links)).map(postUrl => ({ postUrl }));
//   });

//   console.log(`✅ Found ${posts.length} TikTok video(s)`);
//   await browser.close();
//   return posts.slice(0, 10);
// }

// module.exports = { scrapeTikTok };


// // const puppeteer = require('puppeteer');

// // async function scrapeTikTok(handle) {
// //   const browser = await puppeteer.launch({ headless: false });
// //   const page = await browser.newPage();

// //   await page.setUserAgent(
// //     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
// //     '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
// //   );

// //   console.log(`🔗 Opening TikTok profile: ${handle}`);
// //   await page.goto(`https://www.tiktok.com/@${handle}`, {
// //     waitUntil: 'networkidle2',
// //   });

// //   // Accept cookie banner if present
// //   try {
// //     await page.waitForSelector('button[data-e2e="accept-button"]', { timeout: 5000 });
// //     await page.click('button[data-e2e="accept-button"]');
// //     console.log('✅ Clicked Accept Cookies');
// //   } catch {
// //     console.log('ℹ️ No cookie banner found');
// //   }

// //   // Wait for playlist cards to appear
// //   await page.waitForSelector('div[data-e2e="playlist-card"]', { timeout: 15000 });
// //   console.log('✅ Playlist cards found');

// //   // Click the first playlist card and wait for new content
// //   console.log('🔗 Clicking first playlist...');
// //   await page.click('div[data-e2e="playlist-card"]');

// //   // Wait for videos inside playlist to appear
// //   try {
// //     await page.waitForSelector('a[href*="/video/"]', { timeout: 20000 });
// //     console.log('✅ Playlist videos loaded');
// //   } catch (e) {
// //     console.log('❌ Video links did not appear, taking debug screenshot...');
// //     await page.screenshot({ path: 'playlist_debug.png' });
// //     throw new Error('Failed to load playlist videos.');
// //   }

// //   // Extract video links
// //   const posts = await page.evaluate(() => {
// //     const links = [];
// //     document.querySelectorAll('a[href*="/video/"]').forEach(a => {
// //       const url = a.href;
// //       if (url) links.push(url);
// //     });
// //     // De-duplicate
// //     return Array.from(new Set(links)).map(postUrl => ({ postUrl }));
// //   });

// //   console.log(`✅ Found ${posts.length} TikTok video(s)`);

// //   await browser.close();
// //   return posts.slice(0, 10); // Return first 10 only
// // }

// // module.exports = { scrapeTikTok };
