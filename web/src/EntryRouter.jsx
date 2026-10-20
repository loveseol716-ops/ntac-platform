import { lazy, Suspense } from "react";
const EntryGate = lazy(() => import("./EntryGate.jsx"));
const GroupDisplay = lazy(() => import("./groups/GroupDisplay.jsx"));
export default function EntryRouter() {
  const token = new URLSearchParams(location.hash.slice(1)).get("display");
  return (
    <Suspense fallback={<p className="center-state">화면을 불러오는 중…</p>}>
      {token ? <GroupDisplay token={token} /> : <EntryGate />}
    </Suspense>
  );
}
