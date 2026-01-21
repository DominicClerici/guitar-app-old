import { Github, Instagram, Twitter, Youtube } from "lucide-react"
import Link from "next/link"

const footerLinks = {
  product: {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How It Works", href: "#how-it-works" },
      { label: "Pricing", href: "/pricing" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  resources: {
    title: "Resources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Tutorials", href: "/tutorials" },
      { label: "Chord Library", href: "/chords" },
      { label: "Scale Reference", href: "/scales" },
    ],
  },
  company: {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Careers", href: "/careers" },
      { label: "Press", href: "/press" },
    ],
  },
  legal: {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Cookie Policy", href: "/cookies" },
    ],
  },
}

const socialLinks = [
  { icon: Twitter, href: "https://twitter.com", label: "Twitter" },
  { icon: Instagram, href: "https://instagram.com", label: "Instagram" },
  { icon: Youtube, href: "https://youtube.com", label: "YouTube" },
  { icon: Github, href: "https://github.com", label: "GitHub" },
]

export default function LandingFooter() {
  return (
    <footer className="bg-card/30 border-t">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-foreground hover:bg-landing-accent h-6 transition-all duration-300"
                    style={{
                      width: `${1 + i * 0.3}px`,
                    }}
                  />
                ))}
              </div>
              <span className="text-xl font-semibold tracking-tight">StringFlow</span>
            </Link>

            <p className="text-muted-foreground mt-4 max-w-xs text-sm leading-relaxed">
              Learn guitar with an AI that listens. Real-time feedback, personalized lessons, and
              progress tracking to help you become the guitarist you want to be.
            </p>

            <div className="mt-6 flex gap-4">
              {socialLinks.map((social) => {
                const Icon = social.icon
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-muted/50 text-muted-foreground hover:bg-landing-accent/10 hover:text-landing-accent flex size-9 items-center justify-center rounded-lg transition-colors"
                    aria-label={social.label}
                  >
                    <Icon className="size-4" />
                  </a>
                )
              })}
            </div>
          </div>

          {Object.values(footerLinks).map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold">{section.title}</h3>
              <ul className="mt-4 space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 md:flex-row">
          <p className="text-muted-foreground text-sm">
            &copy; {new Date().getFullYear()} StringFlow. All rights reserved.
          </p>

          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <span>Made with</span>
            <span className="text-landing-accent">♪</span>
            <span>for guitarists</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
