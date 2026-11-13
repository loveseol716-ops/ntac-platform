begin;
do $$ begin
 if private.group_design_rule('2026-11-23','gentle_strength')->'required'<>'["back_squat"]'::jsonb then raise exception 'Gentle training anchor wrong';end if;
 if private.group_design_rule('2026-12-21','bomb_strength')->'required'<>'["hang_power_clean"]'::jsonb then raise exception 'Bomb training anchor wrong';end if;
 if private.group_design_rule('2026-12-28','gentle_strength')->'required'<>'["back_squat","hang_power_clean"]'::jsonb then raise exception 'Lifting tests changed';end if;
 if private.group_design_rule('2026-12-28','bomb_strength')->'required'<>'[]'::jsonb then raise exception 'Metcon assessment changed';end if;
end $$;
rollback;
select 'PASS: class-specific training anchors and unchanged final assessment exceptions' as result;
