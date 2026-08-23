# 自托管 Supabase 部署检查

应用代码和 Supabase 数据库结构需要一起升级。只重新构建或重启 Next.js，
不会自动修改自托管 PostgreSQL。

## 本次登录修复必须执行的迁移

迁移文件：

`supabase/migrations/20260821164704_secure_pending_user_credentials.sql`

执行前先备份数据库。默认 Supabase Docker 部署的数据库容器通常叫
`supabase-db`，如果你的容器名不同，请先用 `docker ps` 确认并替换命令中的名称。

```bash
docker exec -t supabase-db pg_dump -U postgres -d postgres -Fc -f /tmp/bangbang-before-auth-upgrade.dump
docker cp supabase-db:/tmp/bangbang-before-auth-upgrade.dump ./bangbang-before-auth-upgrade.dump
```

在项目代码目录执行迁移：

```bash
docker exec -i supabase-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/migrations/20260821164704_secure_pending_user_credentials.sql
```

也可以打开自托管 Supabase Studio 的 SQL Editor，粘贴整个迁移文件并执行。
迁移使用事务；任何一步失败都会整体回滚，不会留下半套权限结构。

## 验证

```bash
docker exec -i supabase-db psql -U postgres -d postgres -c "select table_name, column_name, is_nullable from information_schema.columns where table_schema = 'public' and table_name in ('admin_users','approved_users','pending_users') and column_name = 'auth_user_id' order by table_name;"
```

正常结果应有三行，且 `is_nullable` 都是 `NO`。迁移末尾会通知 PostgREST
刷新结构缓存，通常不需要重启 Supabase。随后重新尝试登录即可。

如果迁移提示某个邮箱没有匹配的 `auth.users` 账户，请先在
Authentication → Users 中为该邮箱创建或恢复 Auth 账户，再重新执行迁移。

## 环境变量

自托管地址可以是 HTTP、HTTPS、局域网 IP 或自定义域名。至少需要：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://你的-supabase-地址
SUPABASE_URL=https://你的-supabase-地址
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的-anon-key
SUPABASE_SERVICE_ROLE_KEY=你的-service-role-key
```

`service-role-key` 只能放在服务器环境变量中，不能添加 `NEXT_PUBLIC_` 前缀，
也不能提交到 Git。
