const axios = require("axios");

async function scrapeFacebook() {
  const options = {
    method: 'GET',
    url: 'https://facebook-scraper3.p.rapidapi.com/page/posts',
    params: { page_id: '100064860875397' }, // hardcoded page ID
    headers: {
      'X-RapidAPI-Key': 'f582de019fmsh2f3f89b6743b49ap1279ffjsnb6eb015871ce',
      'X-RapidAPI-Host': 'facebook-scraper3.p.rapidapi.com'
    }
  };

  try {
    const response = await axios.request(options);
    console.log('✅ Facebook posts:', response.data);
    return response.data;
  } catch (error) {
    console.error(error);
    return [];
  }
}

module.exports = { scrapeFacebook };



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
