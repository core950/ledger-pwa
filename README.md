# 墨账

黑白极简的本地记账 PWA，面向 iPhone Safari 使用。它不需要 Mac、不需要 App Store，部署到 HTTPS 后可以添加到主屏幕。

## 功能

- 手动记录收入和支出
- 导入 CSV、TSV、TXT 账单并自动识别日期、金额、收支、商户/备注
- 按关键词和月份筛选流水
- 本月收入、支出、结余汇总
- 分类支出排行
- JSON 备份导入导出
- Service Worker 离线缓存

## 本地预览

在 Windows PowerShell 里进入目录：

```powershell
cd "E:\Microsoft VS Code\ledger-pwa"
python -m http.server 5173
```

电脑浏览器打开：

```text
http://localhost:5173
```

如果想用 iPhone 预览，需要让手机和电脑在同一 Wi-Fi，并用电脑局域网 IP 访问，例如：

```text
http://你的电脑IP:5173
```

正式使用建议部署到 Vercel、Netlify、Cloudflare Pages 或自己的 HTTPS 服务器。iPhone Safari 打开后，点分享按钮，再选“添加到主屏幕”。

## 账单导入

优先导入支付宝、微信、银行导出的 CSV/TXT。解析器会自动寻找表头，常见字段包括：

- 日期、交易时间、付款时间
- 金额、人民币、收入、支出
- 收/支、交易类型、借贷方向
- 交易对方、商户、商品、备注、摘要

导入前会先显示预览，可以取消不想导入的记录。
