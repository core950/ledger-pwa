# 墨账

黑白极简的本地记账 PWA，面向 iPhone Safari 使用。它不需要 Mac、不需要 App Store，部署到 HTTPS 后可以添加到主屏幕。

## 功能

- 手动记录收入和支出
- 导入 CSV、TSV、TXT 账单并自动识别日期、金额、收支、商户/备注
- Supabase 云同步，适合长期使用和换机恢复
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

## 长期使用：Supabase 云同步

只靠 iPhone Safari/PWA 的本地存储并不适合长期保存重要账本。建议开启 Supabase 云同步：本地仍可离线使用，联网后同步到你的 Supabase 数据库。

### 1. 创建 Supabase 项目

1. 打开 `https://supabase.com` 并登录。
2. 创建一个新项目。
3. 进入 `Project Settings` -> `API`。
4. 复制：
   - `Project URL`
   - `anon public` key

### 2. 创建数据表

进入 Supabase 项目的 `SQL Editor`，粘贴并运行：

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

如果重复运行提示 policy 已存在，可以忽略，或先删除同名 policy 后再运行。

### 3. 在墨账里开启

1. 打开应用的 `同步` 页。
2. 填入 Supabase `Project URL` 和 `anon public key`。
3. 点击 `保存云配置`。
4. 输入邮箱和密码，点击 `注册`。
5. 如果 Supabase 要求邮箱验证，先去邮箱确认，再回到应用点击 `登录`。
6. 点击 `立即同步`。

之后每次手动记账、导入账单、删除记录都会先保存到本地，并排队同步到云端。换手机时，重新打开应用、填同一套 Supabase 配置并登录，再点 `从云端恢复`。
