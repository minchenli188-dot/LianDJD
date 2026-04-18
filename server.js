/**
 * Backend Server for 阿莲读经典
 * Protects API keys by proxying requests to Gemini API
 * Includes analytics data collection system
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
function loadEnv() {
    try {
        const envPath = path.join(__dirname, '.env');
        const envContent = fs.readFileSync(envPath, 'utf8');
        const env = {};
        envContent.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                if (key && valueParts.length > 0) {
                    env[key.trim()] = valueParts.join('=').trim();
                }
            }
        });
        return env;
    } catch (error) {
        console.error('Error loading .env file:', error.message);
        return {};
    }
}

const ENV = loadEnv();
const PORT = parseInt(ENV.PORT, 10) || 8080;
const ANALYTICS_FILE = path.join(__dirname, 'analytics.json');
const ALLOWED_ORIGIN = ENV.ALLOWED_ORIGIN || 'https://liandjd.com';

// Rate limiter: per-IP request counts
const rateLimitMap = new Map();
const RATE_LIMIT = 10;          // max requests per window
const RATE_WINDOW = 60 * 1000;  // 1 minute

function checkRateLimit(ip) {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now - entry.windowStart > RATE_WINDOW) {
        rateLimitMap.set(ip, { windowStart: now, count: 1 });
        return true;
    }
    entry.count++;
    return entry.count <= RATE_LIMIT;
}

// Clean up expired entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimitMap) {
        if (now - entry.windowStart > RATE_WINDOW) rateLimitMap.delete(ip);
    }
}, 5 * 60 * 1000);

function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

const MAX_BODY = 100 * 1024; // 100KB

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        let size = 0;
        req.on('data', chunk => {
            size += chunk.length;
            if (size > MAX_BODY) {
                req.destroy();
                reject(new Error('BODY_TOO_LARGE'));
            }
            body += chunk;
        });
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

// MIME types for static files
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.jpeg': 'image/jpeg'
};

// Whitelist: only serve files with allowed extensions
const ALLOWED_EXTENSIONS = new Set(['.html', '.css', '.js', '.json', '.png', '.jpg', '.jpeg', '.svg', '.ico']);
// Block specific filenames even if extension matches
const BLOCKED_FILES = new Set(['/server.js', '/analytics.json', '/package.json']);

// ============== Analytics System ==============

/**
 * Analytics data structure:
 * {
 *   summary: { totalUniqueUsers, totalAiUsage, totalPageViews },
 *   users: {
 *     [userId]: {
 *       firstVisit, lastVisit, pageViews, aiUsage,
 *       visits: [{ timestamp, type: 'page'|'ai', chapter?: string, book?: 'daxue'|'zhongyong'|'daodejing'|'mengzi'|'sushu'|'neijing' }]
 *     }
 *   }
 * }
 */

const VALID_BOOKS = new Set(['daxue', 'zhongyong', 'daodejing', 'mengzi', 'sushu', 'neijing']);
function normalizeBook(b) {
    return (typeof b === 'string' && VALID_BOOKS.has(b)) ? b : null;
}

function loadAnalytics() {
    try {
        if (fs.existsSync(ANALYTICS_FILE)) {
            const data = fs.readFileSync(ANALYTICS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading analytics:', error.message);
    }
    return {
        summary: {
            totalUniqueUsers: 0,
            totalAiUsage: 0,
            totalPageViews: 0
        },
        users: {}
    };
}

function saveAnalytics(analytics) {
    try {
        fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(analytics, null, 2));
    } catch (error) {
        console.error('Error saving analytics:', error.message);
    }
}

// In-memory analytics with periodic flush
let analyticsData = loadAnalytics();
let analyticsDirty = false;

setInterval(() => {
    if (analyticsDirty) {
        saveAnalytics(analyticsData);
        analyticsDirty = false;
    }
}, 30 * 1000);

function shutdown() {
    if (analyticsDirty) saveAnalytics(analyticsData);
    process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

function ensureUser(analytics, userId, now) {
    if (!analytics.users[userId]) {
        analytics.users[userId] = {
            firstVisit: now,
            lastVisit: now,
            pageViews: 0,
            aiUsage: 0,
            visits: []
        };
        analytics.summary.totalUniqueUsers++;
    }
    return analytics.users[userId];
}

function recordVisit(userId, type, chapter, book) {
    const analytics = analyticsData;
    const now = Date.now();
    const user = ensureUser(analytics, userId, now);
    user.lastVisit = now;
    if (type === 'page') {
        user.pageViews++;
        analytics.summary.totalPageViews++;
    } else {
        user.aiUsage++;
        analytics.summary.totalAiUsage++;
    }
    user.visits.push({ timestamp: now, type, chapter: chapter || null, book: normalizeBook(book) });
    if (user.visits.length > 100) user.visits = user.visits.slice(-100);
    analyticsDirty = true;
    return { success: true };
}

function trackPageView(userId, chapter = null, book = null) {
    return recordVisit(userId, 'page', chapter, book);
}

function trackAiUsage(userId, chapter = null, book = null) {
    return recordVisit(userId, 'ai', chapter, book);
}

// Get analytics summary
function getAnalyticsSummary() {
    const analytics = analyticsData;
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    
    // Calculate active users
    let dailyActiveUsers = 0;
    let weeklyActiveUsers = 0;
    let dailyPageViews = 0;
    let dailyAiUsage = 0;
    let weeklyPageViews = 0;
    let weeklyAiUsage = 0;
    
    const userStats = [];
    
    for (const [userId, user] of Object.entries(analytics.users)) {
        if (user.lastVisit >= oneDayAgo) {
            dailyActiveUsers++;
        }
        if (user.lastVisit >= oneWeekAgo) {
            weeklyActiveUsers++;
        }
        
        // Count recent activity
        for (const visit of user.visits) {
            if (visit.timestamp >= oneDayAgo) {
                if (visit.type === 'page') dailyPageViews++;
                if (visit.type === 'ai') dailyAiUsage++;
            }
            if (visit.timestamp >= oneWeekAgo) {
                if (visit.type === 'page') weeklyPageViews++;
                if (visit.type === 'ai') weeklyAiUsage++;
            }
        }
        
        // Calculate user frequency (visits per day since first visit)
        const daysSinceFirstVisit = Math.max(1, (now - user.firstVisit) / (24 * 60 * 60 * 1000));
        const pageFrequency = (user.pageViews / daysSinceFirstVisit).toFixed(2);
        const aiFrequency = (user.aiUsage / daysSinceFirstVisit).toFixed(2);
        
        userStats.push({
            userId: userId.substring(0, 8) + '...', // Truncate for privacy
            firstVisit: new Date(user.firstVisit).toISOString(),
            lastVisit: new Date(user.lastVisit).toISOString(),
            totalPageViews: user.pageViews,
            totalAiUsage: user.aiUsage,
            pageViewsPerDay: parseFloat(pageFrequency),
            aiUsagePerDay: parseFloat(aiFrequency)
        });
    }
    
    // Sort by last visit
    userStats.sort((a, b) => new Date(b.lastVisit) - new Date(a.lastVisit));
    
    return {
        overview: {
            totalUniqueUsers: analytics.summary.totalUniqueUsers,
            totalPageViews: analytics.summary.totalPageViews,
            totalAiUsage: analytics.summary.totalAiUsage,
            dailyActiveUsers,
            weeklyActiveUsers,
            dailyPageViews,
            dailyAiUsage,
            weeklyPageViews,
            weeklyAiUsage
        },
        users: userStats,
        generatedAt: new Date().toISOString()
    };
}

// ============== Aggregators for Dashboard v2 ==============

const SHANGHAI_TZ = 'Asia/Shanghai';
const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_GAP_MS = 30 * 60 * 1000;

function shanghaiDateKey(ts) {
    // 'sv-SE' locale yields ISO-like YYYY-MM-DD
    return new Date(ts).toLocaleDateString('sv-SE', { timeZone: SHANGHAI_TZ });
}

function shanghaiDowHour(ts) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: SHANGHAI_TZ,
        weekday: 'short', hour: '2-digit', hour12: false
    }).formatToParts(new Date(ts));
    const wk = parts.find(p => p.type === 'weekday').value;
    const hr = parseInt(parts.find(p => p.type === 'hour').value, 10);
    // Mon=0 ... Sun=6 (Chinese convention)
    const dow = ({ Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 })[wk];
    return { dow, hour: hr };
}

