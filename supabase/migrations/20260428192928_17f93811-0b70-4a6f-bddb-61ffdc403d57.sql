DELETE FROM public.almoxarifado_itens
WHERE nome IS NULL
   OR btrim(nome) = ''
   OR nome ~ '[\x00-\x08\x0B\x0C\x0E-\x1F]'
   OR nome ~ '[\uFFFD]'
   OR length(nome) > 200
   OR nome !~ '[A-Za-z0-9]';