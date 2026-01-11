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
const PORT = 8080;
const ANALYTICS_FILE = path.join(__dirname, 'analytics.json');

// MIME types for static files
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// ============== Analytics System ==============

/**
 * Analytics data structure:
 * {
 *   summary: {
 *     totalUniqueUsers: number,
 *     totalAiUsage: number,
 *     totalPageViews: number
 *   },
 *   users: {
 *     [userId]: {
 *       firstVisit: timestamp,
 *       lastVisit: timestamp,
 *       pageViews: number,
 *       aiUsage: number,
 *       visits: [{ timestamp, type: 'page'|'ai', chapter?: string }]
 *     }
 *   }
 * }
 */

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

// Track page view event
function trackPageView(userId, chapter = null) {
    const analytics = loadAnalytics();
    const now = Date.now();
    
    // Initialize user if new
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
    
    // Update user data
    const user = analytics.users[userId];
    user.lastVisit = now;
    user.pageViews++;
    user.visits.push({
        timestamp: now,
        type: 'page',
        chapter: chapter
    });
    
    // Keep only last 100 visits per user to limit file size
    if (user.visits.length > 100) {
        user.visits = user.visits.slice(-100);
    }
    
    analytics.summary.totalPageViews++;
    
    saveAnalytics(analytics);
    return { success: true };
}

// Track AI usage event
function trackAiUsage(userId, chapter = null) {
    const analytics = loadAnalytics();
    const now = Date.now();
    
    // Initialize user if new
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
    
    // Update user data
    const user = analytics.users[userId];
    user.lastVisit = now;
    user.aiUsage++;
    user.visits.push({
        timestamp: now,
        type: 'ai',
        chapter: chapter
    });
    
    // Keep only last 100 visits per user
    if (user.visits.length > 100) {
        user.visits = user.visits.slice(-100);
    }
    
    analytics.summary.totalAiUsage++;
    
    saveAnalytics(analytics);
    return { success: true };
}

// Get analytics summary
function getAnalyticsSummary() {
    const analytics = loadAnalytics();
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

// Handle analytics API requests
async function handleAnalyticsApi(req, res, urlPath) {
    // Read request body for POST
    let body = '';
    if (req.method === 'POST') {
        for await (const chunk of req) {
            body += chunk;
        }
    }
    
    try {
        // POST /api/analytics/pageview - Track page view
        if (req.method === 'POST' && urlPath === '/api/analytics/pageview') {
            const data = JSON.parse(body);
            const result = trackPageView(data.userId, data.chapter);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            return;
        }
        
        // POST /api/analytics/ai - Track AI usage
        if (req.method === 'POST' && urlPath === '/api/analytics/ai') {
            const data = JSON.parse(body);
            const result = trackAiUsage(data.userId, data.chapter);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            return;
        }
        
        // GET /api/analytics/summary - Get analytics dashboard
        if (req.method === 'GET' && urlPath === '/api/analytics/summary') {
            const summary = getAnalyticsSummary();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(summary, null, 2));
            return;
        }
        
        // GET /api/analytics/dashboard - HTML dashboard
        if (req.method === 'GET' && urlPath === '/api/analytics/dashboard') {
            const summary = getAnalyticsSummary();
            const html = generateDashboardHtml(summary);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
            return;
        }
        
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        
    } catch (error) {
        console.error('Analytics API error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
    }
}

// Generate HTML dashboard
function generateDashboardHtml(summary) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>阿莲读经典 - 数据分析面板</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5; 
            padding: 20px;
            color: #333;
        }
        h1 { 
            color: #8B2323; 
            margin-bottom: 20px;
            text-align: center;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 30px;
        }
        .card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .card h3 {
            font-size: 14px;
            color: #666;
            margin-bottom: 8px;
        }
        .card .value {
            font-size: 32px;
            font-weight: bold;
            color: #8B2323;
        }
        .card .sub {
            font-size: 12px;
            color: #999;
            margin-top: 4px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        th, td {
            padding: 12px 16px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }
        th {
            background: #8B2323;
            color: white;
            font-weight: 500;
        }
        tr:hover { background: #f9f9f9; }
        .refresh {
            display: block;
            margin: 20px auto;
            padding: 12px 24px;
            background: #8B2323;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
        }
        .refresh:hover { background: #6B1A1A; }
        .timestamp {
            text-align: center;
            color: #999;
            font-size: 12px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <h1>阿莲读经典 - 数据分析面板</h1>
    
    <div class="grid">
        <div class="card">
            <h3>总用户数（去重）</h3>
            <div class="value">${summary.overview.totalUniqueUsers}</div>
        </div>
        <div class="card">
            <h3>总 AI 使用次数</h3>
            <div class="value">${summary.overview.totalAiUsage}</div>
        </div>
        <div class="card">
            <h3>总页面访问次数</h3>
            <div class="value">${summary.overview.totalPageViews}</div>
        </div>
        <div class="card">
            <h3>日活用户</h3>
            <div class="value">${summary.overview.dailyActiveUsers}</div>
            <div class="sub">过去24小时</div>
        </div>
        <div class="card">
            <h3>周活用户</h3>
            <div class="value">${summary.overview.weeklyActiveUsers}</div>
            <div class="sub">过去7天</div>
        </div>
        <div class="card">
            <h3>今日 AI 使用</h3>
            <div class="value">${summary.overview.dailyAiUsage}</div>
            <div class="sub">过去24小时</div>
        </div>
    </div>
    
    <h2 style="margin-bottom: 16px; color: #333;">用户详情</h2>
    <table>
        <thead>
            <tr>
                <th>用户ID</th>
                <th>首次访问</th>
                <th>最后访问</th>
                <th>页面访问</th>
                <th>AI使用</th>
                <th>页面频率/天</th>
                <th>AI频率/天</th>
            </tr>
        </thead>
        <tbody>
            ${summary.users.map(u => `
                <tr>
                    <td>${u.userId}</td>
                    <td>${new Date(u.firstVisit).toLocaleString('zh-CN')}</td>
                    <td>${new Date(u.lastVisit).toLocaleString('zh-CN')}</td>
                    <td>${u.totalPageViews}</td>
                    <td>${u.totalAiUsage}</td>
                    <td>${u.pageViewsPerDay}</td>
                    <td>${u.aiUsagePerDay}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    
    <button class="refresh" onclick="location.reload()">刷新数据</button>
    <p class="timestamp">数据生成时间: ${new Date(summary.generatedAt).toLocaleString('zh-CN')}</p>
</body>
</html>`;
}

// ============== End Analytics System ==============

// Serve static files
function serveStatic(req, res) {
    let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    
    // Security: prevent directory traversal
    filePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    
    // Don't serve sensitive files
    if (filePath.includes('.env') || filePath.includes('analytics.json')) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }
    
    const fullPath = path.join(__dirname, filePath);
    const ext = path.extname(fullPath).toLowerCase();
    
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
    // Read request body
    let body = '';
    for await (const chunk of req) {
        body += chunk;
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
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(data));
        
    } catch (error) {
        console.error('API proxy error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
    }
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
    const urlPath = req.url.split('?')[0];
    
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
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
