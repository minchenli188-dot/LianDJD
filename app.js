/**
 * 阿莲读经典 - Parent Learning Platform
 * Main Application JavaScript
 */

// Application State
const AppState = {
    currentBook: 'daxue', // 'daxue' or 'zhongyong'
    chapters: [],
    currentChapter: null,
    currentParagraph: null,
    isLoading: false,
    userId: null
};

// Book Configurations
const BookConfig = {
    daxue: {
        key: 'daxue',
        name: '《大学》章句',
        shortName: '大学',
        dataFile: 'data.json',
        chapterDefs: [
            { key: '经一章', name: '经一章', subtitle: '三纲领·八条目', category: '经' },
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
        ],
        mapSection: function(section) {
            if (section === '经一章') return '经一章';
            if (section === '朱子补传') return '朱子补传';
            const mapping = {
                '传十章 - 第一章': '传一章', '传十章 - 第二章': '传二章',
                '传十章 - 第三章': '传三章', '传十章 - 第四章': '传四章',
                '传十章 - 第五章': '传五章', '传十章 - 第六章': '传六章',
                '传十章 - 第七章': '传七章', '传十章 - 第八章': '传八章',
                '传十章 - 第九章': '传九章', '传十章 - 第十章': '传十章'
            };
            return mapping[section] || section;
        },
        renderNav: function(chapters) {
            const jing = chapters.filter(ch => ch.category === '经');
            const chuan = chapters.filter(ch => ch.category === '传');
            let html = '';
            if (jing.length > 0) {
                html += `<div class="nav-section"><div class="nav-section-header">【经】（总纲）</div><ul class="nav-section-list">${jing.map(ch => `<li class="nav-item" data-chapter="${ch.key}"><span class="nav-item-name">${ch.name}：</span><span class="nav-item-desc">${ch.subtitle}</span></li>`).join('')}</ul></div>`;
            }
            if (chuan.length > 0) {
                html += `<div class="nav-section"><div class="nav-section-header">【传】（释义）</div><ul class="nav-section-list">${chuan.map(ch => `<li class="nav-item ${ch.isSubEntry ? 'sub-entry' : ''}" data-chapter="${ch.key}"><span class="nav-item-name">${ch.name}：</span><span class="nav-item-desc">${ch.subtitle}</span></li>`).join('')}</ul></div>`;
            }
            return html;
        },
        aiPromptPrefix: '你是一位精通中国传统文化和家庭教育的智慧导师。请根据以下《大学》原文，为家长提供学习指导。'
    },
    zhongyong: {
        key: 'zhongyong',
        name: '《中庸》章句',
        shortName: '中庸',
        dataFile: 'zhongyong-data.json',
        chapterDefs: [
            { key: '序', name: '序', subtitle: '朱熹序·道统传承', category: '序' },
            { key: '第一章', name: '第一章', subtitle: '天命·中和', category: '上' },
            { key: '第二章', name: '第二章', subtitle: '君子时中', category: '上' },
            { key: '第三章', name: '第三章', subtitle: '中庸至矣', category: '上' },
            { key: '第四章', name: '第四章', subtitle: '道不行不明', category: '上' },
            { key: '第五章', name: '第五章', subtitle: '道其不行', category: '上' },
            { key: '第六章', name: '第六章', subtitle: '舜之大知', category: '上' },
            { key: '第七章', name: '第七章', subtitle: '择而不守', category: '上' },
            { key: '第八章', name: '第八章', subtitle: '颜回服膺', category: '上' },
            { key: '第九章', name: '第九章', subtitle: '中庸不可能', category: '上' },
            { key: '第十章', name: '第十章', subtitle: '子路问强', category: '上' },
            { key: '第十一章', name: '第十一章', subtitle: '依乎中庸', category: '上' },
            { key: '第十二章', name: '第十二章', subtitle: '费而隐', category: '中' },
            { key: '第十三章', name: '第十三章', subtitle: '道不远人', category: '中' },
            { key: '第十四章', name: '第十四章', subtitle: '素位而行', category: '中' },
            { key: '第十五章', name: '第十五章', subtitle: '行远自迩', category: '中' },
            { key: '第十六章', name: '第十六章', subtitle: '鬼神之德', category: '中' },
            { key: '第十七章', name: '第十七章', subtitle: '大德受命', category: '中' },
            { key: '第十八章', name: '第十八章', subtitle: '文王无忧', category: '中' },
            { key: '第十九章', name: '第十九章', subtitle: '达孝善述', category: '中' },
            { key: '第二十章', name: '第二十章', subtitle: '哀公问政', category: '中' },
            { key: '第二十一章', name: '第二十一章', subtitle: '自诚明', category: '下' },
            { key: '第二十二章', name: '第二十二章', subtitle: '至诚尽性', category: '下' },
            { key: '第二十三章', name: '第二十三章', subtitle: '致曲有诚', category: '下' },
            { key: '第二十四章', name: '第二十四章', subtitle: '至诚前知', category: '下' },
            { key: '第二十五章', name: '第二十五章', subtitle: '诚者自成', category: '下' },
            { key: '第二十六章', name: '第二十六章', subtitle: '至诚无息', category: '下' },
            { key: '第二十七章', name: '第二十七章', subtitle: '尊德性道问学', category: '下' },
            { key: '第二十八章', name: '第二十八章', subtitle: '非天子不议礼', category: '下' },
            { key: '第二十九章', name: '第二十九章', subtitle: '本诸身', category: '下' },
            { key: '第三十章', name: '第三十章', subtitle: '大德敦化', category: '下' },
            { key: '第三十一章', name: '第三十一章', subtitle: '至圣配天', category: '下' },
            { key: '第三十二章', name: '第三十二章', subtitle: '至诚经纶', category: '下' },
            { key: '第三十三章', name: '第三十三章', subtitle: '无声无臭', category: '下' }
        ],
        mapSection: function(section) { return section; },
        renderNav: function(chapters) {
            const groups = [
                { key: '序', label: '【序】', chapters: chapters.filter(ch => ch.category === '序') },
                { key: '上', label: '【上篇】首章及释义（1-11）', chapters: chapters.filter(ch => ch.category === '上') },
                { key: '中', label: '【中篇】费隐与实践（12-20）', chapters: chapters.filter(ch => ch.category === '中') },
                { key: '下', label: '【下篇】诚与天道（21-33）', chapters: chapters.filter(ch => ch.category === '下') }
            ];
            return groups.filter(g => g.chapters.length > 0).map(g => `
                <div class="nav-section">
                    <div class="nav-section-header">${g.label}</div>
                    <ul class="nav-section-list">
                        ${g.chapters.map(ch => `<li class="nav-item" data-chapter="${ch.key}"><span class="nav-item-name">${ch.name}：</span><span class="nav-item-desc">${ch.subtitle}</span></li>`).join('')}
                    </ul>
                </div>
            `).join('');
        },
        aiPromptPrefix: '你是一位精通中国传统文化和家庭教育的智慧导师。请根据以下《中庸》原文，为家长提供学习指导。'
    },
    daodejing: {
        key: 'daodejing',
        name: '《道德经》',
        shortName: '道德经',
        dataFile: 'daodejing-data.json',
        chapterDefs: [
            { key: '第一章', name: '第一章', subtitle: '道可道非常道', category: '道经' },
            { key: '第二章', name: '第二章', subtitle: '美丑善恶相生', category: '道经' },
            { key: '第三章', name: '第三章', subtitle: '无为而治', category: '道经' },
            { key: '第四章', name: '第四章', subtitle: '道冲不盈', category: '道经' },
            { key: '第五章', name: '第五章', subtitle: '天地不仁', category: '道经' },
            { key: '第六章', name: '第六章', subtitle: '谷神不死', category: '道经' },
            { key: '第七章', name: '第七章', subtitle: '天长地久', category: '道经' },
            { key: '第八章', name: '第八章', subtitle: '上善若水', category: '道经' },
            { key: '第九章', name: '第九章', subtitle: '功成身退', category: '道经' },
            { key: '第十章', name: '第十章', subtitle: '载营抱一', category: '道经' },
            { key: '第十一章', name: '第十一章', subtitle: '有无之用', category: '道经' },
            { key: '第十二章', name: '第十二章', subtitle: '去彼取此', category: '道经' },
            { key: '第十三章', name: '第十三章', subtitle: '宠辱若惊', category: '道经' },
            { key: '第十四章', name: '第十四章', subtitle: '执古御今', category: '道经' },
            { key: '第十五章', name: '第十五章', subtitle: '微妙玄通', category: '道经' },
            { key: '第十六章', name: '第十六章', subtitle: '致虚守静', category: '道经' },
            { key: '第十七章', name: '第十七章', subtitle: '太上下知有之', category: '道经' },
            { key: '第十八章', name: '第十八章', subtitle: '大道废有仁义', category: '道经' },
            { key: '第十九章', name: '第十九章', subtitle: '见素抱朴', category: '道经' },
            { key: '第二十章', name: '第二十章', subtitle: '独异于人', category: '道经' },
            { key: '第二十一章', name: '第二十一章', subtitle: '孔德之容', category: '道经' },
            { key: '第二十二章', name: '第二十二章', subtitle: '曲则全', category: '道经' },
            { key: '第二十三章', name: '第二十三章', subtitle: '希言自然', category: '道经' },
            { key: '第二十四章', name: '第二十四章', subtitle: '企者不立', category: '道经' },
            { key: '第二十五章', name: '第二十五章', subtitle: '道法自然', category: '道经' },
            { key: '第二十六章', name: '第二十六章', subtitle: '重为轻根', category: '道经' },
            { key: '第二十七章', name: '第二十七章', subtitle: '善行无迹', category: '道经' },
            { key: '第二十八章', name: '第二十八章', subtitle: '知雄守雌', category: '道经' },
            { key: '第二十九章', name: '第二十九章', subtitle: '天下神器', category: '道经' },
            { key: '第三十章', name: '第三十章', subtitle: '以道佐人主', category: '道经' },
            { key: '第三十一章', name: '第三十一章', subtitle: '兵者不祥', category: '道经' },
            { key: '第三十二章', name: '第三十二章', subtitle: '道常无名', category: '道经' },
            { key: '第三十三章', name: '第三十三章', subtitle: '自知者明', category: '道经' },
            { key: '第三十四章', name: '第三十四章', subtitle: '大道泛兮', category: '道经' },
            { key: '第三十五章', name: '第三十五章', subtitle: '执大象', category: '道经' },
            { key: '第三十六章', name: '第三十六章', subtitle: '微明', category: '道经' },
            { key: '第三十七章', name: '第三十七章', subtitle: '道常无为', category: '道经' },
            { key: '第三十八章', name: '第三十八章', subtitle: '上德不德', category: '德经' },
            { key: '第三十九章', name: '第三十九章', subtitle: '得一', category: '德经' },
            { key: '第四十章', name: '第四十章', subtitle: '反者道之动', category: '德经' },
            { key: '第四十一章', name: '第四十一章', subtitle: '大器晚成', category: '德经' },
            { key: '第四十二章', name: '第四十二章', subtitle: '道生一', category: '德经' },
            { key: '第四十三章', name: '第四十三章', subtitle: '至柔至坚', category: '德经' },
            { key: '第四十四章', name: '第四十四章', subtitle: '知足不辱', category: '德经' },
            { key: '第四十五章', name: '第四十五章', subtitle: '大成若缺', category: '德经' },
            { key: '第四十六章', name: '第四十六章', subtitle: '知足常足', category: '德经' },
            { key: '第四十七章', name: '第四十七章', subtitle: '不出户知天下', category: '德经' },
            { key: '第四十八章', name: '第四十八章', subtitle: '为道日损', category: '德经' },
            { key: '第四十九章', name: '第四十九章', subtitle: '圣人无常心', category: '德经' },
            { key: '第五十章', name: '第五十章', subtitle: '出生入死', category: '德经' },
            { key: '第五十一章', name: '第五十一章', subtitle: '道生德畜', category: '德经' },
            { key: '第五十二章', name: '第五十二章', subtitle: '天下有始', category: '德经' },
            { key: '第五十三章', name: '第五十三章', subtitle: '行于大道', category: '德经' },
            { key: '第五十四章', name: '第五十四章', subtitle: '善建不拔', category: '德经' },
            { key: '第五十五章', name: '第五十五章', subtitle: '含德之厚', category: '德经' },
            { key: '第五十六章', name: '第五十六章', subtitle: '知者不言', category: '德经' },
            { key: '第五十七章', name: '第五十七章', subtitle: '以正治国', category: '德经' },
            { key: '第五十八章', name: '第五十八章', subtitle: '祸福相倚', category: '德经' },
            { key: '第五十九章', name: '第五十九章', subtitle: '深根固柢', category: '德经' },
            { key: '第六十章', name: '第六十章', subtitle: '治大国若烹小鲜', category: '德经' },
            { key: '第六十一章', name: '第六十一章', subtitle: '大国者下流', category: '德经' },
            { key: '第六十二章', name: '第六十二章', subtitle: '道者万物之奥', category: '德经' },
            { key: '第六十三章', name: '第六十三章', subtitle: '为无为', category: '德经' },
            { key: '第六十四章', name: '第六十四章', subtitle: '千里之行始于足下', category: '德经' },
            { key: '第六十五章', name: '第六十五章', subtitle: '善为道者', category: '德经' },
            { key: '第六十六章', name: '第六十六章', subtitle: '江海为百谷王', category: '德经' },
            { key: '第六十七章', name: '第六十七章', subtitle: '三宝', category: '德经' },
            { key: '第六十八章', name: '第六十八章', subtitle: '不争之德', category: '德经' },
            { key: '第六十九章', name: '第六十九章', subtitle: '哀者胜矣', category: '德经' },
            { key: '第七十章', name: '第七十章', subtitle: '被褐怀玉', category: '德经' },
            { key: '第七十一章', name: '第七十一章', subtitle: '知不知上', category: '德经' },
            { key: '第七十二章', name: '第七十二章', subtitle: '民不畏威', category: '德经' },
            { key: '第七十三章', name: '第七十三章', subtitle: '天网恢恢', category: '德经' },
            { key: '第七十四章', name: '第七十四章', subtitle: '民不畏死', category: '德经' },
            { key: '第七十五章', name: '第七十五章', subtitle: '民之饥', category: '德经' },
            { key: '第七十六章', name: '第七十六章', subtitle: '柔弱处上', category: '德经' },
            { key: '第七十七章', name: '第七十七章', subtitle: '天之道', category: '德经' },
            { key: '第七十八章', name: '第七十八章', subtitle: '柔弱胜刚强', category: '德经' },
            { key: '第七十九章', name: '第七十九章', subtitle: '天道无亲', category: '德经' },
            { key: '第八十章', name: '第八十章', subtitle: '小国寡民', category: '德经' },
            { key: '第八十一章', name: '第八十一章', subtitle: '信言不美', category: '德经' }
        ],
        mapSection: function(section) { return section; },
        renderNav: function(chapters) {
            const groups = [
                { key: '道经', label: '【道经】上篇（1-37章）', chapters: chapters.filter(ch => ch.category === '道经') },
                { key: '德经', label: '【德经】下篇（38-81章）', chapters: chapters.filter(ch => ch.category === '德经') }
            ];
            return groups.filter(g => g.chapters.length > 0).map(g => `
                <div class="nav-section">
                    <div class="nav-section-header">${g.label}</div>
                    <ul class="nav-section-list">
                        ${g.chapters.map(ch => `<li class="nav-item" data-chapter="${ch.key}"><span class="nav-item-name">${ch.name}：</span><span class="nav-item-desc">${ch.subtitle}</span></li>`).join('')}
                    </ul>
                </div>
            `).join('');
        },
        aiPromptPrefix: '你是一位精通中国传统文化和家庭教育的智慧导师。请根据以下《道德经》原文，为家长提供学习指导。'
    },
    mengzi: {
        key: 'mengzi',
        name: '《孟子》',
        shortName: '孟子',
        dataFile: 'mengzi-data.json',
        chapterDefs: [
            { key: '梁惠王上·1', name: '第1章', subtitle: '孟子见梁惠王', category: '梁惠王上' },
            { key: '梁惠王上·2', name: '第2章', subtitle: '孟子见梁惠王', category: '梁惠王上' },
            { key: '梁惠王上·3', name: '第3章', subtitle: '梁惠王曰', category: '梁惠王上' },
            { key: '梁惠王上·4', name: '第4章', subtitle: '梁惠王曰', category: '梁惠王上' },
            { key: '梁惠王上·5', name: '第5章', subtitle: '梁惠王曰', category: '梁惠王上' },
            { key: '梁惠王上·6', name: '第6章', subtitle: '孟子见梁襄王', category: '梁惠王上' },
            { key: '梁惠王上·7', name: '第7章', subtitle: '齐宣王问曰', category: '梁惠王上' },
            { key: '梁惠王下·1', name: '第1章', subtitle: '庄暴见孟子', category: '梁惠王下' },
            { key: '梁惠王下·2', name: '第2章', subtitle: '齐宣王问曰', category: '梁惠王下' },
            { key: '梁惠王下·3', name: '第3章', subtitle: '齐宣王问曰', category: '梁惠王下' },
            { key: '梁惠王下·4', name: '第4章', subtitle: '齐宣王见孟子于雪宫', category: '梁惠王下' },
            { key: '梁惠王下·5', name: '第5章', subtitle: '齐宣王问曰', category: '梁惠王下' },
            { key: '梁惠王下·6', name: '第6章', subtitle: '孟子谓齐宣王', category: '梁惠王下' },
            { key: '梁惠王下·7', name: '第7章', subtitle: '孟子见齐宣王', category: '梁惠王下' },
            { key: '梁惠王下·8', name: '第8章', subtitle: '齐宣王问曰', category: '梁惠王下' },
            { key: '梁惠王下·9', name: '第9章', subtitle: '孟子见齐宣王', category: '梁惠王下' },
            { key: '梁惠王下·10', name: '第10章', subtitle: '齐人伐燕', category: '梁惠王下' },
            { key: '梁惠王下·11', name: '第11章', subtitle: '齐人伐燕', category: '梁惠王下' },
            { key: '梁惠王下·12', name: '第12章', subtitle: '邹与鲁哄', category: '梁惠王下' },
            { key: '梁惠王下·13', name: '第13章', subtitle: '滕文公问曰', category: '梁惠王下' },
            { key: '梁惠王下·14', name: '第14章', subtitle: '滕文公问曰', category: '梁惠王下' },
            { key: '梁惠王下·15', name: '第15章', subtitle: '滕文公问曰', category: '梁惠王下' },
            { key: '梁惠王下·16', name: '第16章', subtitle: '鲁平公将出', category: '梁惠王下' },
            { key: '公孙丑上·1', name: '第1章', subtitle: '公孙丑问曰', category: '公孙丑上' },
            { key: '公孙丑上·2', name: '第2章', subtitle: '公孙丑问曰', category: '公孙丑上' },
            { key: '公孙丑上·3', name: '第3章', subtitle: '孟子曰', category: '公孙丑上' },
            { key: '公孙丑上·4', name: '第4章', subtitle: '孟子曰', category: '公孙丑上' },
            { key: '公孙丑上·5', name: '第5章', subtitle: '孟子曰', category: '公孙丑上' },
            { key: '公孙丑上·6', name: '第6章', subtitle: '孟子曰', category: '公孙丑上' },
            { key: '公孙丑上·7', name: '第7章', subtitle: '孟子曰', category: '公孙丑上' },
            { key: '公孙丑上·8', name: '第8章', subtitle: '孟子曰', category: '公孙丑上' },
            { key: '公孙丑上·9', name: '第9章', subtitle: '孟子曰', category: '公孙丑上' },
            { key: '公孙丑下·1', name: '第1章', subtitle: '孟子曰', category: '公孙丑下' },
            { key: '公孙丑下·2', name: '第2章', subtitle: '孟子将朝王', category: '公孙丑下' },
            { key: '公孙丑下·3', name: '第3章', subtitle: '陈臻问曰', category: '公孙丑下' },
            { key: '公孙丑下·4', name: '第4章', subtitle: '孟子之平陆', category: '公孙丑下' },
            { key: '公孙丑下·5', name: '第5章', subtitle: '孟子谓蚔蛙曰', category: '公孙丑下' },
            { key: '公孙丑下·6', name: '第6章', subtitle: '孟子为卿于齐', category: '公孙丑下' },
            { key: '公孙丑下·7', name: '第7章', subtitle: '孟子自齐葬于鲁', category: '公孙丑下' },
            { key: '公孙丑下·8', name: '第8章', subtitle: '沈同以其私问曰', category: '公孙丑下' },
            { key: '公孙丑下·9', name: '第9章', subtitle: '燕人畔', category: '公孙丑下' },
            { key: '公孙丑下·10', name: '第10章', subtitle: '孟子致为臣而归', category: '公孙丑下' },
            { key: '公孙丑下·11', name: '第11章', subtitle: '孟子去齐', category: '公孙丑下' },
            { key: '公孙丑下·12', name: '第12章', subtitle: '孟子去齐', category: '公孙丑下' },
            { key: '公孙丑下·13', name: '第13章', subtitle: '孟子去齐', category: '公孙丑下' },
            { key: '公孙丑下·14', name: '第14章', subtitle: '孟子去齐', category: '公孙丑下' },
            { key: '滕文公上·1', name: '第1章', subtitle: '滕文公为世子', category: '滕文公上' },
            { key: '滕文公上·2', name: '第2章', subtitle: '滕定公薨', category: '滕文公上' },
            { key: '滕文公上·3', name: '第3章', subtitle: '滕文公问为国', category: '滕文公上' },
            { key: '滕文公上·4', name: '第4章', subtitle: '有为神农之言者许行', category: '滕文公上' },
            { key: '滕文公上·5', name: '第5章', subtitle: '墨者夷之', category: '滕文公上' },
            { key: '滕文公下·1', name: '第1章', subtitle: '陈代曰', category: '滕文公下' },
            { key: '滕文公下·2', name: '第2章', subtitle: '景春曰', category: '滕文公下' },
            { key: '滕文公下·3', name: '第3章', subtitle: '周霄问曰', category: '滕文公下' },
            { key: '滕文公下·4', name: '第4章', subtitle: '彭更问曰', category: '滕文公下' },
            { key: '滕文公下·5', name: '第5章', subtitle: '万章问曰', category: '滕文公下' },
            { key: '滕文公下·6', name: '第6章', subtitle: '孟子谓戴不胜曰', category: '滕文公下' },
            { key: '滕文公下·7', name: '第7章', subtitle: '公孙丑问曰', category: '滕文公下' },
            { key: '滕文公下·8', name: '第8章', subtitle: '戴盈之曰', category: '滕文公下' },
            { key: '滕文公下·9', name: '第9章', subtitle: '公都子曰', category: '滕文公下' },
            { key: '滕文公下·10', name: '第10章', subtitle: '匡章曰', category: '滕文公下' },
            { key: '离娄上·1', name: '第1章', subtitle: '孟子曰', category: '离娄上' },
            { key: '离娄上·2', name: '第2章', subtitle: '孟子曰', category: '离娄上' },
            { key: '离娄上·3', name: '第3章', subtitle: '孟子曰', category: '离娄上' },
            { key: '离娄上·4', name: '第4章', subtitle: '孟子曰', category: '离娄上' },
            { key: '离娄上·5', name: '第5章', subtitle: '孟子曰', category: '离娄上' },
            { key: '离娄上·6', name: '第6章', subtitle: '孟子曰', category: '离娄上' },
            { key: '离娄上·7', name: '第7章', subtitle: '孟子曰', category: '离娄上' },
            { key: '离娄上·8', name: '第8章', subtitle: '孟子曰', category: '离娄上' },
            { key: '离娄上·9', name: '第9章', subtitle: '孟子曰', category: '离娄上' },
            { key: '离娄上·10', name: '第10章', subtitle: '孟子曰', category: '离娄上' },
            { key: '离娄上·11', name: '第11章', subtitle: '孟子曰', category: '离娄上' },
            { key: '离娄上·12', name: '第12章', subtitle: '孟子曰', category: '离娄上' },
            { key: '离娄上·13', name: '第13章', subtitle: '孟子曰', category: '离娄上' },
            { key: '离娄上·14', name: '第14章', subtitle: '孟子曰', category: '离娄上' },
            { key: '离娄上·15', name: '第15章', subtitle: '孟子曰', category: '离娄上' },
            { key: '离娄上·16', name: '第16章', subtitle: '孟子曰', category: '离娄上' },
            { key: '离娄上·17', name: '第17章', subtitle: '淳于髡曰', category: '离娄上' },
            { key: '离娄上·18', name: '第18章', subtitle: '公孙丑曰', category: '离娄上' },
            { key: '离娄上·19', name: '第19章', subtitle: '孟子曰', category: '离娄上' },
            { key: '离娄上·20', name: '第20章', subtitle: '孟子曰', category: '离娄上' },
            { key: '离娄上·21', name: '第21章', subtitle: '孟子曰', category: '离娄上' },
            { key: '离娄上·22', name: '第22章', subtitle: '孟子曰', category: '离娄上' },
            { key: '离娄上·23', name: '第23章', subtitle: '孟子曰', category: '离娄上' },
            { key: '离娄上·24', name: '第24章', subtitle: '乐正子从于子敖之齐', category: '离娄上' },
            { key: '离娄上·25', name: '第25章', subtitle: '孟子谓乐正子曰', category: '离娄上' },
            { key: '离娄上·26', name: '第26章', subtitle: '孟子曰', category: '离娄上' },
            { key: '离娄上·27', name: '第27章', subtitle: '孟子曰', category: '离娄上' },
            { key: '离娄上·28', name: '第28章', subtitle: '孟子曰', category: '离娄上' },
            { key: '离娄下·1', name: '第1章', subtitle: '孟子曰', category: '离娄下' },
            { key: '离娄下·2', name: '第2章', subtitle: '子产听郑国之政', category: '离娄下' },
            { key: '离娄下·3', name: '第3章', subtitle: '孟子告齐宣王曰', category: '离娄下' },
            { key: '离娄下·4', name: '第4章', subtitle: '孟子曰', category: '离娄下' },
            { key: '离娄下·5', name: '第5章', subtitle: '孟子曰', category: '离娄下' },
            { key: '离娄下·6', name: '第6章', subtitle: '孟子曰', category: '离娄下' },
            { key: '离娄下·7', name: '第7章', subtitle: '孟子曰', category: '离娄下' },
            { key: '离娄下·8', name: '第8章', subtitle: '孟子曰', category: '离娄下' },
            { key: '离娄下·9', name: '第9章', subtitle: '孟子曰', category: '离娄下' },
            { key: '离娄下·10', name: '第10章', subtitle: '孟子曰', category: '离娄下' },
            { key: '离娄下·11', name: '第11章', subtitle: '孟子曰', category: '离娄下' },
            { key: '离娄下·12', name: '第12章', subtitle: '孟子曰', category: '离娄下' },
            { key: '离娄下·13', name: '第13章', subtitle: '孟子曰', category: '离娄下' },
            { key: '离娄下·14', name: '第14章', subtitle: '孟子曰', category: '离娄下' },
            { key: '离娄下·15', name: '第15章', subtitle: '孟子曰', category: '离娄下' },
            { key: '离娄下·16', name: '第16章', subtitle: '孟子曰', category: '离娄下' },
            { key: '离娄下·17', name: '第17章', subtitle: '孟子曰', category: '离娄下' },
            { key: '离娄下·18', name: '第18章', subtitle: '徐子曰', category: '离娄下' },
            { key: '离娄下·19', name: '第19章', subtitle: '孟子曰', category: '离娄下' },
            { key: '离娄下·20', name: '第20章', subtitle: '孟子曰', category: '离娄下' },
            { key: '离娄下·21', name: '第21章', subtitle: '孟子曰', category: '离娄下' },
            { key: '离娄下·22', name: '第22章', subtitle: '孟子曰', category: '离娄下' },
            { key: '离娄下·23', name: '第23章', subtitle: '孟子曰', category: '离娄下' },
            { key: '离娄下·24', name: '第24章', subtitle: '逢蒙学射于羿', category: '离娄下' },
            { key: '离娄下·25', name: '第25章', subtitle: '孟子曰', category: '离娄下' },
            { key: '离娄下·26', name: '第26章', subtitle: '孟子曰', category: '离娄下' },
            { key: '离娄下·27', name: '第27章', subtitle: '公行子有子之丧', category: '离娄下' },
            { key: '离娄下·28', name: '第28章', subtitle: '孟子曰', category: '离娄下' },
            { key: '离娄下·29', name: '第29章', subtitle: '禹、稷当平世', category: '离娄下' },
            { key: '离娄下·30', name: '第30章', subtitle: '公都子曰', category: '离娄下' },
            { key: '离娄下·31', name: '第31章', subtitle: '曾子居武城', category: '离娄下' },
            { key: '离娄下·32', name: '第32章', subtitle: '储子曰', category: '离娄下' },
            { key: '离娄下·33', name: '第33章', subtitle: '齐人有一妻一妾而', category: '离娄下' },
            { key: '万章上·1', name: '第1章', subtitle: '万章问曰', category: '万章上' },
            { key: '万章上·2', name: '第2章', subtitle: '万章问曰', category: '万章上' },
            { key: '万章上·3', name: '第3章', subtitle: '万章问曰', category: '万章上' },
            { key: '万章上·4', name: '第4章', subtitle: '咸丘蒙问曰', category: '万章上' },
            { key: '万章上·5', name: '第5章', subtitle: '万章曰', category: '万章上' },
            { key: '万章上·6', name: '第6章', subtitle: '万章问曰', category: '万章上' },
            { key: '万章上·7', name: '第7章', subtitle: '万章问曰', category: '万章上' },
            { key: '万章上·8', name: '第8章', subtitle: '万章问曰', category: '万章上' },
            { key: '万章上·9', name: '第9章', subtitle: '万章问曰', category: '万章上' },
            { key: '万章下·1', name: '第1章', subtitle: '孟子曰', category: '万章下' },
            { key: '万章下·2', name: '第2章', subtitle: '北京锜问曰', category: '万章下' },
            { key: '万章下·3', name: '第3章', subtitle: '万章问曰', category: '万章下' },
            { key: '万章下·4', name: '第4章', subtitle: '万章曰', category: '万章下' },
            { key: '万章下·5', name: '第5章', subtitle: '孟子曰', category: '万章下' },
            { key: '万章下·6', name: '第6章', subtitle: '万章曰', category: '万章下' },
            { key: '万章下·7', name: '第7章', subtitle: '万章曰', category: '万章下' },
            { key: '万章下·8', name: '第8章', subtitle: '孟子谓万章曰', category: '万章下' },
            { key: '万章下·9', name: '第9章', subtitle: '齐宣王问卿', category: '万章下' },
            { key: '告子上·1', name: '第1章', subtitle: '告子曰', category: '告子上' },
            { key: '告子上·2', name: '第2章', subtitle: '告子曰', category: '告子上' },
            { key: '告子上·3', name: '第3章', subtitle: '告子曰', category: '告子上' },
            { key: '告子上·4', name: '第4章', subtitle: '告子曰', category: '告子上' },
            { key: '告子上·5', name: '第5章', subtitle: '孟季子问公都子曰', category: '告子上' },
            { key: '告子上·6', name: '第6章', subtitle: '公都子曰', category: '告子上' },
            { key: '告子上·7', name: '第7章', subtitle: '孟子曰', category: '告子上' },
            { key: '告子上·8', name: '第8章', subtitle: '孟子曰', category: '告子上' },
            { key: '告子上·9', name: '第9章', subtitle: '孟子曰', category: '告子上' },
            { key: '告子上·10', name: '第10章', subtitle: '孟子曰', category: '告子上' },
            { key: '告子上·11', name: '第11章', subtitle: '孟子曰', category: '告子上' },
            { key: '告子上·12', name: '第12章', subtitle: '孟子曰', category: '告子上' },
            { key: '告子上·13', name: '第13章', subtitle: '孟子曰', category: '告子上' },
            { key: '告子上·14', name: '第14章', subtitle: '孟子曰', category: '告子上' },
            { key: '告子上·15', name: '第15章', subtitle: '公都子问曰', category: '告子上' },
            { key: '告子上·16', name: '第16章', subtitle: '孟子曰', category: '告子上' },
            { key: '告子上·17', name: '第17章', subtitle: '孟子曰', category: '告子上' },
            { key: '告子上·18', name: '第18章', subtitle: '孟子曰', category: '告子上' },
            { key: '告子上·19', name: '第19章', subtitle: '孟子曰', category: '告子上' },
            { key: '告子上·20', name: '第20章', subtitle: '孟子曰', category: '告子上' },
            { key: '告子下·1', name: '第1章', subtitle: '任人有问屋庐子曰', category: '告子下' },
            { key: '告子下·2', name: '第2章', subtitle: '曹交问曰', category: '告子下' },
            { key: '告子下·3', name: '第3章', subtitle: '公孙丑问曰', category: '告子下' },
            { key: '告子下·4', name: '第4章', subtitle: '宋牼将之楚', category: '告子下' },
            { key: '告子下·5', name: '第5章', subtitle: '孟子居邹', category: '告子下' },
            { key: '告子下·6', name: '第6章', subtitle: '淳于髡曰', category: '告子下' },
            { key: '告子下·7', name: '第7章', subtitle: '孟子曰', category: '告子下' },
            { key: '告子下·8', name: '第8章', subtitle: '鲁欲使慎子为将军', category: '告子下' },
            { key: '告子下·9', name: '第9章', subtitle: '孟子曰', category: '告子下' },
            { key: '告子下·10', name: '第10章', subtitle: '白圭曰', category: '告子下' },
            { key: '告子下·11', name: '第11章', subtitle: '白圭曰', category: '告子下' },
            { key: '告子下·12', name: '第12章', subtitle: '孟子曰', category: '告子下' },
            { key: '告子下·13', name: '第13章', subtitle: '鲁欲使乐正子为政', category: '告子下' },
            { key: '告子下·14', name: '第14章', subtitle: '陈子曰', category: '告子下' },
            { key: '告子下·15', name: '第15章', subtitle: '孟子曰', category: '告子下' },
            { key: '告子下·16', name: '第16章', subtitle: '孟子曰', category: '告子下' },
            { key: '尽心上·1', name: '第1章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·2', name: '第2章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·3', name: '第3章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·4', name: '第4章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·5', name: '第5章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·6', name: '第6章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·7', name: '第7章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·8', name: '第8章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·9', name: '第9章', subtitle: '孟子谓宋句践曰', category: '尽心上' },
            { key: '尽心上·10', name: '第10章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·11', name: '第11章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·12', name: '第12章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·13', name: '第13章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·14', name: '第14章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·15', name: '第15章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·16', name: '第16章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·17', name: '第17章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·18', name: '第18章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·19', name: '第19章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·20', name: '第20章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·21', name: '第21章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·22', name: '第22章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·23', name: '第23章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·24', name: '第24章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·25', name: '第25章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·26', name: '第26章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·27', name: '第27章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·28', name: '第28章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·29', name: '第29章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·30', name: '第30章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·31', name: '第31章', subtitle: '公孙丑曰', category: '尽心上' },
            { key: '尽心上·32', name: '第32章', subtitle: '公孙丑曰', category: '尽心上' },
            { key: '尽心上·33', name: '第33章', subtitle: '王子垫问曰', category: '尽心上' },
            { key: '尽心上·34', name: '第34章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·35', name: '第35章', subtitle: '桃应问曰', category: '尽心上' },
            { key: '尽心上·36', name: '第36章', subtitle: '孟子自范之齐', category: '尽心上' },
            { key: '尽心上·37', name: '第37章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·38', name: '第38章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·39', name: '第39章', subtitle: '齐宣王欲短丧', category: '尽心上' },
            { key: '尽心上·40', name: '第40章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·41', name: '第41章', subtitle: '公孙丑曰', category: '尽心上' },
            { key: '尽心上·42', name: '第42章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·43', name: '第43章', subtitle: '公都子曰', category: '尽心上' },
            { key: '尽心上·44', name: '第44章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·45', name: '第45章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心上·46', name: '第46章', subtitle: '孟子曰', category: '尽心上' },
            { key: '尽心下·1', name: '第1章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·2', name: '第2章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·3', name: '第3章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·4', name: '第4章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·5', name: '第5章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·6', name: '第6章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·7', name: '第7章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·8', name: '第8章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·9', name: '第9章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·10', name: '第10章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·11', name: '第11章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·12', name: '第12章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·13', name: '第13章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·14', name: '第14章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·15', name: '第15章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·16', name: '第16章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·17', name: '第17章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·18', name: '第18章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·19', name: '第19章', subtitle: '貉稽曰', category: '尽心下' },
            { key: '尽心下·20', name: '第20章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·21', name: '第21章', subtitle: '孟子谓高子曰', category: '尽心下' },
            { key: '尽心下·22', name: '第22章', subtitle: '高子曰', category: '尽心下' },
            { key: '尽心下·23', name: '第23章', subtitle: '齐饥', category: '尽心下' },
            { key: '尽心下·24', name: '第24章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·25', name: '第25章', subtitle: '浩生不害问曰', category: '尽心下' },
            { key: '尽心下·26', name: '第26章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·27', name: '第27章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·28', name: '第28章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·29', name: '第29章', subtitle: '盆成括仕于齐', category: '尽心下' },
            { key: '尽心下·30', name: '第30章', subtitle: '孟子之滕', category: '尽心下' },
            { key: '尽心下·31', name: '第31章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·32', name: '第32章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·33', name: '第33章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·34', name: '第34章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·35', name: '第35章', subtitle: '孟子曰', category: '尽心下' },
            { key: '尽心下·36', name: '第36章', subtitle: '曾晳嗜羊枣', category: '尽心下' },
            { key: '尽心下·37', name: '第37章', subtitle: '万章问曰', category: '尽心下' },
            { key: '尽心下·38', name: '第38章', subtitle: '孟子曰', category: '尽心下' }
        ],
        mapSection: function(section) { return section; },
        renderNav: function(chapters) {
            const groups = [
                { key: '梁惠王上', label: '【梁惠王上】', chapters: chapters.filter(ch => ch.category === '梁惠王上') },
                { key: '梁惠王下', label: '【梁惠王下】', chapters: chapters.filter(ch => ch.category === '梁惠王下') },
                { key: '公孙丑上', label: '【公孙丑上】', chapters: chapters.filter(ch => ch.category === '公孙丑上') },
                { key: '公孙丑下', label: '【公孙丑下】', chapters: chapters.filter(ch => ch.category === '公孙丑下') },
                { key: '滕文公上', label: '【滕文公上】', chapters: chapters.filter(ch => ch.category === '滕文公上') },
                { key: '滕文公下', label: '【滕文公下】', chapters: chapters.filter(ch => ch.category === '滕文公下') },
                { key: '离娄上', label: '【离娄上】', chapters: chapters.filter(ch => ch.category === '离娄上') },
                { key: '离娄下', label: '【离娄下】', chapters: chapters.filter(ch => ch.category === '离娄下') },
                { key: '万章上', label: '【万章上】', chapters: chapters.filter(ch => ch.category === '万章上') },
                { key: '万章下', label: '【万章下】', chapters: chapters.filter(ch => ch.category === '万章下') },
                { key: '告子上', label: '【告子上】', chapters: chapters.filter(ch => ch.category === '告子上') },
                { key: '告子下', label: '【告子下】', chapters: chapters.filter(ch => ch.category === '告子下') },
                { key: '尽心上', label: '【尽心上】', chapters: chapters.filter(ch => ch.category === '尽心上') },
                { key: '尽心下', label: '【尽心下】', chapters: chapters.filter(ch => ch.category === '尽心下') }
            ];
            return groups.filter(g => g.chapters.length > 0).map(g => `
                <div class="nav-section">
                    <div class="nav-section-header">${g.label}</div>
                    <ul class="nav-section-list">
                        ${g.chapters.map(ch => `<li class="nav-item" data-chapter="${ch.key}"><span class="nav-item-name">${ch.name}：</span><span class="nav-item-desc">${ch.subtitle}</span></li>`).join('')}
                    </ul>
                </div>
            `).join('');
        },
        aiPromptPrefix: '你是一位精通中国传统文化和家庭教育的智慧导师。请根据以下《孟子》原文，为家长提供学习指导。'
    }
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
        chapterContent: document.getElementById('chapterContent'),

        // Sidebar Header (book title)
        sidebarHeader: document.querySelector('.sidebar-header .book-title-text'),
        
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
        showIntroPage();
    } catch (error) {
        console.error('Init error:', error);
    }

    // Setup book tab listeners
    setupBookTabs();
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
    document.querySelector('.book-title-text')?.addEventListener('click', showIntroPage);
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

    // Hide all intro pages, show the current book's intro
    document.querySelectorAll('.intro-page').forEach(page => {
        page.style.display = 'none';
    });
    const currentIntro = document.getElementById('introPage-' + AppState.currentBook);
    if (currentIntro) currentIntro.style.display = 'block';

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

    // Hide all intro pages, show chapter content
    document.querySelectorAll('.intro-page').forEach(page => {
        page.style.display = 'none';
    });
    if (DOM.chapterContent) DOM.chapterContent.style.display = 'block';
}

