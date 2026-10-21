import { lazy, Suspense } from "react";
import { GROUP_TV_ENABLED } from "./groups/features.js";
const EntryGate = lazy(() => import("./EntryGate.jsx"));
const GroupDisplay = lazy(() => import("./groups/GroupDisplay.jsx"));
export default function EntryRouter() {
  const token = new URLSearchParams(location.hash.slice(1)).get("display");
  return (
    <Suspense fallback={<p className="center-state">화면을 불러오는 중…</p>}>
      {GROUP_TV_ENABLED && token ? (
        <GroupDisplay token={token} />
      ) : (
        <EntryGate />
      )}
    </Suspense>
  );
}
