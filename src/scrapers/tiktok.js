const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');

dotenv.config();
puppeteer.use(StealthPlugin());

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

async function analyzePost({ caption, imagePath, task, url }) {
  console.log(`Analyzing: "${caption}" for task "${task}"`);

  try {
    const imageData = fs.readFileSync(imagePath);
    const base64Image = imageData.toString('base64');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `Does this TikTok video (image + caption) satisfy the following task?\n\nTask: ${task}\n\nCaption: "${caption}"` },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${base64Image}` },
            },
          ],
        },
      ],
      max_tokens: 100,
    });

    const reply = response.choices[0].message.content.toLowerCase();
    console.log(`🔎 GPT Reply: ${reply}`);
    return reply.includes('yes') || reply.includes('true');
  } catch (err) {
    console.error(`analyzePost error: ${err.message}`);
    return false;
  }
}

async function scrapeTikTok(handle, task) {
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
    console.log('Accepted Cookies');
  } catch {}

  const playlistSelector = 'a[href*="/playlist/"]';
  await page.waitForSelector(playlistSelector, { timeout: 20000 });
  await page.click(playlistSelector);
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Scroll to load posts
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
   await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const posts = await page.$$eval('a[href*="/video/"]', els =>
    Array.from(new Set(els.map(e => e.href)))
  );

  console.log(`Found ${posts.length} video(s)`);

  const matchedPosts = [];

  for (let i = 0; i < Math.min(posts.length, 10); i++) {
    const videoUrl = posts[i];
    console.log(`🔍 Analyzing video ${i + 1}: ${videoUrl}`);
    try {
      const videoPage = await browser.newPage();
      await videoPage.goto(videoUrl, { waitUntil: 'networkidle2' });

      let caption = '';
      try {
        await videoPage.waitForSelector('h1', { timeout: 5000 });
        caption = await videoPage.$eval('h1', el => el.innerText);
      } catch {
        console.log('⚠️ Could not extract caption');
      }

      const screenshotPath = path.resolve(__dirname, `tiktok_${i}.png`);
      await videoPage.screenshot({ path: screenshotPath, fullPage: true });

      const match = await analyzePost({
        caption,
        imagePath: screenshotPath,
        task,
        url: videoUrl,
      });

      if (match) {
        matchedPosts.push({ url: videoUrl, caption });
      }

      await videoPage.close();
    } catch (err) {
      console.log(`❌ Error analyzing video ${i + 1}: ${err.message}`);
    }
  }

  await browser.close();
  return matchedPosts;
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
//   await page.goto(`https://www.tiktok.com/@${handle}`, { waitUntil: 'networkidle2' });

//   try {
//     await page.waitForSelector('button[data-e2e="accept-button"]', { timeout: 5000 });
//     await page.click('button[data-e2e="accept-button"]');
//     console.log('Clicked Accept Cookies');
//   } catch {}

//   const playlistSelector = 'a[href*="/playlist/"]';
//   await page.waitForSelector(playlistSelector, { timeout: 20000 });
//   console.log('Found playlist link');

//   await page.click(playlistSelector);
//   console.log('Clicked playlist link');

//   // Wait for playlist page container to confirm it's open
//   await new Promise(resolve => setTimeout(resolve, 3000));


//   // Lazy load: scroll until videos appear
//   let found = false;
//   for (let i = 0; i < 10; i++) {
//     const posts = await page.$$eval('a[href*="/video/"]', els => els.length);
//     if (posts > 0) {
//       found = true;
//       break;
//     }
//     console.log(`🔄 Scrolling to load... (${i + 1})`);
//     await page.evaluate(() => window.scrollBy(0, window.innerHeight));
//     await page.waitForTimeout(1000);
//   }

//   if (!found) {
//     await page.screenshot({ path: 'debug_no_posts.png' });
//     throw new Error('Could not find video posts after scrolling.');
//   }

//   // Extract video links
//   const posts = await page.evaluate(() => {
//     const links = [];
//     document.querySelectorAll('a[href*="/video/"]').forEach(a => {
//       links.push({ postUrl: a.href });
//     });
//     return Array.from(new Set(links.map(JSON.stringify))).map(JSON.parse);
//   });

//   console.log(`✅ Found ${posts.length} TikTok video(s)`);
//   await browser.close();
//   return posts.slice(0, 10);
// }

// module.exports = { scrapeTikTok };


