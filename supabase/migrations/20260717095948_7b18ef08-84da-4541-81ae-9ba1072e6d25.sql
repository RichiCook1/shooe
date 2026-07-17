
begin;

create table if not exists public.reviews_quarantine
  (like public.reviews including all);
alter table public.reviews_quarantine
  add column if not exists quarantine_reason text;
alter table public.reviews_quarantine
  add column if not exists quarantined_at timestamptz default now();
alter table public.reviews_quarantine enable row level security;

create temp table q_ids on commit drop as
select id,
       case
         when trim(coalesce(content,'')) ~* '\[reviewer:\s*kofuzi[^\]]*\]$'
           then 'youtube'
         when coalesce(guest_session_id,'') like 'import:%'
           then 'import_derived'
         when coalesce(guest_session_id,'') ~ '^guest-[0-9]+$'
           then 'synthetic'
       end as reason
from public.reviews
where trim(coalesce(content,'')) ~* '\[reviewer:\s*kofuzi[^\]]*\]$'
   or coalesce(guest_session_id,'') like 'import:%'
   or coalesce(guest_session_id,'') ~ '^guest-[0-9]+$'
;

insert into public.reviews_quarantine
select r.*, q.reason, now()
from public.reviews r
join q_ids q on q.id = r.id;

delete from public.review_tags   where review_id in (select id from q_ids);
delete from public.likes         where review_id in (select id from q_ids);
delete from public.comments      where review_id in (select id from q_ids);
delete from public.saved_reviews where review_id in (select id from q_ids);

delete from public.reviews where id in (select id from q_ids);

commit;

update public.model_summaries ms
set review_count = sub.c,
    avg_rating   = sub.a,
    updated_at   = now()
from (
  select model_id, count(*) as c, round(avg(rating)::numeric, 2) as a
  from public.reviews
  where model_id is not null
  group by model_id
) sub
where ms.model_id = sub.model_id;

update public.model_summaries
set review_count = 0, avg_rating = null, updated_at = now()
where model_id not in
  (select distinct model_id from public.reviews where model_id is not null);

update public.model_summaries
set summary = null, top_tags = null, updated_at = now()
where model_id in (select distinct model_id from public.reviews_quarantine);
