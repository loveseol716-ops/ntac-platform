-- Training anchors belong to their own class; retain the agreed week-six tests.
do $$ declare body text; anchor text;
begin
 select pg_get_functiondef('private.group_design_rule(date,text)'::regprocedure) into body;
 anchor:='case when w=6 and class_type=''bomb_strength'' then ''[]''::jsonb else ''["back_squat","hang_power_clean"]''::jsonb end';
 if position(anchor in body)=0 then raise exception 'Seasonal required-lift mapping anchor missing';end if;
 body:=replace(body,anchor,'case when w=6 then case when class_type=''bomb_strength'' then ''[]''::jsonb else ''["back_squat","hang_power_clean"]''::jsonb end when class_type=''gentle_strength'' then ''["back_squat"]''::jsonb else ''["hang_power_clean"]''::jsonb end');
 execute body;
end $$;
