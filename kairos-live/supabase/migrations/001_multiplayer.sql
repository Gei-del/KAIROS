-- KAIROS LIVE: persisted multiplayer rooms. Run in the Supabase SQL editor.
create extension if not exists pgcrypto;
create type public.room_phase as enum ('lobby','question','reveal','ended');
create type public.game_difficulty as enum ('facil','media','dificil');

create table public.rooms (
  id uuid primary key default gen_random_uuid(), code text not null unique,
  host_id uuid not null references auth.users(id) on delete cascade,
  phase room_phase not null default 'lobby', current_round integer not null default 0,
  max_rounds integer not null default 10 check (max_rounds between 3 and 30),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (code ~ '^[A-HJ-NP-Z2-9]{4}$')
);
create table public.players (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 18), avatar text not null,
  points integer not null default 0 check (points >= 0), joined_at timestamptz not null default now(),
  unique(room_id,user_id)
);
create table public.questions (
  id text primary key, prompt text not null, options jsonb not null check (jsonb_array_length(options)=4),
  correct smallint not null check (correct between 0 and 3), reference text not null,
  difficulty game_difficulty not null, source_version text not null default 'RV1909', active boolean not null default true
);
create table public.rounds (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references rooms(id) on delete cascade,
  number integer not null, question_id text not null references questions(id), host_line text not null default '',
  duration_seconds integer not null default 15 check (duration_seconds between 5 and 90),
  started_at timestamptz not null default now(), revealed_at timestamptz,
  unique(room_id,number), unique(room_id,question_id)
);
create table public.answers (
  id uuid primary key default gen_random_uuid(), round_id uuid not null references rounds(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade, choice smallint not null check (choice between 0 and 3),
  elapsed_ms integer not null check (elapsed_ms >= 0), is_correct boolean not null,
  points_awarded integer not null default 0 check (points_awarded >= 0), answered_at timestamptz not null default now(),
  unique(round_id,player_id)
);
create index on players(room_id); create index on rounds(room_id,number desc); create index on answers(round_id);

alter table rooms enable row level security; alter table players enable row level security;
alter table questions enable row level security; alter table rounds enable row level security; alter table answers enable row level security;
create or replace function public.is_room_member(target uuid) returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from players where room_id=target and user_id=auth.uid()) $$;
create policy "member reads room" on rooms for select using (is_room_member(id) or host_id=auth.uid());
create policy "member reads players" on players for select using (is_room_member(room_id));
create policy "authenticated reads questions" on questions for select to authenticated using (active);
create policy "member reads rounds" on rounds for select using (is_room_member(room_id));
create policy "member reads answers" on answers for select using (exists(select 1 from rounds r where r.id=round_id and is_room_member(r.room_id)));
create policy "host updates room" on rooms for update using (host_id=auth.uid()) with check (host_id=auth.uid());
create policy "host creates rounds" on rounds for insert with check (exists(select 1 from rooms where id=room_id and host_id=auth.uid()));
create policy "host updates rounds" on rounds for update using (exists(select 1 from rooms where id=room_id and host_id=auth.uid()));

create or replace function public.create_room(room_code text, player_name text, player_avatar text)
returns uuid language plpgsql security definer set search_path=public as $$ declare rid uuid; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 insert into rooms(code,host_id) values(upper(room_code),auth.uid()) returning id into rid;
 insert into players(room_id,user_id,name,avatar) values(rid,auth.uid(),trim(player_name),player_avatar); return rid;
end $$;
create or replace function public.join_room(room_code text, player_name text, player_avatar text)
returns uuid language plpgsql security definer set search_path=public as $$ declare rid uuid; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select id into rid from rooms where code=upper(room_code) and phase='lobby';
 if rid is null then raise exception 'Room not found or already started'; end if;
 insert into players(room_id,user_id,name,avatar) values(rid,auth.uid(),trim(player_name),player_avatar)
 on conflict(room_id,user_id) do update set name=excluded.name,avatar=excluded.avatar; return rid;
