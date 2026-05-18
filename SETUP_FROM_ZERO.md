# 墨账从 0 搭建流程

这份文档记录从零开始搭建、部署、开启云同步、iPhone 使用和账单导入的完整流程。

## 1. 准备项目

项目是纯静态 PWA，不需要 Mac，不需要 App Store。

需要的东西：

- Windows 电脑
- Git
- GitHub 账号
- Cloudflare 账号
- Supabase 账号
- iPhone Safari

项目文件：

```text
index.html
styles.css
app.js
manifest.webmanifest
sw.js
icon.svg
README.md
```

## 2. 初始化 Git 并推送到 GitHub

进入项目目录：

```powershell
cd "E:\Microsoft VS Code\ledger-pwa"
```

初始化 Git：

```powershell
git init
git branch -M main
git add .
git commit -m "Initial ink ledger PWA"
```

在 GitHub 创建空仓库，不要勾选 README、gitignore、license。

添加远程仓库并推送：

```powershell
git remote add origin https://github.com/core950/ledger-pwa.git
git push -u origin main
```

以后每次改完：

```powershell
git add .
git commit -m "说明这次修改"
git push
```

## 3. 部署到 Cloudflare

打开 Cloudflare 控制台：

```text
https://dash.cloudflare.com
```

进入：

```text
Workers and Pages
```

选择：

```text
Start building
Continue with GitHub
```

选择仓库：

```text
core950/ledger-pwa
```

构建设置：

```text
Framework preset: None
Build command: 留空
Build output directory: .
```

部署完成后得到 HTTPS 地址：

```text
https://ledger-pwa.coore7290.workers.dev/
```

## 4. iPhone 添加到主屏幕

用 iPhone Safari 打开：

```text
https://ledger-pwa.coore7290.workers.dev/
```

然后：

```text
分享按钮 -> 添加到主屏幕 -> 添加
```

如果更新后 iPhone 还是旧版本：

1. Safari 打开线上地址。
2. 刷新一次。
3. 关闭主屏幕里的墨账再打开。
4. 如果仍旧没更新，删除主屏幕图标后重新添加。

## 5. 创建 Supabase 项目

打开：

```text
https://supabase.com
```

创建新项目。

进入：

```text
Project Settings -> API
```

复制：

```text
Project URL
Publishable key
```

注意：

- Project URL 类似 `https://xxxx.supabase.co`
- key 要用 `sb_publishable_...`
- 不要把 `sb_secret_...` 填进网页

## 6. 设置 Supabase 邮件跳转

如果确认邮件点开后跳到 localhost，需要改 URL。

进入 Supabase：

```text
Authentication -> URL Configuration
```

Site URL 填：

```text
https://ledger-pwa.coore7290.workers.dev/
```

Redirect URLs 添加：

```text
https://ledger-pwa.coore7290.workers.dev/**
```

保存。

## 7. 创建云端数据表

进入 Supabase：

```text
SQL Editor -> New query
```

粘贴并运行：

```sql
create table if not exists public.ledger_records (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12, 2) not null,
  category text not null default '未分类',
  record_date date not null,
  note text not null default '',
  source text not null default '手动',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ledger_records enable row level security;

create policy "Users can read own ledger records"
on public.ledger_records
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own ledger records"
on public.ledger_records
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own ledger records"
on public.ledger_records
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own ledger records"
on public.ledger_records
for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists ledger_records_user_date_idx
on public.ledger_records (user_id, record_date desc);
```

SQL Editor 里只能放 SQL，不要把文档标题一起复制进去。

## 8. 在墨账里开启云同步

打开墨账：

```text
同步
```

填写：

```text
Supabase Project URL: https://xxxx.supabase.co
Supabase anon public key: sb_publishable_...
```

点击：

```text
保存云配置
检查云配置
```

如果显示云配置可访问：

1. 输入邮箱和密码。
2. 第一次使用点 `注册`。
3. 去 Gmail 点 Supabase 确认邮件。
4. 回到墨账点 `登录`。
5. 点 `立即同步`。

如果提示限流：

```text
For security purposes, you can only request this after xx seconds.
```

等 1 分钟再试，不要连续点注册或登录。

## 9. 电脑导入账单并同步到 iPhone

推荐流程：

```text
电脑打开墨账 -> 登录云同步 -> 导入微信账单 -> 导入选中 -> 立即同步
iPhone 打开墨账 -> 登录同一账号 -> 从云端恢复
```

这样电脑导入的数据会同步到 iPhone。

## 10. 微信账单导入

支持：

- CSV
- TXT
- TSV
- XLSX

微信常见字段：

```text
交易时间
交易类型
交易对方
商品
收/支
金额(元)
支付方式
当前状态
交易单号
商户单号
备注
```

iOS 直接导入 XLSX 可能受浏览器能力影响。如果失败，使用电脑端导入再同步到 iPhone。

## 11. 日常记账

首页支持：

- 本月结余、支出、收入
- 今日结余、支出、收入
- 按日期分组流水
- 每天独立创建清点分组
- 勾选明细归入分组或取消分组
- 在分组内新增明细，组内明细不计入当天/本月总金额
- 按月筛选
- 按日筛选
- 搜索分类或备注
- 编辑已有记录
- 删除记录

编辑记录：

```text
流水 -> 编辑 -> 修改表单 -> 保存修改
```

## 12. JSON 备份

即使开启云同步，也建议定期导出备份。

进入：

```text
备份 -> 导出 JSON 备份
```

恢复：

```text
备份 -> 导入 JSON 备份
```

## 13. iOS 轻点背面快速记账

PWA 不能直接监听 iPhone 背面轻点，需要通过 iOS 快捷指令。

打开 iPhone：

```text
快捷指令 -> 新建快捷指令 -> 打开 URL
```

URL 示例：

```text
https://ledger-pwa.coore7290.workers.dev/?quick=1&auto=1&type=expense&amount=10&category=餐饮&note=背面轻点
```

然后：

```text
设置 -> 辅助功能 -> 触控 -> 轻点背面
```

选择轻点两下或轻点三下，绑定这个快捷指令。

参数说明：

```text
quick=1      开启快捷记账
auto=1       自动保存
type=expense 支出
type=income  收入
amount=10    金额
category=餐饮 分类
note=背面轻点 备注
```

如果不想自动保存，去掉 `auto=1`，应用会打开并预填表单。

## 14. 常见错误

### 邮件确认跳到 localhost

去 Supabase：

```text
Authentication -> URL Configuration
```

把 Site URL 改成线上地址。

### 云端数据表还没建好

去 Supabase SQL Editor 运行第 7 节 SQL。

### column ledger_records.date does not exist

这是旧版本字段名问题。刷新应用，确认线上 `sw.js` 是新缓存版本。

### 邮箱或密码不正确

可能是：

- 没注册
- 密码错
- 邮箱没确认

第一次使用先点注册。

### Publishable key 不正确

重新复制 `sb_publishable_...` 开头的完整 key，不要用 `sb_secret_...`。

### iPhone 还是旧版

Safari 打开线上地址刷新，必要时删除主屏幕图标后重新添加。
