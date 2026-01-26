import LandingCta from "@/components/landing/landing-cta"
import LandingFeatures from "@/components/landing/landing-features"
import LandingFooter from "@/components/landing/landing-footer"
import LandingHero from "@/components/landing/landing-hero"
import LandingHowItWorks from "@/components/landing/landing-how-it-works"
import LandingTestimonials from "@/components/landing/landing-testimonials"

export default function Home() {
  return (
    <>
      <LandingHero />
      <LandingFeatures />
      <LandingHowItWorks />
      <LandingTestimonials />
      <LandingCta />
      <LandingFooter />
    </>
  )
}
