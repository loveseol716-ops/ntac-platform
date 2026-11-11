-- Add missing canonical lifts without deleting exercises or rewriting historical data.
insert into public.group_exercises(id,name) values
 ('back_squat','백 스쿼트'), ('front_squat','프론트 스쿼트'),
 ('bench_press','벤치 프레스'), ('pendlay_row','팬들레이 로우'),
 ('deadlift','컨벤셔널 데드리프트'), ('overhead_press','오버헤드 프레스'),
 ('push_press','푸시 프레스'), ('push_jerk','푸시 저크'), ('power_clean','파워 클린')
on conflict(id) do nothing;
