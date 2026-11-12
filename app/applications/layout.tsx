import YouthOnboardingRouteGuard from "@/app/components/YouthOnboardingRouteGuard";

export default function ApplicationsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <YouthOnboardingRouteGuard>{children}</YouthOnboardingRouteGuard>;
}
