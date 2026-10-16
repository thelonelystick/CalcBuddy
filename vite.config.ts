import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const publicSupabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
  const publicSupabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY
    || env.SUPABASE_PUBLISHABLE_KEY
    || env.VITE_SUPABASE_ANON_KEY
    || "";

  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(publicSupabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(publicSupabaseKey),
    },
  };
});