// Heuristic book inference for visits recorded before the `book` field was added
function inferBookFromChapter(chapter, storedBook) {
    if (storedBook && VALID_BOOKS.has(storedBook)) return storedBook;
    if (!chapter) return null;
    // Daxue: 经X章 / 传X章 / 朱子补传 — unique prefixes
    if (/^经.{1,3}章$/.test(chapter) || /^传.{1,3}章$/.test(chapter) || chapter === '朱子补传') {
        return 'daxue';
    }
    // Mengzi: section names like 梁惠王上·1 / 公孙丑下
    if (/^(梁惠王|公孙丑|滕文公|离娄|万章|告子|尽心)[上下]/.test(chapter)) {
        return 'mengzi';
    }
    // Sushu: six named chapters unique to this book
    if (/^(原始|正道|求人之志|本德宗道|遵义|安礼)章$/.test(chapter)) {
        return 'sushu';
    }
    // Neijing: 篇名含 "论"/"篇" 且以数字结尾，或直接以 "第N" 结尾（不带 "章"）。
    // 例："上古天真论篇第一" "阴阳应象大论第五" "五藏生成篇十" "本神第八"
    if (/(论|篇).*[〇零一二三四五六七八九十百]+$/.test(chapter) ||
        /第[〇零一二三四五六七八九十百]+$/.test(chapter)) {
        return 'neijing';
    }
    // 第N章 where 34 <= N <= 81 is exclusively daodejing
    const m = chapter.match(/^第(.+?)章$/);
    if (m) {
        const n = chineseNumeralToInt(m[1]);
        if (n >= 34 && n <= 81) return 'daodejing';
    }
    return 'unknown';
}

// Convert Chinese numeric strings like "三十四", "一", "八十一" to int.
// Handles the ranges used by these books (1-81). Returns NaN on failure.
function chineseNumeralToInt(s) {
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    const digits = { '〇':0,'零':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9 };
    if (s.length === 1) return digits[s] ?? NaN;
    if (s === '十') return 10;
    // X十 = X*10
    if (/^[一二三四五六七八九]十$/.test(s)) return digits[s[0]] * 10;
    // 十X = 10 + X
    if (/^十[一二三四五六七八九]$/.test(s)) return 10 + digits[s[1]];
    // X十Y = X*10 + Y
    if (/^[一二三四五六七八九]十[一二三四五六七八九]$/.test(s)) return digits[s[0]] * 10 + digits[s[2]];
    return NaN;
}

function classifySegment(pv) {
    if (pv <= 1) return 'oneAndDone';
    if (pv <= 9) return 'light';
    if (pv <= 49) return 'medium';
    return 'heavy';
}

// Reconstruct sessions for a single user's visits (ascending by timestamp)
function reconstructSessions(visits) {
    if (!visits.length) return [];
    const sorted = visits.slice().sort((a, b) => a.timestamp - b.timestamp);
    const sessions = [];
    let cur = null;
    for (const v of sorted) {
        if (!cur || v.timestamp - cur.end > SESSION_GAP_MS) {
            if (cur) sessions.push(cur);
            cur = {
                start: v.timestamp,
                end: v.timestamp,
                actionCount: 0,
                pageViews: 0,
                aiUsage: 0,
                chapters: new Set(),
                books: new Set()
            };
        }
        cur.end = v.timestamp;
        cur.actionCount++;
        if (v.type === 'page') cur.pageViews++; else cur.aiUsage++;
        if (v.chapter) cur.chapters.add(v.chapter);
        const inferred = inferBookFromChapter(v.chapter, v.book);
        if (inferred && inferred !== 'unknown') cur.books.add(inferred);
    }
    if (cur) sessions.push(cur);
    return sessions;
}

