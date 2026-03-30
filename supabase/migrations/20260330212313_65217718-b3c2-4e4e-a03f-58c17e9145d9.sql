UPDATE public.products SET price = regexp_replace(price, '[^0-9.]', '', 'g');
ALTER TABLE public.products ALTER COLUMN price TYPE numeric USING price::numeric;