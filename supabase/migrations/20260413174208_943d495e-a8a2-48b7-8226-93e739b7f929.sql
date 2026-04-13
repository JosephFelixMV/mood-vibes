
-- Add vendor_id column to products, referencing brands table
ALTER TABLE public.products 
ADD COLUMN vendor_id uuid REFERENCES public.brands(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_products_vendor_id ON public.products(vendor_id);
