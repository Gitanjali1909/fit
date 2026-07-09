import "./globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata = {
  title: "Fit",
  description: "AI Fitness Coach",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-black">
      <body className="h-full bg-black text-white antialiased selection:bg-emerald-500/25">
        <div className="min-h-screen bg-gradient-to-b from-black via-zinc-900 to-black text-white flex flex-col">
          {/* Main Content Area */}
          <main className="w-full max-w-4xl mx-auto px-4 pt-6 pb-24 flex flex-col gap-4 flex-1">
            {children}
          </main>

          {/* Global Bottom Navigation */}
          <BottomNav />
        </div>
      </body>
    </html>
  );
}