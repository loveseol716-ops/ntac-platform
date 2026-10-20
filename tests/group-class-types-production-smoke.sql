-- Hosted compatibility check. All timetable, week and roster changes are rolled back.
begin;
do $$
declare aid uuid; uid uuid; ws date; rev integer; data jsonb; result jsonb; wid uuid; cid uuid; bundle jsonb;
begin
 select id into aid from public.profiles where role in ('owner','admin') order by id limit 1;
 select id into uid from public.profiles where role='member' order by id limit 1;
 ws:=date_trunc('week',now() at time zone 'Asia/Seoul')::date+224;
 while exists(select 1 from public.group_weeks where week_start=ws and status<>'archived')
    or exists(select 1 from public.group_classes where (starts_at at time zone 'Asia/Seoul')::date between ws and ws+6) loop ws:=ws+7;end loop;
 perform set_config('request.jwt.claim.sub',aid::text,true);perform set_config('role','authenticated',true);
 select revision into rev from public.group_timetable where id;
 perform public.group_save_timetable('[]',rev);
 select jsonb_agg(jsonb_build_object('class_type_id',id,'title',name,'description','ROLLBACK '||id,'movements','[]'::jsonb) order by sort_order) into bundle from public.group_class_types;
 data:=jsonb_build_object('week_start',ws,'title','ROLLBACK SEVEN TYPES','status','published','program_mode','class_type','programs',bundle);
 result:=public.group_save_week(data);wid:=(result->>'id')::uuid;
 if (result->>'created')::int<>26 or not (result->>'default_timetable_loaded')::boolean then raise exception '26 poster occurrences not generated';end if;
 if exists(select 1 from public.group_classes where week_id=wid and description<>'ROLLBACK '||class_type_id) then raise exception 'Class prescription mismatch';end if;
 if (select count(*) from public.group_classes where week_id=wid and class_type_id='gentle_strength')<>6
    or (select count(*) from public.group_classes where week_id=wid and class_type_id='bomb_strength')<>5 then raise exception 'Repeated weekday matching failed';end if;
 if not exists(select 1 from public.group_classes where week_id=wid and class_type_id='you_in' and (starts_at at time zone 'Asia/Seoul')::time='19:30') then raise exception 'Thursday start mismatch';end if;
 perform public.group_set_member(uid,true);
 select id into cid from public.group_classes where week_id=wid order by starts_at limit 1;
 perform public.group_join(cid,array[uid]);
 result:=public.group_save_week(data||jsonb_build_object('id',wid,'revision',1));
 if (result->>'created')::int<>0 or (result->>'updated')::int<>25 or (result->>'kept')::int<>1 then raise exception 'Republish/frozen roster mismatch';end if;
 begin perform public.group_save_week(data||jsonb_build_object('id',wid,'revision',2,'program_mode','day'));raise exception 'Legacy client downgraded type week';exception when raise_exception then if SQLERRM not like '%최신 화면%' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 if not exists(select 1 from public.group_weeks where id=wid and jsonb_array_length(programs)=7) then raise exception 'Member published bundle not visible';end if;
 begin perform public.group_save_week(data);raise exception 'Member could publish';exception when raise_exception then if SQLERRM not like '%관리자%' then raise;end if;end;
 perform set_config('request.jwt.claim.sub','',true);perform set_config('role','anon',true);
 begin perform public.group_save_week(data);raise exception 'Anonymous publish permitted';exception when insufficient_privilege then null;end;
 perform set_config('role','none',true);
end $$;
rollback;
select 'PASS: seven-class bundles, 26 poster occurrences, repeated weekdays, frozen roster, legacy guard and member permissions; all test changes rolled back' as result;
