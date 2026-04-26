import { Nav } from "./components/Nav";
import { Hero } from "./sections/Hero";
import { StatsBand } from "./sections/StatsBand";
import { Problem } from "./sections/Problem";
import { Solution } from "./sections/Solution";
import { HowItWorks } from "./sections/HowItWorks";
import { ProductPreview } from "./sections/ProductPreview";
import { UseCases } from "./sections/UseCases";
import { WhyDifferent } from "./sections/WhyDifferent";
import { FinalCTA } from "./sections/FinalCTA";
import { Footer } from "./sections/Footer";
import "./landing.css";

export function Landing() {
  return (
    <div className="calyx-landing">
      <Nav />
      <Hero />
      <StatsBand />
      <Problem />
      <Solution />
      <HowItWorks />
      <ProductPreview />
      <UseCases />
      <WhyDifferent />
      <FinalCTA />
      <Footer />
    </div>
  );
}
