import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get the authorization header from the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client with user's token for RLS
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { case_id } = await req.json();

    if (!case_id) {
      return new Response(JSON.stringify({ error: "case_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Generating images for case: ${case_id}`);

    // Fetch the physical attributes for this case
    const { data: attributes, error: attrError } = await supabase
      .from("suspect_physical_attributes")
      .select("*")
      .eq("case_id", case_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (attrError) {
      console.error("Error fetching attributes:", attrError);
      return new Response(JSON.stringify({ error: "Failed to fetch attributes" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build detailed prompt from physical attributes
    const buildPrompt = (attr: any) => {
      const parts: string[] = [];
      
      // Core identity
      if (attr.gender) parts.push(`${attr.gender}`);
      if (attr.age) parts.push(`approximately ${attr.age} years old`);
      if (attr.ethnicity) parts.push(`${attr.ethnicity} ethnicity`);
      
      // Body and face structure
      if (attr.body_type) parts.push(`${attr.body_type} body type`);
      if (attr.head_shape) parts.push(`${attr.head_shape} face shape`);
      if (attr.chin_shape) parts.push(`${attr.chin_shape}`);
      
      // Hair
      const hairParts: string[] = [];
      if (attr.hair_length) hairParts.push(attr.hair_length);
      if (attr.hair_texture) hairParts.push(attr.hair_texture);
      if (attr.hair_style) hairParts.push(attr.hair_style);
      if (attr.hairline_shape) hairParts.push(`${attr.hairline_shape} hairline`);
      if (hairParts.length > 0) parts.push(`${hairParts.join(" ")} hair`);
      
      // Facial hair
      if (attr.facial_hair_type && attr.facial_hair_type !== "None") {
        const beardDesc = attr.beard_color ? `${attr.beard_color} ${attr.facial_hair_type}` : attr.facial_hair_type;
        parts.push(beardDesc);
      }
      
      // Eyes
      const eyeParts: string[] = [];
      if (attr.eye_shape) eyeParts.push(attr.eye_shape);
      if (attr.eye_color) eyeParts.push(attr.eye_color);
      if (attr.eye_size_spacing) eyeParts.push(attr.eye_size_spacing);
      if (eyeParts.length > 0) parts.push(`${eyeParts.join(" ")} eyes`);
      if (attr.eyebrow_type) parts.push(`${attr.eyebrow_type} eyebrows`);
      if (attr.eyelid_type) parts.push(`${attr.eyelid_type}`);
      if (attr.eye_bags_wrinkles && attr.eye_bags_wrinkles !== "None") parts.push(attr.eye_bags_wrinkles);
      
      // Nose
      const noseParts: string[] = [];
      if (attr.nose_shape) noseParts.push(attr.nose_shape);
      if (attr.bridge_height) noseParts.push(`${attr.bridge_height} bridge`);
      if (attr.nostril_width) noseParts.push(`${attr.nostril_width} nostrils`);
      if (attr.nose_tip_shape) noseParts.push(`${attr.nose_tip_shape} tip`);
      if (noseParts.length > 0) parts.push(`${noseParts.join(", ")} nose`);
      
      // Mouth and lips
      const mouthParts: string[] = [];
      if (attr.lip_thickness) mouthParts.push(attr.lip_thickness);
      if (attr.lip_shape) mouthParts.push(attr.lip_shape);
      if (attr.mouth_width) mouthParts.push(`${attr.mouth_width} width`);
      if (mouthParts.length > 0) parts.push(`${mouthParts.join(" ")} lips`);
      if (attr.smile_type) parts.push(`${attr.smile_type} expression`);
      
      // Ears
      const earParts: string[] = [];
      if (attr.ear_size) earParts.push(attr.ear_size);
      if (attr.ear_shape) earParts.push(attr.ear_shape);
      if (attr.ear_lobes) earParts.push(`${attr.ear_lobes} lobes`);
      if (earParts.length > 0) parts.push(`${earParts.join(" ")} ears`);
      
      // Skin
      if (attr.skin_tone) parts.push(`${attr.skin_tone} skin tone`);
      if (attr.other_skin_features && attr.other_skin_features !== "None") parts.push(attr.other_skin_features);
      
      // Accessories
      if (attr.accessories) parts.push(`wearing ${attr.accessories}`);
      
      const description = parts.join(", ");
      
      return `Create a realistic police sketch portrait of a person with these features: ${description}. 
The image should be a front-facing portrait suitable for suspect identification, with neutral background, 
professional police composite sketch style, detailed facial features, photorealistic rendering.
High quality, detailed facial features, natural lighting, neutral expression.`;
    };

    const prompt = buildPrompt(attributes);
    console.log("Generated prompt:", prompt);

    // Generate 4 images using Lovable AI Gateway with Gemini image model
    const images: string[] = [];
    const numImages = 4;

    for (let i = 0; i < numImages; i++) {
      console.log(`Generating image ${i + 1} of ${numImages}...`);
      
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [
            {
              role: "user",
              content: `${prompt} Variation ${i + 1} of ${numImages} - slight variation in angle or expression.`
            }
          ],
          modalities: ["image", "text"]
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`AI gateway error for image ${i + 1}:`, response.status, errorText);
        
        if (response.status === 429) {
          return new Response(JSON.stringify({ 
            error: "Rate limit exceeded. Please wait a moment and try again.",
            retryAfter: 30
          }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        if (response.status === 402) {
          return new Response(JSON.stringify({ 
            error: "AI credits exhausted. Please add more credits to continue." 
          }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        continue; // Skip this image and try the next
      }

      const result = await response.json();
      const imageUrl = result.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      
      if (imageUrl) {
        images.push(imageUrl);
        console.log(`Image ${i + 1} generated successfully`);
      }
    }

    if (images.length === 0) {
      return new Response(JSON.stringify({ error: "Failed to generate any images" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Successfully generated ${images.length} images`);

    return new Response(JSON.stringify({ 
      images,
      message: `Generated ${images.length} suspect portraits`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in generate-suspect-image:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error occurred" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
