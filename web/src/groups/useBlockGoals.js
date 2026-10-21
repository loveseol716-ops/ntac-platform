import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { checked } from "./api.js";

export default function useBlockGoals() {
  const [rows, setRows] = useState([]), [error, setError] = useState(""),
    [loading, setLoading] = useState(true), [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true); setError("");
    checked(supabase.from("group_block_goals").select("*")).then((data) => {
      if (live) setRows(data);
    }).catch((e) => { if (live) setError(e.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [version]);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  return { rows, error, loading, refresh };
}
