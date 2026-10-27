import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SCREENSHOTS_DIR = path.resolve(ROOT_DIR, 'docs', 'screenshots');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsInNlc3Npb25WZXJzaW9uIjoiMWJhOGI4N2EtZWJmZC00OTc3LWE5ZjMtNzAzZmRmNjJiNTk5IiwiaWF0IjoxNzkzMDY4NDU0LCJleHAiOjE3OTM2NzMyNTR9.aMeB0qvqTn7YkoHLvvtmKDwXkhcs8PgyjnZWqRajfjg';
const user = JSON.stringify({ username: 'admin', updatedAt: 1793064696098 });

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function capture() {
  console.log('Launching Chrome from:', CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1440,960',
      '--font-render-hinting=medium',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 2 });

    const saveScreenshot = async (name) => {
      const buf = await page.screenshot();
      const targetPath = path.join(SCREENSHOTS_DIR, name);
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          fs.writeFileSync(targetPath, buf);
          return;
        } catch (e) {
          if (attempt === 4) throw e;
          await sleep(200);
        }
      }
    };

    // Helper to log in and set dark theme
    const login = async () => {
      await page.evaluate((t, u) => {
        localStorage.setItem('nodemaster_auth_token', t);
        localStorage.setItem('nodemaster_auth_user', u);
        localStorage.setItem('nodemaster-theme', 'dark');
      }, token, user);
    };

    // 1. Capture Login Gateway (logged out, dark mode)
    console.log('Capturing: 11-login-gateway.png');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('nodemaster-theme', 'dark');
    });
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await sleep(800);
    await saveScreenshot('11-login-gateway.png');

    // 2. Capture Dashboard Overview (dark mode)
    console.log('Capturing: 01-dashboard-overview.png');
    await login();
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await sleep(1500); // Wait for GSAP and charts
    await saveScreenshot('01-dashboard-overview.png');

    // 3. Capture Nodes Management
    console.log('Capturing: 02-nodes-management.png');
    await page.goto(`${BASE_URL}/nodes`, { waitUntil: 'networkidle0' });
    await sleep(1200);
    await saveScreenshot('02-nodes-management.png');

    // 4. Capture Node Detail Modal
    console.log('Capturing: 03-node-detail-modal.png');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await sleep(1500);
    const clicked = await page.evaluate(() => {
      const rows = document.querySelectorAll('tbody tr, .probe-item-anim');
      for (const el of rows) {
        if (el.textContent && el.textContent.includes('香港 CN2 GIA')) {
          el.click();
          return true;
        }
      }
      const firstRow = document.querySelector('tbody tr');
      if (firstRow) {
        firstRow.click();
        return true;
      }
      return false;
    });
    if (clicked) {
      await sleep(1500);
      await saveScreenshot('03-node-detail-modal.png');
      await page.keyboard.press('Escape');
      await sleep(500);
    }

    // 5. Capture Traffic Analytics
    console.log('Capturing: 04-traffic-analytics.png');
    await page.goto(`${BASE_URL}/traffic`, { waitUntil: 'networkidle0' });
    await sleep(1200);
    await saveScreenshot('04-traffic-analytics.png');

    // 6. Capture Latency Monitor
    console.log('Capturing: 05-latency-monitor.png');
    await page.goto(`${BASE_URL}/ping`, { waitUntil: 'networkidle0' });
    await sleep(1200);
    await saveScreenshot('05-latency-monitor.png');

    // 7. Capture Chain Topology
    console.log('Capturing: 06-chain-topology.png');
    await page.goto(`${BASE_URL}/topology`, { waitUntil: 'networkidle0' });
    await sleep(2000); // Allow GSAP animations
    await saveScreenshot('06-chain-topology.png');

    // 8. Capture Subscription Export
    console.log('Capturing: 07-subscription-export.png');
    await page.goto(`${BASE_URL}/subscription`, { waitUntil: 'networkidle0' });
    await sleep(1200);
    await saveScreenshot('07-subscription-export.png');

    // 9. Capture Deploy Scripts
    console.log('Capturing: 08-deploy-scripts.png');
    await page.goto(`${BASE_URL}/script`, { waitUntil: 'networkidle0' });
    await sleep(1000);
    await saveScreenshot('08-deploy-scripts.png');

    // 10. Capture Telegram Alerts
    console.log('Capturing: 09-telegram-alerts.png');
    await page.goto(`${BASE_URL}/notifications`, { waitUntil: 'networkidle0' });
    await sleep(1200);
    await saveScreenshot('09-telegram-alerts.png');

    // 11. Capture Mobile View
    console.log('Capturing: 10-mobile-experience.png');
    await page.setViewport({
      width: 390,
      height: 844,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await sleep(1200);
    await saveScreenshot('10-mobile-experience.png');

    console.log('✓ All 11 dark mode screenshots successfully captured and saved to:', SCREENSHOTS_DIR);
  } finally {
    await browser.close();
  }
}

capture().catch((err) => {
  console.error('Error during capture:', err);
  process.exit(1);
});
