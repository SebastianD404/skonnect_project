import HomePageContent from "../HomePageContent";
import YouthDashboardWelcomeToast from "./YouthDashboardWelcomeToast";

export default async function YouthDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; email_confirmation?: string }>;
}) {
  const params = await searchParams;
  const showWelcomeToast =
    params.welcome === "1" || params.email_confirmation === "success";

  return (
    <>
      <YouthDashboardWelcomeToast show={showWelcomeToast} />
      <HomePageContent />
    </>
  );
}
