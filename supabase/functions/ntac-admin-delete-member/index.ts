import { createClient } from "npm:@supabase/supabase-js@2.112.0";
import { deleteMemberHandler } from "./handler.js";
Deno.serve(deleteMemberHandler(createClient, (key: string) => Deno.env.get(key)));
