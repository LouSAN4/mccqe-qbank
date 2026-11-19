-- Execute in Supabase SQL Editor. Never place service_role keys in the browser.
create extension if not exists pgcrypto;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null,
 role text not null default 'student' check (role in ('student','admin')),
 status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
 created_at timestamptz not null default now()
);
create table public.questions (
 id uuid primary key default gen_random_uuid(),
 specialty text not null,
 stem text not null,
 explanation text not null,
 created_at timestamptz not null default now()
);
create table public.question_options (
 question_id uuid not null references public.questions(id) on delete cascade,
 letter text not null check (letter in ('A','B','C','D','E')),
 label text not null,
 is_correct boolean not null default false,
 rationale text not null default '',
 primary key(question_id,letter)
);
create table public.user_answers (
 user_id uuid not null references auth.users(id) on delete cascade,
 question_id uuid not null references public.questions(id) on delete cascade,
 selected_letter text not null,
 is_correct boolean not null,
 answered_at timestamptz not null default now(),
 primary key(user_id,question_id)
);
create index user_answers_user_idx on public.user_answers(user_id);
create index questions_specialty_idx on public.questions(specialty);
create function public.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,email) values (new.id,coalesce(new.email,''));
 return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile();
-- Backfill if accounts already exist. All backfilled users remain pending.
insert into public.profiles(id,email) select id,coalesce(email,'') from auth.users on conflict(id) do nothing;
create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id = (select auth.uid()) and role='admin' and status='approved');
$$;
create function public.is_approved() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and status='approved');
$$;
alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.user_answers enable row level security;
create policy profile_self_read on public.profiles for select to authenticated using (id=(select auth.uid()) or (select public.is_admin()));
create policy question_admin_all on public.questions for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
-- No SELECT grants/policies for question_options or questions to students: use sanitized RPCs.
create policy option_admin_all on public.question_options for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy answer_self_read on public.user_answers for select to authenticated using (user_id=(select auth.uid()) and (select public.is_approved()));
revoke all on public.profiles,public.questions,public.question_options,public.user_answers from anon,authenticated;
grant select on public.profiles to authenticated;
grant select,insert,update,delete on public.questions,public.question_options to authenticated;
grant select on public.user_answers to authenticated;
-- No direct user inserts/updates to profiles or answers.
create function public.list_quiz() returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
 if not public.is_approved() then raise exception 'Accès non autorisé'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'specialty',q.specialty,'stem',q.stem,'options',(
  select coalesce(jsonb_agg(jsonb_build_object('letter',o.letter,'label',o.label) order by o.letter),'[]'::jsonb)
  from public.question_options o where o.question_id=q.id
 )) order by q.created_at,q.id),'[]'::jsonb) into result from public.questions q;
 return result;
end; $$;
create function public.submit_answer(p_question_id uuid,p_letter text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare answer_correct boolean; correct_letter text; explanation_text text; option_explanations jsonb; stored_letter text;
begin
 if not public.is_approved() then raise exception 'Accès non autorisé'; end if;
 if not exists(select 1 from public.questions where id=p_question_id) then raise exception 'Question introuvable'; end if;
 if not exists(select 1 from public.question_options where question_id=p_question_id and letter=p_letter) then raise exception 'Proposition invalide'; end if;
 select selected_letter into stored_letter from public.user_answers where user_id=auth.uid() and question_id=p_question_id;
 if stored_letter is null then
   select is_correct into answer_correct from public.question_options where question_id=p_question_id and letter=p_letter;
   insert into public.user_answers(user_id,question_id,selected_letter,is_correct) values (auth.uid(),p_question_id,p_letter,answer_correct);
 else p_letter:=stored_letter; end if;
 select o.letter into correct_letter from public.question_options o where o.question_id=p_question_id and o.is_correct limit 1;
 select q.explanation into explanation_text from public.questions q where q.id=p_question_id;
 select coalesce(jsonb_agg(jsonb_build_object('letter',letter,'rationale',rationale) order by letter),'[]'::jsonb) into option_explanations from public.question_options where question_id=p_question_id;
 return jsonb_build_object('selected',p_letter,'correct',correct_letter,'is_correct',p_letter=correct_letter,'explanation',explanation_text,'rationales',option_explanations);
end; $$;
create function public.my_results() returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
 if not public.is_approved() then raise exception 'Accès non autorisé'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('question_id',question_id,'selected',selected_letter,'is_correct',is_correct,'answered_at',answered_at)),'[]'::jsonb) into result from public.user_answers where user_id=auth.uid();
 return result;
end; $$;
create function public.admin_set_status(p_user_id uuid,p_status text) returns void language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_admin() then raise exception 'Administrateur requis'; end if;
 if p_status not in ('approved','rejected','suspended','pending') then raise exception 'Statut invalide'; end if;
 if p_user_id=auth.uid() then raise exception 'Impossible de modifier son propre statut'; end if;
 update public.profiles set status=p_status where id=p_user_id and role='student';
end; $$;
create function public.admin_add_question(p_specialty text,p_stem text,p_explanation text,p_options jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid; opt jsonb; letters text[]; correct_count integer;
begin
 if not public.is_admin() then raise exception 'Administrateur requis'; end if;
 if length(trim(coalesce(p_specialty,'')))<2 or length(trim(coalesce(p_stem,'')))<10 or length(trim(coalesce(p_explanation,'')))<3 then raise exception 'Champs incomplets'; end if;
 if jsonb_typeof(p_options)!='array' or jsonb_array_length(p_options) not between 2 and 5 then raise exception 'Entre 2 et 5 propositions requises'; end if;
 select count(*) filter(where (value->>'is_correct')::boolean),array_agg(value->>'letter') into correct_count,letters from jsonb_array_elements(p_options);
 if correct_count!=1 or cardinality(letters)!=cardinality(array(select distinct unnest(letters))) then raise exception 'Une seule bonne réponse et lettres uniques requises'; end if;
 insert into public.questions(specialty,stem,explanation) values(trim(p_specialty),trim(p_stem),trim(p_explanation)) returning id into new_id;
 for opt in select value from jsonb_array_elements(p_options) loop
   insert into public.question_options(question_id,letter,label,is_correct,rationale) values(new_id,opt->>'letter',opt->>'label',(opt->>'is_correct')::boolean,coalesce(opt->>'rationale',''));
 end loop;
 return new_id;
end; $$;
revoke execute on function public.create_profile() from public,anon,authenticated;
revoke execute on function public.is_admin(),public.is_approved(),public.list_quiz(),public.submit_answer(uuid,text),public.my_results(),public.admin_set_status(uuid,text),public.admin_add_question(text,text,text,jsonb) from public,anon;
grant execute on function public.is_admin(),public.is_approved(),public.list_quiz(),public.submit_answer(uuid,text),public.my_results(),public.admin_set_status(uuid,text),public.admin_add_question(text,text,text,jsonb) to authenticated;
-- After your first account is registered, run this ONE-TIME statement in SQL Editor,
-- replacing the address with your own. Never include this statement in GitHub:
-- update public.profiles set role='admin', status='approved' where email='VOTRE_EMAIL';
