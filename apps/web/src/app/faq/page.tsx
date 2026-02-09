"use client";

import Link from "next/link";
import { Key, ChevronDown } from "lucide-react";
import { useState } from "react";

const faqs = [
  {
    category: "Services",
    questions: [
      {
        q: "What services do you offer?",
        a: "We offer a full range of locksmith services including home lockouts, car lockouts, lock rekeying, and smart lock installation. Our network of licensed professionals can handle residential and automotive needs 24/7.",
      },
      {
        q: "Do you service all types of vehicles?",
        a: "Yes, our locksmiths are trained to work with all makes and models, including domestic and foreign vehicles. We can handle traditional keys, transponder keys, and modern smart key systems.",
      },
      {
        q: "Can you install smart locks on any door?",
        a: "Most standard doors can accommodate smart locks. During the service request, you'll upload a photo of your door and lock, and our locksmith will confirm compatibility before arriving.",
      },
    ],
  },
  {
    category: "Pricing & Payment",
    questions: [
      {
        q: "How much does a lockout service cost?",
        a: "Pricing varies based on the service type and urgency. You'll receive quotes from available locksmiths before committing. A small deposit is required to confirm your request, which is applied toward the final service cost.",
      },
      {
        q: "What payment methods do you accept?",
        a: "We accept all major credit and debit cards for the initial deposit. The remaining balance can be paid directly to the locksmith via card, cash, or other accepted methods.",
      },
      {
        q: "Is there an emergency or after-hours fee?",
        a: "Emergency requests (ASAP service) include a 50% surcharge on the deposit. Standard requests within 1-2 hours have no additional fee. All pricing is transparent and shown before you confirm.",
      },
      {
        q: "What if the locksmith can't solve my problem?",
        a: "If our locksmith is unable to complete the service, your deposit will be fully refunded. We stand behind our service guarantee.",
      },
    ],
  },
  {
    category: "Process",
    questions: [
      {
        q: "How does the service work?",
        a: "Simply submit a request with your location and service type. Available locksmiths in your area will send quotes. Once you accept a quote and pay a small deposit, a locksmith will be dispatched to your location.",
      },
      {
        q: "How long until a locksmith arrives?",
        a: "For standard requests, locksmiths typically arrive within 1-2 hours. Emergency requests are prioritized with an average response time under 30 minutes, depending on your location.",
      },
      {
        q: "Do I need to be present for the service?",
        a: "Yes, you must be present to verify your identity and ownership/authorization for the property or vehicle being serviced. This is for your protection and ours.",
      },
      {
        q: "What information do I need to provide?",
        a: "You'll need to provide your name, phone number, location, and service type. For car lockouts, we'll also need your vehicle make, model, and year. For home services, a photo of the lock is required.",
      },
    ],
  },
  {
    category: "Safety & Trust",
    questions: [
      {
        q: "Are your locksmiths licensed and insured?",
        a: "Absolutely. Every locksmith in our network is vetted, licensed, and fully insured. We verify credentials before allowing any locksmith to join our platform.",
      },
      {
        q: "How do I know the locksmith is legitimate?",
        a: "You'll receive the locksmith's name and photo before they arrive. They will also have identification. Never let anyone into your property without verifying their identity.",
      },
      {
        q: "What areas do you service?",
        a: "We currently service select cities and are expanding rapidly. Enter your address during the request process to confirm coverage in your area.",
      },
    ],
  },
];

export default function FAQPage() {
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
              <Link href="/faq" className="text-white font-medium">
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
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-b from-brand-900 to-brand-950 py-16">
        <div className="container mx-auto px-6 text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-brand-300 text-lg max-w-2xl mx-auto">
            Find answers to common questions about our locksmith services,
            pricing, and how the process works.
          </p>
        </div>
      </div>

      {/* FAQ Content */}
      <main className="container mx-auto px-6 py-16 max-w-4xl">
        {faqs.map((section) => (
          <div key={section.category} className="mb-12">
            <h2 className="font-display text-2xl font-bold text-copper-400 mb-6">
              {section.category}
            </h2>
            <div className="space-y-4">
              {section.questions.map((faq, index) => (
                <FAQItem key={index} question={faq.q} answer={faq.a} />
              ))}
            </div>
          </div>
        ))}

        {/* Still have questions */}
        <div className="mt-16 text-center card bg-brand-800/50">
          <h3 className="font-display text-xl font-semibold text-white mb-3">
            Still have questions?
          </h3>
          <p className="text-brand-400 mb-6">
            Can&apos;t find what you&apos;re looking for? Reach out to our support team.
          </p>
          <Link href="/contact" className="btn-primary">
            Contact Us
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

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="card">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left"
      >
        <h3 className="font-semibold text-white pr-4">{question}</h3>
        <ChevronDown
          className={`w-5 h-5 text-brand-400 flex-shrink-0 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && (
        <p className="mt-4 text-brand-300 leading-relaxed">{answer}</p>
      )}
    </div>
  );
}
