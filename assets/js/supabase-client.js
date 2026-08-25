// =========================================================================
// Supabase client: safe to expose these values (that's what
// "publishable" means). RLS in the database is the real security boundary.
// Loaded via <script type="module"> on every page that needs data access.
// =========================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// TODO: replace with YOUR new Supabase project's URL + publishable (anon) key
// Supabase Dashboard -> Project Settings -> API
export const SUPABASE_URL = 'https://xqxtmfijxjdoiclsbcbj.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_GZCfdfs_n2XndHf-xyPyhw_adNZ_sxe';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});


/** Unauthenticated client for public pages (avoids broken/skewed session JWTs). */
export const publicSupabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
