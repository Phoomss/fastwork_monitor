#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http'); // Added http module for port binding

// API configuration
const API_URL = "https://jobboard-api.fastwork.co/api/jobs";
const SEEN_JOBS_FILE = "seen_jobs.json";

// --- Target Categories and Keywords Configuration ---
const TH_WEB = ["เขียนเว็บ", "พัฒนาเว็บไซต์", "ทำเว็บ", "เขียนโปรแกรม", "พัฒนาโปรแกรม", "ระบบเว็บ", "เว็บบอร์ด", "เว็บแอป"];
const EN_WEB = [/\bweb\b/i, /\bwebsite\b/i, /\bwordpress\b/i, /\breact\b/i, /\bvue\b/i, /\bfrontend\b/i, /\bbackend\b/i, /\bfullstack\b/i, /\bnextjs\b/i, /\bnuxt\b/i, /\bjavascript\b/i, /\bnodejs\b/i, /\bphp\b/i, /\bhtml\b/i, /\bcss\b/i];

const TH_APP = ["เขียนแอป", "พัฒนาแอป", "ทำแอป", "สร้างแอป", "พัฒนาแอปพลิเคชัน", "เขียนแอปพลิเคชัน", "ทำแอปพลิเคชัน", "สร้างแอปพลิเคชัน", "โมบายแอป"];
const EN_APP = [/\bios\b/i, /\bandroid\b/i, /\bflutter\b/i, /\breact native\b/i, /\breact-native\b/i, /\bkotlin\b/i, /\bswift\b/i, /\bmobile app\b/i, /\bmobile-app\b/i];

const TH_UXUI = ["ออกแบบหน้าจอ", "ออกแบบเว็บ", "ออกแบบแอป", "ออกแบบ ui", "ออกแบบ ux", "ออกแบบ ux/ui", "ดีไซน์ ui", "ดีไซน์ ux"];
const EN_UXUI = [/\bux\b/i, /\bui\b/i, /\buxui\b/i, /\bfigma\b/i, /\bwireframe\b/i, /\bprototype\b/i, /\bmockup\b/i];

function isTargetJob(job) {
    const title = (job.title || "").toLowerCase();
    const description = (job.description || "").toLowerCase();
    const tagName = (job.tag && job.tag.name || "").toLowerCase();
    
    const allText = `${title} ${description} ${tagName}`;
    
    // Web Development Check
    let isWeb = TH_WEB.some(kw => allText.includes(kw)) || EN_WEB.some(regex => regex.test(allText));
    
    // App Development Check
    let isApp = TH_APP.some(kw => allText.includes(kw)) || EN_APP.some(regex => regex.test(allText));
    
    // UX/UI Design Check
    let isUxUi = TH_UXUI.some(kw => allText.includes(kw)) || EN_UXUI.some(regex => regex.test(allText));
    
    // Category tag overrides
    if (tagName.includes("พัฒนาเว็บไซต์") || tagName.includes("เขียนโปรแกรม")) {
        isWeb = true;
    }
    if (tagName.includes("แอปพลิเคชัน") || tagName.includes("mobile app")) {
        isApp = true;
    }
    if (tagName.includes("ux/ui") || tagName.includes("ux") || tagName.includes("ui") || tagName.includes("ออกแบบเว็บไซต์")) {
        isUxUi = true;
    }
    
    const matchedCategories = [];
    if (isWeb) matchedCategories.push("พัฒนาเว็บไซต์");
    if (isApp) matchedCategories.push("พัฒนาแอปพลิเคชัน");
    if (isUxUi) matchedCategories.push("ออกแบบ UX UI");
    
    return {
        isTarget: matchedCategories.length > 0,
        matchedCategories
    };
}

function loadEnv() {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        content.split('\n').forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('#') && line.includes('=')) {
                const [key, ...valueParts] = line.split('=');
                const value = valueParts.join('=').trim();
                process.env[key.trim()] = value;
            }
        });
    }
}

// Load env configuration
loadEnv();

function loadSeenJobs() {
    const seenJobsPath = path.join(process.cwd(), SEEN_JOBS_FILE);
    if (fs.existsSync(seenJobsPath)) {
        try {
            const data = fs.readFileSync(seenJobsPath, 'utf-8');
            return new Set(JSON.parse(data));
        } catch (e) {
            console.log(`[${new Date().toISOString()}] Error loading seen jobs: {e.message}. Starting fresh.`);
        }
    }
    return new Set();
}

function saveSeenJobs(seenJobs) {
    const seenJobsPath = path.join(process.cwd(), SEEN_JOBS_FILE);
    try {
        fs.writeFileSync(seenJobsPath, JSON.stringify(Array.from(seenJobs), null, 2), 'utf-8');
    } catch (e) {
        console.log(`[${new Date().toISOString()}] Error saving seen jobs: ${e.message}`);
    }
}

