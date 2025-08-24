// instagramNew.js
const path = require('path');
// Load .env from project root (same level as src/)
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const fs = require('fs');
const { OpenAI } = require('openai');

// 🔎 Policy validator pieces (same folder)
const { validateCaptionHashtags } = require('./validator');
const policy = require('./policy'); // change to './Policy' if your file name is capitalized
const { extractHashtags, normalize } = require('./normalize');

puppeteer.use(StealthPlugin());

// OpenAI init (optional)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || '',
});
const hasOpenAI = !!openai.apiKey;

// helpers
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function dismissPopups(page) {
  const xpaths = [
    "//button[contains(., 'Allow all cookies')]",
    "//button[contains(., 'Only allow essential cookies')]",
    "//button[contains(., 'Accept All')]",
    "//button[contains(., 'Not now')]", "//button[contains(., 'Not Now')]",
    "//div[@role='dialog']//button[contains(., 'Not Now')]",
    "//div[@role='dialog']//button[contains(., 'Not now')]",
  ];
  for (const xp of xpaths) {
    try {
      const [btn] = await page.$x(xp);
      if (btn) {
        await btn.click();
        await sleep(400);
      }
    } catch {}
  }
}

async function waitForGridReady(page) {
  try { await page.waitForSelector('main, article', { timeout: 10000 }); } catch {}
  await page.evaluate(() => window.scrollBy(0, 400));
  await sleep(800);
}

async function scrapeInstagram(handle, taskDescription, maxPosts = 10) {
  // If you want to persist session, uncomment userDataDir
  // const browser = await puppeteer.launch({ headless: false, userDataDir: path.resolve(__dirname, '../../ig_profile') });
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);

  // (Optional) Stable UA/viewport
  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1366, height: 900 });
  } catch {}

  // --- LOGIN (your original working flow) ---
  console.log(`[🔐] Logging into Instagram...`);
  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });
  await dismissPopups(page); // new: clear cookie banner if present

  await page.type('input[name="username"]', process.env.INSTAGRAM_USER || '', { delay: 50 });
  await page.type('input[name="password"]', process.env.INSTAGRAM_PASS || '', { delay: 50 });
  await page.click('button[type="submit"]');

  await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
  await dismissPopups(page); // new: clear “Save info” / “Turn on notifications”

  // Also keep your old Not Now clicks (harmless)
  for (let i = 0; i < 2; i++) {
    try {
      const [btn] = await page.$x('//button[text()="Not Now"]');
      if (btn) await btn.click();
    } catch {}
  }

  // --- PROFILE + SCROLL ---
  console.log(`[📸] Visiting profile: ${handle}`);
  await page.goto(`https://www.instagram.com/${handle}/`, { waitUntil: 'domcontentloaded' });
  await dismissPopups(page);
  await waitForGridReady(page);

  await page.screenshot({ path: 'profile_page.png', fullPage: true });
  fs.writeFileSync('raw_profile.html', await page.content());

  await smartScroll(page, 60);
  console.log(`[✅] Finished scrolling.`);

  // sanity: ensure not bounced to login
  console.log('Page URL after nav:', await page.url());
  const maybeLocked = await page.evaluate(() => {
    return !!document.querySelector('input[name="username"], form[action*="login"]');
  });
  if (maybeLocked) {
    console.warn('[⚠️] Looks like we got bounced back to login or a checkpoint.');
  }

  // --- COLLECT POSTS (looser selectors) ---
  let posts = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a'));
    const seen = new Set();
    const out = [];
    for (const a of anchors) {
      const href = a.href || '';
      if (!/\/(p|reel)\//.test(href)) continue;
      if (seen.has(href)) continue;
      seen.add(href);

      const img = a.querySelector('img')?.src || '';
      const caption = a.querySelector('img')?.alt || '';
      out.push({ href, img, caption });
    }
    return out;
  });

  if (!posts || posts.length === 0) {
    await sleep(1200);
    await page.evaluate(() => window.scrollBy(0, 600));
    await sleep(800);
    posts = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a'));
      const seen = new Set();
      const out = [];
      for (const a of anchors) {
        const href = a.href || '';
        if (!/\/(p|reel)\//.test(href)) continue;
        if (seen.has(href)) continue;
        seen.add(href);
        const img = a.querySelector('img')?.src || '';
        const caption = a.querySelector('img')?.alt || '';
        out.push({ href, img, caption });
      }
      return out;
    });
  }

  console.log(`[📦] Found ${posts.length} post candidates.`);

  // --- DETAIL PAGE SCRAPE ---
  const detailPage = await browser.newPage();
  detailPage.setDefaultNavigationTimeout(60000);

  const results = [];
  for (const post of posts.slice(0, maxPosts)) {
    console.log(`\n[🔍] Post: ${post.href}`);
    const { fullCaption, hashtags } = await fetchPostDetails(detailPage, post.href);

    const finalCaption = fullCaption || post.caption || '';
    const mergedHashtags = (hashtags && hashtags.length) ? hashtags : extractHashtags(finalCaption);
    const policyAudit = validateCaptionHashtags(finalCaption, mergedHashtags, policy);

    let match = null;
    if (hasOpenAI && post.img && taskDescription) {
      match = await analyzeImageWithTask(post.img, taskDescription);
    }

    results.push({
      href: post.href,
      img: post.img,
      caption: finalCaption,
      hashtags: mergedHashtags,
      policyAudit,
      match,
    });
  }

  await detailPage.close();
  await browser.close();
  console.log('\n[🎯] Final Results:', results);
  return results;
}