function computeAggregates(analytics, now = Date.now()) {
    const users = analytics.users || {};
    const userEntries = Object.entries(users);

    const oneDayAgo = now - DAY_MS;
    const oneWeekAgo = now - 7 * DAY_MS;
    const thirtyDaysAgo = now - 30 * DAY_MS;

    // Pre-compute per-user session reconstruction (used in multiple sections)
    const perUserSessions = new Map();
    for (const [uid, u] of userEntries) {
        perUserSessions.set(uid, reconstructSessions(u.visits || []));
    }

    // --- Overview ---
    let dau = 0, wau = 0, mau = 0, newUsers7d = 0;
    for (const [, u] of userEntries) {
        if (u.lastVisit >= oneDayAgo) dau++;
        if (u.lastVisit >= oneWeekAgo) wau++;
        if (u.lastVisit >= thirtyDaysAgo) mau++;
        if (u.firstVisit >= oneWeekAgo) newUsers7d++;
    }
    const totalPV = analytics.summary?.totalPageViews || 0;
    const totalAI = analytics.summary?.totalAiUsage || 0;
    const aiPerPV = totalPV > 0 ? totalAI / totalPV : 0;

    // Avg session length across all multi-action sessions
    let multiSessionCount = 0, multiSessionTotalMin = 0, totalSessionCount = 0;
    for (const sessions of perUserSessions.values()) {
        totalSessionCount += sessions.length;
        for (const s of sessions) {
            if (s.actionCount > 1) {
                multiSessionCount++;
                multiSessionTotalMin += (s.end - s.start) / 60000;
            }
        }
    }
    const avgSessionMin = multiSessionCount > 0 ? multiSessionTotalMin / multiSessionCount : 0;
    const totalActions = Array.from(perUserSessions.values()).reduce((acc, ss) => acc + ss.reduce((a, s) => a + s.actionCount, 0), 0);
    const avgActionsPerSession = totalSessionCount > 0 ? totalActions / totalSessionCount : 0;

    // --- Timeseries: past 30 days daily ---
    const daily = new Map();
    // Pre-fill 30 days (Shanghai tz) with zero counts for a dense chart
    for (let i = 29; i >= 0; i--) {
        const key = shanghaiDateKey(now - i * DAY_MS);
        daily.set(key, { date: key, pv: 0, ai: 0, userSet: new Set() });
    }
    const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const [uid, u] of userEntries) {
        for (const v of u.visits || []) {
            if (v.timestamp >= thirtyDaysAgo) {
                const key = shanghaiDateKey(v.timestamp);
                const bucket = daily.get(key);
                if (bucket) {
                    if (v.type === 'page') bucket.pv++; else bucket.ai++;
                    bucket.userSet.add(uid);
                }
            }
            const { dow, hour } = shanghaiDowHour(v.timestamp);
            if (dow != null && hour != null) heatmap[dow][hour]++;
        }
    }
    const timeseriesDaily = Array.from(daily.values()).map(d => ({
        date: d.date, pv: d.pv, ai: d.ai, activeUsers: d.userSet.size
    }));

    // --- Chapters & Books ---
    const chapterAll = new Map();        // key = chapter|book
    const chapterLast30 = new Map();
    let introAll = 0, introLast30 = 0;
    let introAllAi = 0, introLast30Ai = 0;
    const bookTotals = {
        daxue: { pv: 0, ai: 0, chapters: new Map() },
        zhongyong: { pv: 0, ai: 0, chapters: new Map() },
        daodejing: { pv: 0, ai: 0, chapters: new Map() },
        mengzi: { pv: 0, ai: 0, chapters: new Map() },
        sushu: { pv: 0, ai: 0, chapters: new Map() },
        neijing: { pv: 0, ai: 0, chapters: new Map() },
        unknown: { pv: 0, ai: 0, chapters: new Map() }
    };
    for (const [, u] of userEntries) {
        for (const v of u.visits || []) {
            const inRange30 = v.timestamp >= thirtyDaysAgo;
            if (!v.chapter) {
                if (v.type === 'page') introAll++; else introAllAi++;
                if (inRange30) { if (v.type === 'page') introLast30++; else introLast30Ai++; }
                continue;
            }
            const book = inferBookFromChapter(v.chapter, v.book) || 'unknown';
            const key = v.chapter + '||' + book;
            const bump = (map) => {
                const cur = map.get(key) || { label: v.chapter, book, count: 0, aiCount: 0 };
                cur.count += v.type === 'page' ? 1 : 0;
                cur.aiCount += v.type === 'ai' ? 1 : 0;
                map.set(key, cur);
            };
            bump(chapterAll);
            if (inRange30) bump(chapterLast30);
            const bkey = bookTotals[book] ? book : 'unknown';
            if (v.type === 'page') bookTotals[bkey].pv++; else bookTotals[bkey].ai++;
            const bCh = bookTotals[bkey].chapters;
            const cur = bCh.get(v.chapter) || { label: v.chapter, count: 0, aiCount: 0 };
            if (v.type === 'page') cur.count++; else cur.aiCount++;
            bCh.set(v.chapter, cur);
        }
    }
    const topSort = (m, n) =>
        Array.from(m.values())
            .sort((a, b) => (b.count + b.aiCount) - (a.count + a.aiCount))
            .slice(0, n);
    const bookTotalPV = Object.values(bookTotals).reduce((a, b) => a + b.pv, 0) || 1;
    const books = {};
    for (const [k, v] of Object.entries(bookTotals)) {
        books[k] = {
            pv: v.pv,
            ai: v.ai,
            pct: v.pv / bookTotalPV,
            topChapters: Array.from(v.chapters.values())
                .sort((a, b) => (b.count + b.aiCount) - (a.count + a.aiCount))
                .slice(0, 3)
        };
    }

    // --- Segments ---
    const segments = { oneAndDone: 0, light: 0, medium: 0, heavy: 0 };
    for (const [, u] of userEntries) segments[classifySegment(u.pageViews)]++;

    // --- Recent activity (last 50 events across all users) ---
    const allEvents = [];
    for (const [uid, u] of userEntries) {
        for (const v of u.visits || []) {
            allEvents.push({
                ts: v.timestamp,
                userId: uid,
                type: v.type,
                chapter: v.chapter,
                book: inferBookFromChapter(v.chapter, v.book)
            });
        }
    }
    allEvents.sort((a, b) => b.ts - a.ts);
    const recent = allEvents.slice(0, 50);

    // --- Per-user enriched list ---
    const usersList = userEntries.map(([uid, u]) => {
        const sessions = perUserSessions.get(uid) || [];
        const multi = sessions.filter(s => s.actionCount > 1);
        const avgSessionMinUser = multi.length > 0
            ? multi.reduce((a, s) => a + (s.end - s.start) / 60000, 0) / multi.length
            : 0;
        const daysSinceFirst = Math.max(1, (now - u.firstVisit) / DAY_MS);
        return {
            userId: uid,
            userIdShort: uid.substring(0, 10),
            firstVisit: u.firstVisit,
            lastVisit: u.lastVisit,
            totalPageViews: u.pageViews,
            totalAiUsage: u.aiUsage,
            pageViewsPerDay: +(u.pageViews / daysSinceFirst).toFixed(2),
            aiUsagePerDay: +(u.aiUsage / daysSinceFirst).toFixed(2),
            sessionCount: sessions.length,
            avgSessionMin: +avgSessionMinUser.toFixed(1),
            visitsWindow: (u.visits || []).length,
            segment: classifySegment(u.pageViews)
        };
    }).sort((a, b) => b.lastVisit - a.lastVisit);

    return {
        overview: {
            totalUsers: analytics.summary?.totalUniqueUsers || 0,
            totalPV,
            totalAI,
            dau, wau, mau,
            newUsers7d,
            aiPerPV: +aiPerPV.toFixed(3),
            avgSessionMin: +avgSessionMin.toFixed(1),
            avgActionsPerSession: +avgActionsPerSession.toFixed(1),
            totalSessions: totalSessionCount
        },
        timeseries: {
            daily: timeseriesDaily,
            hourHeatmap: heatmap
        },
        chapters: {
            topAll: topSort(chapterAll, 15),
            topLast30: topSort(chapterLast30, 15),
            introAll: { count: introAll, aiCount: introAllAi },
            introLast30: { count: introLast30, aiCount: introLast30Ai }
        },
        books,
        segments,
        recent,
        users: usersList,
        meta: {
            generatedAt: new Date().toISOString(),
            datasetSize: allEvents.length,
            userCount: userEntries.length
        }
    };
}

