import SettingsPageClient from "./SettingsPageClient";

export default function AdminSettingsPage() {
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return <SettingsPageClient dateLabel={dateLabel} />;
}
