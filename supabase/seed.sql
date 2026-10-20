-- Éclat — données de référence (catégories + offres)
-- Les prix en CDF sont indicatifs : l'administrateur les ajuste selon le taux du moment.

insert into public.categories (slug, name, name_plural, icon, sort, detail_schema) values
  ('photographe', 'Photographe',          'Photographes',          'camera',   1, '[{"key":"materiel","label":"Matériel","type":"list"},{"key":"delai_livraison","label":"Délai de livraison","type":"text"}]'),
  ('videaste',    'Vidéaste',             'Vidéastes',             'video',    2, '[{"key":"materiel","label":"Matériel","type":"list"},{"key":"formats","label":"Formats livrés","type":"list"}]'),
  ('drone',       'Pilote de drone',      'Pilotes de drone',      'drone',    3, '[{"key":"appareils","label":"Appareils","type":"list"},{"key":"autorisations","label":"Autorisations de vol","type":"text"}]'),
  ('salle',       'Salle de fête',        'Salles de fête',        'building', 4, '[{"key":"places_assises","label":"Places assises","type":"number"},{"key":"places_debout","label":"Places debout","type":"number"},{"key":"parking","label":"Places de parking","type":"number"},{"key":"superficie","label":"Superficie (m²)","type":"number"},{"key":"equipements","label":"Équipements","type":"list"},{"key":"adresse","label":"Adresse","type":"text"},{"key":"acces","label":"Plan d''accès","type":"text"}]'),
  ('decorateur',  'Décorateur',           'Décorateurs',           'sparkles', 5, '[{"key":"styles","label":"Styles","type":"list"}]'),
  ('fleuriste',   'Fleuriste',            'Fleuristes',            'flower',   6, '[]'),
  ('traiteur',    'Traiteur',             'Traiteurs',             'utensils', 7, '[{"key":"cuisines","label":"Cuisines","type":"list"},{"key":"couverts_max","label":"Couverts maximum","type":"number"}]'),
  ('dj',          'DJ',                   'DJ',                    'music',    8, '[{"key":"materiel","label":"Matériel son & lumière","type":"list"},{"key":"genres","label":"Genres musicaux","type":"list"}]'),
  ('maquilleur',  'Maquilleuse',          'Maquilleurs',           'brush',    9, '[]'),
  ('voiture',     'Location de voitures', 'Location de voitures',  'car',     10, '[{"key":"flotte","label":"Véhicules","type":"list"}]'),
  ('planner',     'Wedding planner',      'Wedding planners',      'clipboard',11, '[]')
on conflict (slug) do nothing;

insert into public.plans (id, name, price_usd, price_cdf, sort, limits) values
  ('free',     'Gratuit',  0,    0,      1, '{"max_photos":30,"max_videos":0,"storage_mb":500,"max_video_mb":0,"max_packages":1,"team_seats":1,"stats":"basic","verified_badge":false,"recommendation_eligible":false,"stories":false}'),
  ('pro',      'Pro',      1900, 55000,  2, '{"max_photos":300,"max_videos":10,"storage_mb":5120,"max_video_mb":200,"max_packages":10,"team_seats":3,"stats":"advanced","verified_badge":true,"recommendation_eligible":false,"stories":true}'),
  ('prestige', 'Prestige', 4900, 140000, 3, '{"max_photos":1500,"max_videos":50,"storage_mb":25600,"max_video_mb":500,"max_packages":null,"team_seats":10,"stats":"advanced","verified_badge":true,"recommendation_eligible":true,"stories":true}')
on conflict (id) do nothing;
