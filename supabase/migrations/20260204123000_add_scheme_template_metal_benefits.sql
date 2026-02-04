alter table public.scheme_templates
  add column if not exists metal_type text not null default 'GOLD',
  add column if not exists benefits text;

alter table public.scheme_templates
  add constraint scheme_templates_metal_type_check
  check (metal_type in ('GOLD', 'SILVER'));