function buildUserTimeline(userId, analytics) {
    const u = analytics.users?.[userId];
    if (!u) return null;
    const sessions = reconstructSessions(u.visits || []).map(s => ({
        start: s.start,
        end: s.end,
        durationMin: +((s.end - s.start) / 60000).toFixed(1),
        actionCount: s.actionCount,
        pageViews: s.pageViews,
        aiUsage: s.aiUsage,
        chapters: Array.from(s.chapters),
        books: Array.from(s.books)
    }));
    const chapterMap = new Map();
    for (const v of u.visits || []) {
        if (!v.chapter) continue;
        const book = inferBookFromChapter(v.chapter, v.book) || 'unknown';
        const key = v.chapter + '||' + book;
        const cur = chapterMap.get(key) || { label: v.chapter, book, count: 0, aiCount: 0, lastSeen: 0 };
        if (v.type === 'page') cur.count++; else cur.aiCount++;
        if (v.timestamp > cur.lastSeen) cur.lastSeen = v.timestamp;
        chapterMap.set(key, cur);
    }
    const chaptersVisited = Array.from(chapterMap.values())
        .sort((a, b) => (b.count + b.aiCount) - (a.count + a.aiCount));
    return {
        userId,
        firstVisit: u.firstVisit,
        lastVisit: u.lastVisit,
        totalPageViews: u.pageViews,
        totalAiUsage: u.aiUsage,
        sessions,
        chaptersVisited,
        rawVisits: (u.visits || []).slice().sort((a, b) => b.timestamp - a.timestamp)
    };
}

// ============== End Aggregators ==============

// Handle analytics API requests
async function handleAnalyticsApi(req, res, urlPath) {
    // Read request body for POST
    let body = '';
    if (req.method === 'POST') {
        try {
            body = await readBody(req);
        } catch (err) {
            if (err.message === 'BODY_TOO_LARGE') {
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '请求体过大' }));
                return;
            }
            throw err;
        }
    }

    try {
        // POST /api/analytics/pageview - Track page view
        if (req.method === 'POST' && urlPath === '/api/analytics/pageview') {
            const data = JSON.parse(body);
            if (!data.userId || !/^[a-zA-Z0-9_]+$/.test(data.userId)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid userId' }));
                return;
            }
            const result = trackPageView(data.userId, data.chapter, data.book);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            return;
        }

        // POST /api/analytics/ai - Track AI usage
        if (req.method === 'POST' && urlPath === '/api/analytics/ai') {
            const data = JSON.parse(body);
            if (!data.userId || !/^[a-zA-Z0-9_]+$/.test(data.userId)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid userId' }));
                return;
            }
            const result = trackAiUsage(data.userId, data.chapter, data.book);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            return;
        }
        
        // Auth check for GET endpoints
        if (req.method === 'GET') {
            const url = new URL(req.url, 'http://localhost');
            const token = url.searchParams.get('token');
            if (!ENV.ANALYTICS_TOKEN || token !== ENV.ANALYTICS_TOKEN) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Unauthorized' }));
                return;
            }
        }

        // GET /api/analytics/summary - Get analytics dashboard
        if (req.method === 'GET' && urlPath === '/api/analytics/summary') {
            const summary = getAnalyticsSummary();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(summary, null, 2));
            return;
        }
        
        // GET /api/analytics/dashboard - HTML dashboard (v2)
        if (req.method === 'GET' && urlPath === '/api/analytics/dashboard') {
            const aggregates = computeAggregates(analyticsData);
            const html = generateDashboardHtml(aggregates);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
            return;
        }

        // GET /api/analytics/user?id=<userId> - Per-user drill-down
        if (req.method === 'GET' && urlPath === '/api/analytics/user') {
            const url = new URL(req.url, 'http://localhost');
            const id = url.searchParams.get('id');
            if (!id || !/^[a-zA-Z0-9_]+$/.test(id)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid id' }));
                return;
            }
            const timeline = buildUserTimeline(id, analyticsData);
            if (!timeline) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'User not found' }));
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(timeline));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        
    } catch (error) {
        console.error('Analytics API error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '服务器内部错误，请稍后重试' }));
    }
}