async function smartScroll(page, minThumbs = 50) {
  let prevCount = 0;
  let tries = 0;
  while (tries < 16) {
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    await sleep(1200);
    const count = await page.evaluate(
      () => document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]').length
    );
    if (count >= minThumbs) break;
    if (count === prevCount) tries++;
    else tries = 0;
    prevCount = count;
  }
}

// Pulls the main caption + all visible hashtags from a single post page
async function fetchPostDetails(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle2' });
    await dismissPopups(page);

    const fullCaption = await page.evaluate(() => {
      const candidates = [
        'header ~ div span',
        'div[role="dialog"] span',
        'ul li div div span',
        'h1 ~ div[role="button"] span',
      ];
      for (const sel of candidates) {
        const el = document.querySelector(sel);
        if (el && el.textContent && el.textContent.trim().length > 0) {
          return el.textContent.trim();
        }
      }
      const texts = Array.from(document.querySelectorAll('span, div, p'))
        .map((e) => (e.textContent || '').trim())
        .filter(Boolean)
        .sort((a, b) => b.length - a.length);
      return texts[0] || '';
    });

    const allTags = await page.evaluate(() => {
      const set = new Set();
      const re = /(^|[\s.,;!?:()"'”“‘’\-_/])#([a-z0-9_\.]+)/gi;
      const texts = Array.from(document.querySelectorAll('span, div, p'))
        .map((e) => (e.textContent || '').trim())
        .filter(Boolean);
      for (const t of texts) {
        let m;
        while ((m = re.exec(t)) !== null) set.add(`#${m[2].toLowerCase()}`);
      }
      return Array.from(set);
    });

    return { fullCaption: normalize(fullCaption), hashtags: allTags };
  } catch (e) {
    console.warn('[⚠️] fetchPostDetails failed:', e.message);
    return { fullCaption: '', hashtags: [] };
  }
}

async function analyzeImageWithTask(imageUrl, taskDescription) {
  try {
    const imgBuffer = (await axios.get(imageUrl, { responseType: 'arraybuffer' })).data;
    const base64 = Buffer.from(imgBuffer).toString('base64');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Does this image match the task: "${taskDescription}"?
                     Be flexible and consider artistic or educational representations too.
                     Reply with "Yes" or "No" and a short reason.`,
            },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
          ],
        },
      ],
    });

    return response.choices?.[0]?.message?.content ?? 'No response';
  } catch (err) {
    console.error('[❌] Error analyzing image:', err.message);
    return 'Analysis failed';
  }
}

// Export if you want to import elsewhere
module.exports = { scrapeInstagram };

// --- Optional local run ---
if (require.main === module) {
  const handle = process.argv[2] || 'natgeo';
  const task = process.argv.slice(3).join(' ') || '';
  scrapeInstagram(handle, task, 8).then(() => {}).catch(console.error);
}



// // instagramNew.js
// const puppeteer = require('puppeteer-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// const axios = require('axios');
// const fs = require('fs');
// const { OpenAI } = require('openai');
// require('dotenv').config();

// // 🔎 Policy validator pieces
// const { validateCaptionHashtags } = require('./validator');
// const policy = require('./policy');
// const { extractHashtags, normalize } = require('./normalize');


// puppeteer.use(StealthPlugin());
// // const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });
// const path = require('path');
// require('dotenv').config({
//   // adjust this path if your .env is somewhere else
//   path: path.resolve(__dirname, '../../.env'),
// });


// async function scrapeInstagram(handle, taskDescription, maxPosts = 10) {
//   const browser = await puppeteer.launch({ headless: false });
//   const page = await browser.newPage();
//   page.setDefaultNavigationTimeout(60000);

//   // --- Login ---
//   console.log(`[🔐] Logging into Instagram...`);
//   await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });
//   await page.type('input[name="username"]', process.env.INSTAGRAM_USER, { delay: 50 });
//   await page.type('input[name="password"]', process.env.INSTAGRAM_PASS, { delay: 50 });
//   await page.click('button[type="submit"]');
//   await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});

//   // dismiss “Not Now”
//   for (let i = 0; i < 2; i++) {
//     try {
//       const [btn] = await page.$x('//button[text()="Not Now"]');
//       if (btn) await btn.click();
//     } catch {}
//   }

//   // --- Profile + scroll ---
//   console.log(`[📸] Visiting profile: ${handle}`);
//   await page.goto(`https://www.instagram.com/${handle}/`, { waitUntil: 'networkidle2' });
//   await page.screenshot({ path: 'profile_page.png', fullPage: true });
//   fs.writeFileSync('raw_profile.html', await page.content());
//   await smartScroll(page, 60);
//   console.log(`[✅] Finished scrolling.`);

//   // --- Collect candidate posts from the profile grid ---
//   const posts = await page.evaluate(() => {
//     const anchors = Array.from(document.querySelectorAll('a[href^="/p/"], a[href^="/reel/"]'));
//     const seen = new Set();
//     const out = [];
//     for (const a of anchors) {
//       const href = a.href;
//       if (!href || seen.has(href)) continue;
//       seen.add(href);

//       // Try to pick a thumbnail <img> near the anchor
//       const img = a.querySelector('img')?.src || '';
//       // alt often contains a short caption-ish text (not reliable but okay as fallback)
//       const caption = a.querySelector('img')?.alt || '';
//       out.push({ href, img, caption });
//     }
//     return out;
//   });

//   console.log(`[📦] Found ${posts.length} post candidates.`);

//   // --- Open a second tab for detail page scraping ---
//   const detailPage = await browser.newPage();
//   detailPage.setDefaultNavigationTimeout(60000);

//   const results = [];
//   for (const post of posts.slice(0, maxPosts)) {
//     console.log(`\n[🔍] Post: ${post.href}`);

//     // Get richer caption + hashtags from the post page
//     const { fullCaption, hashtags } = await fetchPostDetails(detailPage, post.href);

//     // Run policy audit using your policy.js
//     const finalCaption = fullCaption || post.caption || '';
//     const mergedHashtags = hashtags.length ? hashtags : extractHashtags(finalCaption);
//     const policyAudit = validateCaptionHashtags(finalCaption, mergedHashtags, policy);

//     // Optional: keep your image→task vision check
//     let match = null;
//     if (taskDescription && post.img) {
//       match = await analyzeImageWithTask(post.img, taskDescription);
//     }

//     results.push({
//       href: post.href,
//       img: post.img,
//       caption: finalCaption,
//       hashtags: mergedHashtags,
//       policyAudit,
//       match
//     });
//   }

//   await detailPage.close();
//   await browser.close();
//   console.log('\n[🎯] Final Results:', results);
//   return results;
// }

// async function smartScroll(page, minThumbs = 50) {
//   let prevHeight = 0;
//   let count = 0;
//   let tries = 0;

//   const sleep = (ms) => new Promise(res => setTimeout(res, ms));

//   while (count < minThumbs && tries < 14) {
//     count = await page.evaluate(
//       () => document.querySelectorAll('a[href^="/p/"], a[href^="/reel/"]').length
//     );
//     prevHeight = await page.evaluate('document.body.scrollHeight');
//     await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
//     await sleep(1800); // ← replaces page.waitForTimeout(1800)
//     const newHeight = await page.evaluate('document.body.scrollHeight');
//     if (newHeight === prevHeight) break;
//     tries++;
//   }
// }


// // Pulls the main caption + all visible hashtags from a single post page
// async function fetchPostDetails(page, url) {
//   try {
//     await page.goto(url, { waitUntil: 'networkidle2' });

//     // Try a few selectors (IG DOM changes often); fallback to “longest plausible text”
//     const fullCaption = await page.evaluate(() => {
//       const candidates = [
//         // These may change—kept intentionally broad:
//         'header ~ div span',               // generic
//         'div[role="dialog"] span',         // modal/opened post
//         'ul li div div span',              // list-based
//         'h1 ~ div[role="button"] span'     // older structure
//       ];
//       for (const sel of candidates) {
//         const el = document.querySelector(sel);
//         if (el && el.textContent && el.textContent.trim().length > 0) {
//           return el.textContent.trim();
//         }
//       }
//       const texts = Array.from(document.querySelectorAll('span, div, p'))
//         .map(e => (e.textContent || '').trim())
//         .filter(Boolean)
//         .sort((a, b) => b.length - a.length);
//       return texts[0] || '';
//     });

//     // Get hashtags from all visible text nodes
//     const allTags = await page.evaluate(() => {
//       const set = new Set();
//       const re = /(^|[\s.,;!?:()"'”“‘’\-_/])#([a-z0-9_\.]+)/gi;
//       const texts = Array.from(document.querySelectorAll('span, div, p'))
//         .map(e => (e.textContent || '').trim())
//         .filter(Boolean);
//       for (const t of texts) {
//         let m;
//         while ((m = re.exec(t)) !== null) set.add(`#${m[2].toLowerCase()}`);
//       }
//       return Array.from(set);
//     });

//     return { fullCaption: normalize(fullCaption), hashtags: allTags };
//   } catch (e) {
//     console.warn('[⚠️] fetchPostDetails failed:', e.message);
//     return { fullCaption: '', hashtags: [] };
//   }
// }

// async function analyzeImageWithTask(imageUrl, taskDescription) {
//   try {
//     const imgBuffer = (await axios.get(imageUrl, { responseType: 'arraybuffer' })).data;
//     const base64 = Buffer.from(imgBuffer).toString('base64');

//     const response = await openai.chat.completions.create({
//       model: 'gpt-4-vision-preview',
//       messages: [
//         {
//           role: 'user',
//           content: [
//             { type: 'text', text:
//               `Does this image match the task: "${taskDescription}"?
//                Be flexible and consider artistic or educational representations too.
//                Reply with "Yes" or "No" and a short reason.` },
//             { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
//           ],
//         },
//       ],
//     });

//     return response.choices[0].message.content;
//   } catch (err) {
//     console.error('[❌] Error analyzing image:', err.message);
//     return 'Analysis failed';
//   }
// }

// // Export if you want to import elsewhere
// module.exports = { scrapeInstagram };

// // --- Optional local run ---
// if (require.main === module) {
//   const handle = process.argv[2] || 'natgeo';
//   const task = process.argv.slice(3).join(' ') || '';
//   scrapeInstagram(handle, task, 8).then(() => {}).catch(console.error);
// }
