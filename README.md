# 📸 Social Media Service Scraper

A Node.js microservice to **scrape posts and videos** from **Instagram**, **TikTok**, and **Facebook** using **Puppeteer**, **puppeteer-extra**, and **RapidAPI**.

---

## ✨ Features

✅ **Instagram**  
- Logs in with your credentials  
- Bypasses popups  
- Scrolls to load more posts  
- Extracts up to 30 posts/reels

✅ **TikTok**  
- Opens a TikTok profile  
- Clicks the first playlist  
- Handles cookie banners  
- Scrolls if needed  
- Extracts up to 10 videos

✅ **Facebook**  
- Uses RapidAPI Facebook Scraper  
- Pulls posts from a given page ID  
- Or switch to Puppeteer + cookies (optional)

---

## ⚙️ Tech Stack

- Node.js
- Puppeteer (headless Chrome)
- puppeteer-extra + stealth plugin (TikTok)
- dotenv (load credentials)
- axios (Facebook API)

## create .env file:
INSTAGRAM_USER=<username>
INSTAGRAM_PASS=<pwd>
FB_USER=<email>
FB_PASS=<password>


##run it
node src/index.js


