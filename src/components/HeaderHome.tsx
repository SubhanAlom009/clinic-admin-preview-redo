import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { LogOut, User, Menu, X, ArrowRight } from "lucide-react";
import { Button } from "./ui/Button";
import { ClinicProfileService } from "../services";

function HeaderHome() {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    setMobileMenuOpen(false);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <>
      <nav className="bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200/60 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 lg:h-18">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-3">
              <img
                src="/clinic-admin/abhicure_logo_nobg.png"
                alt="AbhiCure"
                className="h-10 lg:h-12 w-auto object-contain"
              />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-4">
              {loading ? (
                <div className="animate-pulse flex space-x-3">
                  <div className="h-9 w-20 bg-slate-200 rounded-lg"></div>
                  <div className="h-9 w-28 bg-slate-200 rounded-lg"></div>
                </div>
              ) : user ? (
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-3 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="w-8 h-8 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <div className="text-sm">
                      <div className="font-medium text-slate-800">
                        {profile?.admin_name || profile?.name || "Loading..."}
                      </div>
                      {profile?.clinic_name && (
                        <div className="text-xs text-slate-500">
                          {profile.clinic_name}
                        </div>
                      )}
                    </div>
                  </div>
                  <Link to="/admin/dashboard">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                      Dashboard
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    onClick={handleSignOut}
                    className="border-slate-300 hover:bg-slate-50"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              ) : (
                <div className="flex items-center space-x-4">
                  <Link
                    to="/auth"
                    className="text-slate-600 hover:text-slate-800 font-medium transition-colors duration-200"
                  >
                    Sign In
                  </Link>
                  <Link to="/auth">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                      Get Started
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-slate-600 hover:text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500 transition-colors duration-200"
                aria-expanded="false"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md">
            <div className="px-4 py-6 space-y-4">
              {loading ? (
                <div className="space-y-3">
                  <div className="h-12 bg-slate-200 rounded-lg animate-pulse"></div>
                  <div className="h-10 bg-slate-200 rounded-lg animate-pulse"></div>
                </div>
              ) : user ? (
                <div className="space-y-4">
                  {/* User Info */}
                  <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="w-12 h-12 bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center justify-center">
                      <User className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-slate-800">
                        {profile?.admin_name || profile?.name || "Loading..."}
                      </div>
                      {profile?.clinic_name && (
                        <div className="text-sm text-slate-500">
                          {profile.clinic_name}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Navigation Links */}
                  <div className="space-y-3">
                    <Link
                      to="/admin/dashboard"
                      onClick={closeMobileMenu}
                      className="block w-full"
                    >
                      <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white justify-center">
                        <ArrowRight className="h-4 w-4 mr-2" />
                        Go to Dashboard
                      </Button>
                    </Link>

                    <Button
                      variant="outline"
                      onClick={handleSignOut}
                      className="w-full border-slate-300 hover:bg-slate-50 justify-center"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Link
                    to="/auth"
                    onClick={closeMobileMenu}
                    className="block w-full"
                  >
                    <Button
                      variant="outline"
                      className="w-full border-slate-300 hover:bg-slate-50 justify-center"
                    >
                      Sign In
                    </Button>
                  </Link>

                  <Link
                    to="/auth"
                    onClick={closeMobileMenu}
                    className="block w-full"
                  >
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white justify-center">
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Get Started
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-25 z-30 lg:hidden"
          onClick={closeMobileMenu}
        />
      )}
    </>
  );
}

export default HeaderHome;
