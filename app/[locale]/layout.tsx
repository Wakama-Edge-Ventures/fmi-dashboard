export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Locale available for context providers / i18n setup
  await params;
  return <>{children}</>;
}
