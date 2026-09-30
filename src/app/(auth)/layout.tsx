import { BrandMark } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-[#f4f6f8] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <BrandMark className="h-14 w-14 text-lg" />
          <div>
            <p className="text-lg font-bold text-slate-900">Plenty Valley</p>
            <p className="text-sm text-slate-600">Training attendance</p>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-float ring-1 ring-slate-200">{children}</div>
      </div>
    </main>
  );
}
