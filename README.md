# 墨账

黑白极简的本地记账 PWA，面向 iPhone Safari 使用。它不需要 Mac、不需要 App Store，部署到 HTTPS 后可以添加到主屏幕。

## 功能

- 手动记录收入和支出
- 支持按日查看每日收入、支出、结余
- 支持编辑已保存的记账记录
- 每日账单支持独立分组、勾选明细归组、组内新增明细
- 导入账单保留到分钟，流水按具体时间排序
- 支持 iOS 快捷指令链接快速记账，可配合“轻点背面”使用
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

优先导入支付宝、微信、银行导出的 CSV/TXT/XLSX。解析器会自动寻找表头，常见字段包括：

- 日期、交易时间、付款时间
- 金额、人民币、收入、支出
- 收/支、交易类型、借贷方向
- 交易对方、商户、商品、备注、摘要

导入前会先显示预览，可以取消不想导入的记录。

微信账单常见字段已经做了兼容：

- `交易时间`
- `交易类型`
- `交易对方`
- `商品`
- `收/支`
- `金额(元)`
- `支付方式`
- `当前状态`

如果微信导出的 CSV 在电脑上打开是乱码，也可以直接导入应用，应用会自动尝试 UTF-8、GB18030、GBK 等编码。

微信导出的 `.xlsx` 也可以直接导入。应用会读取 Excel 内部工作表，并把微信账单里的 Excel 日期序列号自动转换成正常日期。

### iPhone 导入建议

iOS Safari/PWA 对微信 `.xlsx` 直接导入不稳定。长期使用时推荐：

1. 在电脑浏览器打开墨账。
2. 登录同一个 Supabase 云同步账号。
3. 在电脑上导入微信 `.xlsx` 账单。
4. 点击 `立即同步`。
5. iPhone 打开墨账，登录同一个账号，点击 `从云端恢复`。

这样电脑导入的账单会同步到 iPhone。iPhone 端更适合直接导入 CSV/TXT，或做日常手动记账和查看统计。

## iOS 轻点背面快速记账

PWA 不能直接读取 iPhone 背面轻点事件。可以用 iOS 自带的“快捷指令”作为桥：

1. 打开 iPhone `快捷指令`。
2. 新建快捷指令，动作选择 `打开 URL`。
3. URL 填下面这种格式：

```text
https://ledger-pwa.coore7290.workers.dev/?quick=1&auto=1&type=expense&amount=10&category=餐饮&note=背面轻点
```

4. 打开 `设置` -> `辅助功能` -> `触控` -> `轻点背面`。
5. 选择 `轻点两下` 或 `轻点三下`，绑定刚才的快捷指令。

参数说明：

- `auto=1`：打开后自动记账。
- `type=expense`：支出；收入用 `income`。
- `amount=10`：金额。
- `category=餐饮`：分类。
- `note=背面轻点`：备注。

如果不想自动保存，可以去掉 `auto=1`，应用会打开并预填表单，确认后再保存。

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
