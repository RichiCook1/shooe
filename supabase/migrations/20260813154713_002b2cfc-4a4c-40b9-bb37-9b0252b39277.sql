begin;

-- move empty-content reviews to quarantine

create temp table q_empty on commit drop as

  select id from public.reviews where length(coalesce(content,'')) = 0;

insert into public.reviews_quarantine

  select r.*, 'empty_content', now() from public.reviews r

  join q_empty q on q.id = r.id;

delete from public.review_tags   where review_id in (select id from q_empty);

delete from public.likes         where review_id in (select id from q_empty);

delete from public.comments      where review_id in (select id from q_empty);

delete from public.saved_reviews where review_id in (select id from q_empty);

delete from public.reviews       where id in (select id from q_empty);

commit;

-- recompute summaries

update public.model_summaries ms

set review_count = sub.c, avg_rating = sub.a, updated_at = now()

from (select model_id, count(*) c, round(avg(rating)::numeric,2) a

      from public.reviews where model_id is not null group by model_id) sub

where ms.model_id = sub.model_id;

update public.model_summaries

set review_count = 0, avg_rating = null, updated_at = now()

where model_id not in (select distinct model_id from public.reviews where model_id is not null);

-- verify

select count(*) as remaining_empty from public.reviews where length(coalesce(content,'')) = 0;

select quarantine_reason, count(*) from public.reviews_quarantine group by 1;