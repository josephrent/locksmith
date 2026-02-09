"use client";

import Link from "next/link";
import { Key, Phone, Mail, MapPin, Clock, MessageSquare } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-brand-950">
      {/* Header */}
      <header className="border-b border-brand-800">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-copper-500 rounded-lg flex items-center justify-center">
                <Key className="w-6 h-6 text-white" />
              </div>
              <span className="font-display text-2xl font-bold text-white">
                Locksmith
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/faq" className="text-brand-300 hover:text-white transition-colors font-medium">
                FAQ
              </Link>
              <Link href="/contact" className="text-white font-medium">
                Contact
              </Link>
              <Link href="/privacy" className="text-brand-300 hover:text-white transition-colors font-medium">
                Privacy
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-b from-brand-900 to-brand-950 py-16">
        <div className="container mx-auto px-6 text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">
            Contact Us
          </h1>
          <p className="text-brand-300 text-lg max-w-2xl mx-auto">
            Have a question or need assistance? We&apos;re here to help.
            Reach out through any of the channels below.
          </p>
        </div>
      </div>

      {/* Contact Content */}
      <main className="container mx-auto px-6 py-16 max-w-5xl">
        <div className="grid md:grid-cols-2 gap-12">
          {/* Contact Methods */}
          <div className="space-y-6">
            <h2 className="font-display text-2xl font-bold text-white mb-6">
              Get in Touch
            </h2>

            <ContactCard
              icon={<Phone className="w-6 h-6" />}
              title="Phone Support"
              description="Call us for immediate assistance"
              value="(956) 555-LOCK"
              action="tel:+19565555625"
              actionLabel="Call Now"
            />

            <ContactCard
              icon={<Mail className="w-6 h-6" />}
              title="Email"
              description="Send us a message anytime"
              value="support@locksmith.com"
              action="mailto:support@locksmith.com"
              actionLabel="Send Email"
            />

            <ContactCard
              icon={<MessageSquare className="w-6 h-6" />}
              title="SMS Support"
              description="Text us for quick questions"
              value="(956) 555-LOCK"
              action="sms:+19565555625"
              actionLabel="Send Text"
            />
          </div>

          {/* Info Cards */}
          <div className="space-y-6">
            <h2 className="font-display text-2xl font-bold text-white mb-6">
              Service Information
            </h2>

            <div className="card">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-copper-500/20 rounded-lg flex items-center justify-center text-copper-400 flex-shrink-0">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-2">Hours of Operation</h3>
                  <p className="text-brand-300">
                    Our locksmith services are available <span className="text-copper-400 font-semibold">24 hours a day, 7 days a week</span>.
                  </p>
                  <p className="text-brand-400 text-sm mt-2">
                    Customer support: Mon-Fri 8am-8pm, Sat-Sun 9am-5pm
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-copper-500/20 rounded-lg flex items-center justify-center text-copper-400 flex-shrink-0">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-2">Service Areas</h3>
                  <p className="text-brand-300">
                    We currently serve the greater Laredo area and surrounding cities.
                  </p>
                  <p className="text-brand-400 text-sm mt-2">
                    Expanding to more locations soon!
                  </p>
                </div>
              </div>
            </div>

            <div className="card bg-copper-600/10 border-copper-500/30">
              <h3 className="font-semibold text-white mb-2">Need Immediate Help?</h3>
              <p className="text-brand-300 mb-4">
                If you&apos;re locked out right now, don&apos;t wait. Submit a request and get connected with a locksmith in minutes.
              </p>
              <Link href="/request" className="btn-primary">
                Request a Locksmith
              </Link>
            </div>
          </div>
        </div>

        {/* FAQ Link */}
        <div className="mt-16 text-center card bg-brand-800/50">
          <h3 className="font-display text-xl font-semibold text-white mb-3">
            Looking for answers?
          </h3>
          <p className="text-brand-400 mb-6">
            Check out our FAQ for answers to common questions about our services.
          </p>
          <Link href="/faq" className="btn-secondary">
            View FAQ
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-brand-950 py-12 border-t border-brand-800">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-copper-500 rounded-lg flex items-center justify-center">
                <Key className="w-4 h-4 text-white" />
              </div>
              <span className="font-display text-xl font-bold text-white">
                Locksmith
              </span>
            </div>
            <p className="text-brand-500 text-sm">
              © 2026 Locksmith Marketplace. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ContactCard({
  icon,
  title,
  description,
  value,
  action,
  actionLabel,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  value: string;
  action: string;
  actionLabel: string;
}) {
  return (
    <div className="card">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-copper-500/20 rounded-lg flex items-center justify-center text-copper-400 flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-white">{title}</h3>
          <p className="text-brand-400 text-sm mb-2">{description}</p>
          <p className="text-copper-400 font-medium">{value}</p>
        </div>
        <a
          href={action}
          className="btn-secondary text-sm px-4 py-2 flex-shrink-0"
        >
          {actionLabel}
        </a>
      </div>
    </div>
  );
}
