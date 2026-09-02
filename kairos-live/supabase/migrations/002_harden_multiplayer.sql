-- KAIROS LIVE: security and consistency hardening.
-- Run after 001_multiplayer.sql. Safe to run more than once.

-- Players may inspect their own answer. The host may inspect all answers to
-- operate the round, and everybody may inspect them after the reveal.
drop policy if exists "member reads answers" on public.answers;
drop policy if exists "players read permitted answers" on public.answers;
create policy "players read permitted answers"
on public.answers for select to authenticated
using (
  exists (
    select 1
    from public.players answer_player
    join public.rounds answer_round on answer_round.id = answers.round_id
    join public.rooms answer_room on answer_room.id = answer_round.room_id
    where answer_player.id = answers.player_id
      and public.is_room_member(answer_room.id)
      and (
        answer_player.user_id = auth.uid()
        or answer_room.host_id = auth.uid()
        or answer_round.revealed_at is not null
      )
  )
);

-- Keep the existing RPC signature so deployed clients remain compatible, but
-- calculate speed on the database clock. A player cannot award themselves a
-- larger speed bonus by sending a fake elapsed time.
create or replace function public.submit_answer(
  target_round uuid,
  selected_choice smallint,
  elapsed integer
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  p public.players;
  r public.rounds;
  q public.questions;
  awarded integer;
  server_elapsed integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into r from public.rounds where id=target_round;
  if r.id is null then raise exception 'Round not found'; end if;

  if not exists (
    select 1 from public.rooms
    where id=r.room_id and phase='question'
  ) or r.revealed_at is not null then
    raise exception 'Round is closed';
  end if;

  select * into p
  from public.players
  where room_id=r.room_id and user_id=auth.uid();
  if p.id is null then raise exception 'Player not found'; end if;

  select * into q from public.questions where id=r.question_id and active;
  if q.id is null then raise exception 'Question not found'; end if;

  server_elapsed := greatest(0, floor(extract(epoch from (now()-r.started_at))*1000)::integer);
  if server_elapsed > (r.duration_seconds+2)*1000 then
    raise exception 'Time is up';
  end if;

  awarded := case
    when selected_choice=q.correct then
      round(100+100*greatest(0,1-server_elapsed::numeric/(r.duration_seconds*1000)))
    else 0
  end;

  insert into public.answers(
    round_id,player_id,choice,elapsed_ms,is_correct,points_awarded
  ) values (
    r.id,p.id,selected_choice,server_elapsed,selected_choice=q.correct,awarded
  );

  update public.players set points=points+awarded where id=p.id;
  return awarded;
end
$$;

revoke all on function public.submit_answer(uuid,smallint,integer) from public;
grant execute on function public.submit_answer(uuid,smallint,integer) to authenticated;

