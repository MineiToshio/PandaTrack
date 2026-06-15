import Header from "./_components/Menu/Header";

export default function LandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="mk-public">
      <Header />
      {children}
    </div>
  );
}
