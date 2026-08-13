import { useDocumentHead } from "@/hooks/useDocumentHead";
import { LandingNav } from "@/components/landing/LandingNav";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingShowcase } from "@/components/landing/LandingShowcase";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import { LandingCTA } from "@/components/landing/LandingCTA";
import { LandingFooter } from "@/components/landing/LandingFooter";

const Landing = () => {
  useDocumentHead({
    title: "SeeMyGD — AI Garage Door Visualizer for Garage Door Companies",
    description:
      "Embed an AI garage door visualizer on your website. Homeowners see photorealistic new doors on their own home and get instant repair estimates — you get the lead. Free to try.",
    themeColor: "#091F3B",
    ogType: "website",
    siteName: "SeeMyGD",
    image: "/og-thumbnail.jpg",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "SeeMyGD",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: "https://seemygd.com/",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        description:
          "AI garage door visualizer that garage door companies embed on their website. Homeowners preview new doors on their own home and get instant repair estimates.",
      },
    ],
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNav />
      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingShowcase />
        <LandingHowItWorks />
        <LandingCTA />
      </main>
      <LandingFooter />
    </div>
  );
};

export default Landing;