/**
 * Setup book tab switching
 */
function setupBookTabs() {
    document.querySelectorAll('.book-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const bookKey = tab.dataset.book;
            if (bookKey !== AppState.currentBook) {
                switchBook(bookKey);
            }
        });
    });
}

/**
 * Switch to a different book
 */
async function switchBook(bookKey) {
    if (!BookConfig[bookKey]) return;
    AppState.currentBook = bookKey;
    AppState.currentChapter = null;
    AppState.currentParagraph = null;

    // Update tab active state
    document.querySelectorAll('.book-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.book === bookKey);
    });

    // Update sidebar header title
    if (DOM.sidebarHeader) {
        DOM.sidebarHeader.textContent = BookConfig[bookKey].name;
    }

    // Update intro pages visibility
    document.querySelectorAll('.intro-page').forEach(page => {
        page.style.display = 'none';
    });

    // Load data and re-render
    await loadData();
    renderChapterNav();
    showIntroPage();
}

/**
 * Load and organize data from JSON
 */
async function loadData() {
    const config = BookConfig[AppState.currentBook];
    const response = await fetch(config.dataFile);
    const data = await response.json();

    // Create chapter map from config
    const chapterMap = new Map();
    config.chapterDefs.forEach(def => {
        chapterMap.set(def.key, { ...def, paragraphs: [] });
    });

    // Map data to chapters
    data.forEach(item => {
        const chapterKey = config.mapSection(item.section);
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
 * Render chapter navigation using book-specific renderer
 */
function renderChapterNav() {
    if (!DOM.chapterNav) return;

    const config = BookConfig[AppState.currentBook];
    DOM.chapterNav.innerHTML = config.renderNav(AppState.chapters);

    // Add click handlers
    DOM.chapterNav.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            selectChapter(item.dataset.chapter);
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
    if (AppState.currentBook === 'daxue') {
        return content
            .replace(/《大学章句》全文\n?/g, '')
            .replace(/【[^】]+】\n?/g, '')
            .replace(/（[^）]+）\n?/g, '')
            .replace(/第[一二三四五六七八九十]+章\s*[^\n]*\n?/g, '')
            .trim();
    }
    // 中庸 content is already clean (bold text extracted)
    return content.trim();
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
    
    const config = BookConfig[AppState.currentBook];
    const prompt = `${config.aiPromptPrefix}

原文：
${text}

请严格按以下格式提供解读，每个部分都必须简洁精炼：

## 一、白话文解释
纯粹的现代汉语翻译，只翻译原文含义，不要任何解读、引申或额外信息。一段话即可。

## 二、家庭教育智慧
只写一段话。直接阐述这段经典与家庭教育的内在逻辑关系，重在推导而非说教。不要分点，不要列举。`;

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
        principle: ''
    };

    const patterns = [
        { key: 'explanation', regex: /(?:##?\s*)?(?:一、|1[.、])?白话文解释[：:\s]*/i },
        { key: 'principle', regex: /(?:##?\s*)?(?:二、|2[.、])?家庭教育智慧[：:\s]*/i }
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
