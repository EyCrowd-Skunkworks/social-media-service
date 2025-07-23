const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const fs = require('fs');
const { OpenAI } = require('openai');
require('dotenv').config();

puppeteer.use(StealthPlugin());
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

async function scrapeInstagram(handle, taskDescription) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);

  console.log(`[🔐] Logging into Instagram...`);
  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });
  await page.type('input[name="username"]', process.env.INSTAGRAM_USER, { delay: 50 });
  await page.type('input[name="password"]', process.env.INSTAGRAM_PASS, { delay: 50 });
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  try {
    const [btn1] = await page.$x('//button[text()="Not Now"]');
    if (btn1) await btn1.click();
  } catch {}
  try {
    const [btn2] = await page.$x('//button[text()="Not Now"]');
    if (btn2) await btn2.click();
  } catch {}

  console.log(`[📸] Visiting profile: ${handle}`);
  await page.goto(`https://www.instagram.com/${handle}/`, { waitUntil: 'networkidle2' });
  await page.screenshot({ path: 'profile_page.png', fullPage: true });
  const html = await page.content();
  fs.writeFileSync('raw_profile.html', html);

  await smartScroll(page, 50);
  console.log(`[✅] Finished scrolling.`);

const posts = await page.evaluate(() => {
  const imgElements = Array.from(document.querySelectorAll('img'));
  const data = [];
  const seen = new Set();

  for (const img of imgElements) {
    const caption = img.alt || '';
    const imgUrl = img.src;

    // Traverse up to find enclosing post link
    let el = img.parentElement;
    while (el && el.tagName !== 'A') {
      el = el.parentElement;
    }

    const postUrl = el?.href;
    if (postUrl && postUrl.includes('/p/') && !seen.has(postUrl)) {
      seen.add(postUrl);
      data.push({ href: postUrl, img: imgUrl, caption });
    }
  }

  return data;
});



  console.log(`[📦] Found ${posts.length} post candidates.`);
  const results = [];

  for (const post of posts.slice(0, 10)) {
    if (!post.img) continue;

    console.log(`[🔍] Analyzing post:\nImage: ${post.img}\nCaption: ${post.caption}`);
    const match = await analyzeImageWithTask(post.img, taskDescription);
    results.push({ ...post, match });
  }

  await browser.close();
  console.log('[🎯] Final Results:', results);
  return results;
}

async function smartScroll(page, minPosts = 50) {
  let prevHeight = 0;
  let postCount = 0;
  let tries = 0;

  while (postCount < minPosts && tries < 12) {
    postCount = await page.evaluate(() =>
      document.querySelectorAll('a[href^="/p/"], a[href^="/reel/"]').length
    );
    prevHeight = await page.evaluate('document.body.scrollHeight');
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    await new Promise(r => setTimeout(r, 2000));
    const newHeight = await page.evaluate('document.body.scrollHeight');
    if (newHeight === prevHeight) break;
    tries++;
  }
}

async function analyzeImageWithTask(imageUrl, taskDescription) {
  try {
    const imgBuffer = (await axios.get(imageUrl, { responseType: 'arraybuffer' })).data;
    const base64 = Buffer.from(imgBuffer).toString('base64');

    const response = await openai.chat.completions.create({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `Does this image match the task: "${taskDescription}"?  Be flexible and consider artistic or educational representations too. Reply with "Yes" or "No" and explain briefly.Reply yes/no and explain.` },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
          ],
        },
      ],
    });

    return response.choices[0].message.content;
  } catch (err) {
    console.error('[❌] Error analyzing image:', err.message);
    return 'Analysis failed';
  }
}

module.exports = { scrapeInstagram };

// // 🔁 Optional local test run
// if (require.main === module) {
//   const handle = 'natgeo'; // test with public, media-heavy profiles
//   const taskDescription = 'person using a telescope outdoors';
//   scrapeInstagram(handle, taskDescription).then(console.log);
// }
