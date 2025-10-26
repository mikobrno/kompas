-- Quick row count sanity checks after seeding
select 'users' as table, count(*) as rows from public.users
union all select 'categories', count(*) from public.categories
union all select 'links', count(*) from public.links
union all select 'category_shares', count(*) from public.category_shares
union all select 'link_shares', count(*) from public.link_shares
order by 1;