end $$;
create or replace function public.submit_answer(target_round uuid, selected_choice smallint, elapsed integer)
returns integer language plpgsql security definer set search_path=public as $$ declare p players; r rounds; q questions; awarded integer; begin
 select * into r from rounds where id=target_round; select * into p from players where room_id=r.room_id and user_id=auth.uid();
 select * into q from questions where id=r.question_id;
 if p.id is null or r.revealed_at is not null then raise exception 'Round is closed'; end if;
 if now()>r.started_at+make_interval(secs=>r.duration_seconds+2) then raise exception 'Time is up'; end if;
 awarded:=case when selected_choice=q.correct then round(100+100*greatest(0,1-elapsed::numeric/(r.duration_seconds*1000))) else 0 end;
 insert into answers(round_id,player_id,choice,elapsed_ms,is_correct,points_awarded)
 values(r.id,p.id,selected_choice,greatest(elapsed,0),selected_choice=q.correct,awarded);
 update players set points=points+awarded where id=p.id; return awarded;
end $$;
revoke all on function create_room(text,text,text),join_room(text,text,text),submit_answer(uuid,smallint,integer) from public;
grant execute on function create_room(text,text,text),join_room(text,text,text),submit_answer(uuid,smallint,integer) to authenticated;
alter publication supabase_realtime add table rooms,players,rounds,answers;

insert into questions(id,prompt,options,correct,reference,difficulty) values
('q-arca','¿Quién construyó el arca?','["Abraham","Noé","Moisés","David"]',1,'Génesis 6:14','facil'),
('q-mar-rojo','¿Quién extendió su mano para que el mar se retirara?','["Josué","Elías","Moisés","Aarón"]',2,'Éxodo 14:21','facil'),
('q-pez','¿Qué profeta estuvo dentro de un gran pez?','["Jonás","Amós","Oseas","Joel"]',0,'Jonás 1:17','facil'),
('q-gigante','¿A qué gigante venció David?','["Og","Goliat","Sansón","Nimrod"]',1,'1 Samuel 17:50','media'),
('q-tablas','¿En qué monte habló Dios con Moisés?','["Sinaí","Carmelo","Nebo","Sion"]',0,'Éxodo 19:20','media'),
('q-leones','¿Quién fue echado en el foso de los leones?','["Daniel","Ezequiel","Jeremías","Isaías"]',0,'Daniel 6:16','media'),
('q-rey-sabio','¿Qué rey pidió entendimiento para gobernar?','["Saúl","David","Salomón","Ezequías"]',2,'1 Reyes 3:9','dificil'),
('q-patmos','¿En qué isla se encontraba Juan?','["Chipre","Patmos","Creta","Malta"]',1,'Apocalipsis 1:9','dificil') on conflict do nothing;

insert into questions(id,prompt,options,correct,reference,difficulty) values
('q-panes','¿Cuántos panes había antes de alimentar a los cinco mil?','["Dos","Cinco","Siete","Doce"]',1,'Mateo 14:17','facil'),
('q-primer-hombre','¿Cómo se llamaba el primer hombre?','["Caín","Set","Adán","Enós"]',2,'Génesis 2:7','facil'),
('q-evangelios','¿Cuál de estos libros no es uno de los cuatro Evangelios?','["Marcos","Lucas","Hechos","Juan"]',2,'Hechos 1:1','media'),
('q-negacion','¿Cuántas veces negó Pedro conocer a Jesús?','["Una","Dos","Tres","Siete"]',2,'Mateo 26:75','media'),
('q-primer-milagro','¿Qué señal hizo Jesús en Caná de Galilea?','["Sanó a un ciego","Convirtió agua en vino","Caminó sobre el agua","Resucitó a Lázaro"]',1,'Juan 2:11','dificil'),
('q-cartas-pablo','¿Cuál de estas no es una carta dirigida por Pablo a esa iglesia?','["Corintios","Efesios","Antioquenos","Filipenses"]',2,'Colosenses 4:16','dificil'),
('q-fruto','¿Cuál no aparece entre el fruto del Espíritu?','["Paciencia","Bondad","Riqueza","Templanza"]',2,'Gálatas 5:22-23','dificil') on conflict do nothing;
