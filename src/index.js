require('dotenv').config();

const { scrapeInstagram } = require('./scrapers/instagram');
const { scrapeFacebook } = require('./scrapers/facebook');
const { scrapeTikTok } = require('./scrapers/tiktok');

(async () => {
//console.log(await scrapeInstagram('nasa'));
console.log(await scrapeFacebook('facebook'));
//console.log(await scrapeTikTok('tiktok'));
})();
