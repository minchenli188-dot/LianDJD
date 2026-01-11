/**
 * 阿莲读经典 - Parent Learning Platform
 * Main Application JavaScript
 */

// Application State
const AppState = {
    chapters: [],
    currentChapter: null,
    currentParagraph: null,
    isLoading: false,
    userId: null
};

// DOM Elements
let DOM = {};

// View state: 'intro' or 'chapter'
let currentView = 'intro';

// ============== Analytics System ==============

/**
 * Generate or retrieve unique user ID
 */
function getUserId() {
    let userId = localStorage.getItem('liandjd_user_id');
    if (!userId) {
        // Generate a unique ID: timestamp + random string
        userId = 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('liandjd_user_id', userId);
    }
    return userId;
}

/**
 * Track page view event
 */
async function trackPageView(chapter = null) {
    try {
        await fetch('/api/analytics/pageview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: AppState.userId,
                chapter: chapter
            })
        });
    } catch (error) {
        // Silent fail - don't disrupt user experience
        console.debug('Analytics pageview error:', error);
    }
}

/**
 * Track AI usage event
 */
async function trackAiUsage(chapter = null) {
    try {
        await fetch('/api/analytics/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: AppState.userId,
                chapter: chapter
            })
        });
    } catch (error) {
        // Silent fail - don't disrupt user experience
        console.debug('Analytics AI usage error:', error);
    }
}

// ============== End Analytics System ==============

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', init);

async function init() {
    // Initialize user ID for analytics
    AppState.userId = getUserId();
    
    // Get DOM references
    DOM = {
        // Sidebars
        sidebarLeft: document.getElementById('sidebarLeft'),
        sidebarRight: document.getElementById('sidebarRight'),
        overlay: document.getElementById('overlay'),
        
        // Buttons
        menuBtn: document.getElementById('menuBtn'),
        aiBtn: document.getElementById('aiBtn'),
        closeMenuBtn: document.getElementById('closeMenuBtn'),
        closeAiBtn: document.getElementById('closeAiBtn'),
        retryBtn: document.getElementById('retryBtn'),
        
        // Content Views
        introPage: document.getElementById('introPage'),
        chapterContent: document.getElementById('chapterContent'),
        
        // Sidebar Header (book title)
        sidebarHeader: document.querySelector('.sidebar-left .sidebar-header h2'),
        
        // Chapter Content
        chapterNav: document.getElementById('chapterNav'),
        chapterTitle: document.getElementById('chapterTitle'),
        chapterSubtitle: document.getElementById('chapterSubtitle'),
        textContent: document.getElementById('textContent'),
        
        // AI Panel
        aiWelcome: document.getElementById('aiWelcome'),
        aiLoading: document.getElementById('aiLoading'),
        aiResponse: document.getElementById('aiResponse'),
        aiError: document.getElementById('aiError'),
        selectedText: document.getElementById('selectedText'),
        explanationContent: document.getElementById('explanationContent'),
        principleContent: document.getElementById('principleContent'),
        positiveCaseContent: document.getElementById('positiveCaseContent'),
        negativeCaseContent: document.getElementById('negativeCaseContent'),
        errorMessage: document.getElementById('errorMessage')
    };
    
    // Setup event listeners
    setupEventListeners();
    
    // Check if AI button was clicked before (restore static state)
    checkAiButtonState();
    
    // Track initial page view
    trackPageView();
    
    // Load data and render
    try {
        await loadData();
        renderChapterNav();
        // Show intro page by default (don't auto-select first chapter)
        showIntroPage();
    } catch (error) {
        console.error('Init error:', error);
    }
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Mobile sidebar toggles
    DOM.menuBtn?.addEventListener('click', openMenu);
    DOM.aiBtn?.addEventListener('click', openAiPanel);
    DOM.closeMenuBtn?.addEventListener('click', closeMenu);
    DOM.closeAiBtn?.addEventListener('click', closeAiPanel);
    DOM.overlay?.addEventListener('click', closeAllSidebars);
    DOM.retryBtn?.addEventListener('click', retryAiRequest);
    
    // Click on book title to show intro page
    DOM.sidebarHeader?.addEventListener('click', showIntroPage);
}

function openMenu() {
    DOM.sidebarLeft?.classList.add('open');
    DOM.overlay?.classList.add('active');
}

function closeMenu() {
    DOM.sidebarLeft?.classList.remove('open');
    DOM.overlay?.classList.remove('active');
}

function openAiPanel() {
    DOM.sidebarRight?.classList.add('open');
    DOM.overlay?.classList.add('active');
    
    // Mark AI button as clicked (stop animation)
    markAiButtonClicked();
}

/**
 * Mark AI button as clicked and persist state
 */
