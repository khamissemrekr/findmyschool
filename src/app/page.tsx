import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";

export default function HomePage() {
  return (
    <div className="flex h-dvh min-h-0 flex-col">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
            불러오는 중…
          </div>
        }
      >
        <AppShell />
      </Suspense>
    </div>
  );
}
