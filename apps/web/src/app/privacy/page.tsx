"use client";

import Link from "next/link";
import { Key } from "lucide-react";

const lastUpdated = "January 24, 2026";

export default function PrivacyPage() {
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
                Locksmith Laredo
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/faq" className="text-brand-300 hover:text-white transition-colors font-medium">
                FAQ
              </Link>
              <Link href="/contact" className="text-brand-300 hover:text-white transition-colors font-medium">
                Contact
              </Link>
              <Link href="/privacy" className="text-white font-medium">
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
            Privacy Policy
          </h1>
          <p className="text-brand-300 text-lg max-w-2xl mx-auto">
            How we collect, use, and protect your information. Last updated {lastUpdated}.
          </p>
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-6 py-16 max-w-3xl">
        <div className="space-y-10 text-brand-300">
          <section>
            <h2 className="font-display text-2xl font-bold text-copper-400 mb-4">
              Who We Are
            </h2>
            <p className="leading-relaxed">
              Locksmith Laredo (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates a locksmith marketplace that connects customers with licensed locksmiths for on-demand services, including home lockouts, car lockouts, rekeying, and smart lock installation. This privacy policy describes how we handle your information when you use our website and services, including SMS communications.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-copper-400 mb-4">
              Information We Collect
            </h2>
            <p className="leading-relaxed mb-4">
              We collect information you provide when you submit a service request or contact us, including:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Name and phone number</li>
              <li>Email address (if provided)</li>
              <li>Service address or location (including coordinates when you share your location)</li>
              <li>Service type and details (e.g., vehicle make/model/year, lock photos)</li>
              <li>Communications with us and with locksmiths regarding your request</li>
            </ul>
            <p className="leading-relaxed mt-4">
              We also collect technical data such as IP address and browser type when you use our website.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-copper-400 mb-4">
              SMS and Text Messaging
            </h2>
            <p className="leading-relaxed mb-4">
              When you consent to receive SMS messages from Locksmith Laredo, we may send you text messages regarding your service request, including:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2 mb-4">
              <li>Quotes from locksmiths</li>
              <li>Dispatch and arrival notifications</li>
              <li>Status updates about your request</li>
            </ul>
            <p className="leading-relaxed mb-2">
              <strong className="text-white">Message frequency varies</strong> depending on your request and activity. <strong className="text-white">Message and data rates may apply</strong> according to your carrier.
            </p>
            <p className="leading-relaxed mb-2">
              You may <strong className="text-white">reply STOP</strong> at any time to opt out of SMS messages. You may <strong className="text-white">reply HELP</strong> for assistance or contact us through the channels listed below.
            </p>
            <p className="leading-relaxed">
              We obtain your consent before sending marketing or promotional SMS. Service-related messages (e.g., quotes, dispatch, status) are sent based on the consent you provide when submitting a service request. We use a third-party provider (Twilio) to deliver SMS; their use of data is governed by their privacy policy.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-copper-400 mb-4">
              How We Use Your Information
            </h2>
            <p className="leading-relaxed">
              We use the information we collect to: fulfill and manage your service requests; connect you with locksmiths; send quotes, dispatch notifications, and status updates via SMS or other channels; process payments; improve our services and website; and comply with legal obligations. We do not sell your personal information to third parties for marketing.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-copper-400 mb-4">
              Sharing of Information
            </h2>
            <p className="leading-relaxed">
              We share information with service providers that help us operate (e.g., SMS delivery, payment processing, hosting). We share relevant details with locksmiths in our network so they can provide quotes and perform services. We may disclose information when required by law or to protect our rights and safety.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-copper-400 mb-4">
              Data Retention and Security
            </h2>
            <p className="leading-relaxed">
              We retain your information as long as needed to provide services, resolve disputes, and comply with legal obligations. We use reasonable technical and organizational measures to protect your data; no method of transmission or storage is completely secure.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-copper-400 mb-4">
              Your Rights and Choices
            </h2>
            <p className="leading-relaxed">
              You may opt out of SMS at any time by replying STOP. You can contact us to request access to, correction of, or deletion of your personal information, subject to applicable law. If you have questions about this policy or our practices, please contact us.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-copper-400 mb-4">
              Contact Us
            </h2>
            <p className="leading-relaxed mb-4">
              For privacy-related questions or to exercise your rights:
            </p>
            <ul className="space-y-1 text-brand-300">
              <li><strong className="text-white">Email:</strong>{" "}
                <a href="mailto:support@locksmithlaredo.com" className="text-copper-400 hover:underline">support@locksmithlaredo.com</a>
              </li>
              <li><strong className="text-white">Phone:</strong>{" "}
                <a href="tel:+19565555625" className="text-copper-400 hover:underline">(956) 555-LOCK</a>
              </li>
              <li><strong className="text-white">Website:</strong>{" "}
                <Link href="/contact" className="text-copper-400 hover:underline">Contact page</Link>
              </li>
            </ul>
          </section>

          <p className="text-brand-500 text-sm pt-4 border-t border-brand-800">
            This privacy policy may be updated from time to time. The &quot;Last updated&quot; date at the top of this page reflects the most recent change.
          </p>
        </div>

        <div className="mt-16 text-center">
          <Link href="/" className="btn-secondary">
            Back to Home
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
                Locksmith Laredo
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/privacy" className="text-brand-400 hover:text-white transition-colors">
                Privacy
              </Link>
              <Link href="/contact" className="text-brand-400 hover:text-white transition-colors">
                Contact
              </Link>
            </div>
            <p className="text-brand-500 text-sm">
              © 2026 Locksmith Laredo. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