function markAiButtonClicked() {
    if (!localStorage.getItem('liandjd_ai_btn_clicked')) {
        localStorage.setItem('liandjd_ai_btn_clicked', 'true');
    }
    DOM.aiBtn?.classList.add('clicked');
}

/**
 * Check if AI button was clicked before and apply static style
 */
function checkAiButtonState() {
    if (localStorage.getItem('liandjd_ai_btn_clicked')) {
        DOM.aiBtn?.classList.add('clicked');
    }
}

function closeAiPanel() {
    DOM.sidebarRight?.classList.remove('open');
    DOM.overlay?.classList.remove('active');
}

function closeAllSidebars() {
    DOM.sidebarLeft?.classList.remove('open');
    DOM.sidebarRight?.classList.remove('open');
    DOM.overlay?.classList.remove('active');
}

function retryAiRequest() {
    if (AppState.currentParagraph) {
        getAIInterpretation(AppState.currentParagraph);
    }
}

/**
 * Show the book introduction page
 */
function showIntroPage() {
    currentView = 'intro';
    
    // Show intro, hide chapter content
    if (DOM.introPage) DOM.introPage.style.display = 'block';
    if (DOM.chapterContent) DOM.chapterContent.style.display = 'none';
    
    // Clear active state from nav items
    DOM.chapterNav?.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Reset AI panel
    showAiWelcome();
    
    // Close sidebar on mobile
    if (window.innerWidth < 1024) {
        closeMenu();
    }
}

/**
 * Show chapter content (hide intro page)
 */
function showChapterContent() {
    currentView = 'chapter';
    
    // Hide intro, show chapter content
    if (DOM.introPage) DOM.introPage.style.display = 'none';
    if (DOM.chapterContent) DOM.chapterContent.style.display = 'block';
}

/**
 * Load and organize data from JSON
 */
async function loadData() {
    const response = await fetch('data.json');
    const data = await response.json();
    
    // Chapter definitions with proper ordering
    const chapterDefs = [
        { key: '经一章', name: '经一章', subtitle: '三纲领（明明德、亲民、止于至善）、八条目（格致诚正、修齐治平）', category: '经' },
        { key: '传一章', name: '传一章', subtitle: '释明明德', category: '传' },
        { key: '传二章', name: '传二章', subtitle: '释新民', category: '传' },
        { key: '传三章', name: '传三章', subtitle: '释止于至善', category: '传' },
        { key: '传四章', name: '传四章', subtitle: '释本末', category: '传' },
        { key: '传五章', name: '传五章', subtitle: '释格物致知', category: '传' },
        { key: '朱子补传', name: '朱子补传', subtitle: '补格物致知', category: '传', isSubEntry: true, parentKey: '传五章' },
        { key: '传六章', name: '传六章', subtitle: '释诚意', category: '传' },
        { key: '传七章', name: '传七章', subtitle: '释正心修身', category: '传' },
        { key: '传八章', name: '传八章', subtitle: '释修身齐家', category: '传' },
        { key: '传九章', name: '传九章', subtitle: '释齐家治国', category: '传' },
        { key: '传十章', name: '传十章', subtitle: '释治国平天下', category: '传' }
    ];
    
    // Create chapter map
    const chapterMap = new Map();
    chapterDefs.forEach(def => {
        chapterMap.set(def.key, {
            ...def,
            paragraphs: []
        });
    });
    
    // Map data to chapters
    data.forEach(item => {
        const chapterKey = mapToChapter(item.section);
        if (chapterMap.has(chapterKey)) {
            chapterMap.get(chapterKey).paragraphs.push({
                id: item.id,
                content: item.content,
                section: item.section
            });
        }
    });
    
    // Filter empty chapters
    AppState.chapters = Array.from(chapterMap.values())
        .filter(ch => ch.paragraphs.length > 0);
}

/**
 * Map section names to chapter keys
 */
function mapToChapter(section) {
    if (section === '经一章') return '经一章';
    if (section === '朱子补传') return '朱子补传';
    
    const mapping = {
        '传十章 - 第一章': '传一章',
        '传十章 - 第二章': '传二章',
        '传十章 - 第三章': '传三章',
        '传十章 - 第四章': '传四章',
        '传十章 - 第五章': '传五章',
        '传十章 - 第六章': '传六章',
        '传十章 - 第七章': '传七章',
        '传十章 - 第八章': '传八章',
        '传十章 - 第九章': '传九章',
        '传十章 - 第十章': '传十章'
    };
    
    return mapping[section] || section;
}

/**
 * Render chapter navigation with structured sections
 */
