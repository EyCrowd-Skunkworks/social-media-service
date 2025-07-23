const axios = require("axios");
const { OpenAI } = require("openai");
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

function pickFacebookImageUrl(post) {
  if (post.image?.uri) return post.image.uri;
  if (post.picture) return post.picture;
  if (post.full_picture) return post.full_picture;
  if (Array.isArray(post.images) && post.images.length > 0) return post.images[0];
  if (post.video_thumbnail) return post.video_thumbnail;
  return null;
}

async function analyzeFacebookPost(post, taskDescription) {
  try {
    const imageUrl = pickFacebookImageUrl(post);
    if (!imageUrl) return null;

    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const base64 = Buffer.from(imageResponse.data).toString('base64');

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Here is a Facebook post image. The caption says: "${post.message || post.text || ''}". Does this match the task: "${taskDescription}"? Answer yes or no and explain why.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64}`,
              },
            },
          ],
        },
      ],
    });

    const decision = response.choices[0].message.content;
    return {
      postUrl: post.link || post.url || "N/A",
      caption: post.message || post.text || "",
      image: imageUrl,
      decision,
    };
  } catch (error) {
    console.error("Error analyzing Facebook post:", error.message);
    return null;
  }
}

async function scrapeFacebook(taskDescription) {
  const options = {
    method: 'GET',
    url: 'https://facebook-scraper3.p.rapidapi.com/page/posts',
    params: { page_id: '100064860875397' }, // replace with desired page
    headers: {
      'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
      'X-RapidAPI-Host': 'facebook-scraper3.p.rapidapi.com'
    }
  };

  try {
    const response = await axios.request(options);

    const posts = Array.isArray(response.data.results) ? response.data.results : [];
    console.log("[📦] Total posts fetched:", posts.length);

    const relevantPosts = [];

    for (const post of posts.slice(0, 10)) {
      const imageUrl = pickFacebookImageUrl(post);
      if (imageUrl) {
        console.log("[🔍] Analyzing Facebook post:", post.link || post.url);
        const result = await analyzeFacebookPost(post, taskDescription);
        if (result) relevantPosts.push(result);
      }
    }

    console.log("[🎯] Final Facebook Analysis Results:", relevantPosts);
    return relevantPosts;
  } catch (error) {
    console.error("Facebook scraping failed:", error.message);
    return [];
  }
}

module.exports = { scrapeFacebook };




// const axios = require("axios");

// async function scrapeFacebook() {
//   const options = {
//     method: 'GET',
//     url: 'https://facebook-scraper3.p.rapidapi.com/page/posts',
//     params: { page_id: '100064860875397' }, // hardcoded page ID
//     headers: {
//       'X-RapidAPI-Key': 'f582de019fmsh2f3f89b6743b49ap1279ffjsnb6eb015871ce',
//       'X-RapidAPI-Host': 'facebook-scraper3.p.rapidapi.com'
//     }
//   };

//   try {
//     const response = await axios.request(options);
//     console.log('✅ Facebook posts:', response.data);
//     return response.data;
//   } catch (error) {
//     console.error(error);
//     return [];
//   }
// }

// module.exports = { scrapeFacebook };



// const puppeteer = require('puppeteer');
// const fs = require('fs');
// require('dotenv').config();

// async function scrapeFacebook(handle) {
//   const browser = await puppeteer.launch({ headless: false });
//   const page = await browser.newPage();

//   // Load cookies
//   // const cookies = JSON.parse(fs.readFileSync('./facebook.cookies.json'));
//   // await page.setCookie(...cookies);

//   // Go directly to profile — no fresh login
//   await page.goto(`https://www.facebook.com/${handle}`, { waitUntil: 'networkidle2' });

//   // Optional scroll to load more
//   await page.evaluate(() => window.scrollBy(0, 2000));
//   await new Promise(r => setTimeout(r, 2000));

//   const posts = await page.evaluate(() => {
//     const results = [];
//     document.querySelectorAll('div[role="article"] div[dir="auto"]').forEach(post => {
//       const text = post.innerText.trim();
//       if (text.length > 20) results.push({ text });
//     });
//     return results;
//   });

//   console.log('Facebook posts:', posts);
//   await browser.close();
//   return posts.slice(0, 5);
// }

// module.exports = { scrapeFacebook };




// const puppeteer = require('puppeteer');
// const fs = require('fs');

// async function scrapeFacebook(handle) {
//   const browser = await puppeteer.launch({ headless: false });
//   const page = await browser.newPage();

//   // Load cookies
//   const cookies = JSON.parse(fs.readFileSync('./facebook.cookies.json'));
//   await page.setCookie(...cookies);

//   // Go directly to profile — no fresh login
//   await page.goto(`https://www.facebook.com/${handle}`, { waitUntil: 'networkidle2' });

//   // Optional scroll to load more
//   await page.evaluate(() => window.scrollBy(0, 2000));
//   await new Promise(r => setTimeout(r, 2000));

//   const posts = await page.evaluate(() => {
//     const results = [];
//     document.querySelectorAll('div[role="article"] div[dir="auto"]').forEach(post => {
//       const text = post.innerText.trim();
//       if (text.length > 20) results.push({ text });
//     });
//     return results;
//   });

//   console.log('✅ Facebook posts:', posts);
//   await browser.close();
//   return posts.slice(0, 5);
// }

// module.exports = { scrapeFacebook };