// Generate HTML dashboard
const BOOK_LABELS = {
    daxue: '大学',
    zhongyong: '中庸',
    daodejing: '道德经',
    mengzi: '孟子',
    sushu: '素书',
    neijing: '黄帝内经',
    unknown: '未分类'
};
const BOOK_COLORS = {
    daxue: '#8B2323',
    zhongyong: '#c4a35a',
    daodejing: '#3a6b7d',
    mengzi: '#5d7a3f',
    sushu: '#6b4a7a',
    neijing: '#a16b3a',
    unknown: '#999999'
};
const SEGMENT_LABELS = {
    oneAndDone: '仅一次',
    light: '轻度 (2-9)',
    medium: '中度 (10-49)',
    heavy: '重度 (50+)'
};
const SEGMENT_COLORS = {
    oneAndDone: '#cfcfcf',
    light: '#e0b97a',
    medium: '#c47a3a',
    heavy: '#8B2323'
};
const DOW_LABELS = ['周一','周二','周三','周四','周五','周六','周日'];

function fmtDate(ts) {
    return new Date(ts).toLocaleString('zh-CN', { timeZone: SHANGHAI_TZ, hour12: false });
}

function heatmapColor(value, max) {
    if (!max || value === 0) return '#f5f1e8';
    const intensity = Math.min(1, value / max);
    // Interpolate from cream to burgundy
    const r = Math.round(245 + (139 - 245) * intensity);
    const g = Math.round(241 + (35 - 241) * intensity);
    const b = Math.round(232 + (35 - 232) * intensity);
    return `rgb(${r},${g},${b})`;
}

