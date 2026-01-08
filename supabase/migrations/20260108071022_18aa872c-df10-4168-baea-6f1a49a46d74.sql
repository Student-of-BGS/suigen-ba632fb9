-- Create table for suspect case records
CREATE TABLE public.suspect_case_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  incident_timestamp TIMESTAMP WITH TIME ZONE,
  incident_location_address TEXT,
  incident_location_lat DOUBLE PRECISION,
  incident_location_lng DOUBLE PRECISION,
  crime_committed TEXT,
  arms_involved TEXT,
  vehicles_involved TEXT,
  suspect_name TEXT,
  suspect_address TEXT,
  contact_number TEXT,
  reported_by TEXT DEFAULT 'Law Enforcement',
  surveillance_footage_ref TEXT,
  custodies TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for suspect physical attributes
CREATE TABLE public.suspect_physical_attributes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES public.suspect_case_records(id) ON DELETE CASCADE NOT NULL,
  gender TEXT,
  age INTEGER,
  ethnicity TEXT,
  height_feet DOUBLE PRECISION,
  body_type TEXT,
  head_shape TEXT,
  chin_shape TEXT,
  hair_length TEXT,
  hair_texture TEXT,
  hairline_shape TEXT,
  hair_style TEXT,
  facial_hair_type TEXT,
  beard_color TEXT,
  eyebrow_type TEXT,
  eye_shape TEXT,
  eye_size_spacing TEXT,
  eyelid_type TEXT,
  eyelashes TEXT,
  eye_color TEXT,
  eye_bags_wrinkles TEXT,
  nose_shape TEXT,
  bridge_height TEXT,
  nostril_width TEXT,
  nose_tip_shape TEXT,
  lip_thickness TEXT,
  mouth_width TEXT,
  lip_shape TEXT,
  smile_type TEXT,
  ear_size TEXT,
  ear_lobes TEXT,
  ear_shape TEXT,
  helix_antihelix TEXT,
  skin_tone TEXT,
  other_skin_features TEXT,
  accessories TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for generated images (store URLs, not base64)
CREATE TABLE public.generated_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES public.suspect_case_records(id) ON DELETE CASCADE NOT NULL,
  attributes_id UUID REFERENCES public.suspect_physical_attributes(id) ON DELETE SET NULL,
  image_url TEXT,
  generation_status TEXT DEFAULT 'pending',
  generation_metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.suspect_case_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suspect_physical_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;

-- RLS policies for suspect_case_records
CREATE POLICY "Users can view their own case records" 
ON public.suspect_case_records FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own case records" 
ON public.suspect_case_records FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own case records" 
ON public.suspect_case_records FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own case records" 
ON public.suspect_case_records FOR DELETE 
USING (auth.uid() = user_id);

-- RLS policies for suspect_physical_attributes (via case ownership)
CREATE POLICY "Users can view attributes for their cases" 
ON public.suspect_physical_attributes FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.suspect_case_records 
  WHERE id = case_id AND user_id = auth.uid()
));

CREATE POLICY "Users can create attributes for their cases" 
ON public.suspect_physical_attributes FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.suspect_case_records 
  WHERE id = case_id AND user_id = auth.uid()
));

CREATE POLICY "Users can update attributes for their cases" 
ON public.suspect_physical_attributes FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.suspect_case_records 
  WHERE id = case_id AND user_id = auth.uid()
));

-- RLS policies for generated_images (via case ownership)
CREATE POLICY "Users can view images for their cases" 
ON public.generated_images FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.suspect_case_records 
  WHERE id = case_id AND user_id = auth.uid()
));

CREATE POLICY "Users can create images for their cases" 
ON public.generated_images FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.suspect_case_records 
  WHERE id = case_id AND user_id = auth.uid()
));

-- Create storage bucket for generated images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('generated-images', 'generated-images', true);

-- Storage policies
CREATE POLICY "Anyone can view generated images" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'generated-images');

CREATE POLICY "Authenticated users can upload generated images" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'generated-images' AND auth.role() = 'authenticated');

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for automatic timestamp updates
CREATE TRIGGER update_suspect_case_records_updated_at
BEFORE UPDATE ON public.suspect_case_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();