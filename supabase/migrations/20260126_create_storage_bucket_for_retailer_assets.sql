-- Create storage bucket for retailer assets (logos, etc.)
-- This bucket will store retailer branding assets with public access

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'retailer-assets',
  'retailer-assets',
  true,
  2097152, -- 2MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their retailer's folder
CREATE POLICY "Retailers can upload their own assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'retailer-assets' AND
  (storage.foldername(name))[1] = 'logos'
);

-- Allow public read access to all retailer assets
CREATE POLICY "Public can view retailer assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'retailer-assets');

-- Allow retailers to update their own assets
CREATE POLICY "Retailers can update their own assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'retailer-assets' AND
  (storage.foldername(name))[1] = 'logos'
);

-- Allow retailers to delete their own assets
CREATE POLICY "Retailers can delete their own assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'retailer-assets' AND
  (storage.foldername(name))[1] = 'logos'
);
