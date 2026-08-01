export function insertAd() {
    return `
---

## **AI 账号极速发货: [爱窝啦·AI账号店 ⬆️](https://www.aivora.cn/)**

还在为 ChatGPT Plus、Claude、Gemini、Midjourney 等工具的账号和订阅选择烦恼？**爱窝啦·AI账号店** 提供当前可用的 AI 账号与订阅方案，并提供使用指导与售后支持。

✅ **极速发货**：下单即发，无需等待，即刻开启 AI 之旅。
✅ **稳定可靠**：精选优质独享账号，拒绝封号焦虑，售后无忧。
✅ **超全品类**：ChatGPT Plus、Claude 4.5、Gemini 3 Pro、Claude Pro、Midjourney、Poe、Sunno 等热门 AI 工具账号应有尽有。
✅ **超高性价比**：比官方订阅更优惠的价格，享受同等尊贵服务。

🚀 **立即访问 [aivora.cn](https://www.aivora.cn/) 查看当前可用服务。**
    `;
}

const MID_SOFT_AD = `> 💡 **提示**：不确定该选哪种 AI 账号或订阅方案？可前往 [**爱窝啦·AI账号店**](https://www.aivora.cn/?utm_source=daily_news&utm_medium=mid_ad&utm_campaign=content) 查看当前可用服务，并获得购买后的使用指导与售后支持。`;

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
