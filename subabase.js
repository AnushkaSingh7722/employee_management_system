import { createClient } from
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const supabase = createClient(
  "YOUR_SUPABASE_PROJECT_URL",
  "YOUR_SUPABASE_PUBLISHABLE_KEY"
);