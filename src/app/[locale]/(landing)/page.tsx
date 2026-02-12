import Features from "./_components/Features/Features";
import Hero from "./_components/Hero";
import UserFit from "./_components/UserFit/UserFit";

export default function Home() {
  return (
    <main className="bg-background text-foreground min-h-screen">
      <Hero />
      <UserFit />
      <Features />
    </main>
  );
}