function renderChapterNav() {
    if (!DOM.chapterNav) return;
    
    // Group chapters by category
    const jingChapters = AppState.chapters.filter(ch => ch.category === '经');
    const chuanChapters = AppState.chapters.filter(ch => ch.category === '传');
    
    let html = '';
    
    // Render 【经】section
    if (jingChapters.length > 0) {
        html += `
            <div class="nav-section">
                <div class="nav-section-header">【经】（总纲）</div>
                <ul class="nav-section-list">
                    ${jingChapters.map(ch => `
                        <li class="nav-item" data-chapter="${ch.key}">
                            <span class="nav-item-name">${ch.name}：</span>
                            <span class="nav-item-desc">${ch.subtitle}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }
    
    // Render 【传】section
    if (chuanChapters.length > 0) {
        html += `
            <div class="nav-section">
                <div class="nav-section-header">【传】（释义）</div>
                <ul class="nav-section-list">
                    ${chuanChapters.map(ch => `
                        <li class="nav-item ${ch.isSubEntry ? 'sub-entry' : ''}" data-chapter="${ch.key}">
                            <span class="nav-item-name">${ch.name}：</span>
                            <span class="nav-item-desc">${ch.subtitle}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }
    
    DOM.chapterNav.innerHTML = html;
    
    // Add click handlers
    DOM.chapterNav.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            selectChapter(item.dataset.chapter);
            // Close sidebar on mobile
            if (window.innerWidth < 1024) {
                closeMenu();
            }
        });
    });
}

/**
 * Select and display a chapter
 */
function selectChapter(chapterKey) {
    const chapter = AppState.chapters.find(ch => ch.key === chapterKey);
    if (!chapter) return;
    
    AppState.currentChapter = chapter;
    
    // Switch to chapter view
    showChapterContent();
    
    // Track chapter view
    trackPageView(chapter.name);
    
    // Update navigation active state
    DOM.chapterNav?.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.chapter === chapterKey);
    });
    
    // Update header
    if (DOM.chapterTitle) DOM.chapterTitle.textContent = chapter.name;
    if (DOM.chapterSubtitle) DOM.chapterSubtitle.textContent = chapter.subtitle;
    
    // Render paragraphs (hidden by default, shown when user clicks)
    renderParagraphs(chapter.paragraphs);
    
    // Reset AI panel
    showAiWelcome();
}

/**
 * Render text paragraphs - displayed as a single text block
 */
function renderParagraphs(paragraphs) {
    if (!DOM.textContent) return;
    
    // Render paragraphs as clickable text segments without boxes
    DOM.textContent.innerHTML = paragraphs.map(p => `
        <span class="text-segment" data-id="${p.id}">${cleanContent(p.content)}</span>
    `).join('');
    
    // Add click handlers
    DOM.textContent.querySelectorAll('.text-segment').forEach(segment => {
        segment.addEventListener('click', () => selectParagraph(segment));
    });
}

/**
 * Clean paragraph content for display
 */
function cleanContent(content) {
    return content
        .replace(/《大学章句》全文\n?/g, '')
        .replace(/【[^】]+】\n?/g, '')
        .replace(/（[^）]+）\n?/g, '')
        .replace(/第[一二三四五六七八九十]+章\s*[^\n]*\n?/g, '')
        .trim();
}

/**
 * Select a paragraph and get AI interpretation
 */
function selectParagraph(element) {
    // Update selection UI
    DOM.textContent?.querySelectorAll('.text-segment').forEach(p => {
        p.classList.remove('selected');
    });
    element.classList.add('selected');
    
    // Get paragraph data
    const paraId = parseInt(element.dataset.id);
    const paragraph = AppState.currentChapter?.paragraphs.find(p => p.id === paraId);
    
    if (paragraph) {
        AppState.currentParagraph = paragraph;
        getAIInterpretation(paragraph);
        
        // Open AI panel on mobile
        if (window.innerWidth < 1024) {
            openAiPanel();
        }
    }
}

/**
 * AI Panel State Management
 */
function showAiWelcome() {
    if (DOM.aiWelcome) DOM.aiWelcome.style.display = 'block';
    if (DOM.aiLoading) DOM.aiLoading.style.display = 'none';
    if (DOM.aiResponse) DOM.aiResponse.style.display = 'none';
    if (DOM.aiError) DOM.aiError.style.display = 'none';
}

function showAiLoading() {
    if (DOM.aiWelcome) DOM.aiWelcome.style.display = 'none';
    if (DOM.aiLoading) DOM.aiLoading.style.display = 'block';
    if (DOM.aiResponse) DOM.aiResponse.style.display = 'none';
    if (DOM.aiError) DOM.aiError.style.display = 'none';
}

