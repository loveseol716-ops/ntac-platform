import { createClient } from "npm:@supabase/supabase-js@2.112.0";
import { passwordHandler } from "./handler.js";
Deno.serve(passwordHandler(createClient, (key: string) => Deno.env.get(key)));
