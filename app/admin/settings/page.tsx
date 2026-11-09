import SettingsPageClient from "./SettingsPageClient";

export default function AdminSettingsPage() {
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 sm:gap-8">
      <SettingsPageClient dateLabel={dateLabel} />
    </div>
  );
}