function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });
        
        req.on('error', (err) => {
            reject(err);
        });
        
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

async function fetchJobs() {
    const options = {
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    };
    try {
        const response = await makeRequest(API_URL, options);
        if (response.statusCode === 200) {
            const data = JSON.parse(response.body);
            return data.data || [];
        } else {
            console.log(`[${new Date().toISOString()}] Error: Received HTTP status code ${response.statusCode}`);
        }
    } catch (e) {
        console.log(`[${new Date().toISOString()}] Connection Error: ${e.message}`);
    }
    return [];
}

async function sendDiscordNotification(webhookUrl, job, matchedCategories = null, consoleOnly = false) {
    const jobTypes = {
        "freelance": "ฟรีแลนซ์ (จ้างเป็นโปรเจกต์)",
        "contract": "สัญญาจ้าง (รายเดือน/รายปี)",
        "part-time": "พาร์ทไทม์ (รายชั่วโมง/รายวัน)",
        "full-time": "งานประจำ"
    };
    
    const jobType = jobTypes[job.type] || job.type || "ไม่ระบุ";
    const budget = job.budget || "ไม่ระบุ";
    const category = job.tag && job.tag.name || "ทั่วไป";
    const businessType = job.business_type || "ไม่ระบุ";
    const displayName = job.user_profile && job.user_profile.display_name || "ผู้ใช้งานทั่วไป";
    const clientAvatar = job.user_profile && job.user_profile.image_url;
    
    const jobUrl = `https://jobboard.fastwork.co/jobs/${job.id}`;
    
    // Format description
    let desc = job.description || "";
    const maxLen = parseInt(process.env.MAX_DESC_LENGTH || "800", 10);
    if (desc.length > maxLen) {
        desc = desc.substring(0, maxLen) + "\n\n...(รายละเอียดมีต่อ คลิกที่หัวข้อเพื่ออ่านเพิ่มเติม)...";
    }
    
    const categoryPrefix = matchedCategories ? ` [${matchedCategories.join(', ')}]` : "";
    
    if (consoleOnly || !webhookUrl) {
        console.log("\n" + "=" .repeat(50));
        console.log(`🟢 [CONSOLE ONLY] งานใหม่${categoryPrefix}: ${job.title}`);
        console.log(`💰 งบประมาณ: ${budget} บาท`);
        console.log(`🏷️ หมวดหมู่: ${category} | 💼 รูปแบบการจ้าง: ${jobType}`);
        console.log(`🏢 ประเภทธุรกิจ: ${businessType} | 👤 ผู้ประกาศ: ${displayName}`);
        console.log(`🔗 ลิงก์: ${jobUrl}`);
        console.log("-" .repeat(50));
        console.log(desc);
        console.log("=" .repeat(50) + "\n");
        return true;
    }
    
    const embed = {
        title: `🟢 งานใหม่${categoryPrefix}: ${job.title}`,
        description: desc,
        url: jobUrl,
        color: 5753020, // Fastwork green
        fields: [
            { name: "💰 งบประมาณ", value: `${budget} บาท`, inline: true },
            { name: "🏷️ หมวดหมู่", value: category, inline: true },
            { name: "💼 รูปแบบการจ้าง", value: jobType, inline: true },
            { name: "🏢 ประเภทธุรกิจ", value: businessType, inline: true },
            { name: "👤 ผู้ประกาศ", value: displayName, inline: true }
        ],
        footer: {
            text: "Fastwork Jobboard Monitor"
        },
        timestamp: job.inserted_at
    };
    
    if (clientAvatar) {
        embed.thumbnail = { url: clientAvatar };
    }
    
    const payload = {
        embeds: [embed]
    };
    
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'FastworkDiscordBot/1.0'
        },
        body: JSON.stringify(payload)
    };
    
    try {
        const res = await makeRequest(webhookUrl, options);
        return res.statusCode === 204 || res.statusCode === 200;
    } catch (e) {
        console.log(`[${new Date().toISOString()}] Failed to send Discord webhook: ${e.message}`);
        return false;
    }
}

