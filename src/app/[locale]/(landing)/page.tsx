import Banner from "./_components/Banner";
import Faqs from "./_components/Faqs";
import Features from "./_components/Features/Features";
import Footer from "./_components/Footer";
import Hero from "./_components/Hero";
import UserFit from "./_components/UserFit/UserFit";
import Waitlist from "./_components/Waitlist/Waitlist";

export default function Home() {
  return (
    <main className="bg-background text-foreground min-h-screen">
      <Hero />
      <UserFit />
      <Features />
      <Banner />
      <Faqs />
      <Waitlist />
      <Footer />
    </main>
  );
}
