"use client";

import Link from "next/link";
import { Key, Shield, Clock } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-950 via-brand-900 to-brand-950" />
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative">
          {/* Navigation */}
          <nav className="container mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-copper-500 rounded-lg flex items-center justify-center">
                  <Key className="w-6 h-6 text-white" />
                </div>
                <span className="font-display text-2xl font-bold text-white">
                  Locksmith
                </span>
              </div>
              <div className="flex items-center gap-4">
                <Link href="/faq" className="text-brand-300 hover:text-white transition-colors font-medium">
                  FAQ
                </Link>
                <Link href="/contact" className="text-brand-300 hover:text-white transition-colors font-medium">
                  Contact
                </Link>
                <Link href="/privacy" className="text-brand-300 hover:text-white transition-colors font-medium">
                  Privacy
                </Link>
              </div>
            </div>
          </nav>

          {/* Hero Content */}
          <div className="container mx-auto px-6 pt-20 pb-32">
            <div className="max-w-3xl">
              <h1 className="font-display text-5xl md:text-7xl font-bold text-white leading-tight animate-fade-in">
                Locked Out?
                <br />
                <span className="text-copper-400">We&apos;ve Got You.</span>
              </h1>
              <p className="mt-6 text-xl text-brand-300 max-w-xl animate-slide-up">
                Professional locksmiths at your door in minutes. Available 24/7
                for home lockouts, car lockouts, rekeying, and smart lock
                installation.
              </p>
              <div className="mt-10 animate-slide-up">
                <Link
                  href="/request"
                  className="btn-primary text-lg px-8 py-4"
                >
                  Request a Locksmith
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="bg-brand-900 py-24">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Clock className="w-8 h-8" />}
              title="Fast Response"
              description="Average arrival time under 30 minutes. We know you can't wait."
            />
            <FeatureCard
              icon={<Shield className="w-8 h-8" />}
              title="Licensed & Insured"
              description="Every locksmith is vetted, licensed, and fully insured for your protection."
            />
            <FeatureCard
              icon={<Key className="w-8 h-8" />}
              title="Fair Pricing"
              description="Upfront deposit with transparent pricing. No hidden fees or surprises."
            />
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="py-24">
        <div className="container mx-auto px-6">
          <h2 className="font-display text-4xl font-bold text-white text-center mb-16">
            Our Services
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ServiceCard
              title="Home Lockout"
              description="Locked out of your house? We'll get you back inside safely."
            />
            <ServiceCard
              title="Car Lockout"
              description="Keys in the car? We handle all makes and models."
            />
            <ServiceCard
              title="Lock Rekey"
              description="New home? Lost keys? Get your locks rekeyed for peace of mind."
            />
            <ServiceCard
              title="Smart Locks"
              description="Upgrade to keyless entry with professional installation."
            />
          </div>
        </div>
      </div>

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

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="card text-center">
      <div className="w-16 h-16 bg-copper-500/20 rounded-xl flex items-center justify-center mx-auto mb-4 text-copper-400">
        {icon}
      </div>
      <h3 className="font-display text-xl font-semibold text-white mb-2">
        {title}
      </h3>
      <p className="text-brand-400">{description}</p>
    </div>
  );
}

function ServiceCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="card group hover:border-copper-500/50 transition-colors">
      <h3 className="font-display text-lg font-semibold text-white mb-3">
        {title}
      </h3>
      <p className="text-brand-400 text-sm">{description}</p>
    </div>
  );
}
