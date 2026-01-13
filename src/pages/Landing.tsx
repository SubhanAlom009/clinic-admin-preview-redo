import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Users,
  Calendar,
  Receipt,
  BarChart3,
  Shield,
  Clock,
  CheckCircle,
  ArrowRight,
  Star,
  Linkedin,
  Twitter,
  Facebook,
  Phone,
  Mail,
  MapPin,
  PlayCircle,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { useAuth } from "../hooks/useAuth";
import { ClinicProfileService } from "../services";
import HeaderHome from "../components/HeaderHome";

export function Landing() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);

  // Fetch profile when user changes
  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const response = await ClinicProfileService.getClinicProfile(user.id);
        if (response.success) {
          setProfile(response.data);
        } else {
          setProfile(null);
        }
      };
      fetchProfile();
    } else {
      setProfile(null);
    }
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    setProfile(null);
    navigate("/");
  };

  // // Minimalist palette tokens (tailwind classes)
  // // Light healthcare feel with calming blues and neutral grays
  // // Primary: blue-600, tints: blue-50/100, accents via border-slate-200
  // // Text: slate-800/600, Surfaces: white / slate-50
  // const brand = {
  //   bgSoft: "bg-blue-50",
  //   textStrong: "text-slate-900",
  //   textSoft: "text-slate-600",
  //   border: "border-slate-200",
  //   card: "bg-white",
  //   primary: "text-blue-700",
  //   primaryBg: "bg-blue-600",
  //   primaryRing: "focus:ring-blue-600",
  // };

  const features = [
    {
      icon: Users,
      title: "Patient Management",
      description:
        "Unified records with history, demographics, and contacts in a clean timeline view.",
    },
    {
      icon: Calendar,
      title: "Appointment Scheduling",
      description:
        "Frictionless booking, real-time availability, and automated reminders.",
    },
    {
      icon: Receipt,
      title: "Billing & Payments",
      description:
        "Clear invoices, payment tracking, and automated reconciliation.",
    },
    {
      icon: BarChart3,
      title: "Analytics & Reports",
      description:
        "Actionable insights with concise reports and exportable data.",
    },
    {
      icon: Shield,
      title: "Secure & Compliant",
      description:
        "Role-based access, encryption, and audit trails for compliance.",
    },
    {
      icon: Clock,
      title: "Real-time Updates",
      description: "Live sync across devices with non-intrusive notifications.",
    },
  ];

  const benefits = [
    "Reduce administrative overhead by 60%",
    "Improve patient satisfaction with streamlined flows",
    "Increase revenue with efficient billing",
    "Ensure regulatory compliance",
    "Access your clinic data anywhere",
  ];

  // Optional: gentler hero image rotation (fade)
  const carouselImages = [
    "/home_page_1.jpg",
    "/home_page_2.jpg",
    "/home_page_3.jpg",
    "/home_page_4.jpg",
  ];
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setCurrentImageIndex((p) => (p + 1) % carouselImages.length),
      6000
    );
    return () => clearInterval(id);
  }, [carouselImages.length]);

  const IconWrap = ({ Icon }: { Icon: any }) => (
    <div className="p-2 rounded-md bg-blue-50 text-blue-700">
      <Icon className="h-5 w-5" strokeWidth={2} />
    </div>
  );

  const ActionButtons = () => (
    <div className="flex flex-col sm:flex-row gap-3">
      {user ? (
        <Link to="/admin/dashboard">
          <Button size="lg" className="w-full sm:w-auto">
            Go to Dashboard
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </Link>
      ) : (
        <Link to="/auth">
          <Button size="lg" className="w-full sm:w-auto">
            Start Free Trial
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </Link>
      )}
      <Button size="lg" variant="outline" className="w-full sm:w-auto">
        <PlayCircle className="h-5 w-5 mr-2" />
        Watch Demo
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <HeaderHome />

      {/* Hero */}
      <section className="relative pt-16 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="text-center lg:text-left">
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 mb-4">
              Modern Clinic
              <span className="block text-blue-700">Management System</span>
            </h1>
            <p className="text-lg text-slate-600 mb-8">
              Streamline operations with{" "}
              <span className="font-medium">minimal steps</span> and{" "}
              <span className="font-medium">clear actions</span>—patients,
              appointments, billing, and insights in one calm interface.
            </p>
            <div className="sm:flex justify-center lg:justify-start items-center">
              <ActionButtons />
            </div>
          </div>
          <div className="relative h-72 sm:h-80 lg:h-[420px]">
            {/* Minimal fade carousel */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden border border-slate-200">
              {carouselImages.map((src, idx) => (
                <img
                  key={idx}
                  src={src}
                  alt={`Healthcare scene ${idx + 1}`}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${idx === currentImageIndex ? "opacity-100" : "opacity-0"
                    }`}
                />
              ))}
            </div>
            {/* Simple dots */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
              {carouselImages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImageIndex(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all ${idx === currentImageIndex
                      ? "w-6 bg-blue-700"
                      : "w-2 bg-slate-300 hover:bg-slate-400"
                    }`}
                />
              ))}
            </div>
          </div>
        </div>
        {/* Soft background band */}
        <div className="absolute inset-x-0 top-0 -z-10 h-[40%] bg-blue-50/50" />
      </section>

      {/* Features */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold text-slate-900">
              Everything to run your clinic
            </h2>
            <p className="text-slate-600 mt-3">
              Focus on care—keep tools simple, fast, and predictable.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div
                key={i}
                className="bg-white border border-slate-200 rounded-xl p-6"
              >
                <div className="flex items-center gap-3 mb-3">
                  <IconWrap Icon={f.icon} />
                  <h3 className="text-lg font-medium text-slate-900">
                    {f.title}
                  </h3>
                </div>
                <p className="text-slate-600">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-semibold text-slate-900 mb-4">
              Designed for patient-first care
            </h2>
            <p className="text-slate-600 mb-6">
              A clear, minimal interface that supports clinical work and patient
              trust.
            </p>
            <div className="space-y-3">
              {benefits.map((b, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-slate-700">{b}</span>
                </div>
              ))}
            </div>
            <div className="mt-8">
              {user ? (
                <Link to="/admin/dashboard">
                  <Button size="lg">
                    Go to Dashboard
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
              ) : (
                <Link to="/auth">
                  <Button size="lg">
                    Get Started Today
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
          <div className="rounded-2xl p-8 border border-slate-200 bg-white">
            <div className="grid grid-cols-2 gap-6 text-center">
              <div>
                <div className="text-3xl font-semibold text-slate-900">
                  10K+
                </div>
                <div className="text-slate-500">Patients</div>
              </div>
              <div>
                <div className="text-3xl font-semibold text-slate-900">
                  500+
                </div>
                <div className="text-slate-500">Clinics</div>
              </div>
              <div>
                <div className="text-3xl font-semibold text-slate-900">
                  99.9%
                </div>
                <div className="text-slate-500">Uptime</div>
              </div>
              <div>
                <div className="text-3xl font-semibold text-slate-900">
                  24/7
                </div>
                <div className="text-slate-500">Support</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold text-slate-900">
              Trusted by healthcare professionals
            </h2>
            <p className="text-slate-600 mt-3">
              Clear outcomes and efficient workflows across specialties.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: "Dr. Sarah Johnson",
                role: "Family Medicine",
                content:
                  "The interface reduces clicks and clarifies tasks. It saves hours weekly.",
                rating: 5,
              },
              {
                name: "Dr. Michael Chen",
                role: "Pediatrics",
                content:
                  "Scheduling is intuitive, and reminders are reliable—parents love it.",
                rating: 5,
              },
              {
                name: "Dr. Emily Rodriguez",
                role: "Dermatology",
                content:
                  "Billing is transparent and reporting is exportable—finance is simpler.",
                rating: 5,
              },
            ].map((t, i) => (
              <div
                key={i}
                className="bg-white border border-slate-200 rounded-xl p-6"
              >
                <div className="flex items-center mb-3">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star
                      key={j}
                      className="h-5 w-5 text-yellow-400 fill-current"
                    />
                  ))}
                </div>
                <p className="text-slate-700 mb-4 italic">"{t.content}"</p>
                <div>
                  <div className="font-medium text-slate-900">{t.name}</div>
                  <div className="text-sm text-slate-500">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-blue-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold text-white mb-3">
            Ready to modernize your clinic?
          </h2>
          <p className="text-blue-100 mb-8">
            Minimal steps, clear actions, and dependable performance.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {user ? (
              <Link to="/admin/dashboard">
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-white text-blue-700 hover:bg-slate-50 w-full sm:w-auto"
                >
                  Go to Dashboard
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </Link>
            ) : (
              <Link to="/auth">
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-white text-blue-700 hover:bg-slate-50 w-full sm:w-auto"
                >
                  Start Free Trial
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </Link>
            )}
            <Button
              size="lg"
              variant="outline"
              className=" hover:bg-blue-700 w-full sm:w-auto"
            >
              Contact Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto py-14 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* About */}
            <div className="col-span-1 md:col-span-2 lg:col-span-1">
              <img
                src="/clinic-admin/abhicure_logo_nobg.png"
                alt="AbhiCure Logo"
                className="h-10 w-auto bg-white p-1.5 rounded mb-4"
              />
              <p className="text-slate-400">
                Empowering clinicians with calm, clear tools for better care.
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-medium text-lg mb-3">Quick Links</h4>
              <ul className="space-y-2 text-slate-400">
                <li>
                  <a href="#services" className="hover:text-white">
                    Services
                  </a>
                </li>
                <li>
                  <a href="#doctors" className="hover:text-white">
                    Find a Doctor
                  </a>
                </li>
                <li>
                  <a href="#appointment" className="hover:text-white">
                    Book Appointment
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    About Us
                  </a>
                </li>
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h4 className="font-medium text-lg mb-3">Contact Us</h4>
              <ul className="space-y-3 text-slate-400">
                <li className="flex items-start">
                  <MapPin className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
                  <span>
                    123 Healthcare Complex, Mumbai, Maharashtra 400001
                  </span>
                </li>
                <li className="flex items-center">
                  <Mail className="w-5 h-5 mr-3" />
                  <a
                    href="mailto:support@abhicure.com"
                    className="hover:text-white"
                  >
                    support@abhicure.com
                  </a>
                </li>
                <li className="flex items-center">
                  <Phone className="w-5 h-5 mr-3" />
                  <a href="tel:+919876543210" className="hover:text-white">
                    +91 98765 43210
                  </a>
                </li>
                <li className="flex items-center">
                  <Clock className="w-5 h-5 mr-3" />
                  <span>Mon - Sat: 9 AM - 8 PM</span>
                </li>
              </ul>
            </div>

            {/* Social */}
            <div>
              <h4 className="font-medium text-lg mb-3">Follow Us</h4>
              <div className="flex space-x-4 text-slate-400">
                <a href="#" className="hover:text-white" aria-label="Facebook">
                  <Facebook size={22} />
                </a>
                <a href="#" className="hover:text-white" aria-label="Twitter">
                  <Twitter size={22} />
                </a>
                <a href="#" className="hover:text-white" aria-label="LinkedIn">
                  <Linkedin size={22} />
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-10 pt-6 text-center text-slate-500">
            <p>
              &copy; {new Date().getFullYear()} AbhiCure. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