async function checkForNewJobs(webhookUrl, initLoad = false, consoleOnly = false) {
    console.log(`[${new Date().toISOString()}] Checking Fastwork for new job posts...`);
    const jobs = await fetchJobs();
    if (!jobs || jobs.length === 0) {
        console.log(`[${new Date().toISOString()}] No jobs found or error fetching jobs.`);
        return;
    }
    
    const seenJobs = loadSeenJobs();
    let newJobsFound = false;
    
    // Process jobs in reverse order (oldest first)
    const reversedJobs = [...jobs].reverse();
    for (const job of reversedJobs) {
        const jobId = job.id;
        if (!jobId) continue;
        
        if (!seenJobs.has(jobId)) {
            seenJobs.add(jobId);
            newJobsFound = true;
            
            const { isTarget, matchedCategories } = isTargetJob(job);
            if (!isTarget) continue;
            
            if (initLoad) {
                console.log(`  Pre-loaded historical target job: ${job.title} (Cats: ${matchedCategories.join(', ')}) (ID: {jobId})`);
            } else {
                if (consoleOnly) {
                    console.log(`  [CONSOLE] Match found: ${job.title}`);
                } else {
                    console.log(`  FOUND NEW TARGET JOB: ${job.title} (Cats: ${matchedCategories.join(', ')}) (Budget: ${job.budget} THB)`);
                }
                
                const success = await sendDiscordNotification(webhookUrl, job, matchedCategories, consoleOnly);
                if (success && !consoleOnly) {
                    console.log("    Notification sent successfully.");
                } else if (!success) {
                    console.log("    Failed to send notification.");
                }
                
                // Sleep 1 second
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    
    if (newJobsFound) {
        saveSeenJobs(seenJobs);
    } else {
        console.log(`[${new Date().toISOString()}] No new target jobs found.`);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Start HTTP Server if PORT environment variable is present (for Render.com compatibility)
function startHttpServer() {
    const port = process.env.PORT;
    if (port) {
        http.createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Fastwork Jobboard Monitor is running.\n');
        }).listen(port, () => {
            console.log(`[${new Date().toISOString()}] HTTP Health Check Server listening on port ${port}`);
        });
    }
}

async function main() {
    // Start the health check server immediately if PORT is specified
    startHttpServer();

    const args = process.argv.slice(2);
    const hasTest = args.includes('--test');
    const hasOnce = args.includes('--once');
    
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    let consoleOnly = false;
    
    if (!webhookUrl || webhookUrl.startsWith("https://discord.com/api/webhooks/your-webhook-url-here") || webhookUrl.includes("your-webhook-url-here")) {
        console.log("⚠️ Warning: DISCORD_WEBHOOK_URL is not set or using placeholder in .env.");
        console.log("Running in Console-Only mode (matched jobs will be printed here instead of Discord).");
        consoleOnly = true;
    }
    
    if (hasTest) {
        console.log("Running in test mode. Fetching jobs...");
        const jobs = await fetchJobs();
        let targetJob = null;
        
        if (jobs && jobs.length > 0) {
            for (const job of jobs) {
                const { isTarget, matchedCategories } = isTargetJob(job);
                if (isTarget) {
                    targetJob = { job, cats: matchedCategories };
                    break;
                }
            }
            
            if (!targetJob) {
                console.log("No active job matched Web/App/UIUX filter. Falling back to the latest job for test.");
                targetJob = { job: jobs[0], cats: ["Test Run / No Match"] };
            }
            
            console.log(`Sending test notification for job: ${targetJob.job.title} (Categories: ${targetJob.cats.join(', ')})`);
            const success = await sendDiscordNotification(webhookUrl, targetJob.job, targetJob.cats, consoleOnly);
            if (success) {
                if (consoleOnly) {
                    console.log("Test run completed in Console-Only mode!");
                } else {
                    console.log("Test notification sent successfully!");
                }
            } else {
                console.log("Failed to send test notification.");
            }
        } else {
            console.log("No jobs found to test with.");
        }
        process.exit(0);
    }
    
    if (hasOnce) {
        await checkForNewJobs(webhookUrl, false, consoleOnly);
        process.exit(0);
    }
    
    // Default loop mode
    const intervalSeconds = parseInt(process.env.CHECK_INTERVAL_SECONDS || "60", 10);
    const intervalMs = intervalSeconds * 1000;
    console.log(`Starting Fastwork Jobboard Monitor. Interval: ${intervalSeconds}s`);
    
    const seenJobs = loadSeenJobs();
    const initLoad = seenJobs.size === 0;
    if (initLoad) {
        console.log("First launch: Initializing historical jobs database (will not notify for existing jobs).");
    }
    
    await checkForNewJobs(webhookUrl, initLoad, consoleOnly);
    console.log("Looping...");
    
    while (true) {
        try {
            await sleep(intervalMs);
            await checkForNewJobs(webhookUrl, false, consoleOnly);
        } catch (e) {
            console.log(`[${new Date().toISOString()}] Unexpected error in loop: ${e.message}`);
            await sleep(10000); // wait 10 seconds before retrying
        }
    }
}

main().catch(err => {
    console.error("Critical Error:", err);
    process.exit(1);
});
