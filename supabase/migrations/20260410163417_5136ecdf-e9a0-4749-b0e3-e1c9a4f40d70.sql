-- Add mood column to products
ALTER TABLE public.products ADD COLUMN mood text;

-- Seed 15 mood categories with anchor keyword descriptions
INSERT INTO public.categories (name, slug, icon, description, type) VALUES
  ('Cozy', 'cozy', '🧣', 'Warm, soft, comfort-seeking. Blankets, candles, slippers, mugs, loungewear, plush, fleece, knit', 'mood'),
  ('Minimal', 'minimal', '◻️', 'Clean, calm, uncluttered. White decor, simple clothing, organizers, neutral, streamlined, scandinavian', 'mood'),
  ('Luxe', 'luxe', '✨', 'Elevated, indulgent, rich textures. Silk, gold accents, high-end skincare, velvet, premium, designer', 'mood'),
  ('Earthy', 'earthy', '🌿', 'Grounded, natural, organic. Wood, linen, clay, plants, neutral tones, terracotta, botanical', 'mood'),
  ('Playful', 'playful', '🎈', 'Fun, bright, lighthearted. Toys, colorful kitchenware, novelty items, quirky, cheerful, vibrant', 'mood'),
  ('Bold', 'bold', '🔥', 'Statement-making, confident. Bright fashion, graphic art, maximalist decor, loud, dramatic, eye-catching', 'mood'),
  ('Calm', 'calm', '🕊️', 'Soothing, de-stressing. Diffusers, weighted blankets, bath products, aromatherapy, zen, peaceful, tranquil', 'mood'),
  ('Romantic', 'romantic', '🌹', 'Soft, intimate, warm. Candles, lingerie, rose tones, flowers, date night, love, elegant', 'mood'),
  ('Adventurous', 'adventurous', '🏕️', 'Outdoorsy, curious, daring. Camping gear, travel accessories, rugged clothing, explorer, hiking, wanderlust', 'mood'),
  ('Festive', 'festive', '🎉', 'Celebratory, seasonal, joyful. Holiday decor, party supplies, gift wrap, christmas, birthday, celebration', 'mood'),
  ('Focused', 'focused', '🎯', 'Productive, clear-headed. Desk organizers, planners, neutral workwear, office, study, concentration', 'mood'),
  ('Summer Glow', 'summer-glow', '☀️', 'Bright, breezy, outdoor. Sunglasses, beach towels, swimwear, sandals, tropical, warm weather', 'mood'),
  ('Motivated', 'motivated', '💪', 'Active, pumped, energized. Gym gear, bright colors, productivity tools, fitness, sports, workout', 'mood'),
  ('Spring Reset', 'spring-reset', '🌸', 'Fresh, clean, pastel, renewal. Decluttering, light fabrics, floral, garden, new beginnings', 'mood'),
  ('I Love Milo', 'i-love-milo', '🐾', 'Pet-focused, animal-loving. Pet beds, toys, feeding accessories, dog, cat, treats, grooming', 'mood');