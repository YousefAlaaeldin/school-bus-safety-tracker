begin;
select plan(8);

select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');  -- ADMIN_A

select is(
  public.import_roster('11111111-1111-1111-1111-111111111111', $$[
    {"name_en": "Noor Hassan", "name_ar": "نور حسن", "grade": "3", "guardian_phone": "050 111 2233", "relationship": "mother",
     "guardian2_phone": "0502223344", "relationship2": "father"},
    {"name_en": "Adam Hassan", "name_ar": "آدم حسن", "guardian_phone": "+971503334455"}
  ]$$::jsonb),
  '{"students_created": 2, "links_created": 3, "errors": []}'::jsonb,
  'two valid rows create 2 students and 3 links');

select is((select count(*)::int from public.students), 7, 'students were inserted');
select is((select relationship from public.guardian_links where guardian_phone = '+971503334455'), 'guardian',
          'relationship defaults to guardian');

select is(
  public.import_roster('11111111-1111-1111-1111-111111111111', $$[
    {"name_en": "A", "name_ar": "أ", "guardian_phone": "0501110000"},
    {"name_en": "B", "name_ar": "ب", "guardian_phone": "abc"},
    {"name_en": "C", "name_ar": "ج"}
  ]$$::jsonb),
  '{"students_created": 0, "links_created": 0, "errors": [{"row": 2, "code": "BAD_PHONE"}]}'::jsonb,
  'a bad phone on row 2 is reported and nothing is inserted');
select is((select count(*)::int from public.students), 7, 'student count unchanged after a failed import');

select is(
  (public.import_roster('11111111-1111-1111-1111-111111111111', $$[
    {"name_en": "A"}
  ]$$::jsonb))->'errors',
  '[{"row": 1, "code": "NAME_AR_REQUIRED"}]'::jsonb,
  'missing name_ar');
select tests.clear_authentication();

select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');  -- HELPER_A
select throws_ok(
  $$ select public.import_roster('11111111-1111-1111-1111-111111111111', '[]'::jsonb) $$,
  'P0001', 'NOT_AUTHORIZED', 'a helper cannot import');
select tests.clear_authentication();

select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select throws_ok(
  $$ select public.import_roster('11111111-1111-1111-1111-111111111111', '{"a":1}'::jsonb) $$,
  'P0001', 'INVALID_INPUT', 'rows must be an array');
select tests.clear_authentication();

select * from finish();
rollback;
