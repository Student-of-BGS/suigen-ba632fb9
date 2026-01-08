import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FeatureMeta {
  value: string;
  locked: boolean;
  confidence: number; // 0-100
}

type FeatureMetadata = Record<string, FeatureMeta>;

const getConfidenceLabel = (value: number): string => {
  if (value <= 33) return "low";
  if (value <= 66) return "medium";
  return "high";
};

serve(async (req) => {
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { case_id, featureMetadata } = await req.json() as { 
      case_id: string; 
      featureMetadata?: FeatureMetadata;
    };

    if (!case_id) {
      return new Response(JSON.stringify({ error: "case_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Generating images for case: ${case_id}`);
    console.log("Feature metadata:", JSON.stringify(featureMetadata || {}));

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

    // Build prompt with lock and confidence awareness
    const buildPrompt = (attr: any, meta?: FeatureMetadata) => {
      const parts: string[] = [];
      const lockedParts: string[] = [];
      const highConfidenceParts: string[] = [];
      
      // Helper to add feature with metadata awareness
      const addFeature = (key: string, value: string | null, label: string) => {
        if (!value) return;
        
        const featureMeta = meta?.[key];
        const isLocked = featureMeta?.locked ?? false;
        const confidence = featureMeta?.confidence ?? 50;
        const confidenceLevel = getConfidenceLabel(confidence);
        
        if (isLocked) {
          lockedParts.push(`${label}: exactly ${value} (LOCKED - must not change)`);
        } else if (confidenceLevel === "high") {
          highConfidenceParts.push(`${label}: strongly ${value}`);
        } else if (confidenceLevel === "low") {
          parts.push(`${label}: approximately ${value} (can vary)`);
        } else {
          parts.push(`${label}: ${value}`);
        }
      };
      
      // Core identity
      addFeature("gender", attr.gender, "Gender");
      addFeature("age", attr.age?.toString(), "Age");
      addFeature("ethnicity", attr.ethnicity, "Ethnicity");
      
      // Body and face structure
      addFeature("body_type", attr.body_type, "Body type");
      addFeature("head_shape", attr.head_shape, "Face shape");
      addFeature("chin_shape", attr.chin_shape, "Chin");
      
      // Hair
      addFeature("hair_length", attr.hair_length, "Hair length");
      addFeature("hair_texture", attr.hair_texture, "Hair texture");
      addFeature("hair_style", attr.hair_style, "Hair style");
      addFeature("hairline_shape", attr.hairline_shape, "Hairline");
      
      // Facial hair
      if (attr.facial_hair_type && attr.facial_hair_type !== "None") {
        addFeature("facial_hair_type", attr.facial_hair_type, "Facial hair");
        addFeature("beard_color", attr.beard_color, "Beard color");
      }
      
      // Eyes
      addFeature("eyebrow_type", attr.eyebrow_type, "Eyebrows");
      addFeature("eye_shape", attr.eye_shape, "Eye shape");
      addFeature("eye_color", attr.eye_color, "Eye color");
      addFeature("eye_size_spacing", attr.eye_size_spacing, "Eye size");
      addFeature("eyelid_type", attr.eyelid_type, "Eyelids");
      addFeature("eyelashes", attr.eyelashes, "Eyelashes");
      if (attr.eye_bags_wrinkles && attr.eye_bags_wrinkles !== "None") {
        addFeature("eye_bags_wrinkles", attr.eye_bags_wrinkles, "Eye features");
      }
      
      // Nose
      addFeature("nose_shape", attr.nose_shape, "Nose shape");
      addFeature("bridge_height", attr.bridge_height, "Nose bridge");
      addFeature("nostril_width", attr.nostril_width, "Nostrils");
      addFeature("nose_tip_shape", attr.nose_tip_shape, "Nose tip");
      
      // Mouth and lips
      addFeature("lip_thickness", attr.lip_thickness, "Lip thickness");
      addFeature("lip_shape", attr.lip_shape, "Lip shape");
      addFeature("mouth_width", attr.mouth_width, "Mouth width");
      addFeature("smile_type", attr.smile_type, "Expression");
      
      // Ears
      addFeature("ear_size", attr.ear_size, "Ear size");
      addFeature("ear_shape", attr.ear_shape, "Ear shape");
      addFeature("ear_lobes", attr.ear_lobes, "Ear lobes");
      addFeature("helix_antihelix", attr.helix_antihelix, "Ear details");
      
      // Skin
      addFeature("skin_tone", attr.skin_tone, "Skin tone");
      if (attr.other_skin_features && attr.other_skin_features !== "None") {
        addFeature("other_skin_features", attr.other_skin_features, "Skin features");
      }
      
      // Accessories
      addFeature("accessories", attr.accessories, "Accessories");
      
      // Build the prompt with priority sections
      let prompt = "Create a realistic police sketch portrait of a person.\n\n";
      
      if (lockedParts.length > 0) {
        prompt += "CRITICAL FIXED FEATURES (These must be rendered EXACTLY as specified, no variation allowed):\n";
        prompt += lockedParts.join("\n") + "\n\n";
      }
      
      if (highConfidenceParts.length > 0) {
        prompt += "HIGH CONFIDENCE FEATURES (Render these closely as specified, minimal variation):\n";
        prompt += highConfidenceParts.join("\n") + "\n\n";
      }
      
      if (parts.length > 0) {
        prompt += "OTHER FEATURES (Can have natural variation within reason):\n";
        prompt += parts.join("\n") + "\n\n";
      }
      
      prompt += `The image should be a front-facing portrait suitable for suspect identification, with neutral background, 
professional police composite sketch style, detailed facial features, photorealistic rendering.
High quality, detailed facial features, natural lighting, neutral expression.`;
      
      return prompt;
    };

    const prompt = buildPrompt(attributes, featureMetadata);
    console.log("Generated prompt:", prompt);

    const images: string[] = [];
    const numImages = 4;

    for (let i = 0; i < numImages; i++) {
      console.log(`Generating image ${i + 1} of ${numImages}...`);
      
      // For locked features, we emphasize consistency across variations
      const variationNote = featureMetadata && Object.values(featureMetadata).some(m => m.locked)
        ? `Variation ${i + 1}: Keep ALL locked features identical. Only vary unlocked features slightly.`
        : `Variation ${i + 1} of ${numImages} - slight variation in angle or expression.`;
      
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
              content: `${prompt}\n\n${variationNote}`
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
        
        continue;
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
