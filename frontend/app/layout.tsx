import "./globals.css";

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
    <html lang="en">
      <body className="bg-black text-white">
        <nav className="p-4 border-b border-gray-800 flex gap-4">
          <a href="/">Home</a>
          <a href="/dashboard">Dashboard</a>
          <a href="/coach">Coach</a>
          <a href="/workout">Workout</a>
          <a href="/food">Food</a>
        </nav>

        <main className="p-4">{children}</main>
      </body>
    </html>
  );
}