function generateDashboardHtml(agg) {
    const ov = agg.overview;
    const smallSample = agg.meta.datasetSize < 20;
    const maxHour = Math.max(1, ...agg.timeseries.hourHeatmap.flat());
    const maxDaily = Math.max(1, ...agg.timeseries.daily.map(d => d.pv + d.ai));
    const totalSegUsers = Math.max(1, Object.values(agg.segments).reduce((a, b) => a + b, 0));
    const bookOrder = ['daxue', 'zhongyong', 'daodejing', 'mengzi', 'sushu', 'neijing', 'unknown'];

    const escapeJson = (obj) =>
        JSON.stringify(obj).replace(/</g, '\\u003c').replace(/-->/g, '--\\u003e');

    const dataBlob = escapeJson({
        daily: agg.timeseries.daily,
        heatmap: agg.timeseries.hourHeatmap,
        books: agg.books,
        segments: agg.segments
    });

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>阿莲读经典 · 数据面板 v2</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans SC', sans-serif;
    background: #faf7f0;
    color: #2d2d2d;
    padding: 16px;
    max-width: 1400px;
    margin: 0 auto;
}
h1 { color: #8B2323; font-size: 24px; }
h2 { color: #3a3a3a; font-size: 18px; margin: 0 0 12px; }
h3 { font-size: 13px; color: #6b6b6b; font-weight: 500; margin-bottom: 6px; }
.header-bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.header-bar .meta { font-size: 12px; color: #999; }
.btn { background: #8B2323; color: white; border: 0; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; }
.btn:hover { background: #6B1A1A; }
.banner { background: #fff5d6; border: 1px solid #e8c766; color: #7a5c00; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; }
.section { background: white; border-radius: 10px; padding: 16px 18px; margin-bottom: 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
.kpi { background: #fdfaf3; border: 1px solid #ede4d0; border-radius: 8px; padding: 12px 14px; }
.kpi .value { font-size: 24px; font-weight: 600; color: #8B2323; }
.kpi .sub { font-size: 11px; color: #999; margin-top: 2px; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 900px) { .two-col { grid-template-columns: 1fr; } }
.chart-box { height: 260px; }
.heatmap { display: grid; grid-template-columns: 40px repeat(24, 1fr); gap: 1px; font-size: 10px; }
.heatmap .label { color: #999; text-align: right; padding-right: 4px; line-height: 18px; }
.heatmap .cell { height: 18px; border-radius: 2px; position: relative; }
.heatmap .cell:hover { outline: 2px solid #8B2323; z-index: 1; }
.heatmap .hour-label { font-size: 9px; color: #999; text-align: center; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { background: #fdfaf3; color: #555; text-align: left; padding: 8px 10px; border-bottom: 2px solid #ede4d0; font-weight: 500; }
td { padding: 8px 10px; border-bottom: 1px solid #f0ebdc; }
tr.clickable { cursor: pointer; }
tr.clickable:hover { background: #fdfaf3; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; color: white; font-weight: 500; }
.stack-bar { display: flex; height: 28px; border-radius: 6px; overflow: hidden; background: #eee; }
.stack-bar .seg { display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: 500; min-width: 0; }
.legend { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; font-size: 12px; color: #555; }
.legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
.rank-list { list-style: none; }
.rank-list li { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f5f0e0; font-size: 13px; }
.rank-list li:last-child { border-bottom: 0; }
.rank-list .label { color: #333; flex: 1; }
.rank-list .count { color: #8B2323; font-weight: 500; margin-left: 12px; }
.rank-list .book-badge { font-size: 10px; padding: 1px 6px; border-radius: 8px; color: white; margin-right: 6px; vertical-align: middle; }
.book-card { padding: 10px 12px; border-radius: 8px; border-left: 4px solid; margin-bottom: 8px; background: #fdfaf3; }
.book-card .book-name { font-weight: 600; font-size: 14px; }
.book-card .stats { font-size: 12px; color: #666; margin: 4px 0; }
.book-card .chapters { font-size: 11px; color: #888; }
.event { display: grid; grid-template-columns: 140px 100px 50px 1fr 60px; gap: 8px; padding: 4px 0; font-size: 12px; border-bottom: 1px solid #f5f0e0; align-items: center; }
.event:last-child { border-bottom: 0; }
.event .time { color: #999; }
.event .uid { color: #666; font-family: monospace; font-size: 11px; }
.event .type-page { color: #3a6b7d; }
.event .type-ai { color: #8B2323; font-weight: 500; }
.event .chapter { color: #333; }
.drilldown { background: #fbf7ea; padding: 12px 16px; font-size: 12px; border-top: 1px dashed #d4c896; }
.drilldown .session-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; margin: 8px 0; }
.drilldown .session-card { background: white; border: 1px solid #e8dbb5; padding: 8px 10px; border-radius: 6px; font-size: 11px; }
.drilldown .chapter-chip { display: inline-block; background: #faf3e0; padding: 2px 8px; border-radius: 10px; margin: 2px; font-size: 11px; }
.visits-near-cap { color: #c47a3a; font-weight: 500; }
.footer { text-align: center; color: #999; font-size: 11px; margin: 20px 0; }
</style>
</head>
<body>
<div class="header-bar">
    <h1>阿莲读经典 · 数据面板 v2</h1>
    <div>
        <span class="meta">生成于 ${escapeHtml(fmtDate(Date.now()))}</span>
        <button class="btn" onclick="location.reload()">刷新</button>
    </div>
</div>

${smallSample ? `<div class="banner">样本量较小（仅 ${agg.meta.datasetSize} 条事件），以下趋势仅供参考。</div>` : ''}

<div class="section">
    <h2>📊 概览</h2>
    <div class="kpi-grid">
        <div class="kpi"><h3>总用户</h3><div class="value">${ov.totalUsers}</div></div>
        <div class="kpi"><h3>页面访问</h3><div class="value">${ov.totalPV}</div></div>
        <div class="kpi"><h3>AI 调用</h3><div class="value">${ov.totalAI}</div></div>
        <div class="kpi"><h3>日活 (DAU)</h3><div class="value">${ov.dau}</div><div class="sub">过去 24 小时</div></div>
        <div class="kpi"><h3>周活 (WAU)</h3><div class="value">${ov.wau}</div><div class="sub">过去 7 天</div></div>
        <div class="kpi"><h3>月活 (MAU)</h3><div class="value">${ov.mau}</div><div class="sub">过去 30 天</div></div>
        <div class="kpi"><h3>新用户</h3><div class="value">${ov.newUsers7d}</div><div class="sub">过去 7 天</div></div>
        <div class="kpi"><h3>AI / 页面</h3><div class="value">${(ov.aiPerPV * 100).toFixed(1)}%</div><div class="sub">AI 调用占比</div></div>
        <div class="kpi"><h3>平均会话</h3><div class="value">${ov.avgSessionMin}</div><div class="sub">分钟（&gt;1 动作）</div></div>
        <div class="kpi"><h3>总会话数</h3><div class="value">${ov.totalSessions}</div><div class="sub">30 分钟间隔</div></div>
        <div class="kpi"><h3>每会话动作</h3><div class="value">${ov.avgActionsPerSession}</div><div class="sub">平均</div></div>
    </div>
</div>

<div class="two-col">
    <div class="section">
        <h2>📈 过去 30 天每日活动</h2>
        <div class="chart-box"><canvas id="dailyChart"></canvas></div>
    </div>
    <div class="section">
        <h2>🕐 7×24 活动热力图</h2>
        <div class="heatmap">
            <div></div>
            ${Array.from({length: 24}, (_, h) => `<div class="hour-label">${h}</div>`).join('')}
            ${agg.timeseries.hourHeatmap.map((row, dow) => `
                <div class="label">${DOW_LABELS[dow]}</div>
                ${row.map((val, h) => `<div class="cell" style="background:${heatmapColor(val, maxHour)}" title="${DOW_LABELS[dow]} ${h}:00 · ${val} 次"></div>`).join('')}
            `).join('')}
        </div>
    </div>
</div>

<div class="two-col">
    <div class="section">
        <h2>📚 四书占比</h2>
        <div class="chart-box"><canvas id="bookChart"></canvas></div>
        <div>
            ${bookOrder.map(b => {
                const book = agg.books[b];
                if (!book || book.pv + book.ai === 0) return '';
                return `
                <div class="book-card" style="border-left-color:${BOOK_COLORS[b]}">
                    <div class="book-name" style="color:${BOOK_COLORS[b]}">${BOOK_LABELS[b]}</div>
                    <div class="stats">页面 ${book.pv} · AI ${book.ai} · 占比 ${(book.pct * 100).toFixed(1)}%</div>
                    ${book.topChapters.length ? `<div class="chapters">热门：${book.topChapters.map(c => `${escapeHtml(c.label)}(${c.count + c.aiCount})`).join(' · ')}</div>` : ''}
                </div>`;
            }).join('')}
        </div>
    </div>

    <div class="section">
        <h2>📖 章节排行榜</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div>
                <h3>全部时间 Top 15</h3>
                <ul class="rank-list">
                    ${agg.chapters.topAll.map(c => `
                        <li>
                            <span class="label">
                                <span class="book-badge" style="background:${BOOK_COLORS[c.book] || '#999'}">${BOOK_LABELS[c.book] || '未'}</span>
                                ${escapeHtml(c.label)}
                            </span>
                            <span class="count">${c.count}${c.aiCount ? ` <span style="color:#c47a3a">+${c.aiCount}AI</span>` : ''}</span>
                        </li>
                    `).join('') || '<li style="color:#999">暂无数据</li>'}
                </ul>
            </div>
            <div>
                <h3>过去 30 天 Top 15</h3>
                <ul class="rank-list">
                    ${agg.chapters.topLast30.map(c => `
                        <li>
                            <span class="label">
                                <span class="book-badge" style="background:${BOOK_COLORS[c.book] || '#999'}">${BOOK_LABELS[c.book] || '未'}</span>
                                ${escapeHtml(c.label)}
                            </span>
                            <span class="count">${c.count}${c.aiCount ? ` <span style="color:#c47a3a">+${c.aiCount}AI</span>` : ''}</span>
                        </li>
                    `).join('') || '<li style="color:#999">暂无数据</li>'}
                </ul>
            </div>
        </div>
        <div style="margin-top: 10px; padding: 8px 10px; background: #fdfaf3; border-radius: 6px; font-size: 12px; color: #666;">
            未进入章节（引导页）：全部 ${agg.chapters.introAll.count} 次（AI ${agg.chapters.introAll.aiCount}） · 30 天 ${agg.chapters.introLast30.count} 次
        </div>
    </div>
</div>

<div class="section">
    <h2>👥 用户分层</h2>
    <div class="stack-bar">
        ${['oneAndDone','light','medium','heavy'].map(seg => {
            const v = agg.segments[seg];
            if (v === 0) return '';
            const pct = (v / totalSegUsers) * 100;
            return `<div class="seg" style="background:${SEGMENT_COLORS[seg]}; flex: ${v}" title="${SEGMENT_LABELS[seg]}: ${v} 人">${pct > 8 ? v : ''}</div>`;
        }).join('')}
    </div>
    <div class="legend">
        ${['oneAndDone','light','medium','heavy'].map(seg =>
            `<span><span class="dot" style="background:${SEGMENT_COLORS[seg]}"></span>${SEGMENT_LABELS[seg]}: ${agg.segments[seg]}</span>`
        ).join('')}
    </div>
</div>

<div class="section">
    <h2>👤 用户详情（点击展开）</h2>
    <table>
        <thead>
            <tr>
                <th>UserID</th>
                <th>首次</th>
                <th>最近</th>
                <th>PV</th>
                <th>AI</th>
                <th>会话</th>
                <th>均时长 (分)</th>
                <th>分层</th>
                <th>缓冲</th>
            </tr>
        </thead>
        <tbody>
        ${agg.users.map(u => `
            <tr class="clickable" data-uid="${escapeHtml(u.userId)}" onclick="toggleUser(this)">
                <td><code>${escapeHtml(u.userIdShort)}</code></td>
                <td>${escapeHtml(fmtDate(u.firstVisit))}</td>
                <td>${escapeHtml(fmtDate(u.lastVisit))}</td>
                <td>${u.totalPageViews}</td>
                <td>${u.totalAiUsage}</td>
                <td>${u.sessionCount}</td>
                <td>${u.avgSessionMin}</td>
                <td><span class="badge" style="background:${SEGMENT_COLORS[u.segment]}">${SEGMENT_LABELS[u.segment]}</span></td>
                <td class="${u.visitsWindow >= 95 ? 'visits-near-cap' : ''}">${u.visitsWindow}/100</td>
            </tr>
        `).join('')}
        </tbody>
    </table>
</div>

<div class="section">
    <h2>📜 最近 50 条事件</h2>
    <div>
        ${agg.recent.map(e => `
            <div class="event">
                <span class="time">${escapeHtml(fmtDate(e.ts))}</span>
                <span class="uid">${escapeHtml((e.userId || '').substring(0, 10))}</span>
                <span class="type-${e.type}">${e.type === 'ai' ? 'AI' : '访问'}</span>
                <span class="chapter">${e.chapter ? escapeHtml(e.chapter) : '<i style="color:#bbb">引导页</i>'}</span>
                <span>${e.book ? `<span class="book-badge" style="background:${BOOK_COLORS[e.book]}">${BOOK_LABELS[e.book]}</span>` : ''}</span>
            </div>
        `).join('') || '<div style="color:#999">暂无事件</div>'}
    </div>
</div>

<div class="footer">
    数据说明：每用户最多保留 100 条最近访问记录；时区 Asia/Shanghai；会话间隔阈值 30 分钟。<br>
    数据集：${agg.meta.datasetSize} 条事件 · ${agg.meta.userCount} 位用户
</div>

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<script>
window.__DASH = ${dataBlob};
const TOKEN = new URLSearchParams(location.search).get('token') || '';

async function toggleUser(row) {
    const next = row.nextElementSibling;
    if (next && next.classList.contains('drilldown-row')) {
        next.remove();
        return;
    }
    const uid = row.dataset.uid;
    const tr = document.createElement('tr');
    tr.className = 'drilldown-row';
    tr.innerHTML = '<td colspan="9" class="drilldown">加载中…</td>';
    row.after(tr);
    try {
        const r = await fetch('/api/analytics/user?id=' + encodeURIComponent(uid) + '&token=' + encodeURIComponent(TOKEN));
        if (!r.ok) throw new Error('status ' + r.status);
        const t = await r.json();
        tr.querySelector('td').innerHTML = renderDrilldown(t);
    } catch (e) {
        tr.querySelector('td').innerHTML = '加载失败：' + (e.message || e);
    }
}

function renderDrilldown(t) {
    const fmt = ts => new Date(ts).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
    const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const sessions = t.sessions.slice().reverse().slice(0, 10);
    return \`
        <div><strong>\${esc(t.userId)}</strong> · 首次 \${fmt(t.firstVisit)} · 最近 \${fmt(t.lastVisit)}</div>
        <div style="margin-top:8px;font-size:11px;color:#666">最近 \${sessions.length} / 全部 \${t.sessions.length} 个会话：</div>
        <div class="session-list">
            \${sessions.map(s => \`
                <div class="session-card">
                    <div style="color:#666">\${fmt(s.start)}</div>
                    <div>\${s.durationMin} 分钟 · \${s.actionCount} 动作（PV \${s.pageViews} / AI \${s.aiUsage}）</div>
                    <div style="margin-top:4px">\${s.chapters.length ? s.chapters.map(c => '<span class="chapter-chip">' + esc(c) + '</span>').join('') : '<i style="color:#bbb">仅引导页</i>'}</div>
                </div>
            \`).join('')}
        </div>
        <div style="margin-top:8px;font-size:11px;color:#666">浏览过的章节（\${t.chaptersVisited.length}）：</div>
        <div>\${t.chaptersVisited.map(c => '<span class="chapter-chip">' + esc(c.label) + ' (' + (c.count + c.aiCount) + ')</span>').join('') || '<i style="color:#bbb">无</i>'}</div>
    \`;
}

// Chart.js rendering (graceful if CDN blocked)
if (typeof Chart !== 'undefined') {
    const daily = window.__DASH.daily;
    new Chart(document.getElementById('dailyChart'), {
        type: 'bar',
        data: {
            labels: daily.map(d => d.date.slice(5)),
            datasets: [
                { label: '页面访问', data: daily.map(d => d.pv), backgroundColor: '#8B2323', stack: 'a' },
                { label: 'AI 调用', data: daily.map(d => d.ai), backgroundColor: '#c4a35a', stack: 'a' },
                { label: '活跃用户', data: daily.map(d => d.activeUsers), type: 'line', borderColor: '#3a6b7d', backgroundColor: 'transparent', yAxisID: 'y1', tension: 0.3 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
            scales: {
                x: { stacked: true, ticks: { font: { size: 10 } } },
                y: { stacked: true, beginAtZero: true, title: { display: true, text: '事件数' } },
                y1: { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: '活跃用户' } }
            }
        }
    });

    const bookKeys = ['daxue','zhongyong','daodejing','mengzi','sushu','neijing','unknown'];
    const bookLabels = {daxue:'大学',zhongyong:'中庸',daodejing:'道德经',mengzi:'孟子',sushu:'素书',neijing:'黄帝内经',unknown:'未分类'};
    const bookColors = {daxue:'#8B2323',zhongyong:'#c4a35a',daodejing:'#3a6b7d',mengzi:'#5d7a3f',sushu:'#6b4a7a',neijing:'#a16b3a',unknown:'#999999'};
    const bookData = bookKeys.map(k => (window.__DASH.books[k] && window.__DASH.books[k].pv) || 0);
    new Chart(document.getElementById('bookChart'), {
        type: 'doughnut',
        data: {
            labels: bookKeys.map(k => bookLabels[k]),
            datasets: [{ data: bookData, backgroundColor: bookKeys.map(k => bookColors[k]) }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } }
        }
    });
}
</script>
</body>
</html>`;
}

// ============== End Analytics System ==============

// Serve static files
function serveStatic(req, res) {
    let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    
    // Security: prevent directory traversal
    filePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    
    const fullPath = path.join(__dirname, filePath);
    const ext = path.extname(fullPath).toLowerCase();

    // Whitelist check: only serve allowed extensions and non-blocked files
    if (!ALLOWED_EXTENSIONS.has(ext) || BLOCKED_FILES.has(filePath)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }
    
    fs.readFile(fullPath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Server Error');
            }
            return;
        }
        
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

// Handle API proxy request
async function handleApiProxy(req, res) {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
    if (!checkRateLimit(clientIp)) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '请求过于频繁，请稍后再试' }));
        return;
    }

    // Read request body
    let body;
    try {
        body = await readBody(req);
    } catch (err) {
        if (err.message === 'BODY_TOO_LARGE') {
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '请求体过大' }));
            return;
        }
        throw err;
    }

    try {
        const requestData = JSON.parse(body);
        const apiKey = ENV.GEMINI_API_KEY;
        const model = ENV.GEMINI_MODEL || 'gemini-3-flash-preview';
        
        if (!apiKey) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'API key not configured' }));
            return;
        }
        
        // Make request to Gemini API
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });
        
        const data = await response.json();
        
        res.writeHead(response.status, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': ALLOWED_ORIGIN
        });
        res.end(JSON.stringify(data));
        
    } catch (error) {
        console.error('API proxy error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '服务器内部错误，请稍后重试' }));
    }
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
    const urlPath = req.url.split('?')[0];
    
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }
    
    // Route: Analytics API
    if (urlPath.startsWith('/api/analytics')) {
        await handleAnalyticsApi(req, res, urlPath);
        return;
    }
    
    // Route: AI interpretation API proxy
    if (req.method === 'POST' && urlPath === '/api/interpret') {
        await handleApiProxy(req, res);
        return;
    }
    
    // Route: Static files
    if (req.method === 'GET') {
        serveStatic(req, res);
        return;
    }
    
    // 404 for other routes
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                    阿莲读经典 - 服务器启动                    ║
╠════════════════════════════════════════════════════════════╣
║  地址: http://localhost:${PORT}                              ║
║  数据面板: http://localhost:${PORT}/api/analytics/dashboard   ║
║  API Key: ${ENV.GEMINI_API_KEY ? '已配置 ✓' : '未配置 ✗'}                               ║
║  模型: ${ENV.GEMINI_MODEL || 'gemini-3-flash-preview'}                        ║
╚════════════════════════════════════════════════════════════╝
    `);
});
