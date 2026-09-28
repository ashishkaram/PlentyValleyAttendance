export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <p className="mb-6 text-center text-lg font-bold text-brand-700">Plenty Valley Attendance</p>
      {children}
    </main>
  );
}
