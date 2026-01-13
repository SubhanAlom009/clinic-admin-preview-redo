import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  ClinicProfileService,
  type CreateClinicProfileData,
} from "../services";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Eye, EyeOff } from "lucide-react";
import { signupSchema, signInSchema } from "../validation/UserValidation";

export function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    clinicName: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { user, signIn, signUp } = useAuth();



  if (user) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isSignUp) {
        const parsed = signupSchema.safeParse(formData);
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? "Invalid input");
          setLoading(false);
          return;
        }
        const { data, error } = await signUp(
          formData.email,
          formData.password,
          formData.name
        );
        if (error) throw error;

        // Create profile with clinic name after successful signup
        if (data.user) {
          const profilePayload: CreateClinicProfileData = {
            id: data.user.id,
            admin_name: formData.name,
            clinic_name: formData.clinicName,
            contact_email: formData.email,
          };
          const response = await ClinicProfileService.createClinicProfile(
            profilePayload
          );

          if (!response.success) {
            console.error("Error creating profile:", response.error);
          }
        }
      } else {
        const parsed = signInSchema.safeParse({
          email: formData.email,
          password: formData.password,
        });
        if (!parsed.success) {
          setError(parsed.error.issues[0].message);
          setLoading(false);
          return;
        }

        const { error } = await signIn(formData.email, formData.password);
        if (error) throw error;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen flex">
      {/* Left visual (70%) - will stay fixed on large screens */}
      <div className="hidden lg:block w-8/12 sticky top-0 h-screen">
        <div className="relative h-full">
          <img
            src="/clinic-admin/home_page_1.jpg"
            alt="Healthcare"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
      </div>
      {/* Right - auth form */}
      <div className="w-full overflow-y-auto lg:w-4/12 h-screen flex items-center justify-center px-6">
        <div className="w-full bg-white p-8">
          <div className="flex flex-col items-center gap-2 mb-6">
            <img
              src="/clinic-admin/logo_abhicure.jpg"
              alt="Abhicure logo"
              className="h-48 w-48 object-contain -mb-12"
            />
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">
                {isSignUp ? "Create Account" : "Welcome to Abhicure"}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {isSignUp
                  ? "Set up your clinic management system"
                  : "Sign in to your clinic dashboard"}
              </p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {isSignUp && (
              <>
                <Input
                  label="Full Name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter your full name"
                />
                <Input
                  label="Clinic Name"
                  name="clinicName"
                  type="text"
                  required
                  value={formData.clinicName}
                  onChange={handleInputChange}
                  placeholder="Enter your clinic name"
                />
              </>
            )}

            <Input
              label="Email Address"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter your email"
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Password<span className="text-red-500 ml-1">*</span>
              </label>
              <div className="relative">
                <Input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                className="text-sm text-indigo-600 hover:text-indigo-500"
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full text-white font-semibold py-2 rounded-lg"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : isSignUp
                  ? "Create Account"
                  : "Sign In"}
            </Button>

            <div className="text-center mt-2">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-indigo-600 hover:text-indigo-500 transition-colors duration-200"
              >
                {isSignUp
                  ? "Already have an account? Sign in"
                  : "Don't have an account? Create one"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
