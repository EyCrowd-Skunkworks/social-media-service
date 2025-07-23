require('dotenv').config();

const { scrapeInstagram } = require('./scrapers/instagram');
const { scrapeFacebook } = require('./scrapers/facebook');
const { scrapeTikTok } = require('./scrapers/tiktok');




// (async () => {
//   const handle = 'natgeo'; // or another public profile
//   const task = 'dinosaur in the photo';

//   const results = await scrapeInstagram(handle, task);
//   console.log(results);
// })();



// (async () => {
//   const task = "dinosaur in the photo";
//   const results = await scrapeFacebook(task);
//   console.log(results);
// })();


(async () => {
  const handle = 'natgeo'; // TikTok handle without @
  const task = 'Is there a dinosaur in the video or caption?';

  try {
    const results = await scrapeTikTok(handle, task);
    console.log('\n🎯 Matched TikTok Posts:\n');
    results.forEach((post, idx) => {
      console.log(`${idx + 1}. ${post.url}`);
      console.log(`   Caption: ${post.caption}\n`);
    });
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
})();