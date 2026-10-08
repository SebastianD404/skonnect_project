import { Suspense } from "react";
import HomeRouteContent from "./HomeRouteContent";
import HomeSkeleton from "./HomeSkeleton";

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeRouteContent />
    </Suspense>
  );
}