function showAiResponse(data) {
    if (DOM.aiWelcome) DOM.aiWelcome.style.display = 'none';
    if (DOM.aiLoading) DOM.aiLoading.style.display = 'none';
    if (DOM.aiResponse) DOM.aiResponse.style.display = 'block';
    if (DOM.aiError) DOM.aiError.style.display = 'none';
    
    // Populate content
    if (DOM.selectedText) DOM.selectedText.textContent = cleanContent(data.originalText);
    if (DOM.explanationContent) DOM.explanationContent.innerHTML = formatContent(data.explanation);
    if (DOM.principleContent) DOM.principleContent.innerHTML = formatContent(data.principle);
    if (DOM.positiveCaseContent) DOM.positiveCaseContent.innerHTML = formatContent(data.positiveCase);
    if (DOM.negativeCaseContent) DOM.negativeCaseContent.innerHTML = formatContent(data.negativeCase);
}

function showAiError(message) {
    if (DOM.aiWelcome) DOM.aiWelcome.style.display = 'none';
    if (DOM.aiLoading) DOM.aiLoading.style.display = 'none';
    if (DOM.aiResponse) DOM.aiResponse.style.display = 'none';
    if (DOM.aiError) DOM.aiError.style.display = 'block';
    if (DOM.errorMessage) DOM.errorMessage.textContent = message || '请求失败，请稍后重试';
}

function formatContent(text) {
    if (!text) return '<p>内容生成中...</p>';
    return text.split('\n').filter(l => l.trim()).map(l => `<p>${l}</p>`).join('');
}

/**
 * Get AI Interpretation from Backend API
 * API Key is securely stored on server side
 */
async function getAIInterpretation(paragraph) {
    if (AppState.isLoading) return;
    
    AppState.isLoading = true;
    showAiLoading();
    
    // Track AI usage
    trackAiUsage(AppState.currentChapter?.name);
    
    const text = cleanContent(paragraph.content);
    
    const prompt = `你是一位精通中国传统文化和家庭教育的智慧导师。请根据以下《大学》原文，为家长提供学习指导。

原文：
${text}

请严格按以下格式提供解读，每个部分都必须简洁精炼：

## 一、白话文解释
纯粹的现代汉语翻译，只翻译原文含义，不要任何解读、引申或额外信息。一段话即可。

## 二、家庭教育智慧
只写一段话。直接阐述这段经典与家庭教育的内在逻辑关系，重在推导而非说教。不要分点，不要列举。

## 三、普通家长案例
只写一段话。描述一个具体的、真实感强的日常场景，让读者感觉这是真实发生的事情。要有具体的情境（如：周末早上、放学后、饭桌上等），具体的对话或行为，具体的后果。用"有位妈妈"、"一个孩子"等泛称，不要用具体人名。场景要贴近生活，是普通家长容易犯的常见问题。

## 四、智慧家长案例
只写一段话。针对上面普通家长案例中的同一个具体场景，描述另一位家长如何运用这段经典的智慧做出不同的选择。要有同样具体的情境、对话或行为、以及积极的结果。让读者能清晰对比两种做法的差异。`;

    try {
        // Call our backend API (API key is stored securely on server)
        const response = await fetch('/api/interpret', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048
                }
            })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'API请求失败');
        }
        
        const data = await response.json();
        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!aiText) throw new Error('AI响应格式异常');
        
        const parsed = parseAIResponse(aiText);
        showAiResponse({
            originalText: paragraph.content,
            ...parsed
        });
        
    } catch (error) {
        console.error('AI Error:', error);
        showAiError(error.message);
    } finally {
        AppState.isLoading = false;
    }
}

/**
 * Parse AI response into sections
 */
function parseAIResponse(text) {
    const sections = {
        explanation: '',
        principle: '',
        positiveCase: '',
        negativeCase: ''
    };
    
    const patterns = [
        { key: 'explanation', regex: /(?:##?\s*)?(?:一、|1[.、])?白话文解释[：:\s]*/i },
        { key: 'principle', regex: /(?:##?\s*)?(?:二、|2[.、])?家庭教育智慧[：:\s]*/i },
        { key: 'negativeCase', regex: /(?:##?\s*)?(?:三、|3[.、])?普通家长案例[：:\s]*/i },
        { key: 'positiveCase', regex: /(?:##?\s*)?(?:四、|4[.、])?智慧家长案例[：:\s]*/i }
    ];
    
    let currentKey = '';
    let currentContent = '';
    
    text.split('\n').forEach(line => {
        let matched = false;
        for (const p of patterns) {
            if (p.regex.test(line)) {
                if (currentKey) sections[currentKey] = currentContent.trim();
                currentKey = p.key;
                currentContent = line.replace(p.regex, '') + '\n';
                matched = true;
                break;
            }
        }
        if (!matched && currentKey) {
            currentContent += line + '\n';
        }
    });
    
    if (currentKey) sections[currentKey] = currentContent.trim();
    
    // Clean markdown
    Object.keys(sections).forEach(key => {
        sections[key] = sections[key]
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/^#+\s*/gm, '')
            .trim();
    });
    
    return sections;
}
