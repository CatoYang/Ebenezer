begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- Sizes are passed in, and the dates are in 2000, so real rows and the real database size don't matter.

select is((select count(*)::int from public.claim_storage_alert(1000, 0.8, '2000-01-01 12:00+00', 799)), 0,
  'below 80%: no warning');

select results_eq(
  $$ select alert_period, used_bytes, limit_bytes from public.claim_storage_alert(1000, 0.8, '2000-01-02 12:00+00', 800) $$,
  $$ values ('2000-01-02', 800::bigint, 1000::bigint) $$,
  'at 80%: warns, with the UTC date and sizes'
);

select is((select count(*)::int from public.claim_storage_alert(1000, 0.8, '2000-01-02 23:00+00', 950)), 0,
  'only once a day');

select is((select count(*)::int from public.claim_storage_alert(1000, 0.8, '2000-01-03 00:30+00', 950)), 1,
  'again the next UTC day');

-- Singapore just after midnight is still the previous UTC day.
select is((select count(*)::int from public.claim_storage_alert(1000, 0.8, '2000-01-04 07:00+08', 950)), 0,
  'the day is the UTC date (already warned on 3 Jan UTC)');

select isnt((select count(*)::int from public.claim_storage_alert(1)), 0,
  'measures the real database size when none is given');

select * from finish();
rollback;
