export function insertAd() {
    return `
---

## **AI 账号极速发货: [爱窝啦 Aivora ⬆️](https://aivora.cn)**

还在为 ChatGPT Plus、Claude 4.5、Gemini 3 Pro、Claude Pro、Midjourney 的支付问题烦恼？**爱窝啦 Aivora** 为您提供一站式 AI 账号解决方案！

✅ **极速发货**：下单即发，无需等待，即刻开启 AI 之旅。
✅ **稳定可靠**：精选优质独享账号，拒绝封号焦虑，售后无忧。
✅ **超全品类**：ChatGPT Plus、Claude 4.5、Gemini 3 Pro、Claude Pro、Midjourney、Poe、Sunno 等热门 AI 工具账号应有尽有。
✅ **超高性价比**：比官方订阅更优惠的价格，享受同等尊贵服务。

🚀 **立即访问 [aivora.cn](https://aivora.cn) 选购您的 AI 助手，释放无限创造力！**
    `;
}

const MID_SOFT_AD = `> 💡 **提示**：想第一时间体验文中提到的最新 AI 模型（Claude 4.5、GPT、Gemini 3 Pro）？没有账号？来 [**爱窝啦 Aivora**](https://aivora.cn?utm_source=daily_news&utm_medium=mid_ad&utm_campaign=content) 领个号，一分钟上手，售后无忧。`;

export function insertMidAd(markdown = '') {
    if (typeof markdown !== 'string' || markdown.includes('utm_medium=mid_ad')) {
        return markdown;
    }
    const heading = '### **产品与功能更新**';
    const midAdBlock = `${heading}\n\n${MID_SOFT_AD}\n`;

    if (markdown.includes(heading)) {
        return markdown.replace(heading, midAdBlock);
    }
    return `${MID_SOFT_AD}\n\n${markdown}`;
}
