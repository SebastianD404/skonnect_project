import YouthOnboardingRouteGuard from "@/app/components/YouthOnboardingRouteGuard";

export default function InquiriesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <YouthOnboardingRouteGuard>{children}</YouthOnboardingRouteGuard>;
}
