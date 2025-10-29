import { useState, useEffect, useRef } from "react";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { STATES, getCitiesForState } from "../../validation/AddressValidation";
import type { AddressFormData } from "../../validation/AddressValidation";

interface AddressFormProps {
  value: AddressFormData;
  onChange: (data: AddressFormData) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

export function AddressForm({
  value,
  onChange,
  errors,
  disabled,
}: AddressFormProps) {
  const [selectedState, setSelectedState] = useState(value.state || "");
  const [selectedCity, setSelectedCity] = useState(value.city || "");
  const isInternalUpdate = useRef(false);

  useEffect(() => {
    // Only sync with props if this is not an internal update
    if (!isInternalUpdate.current) {
      setSelectedState(value.state || "");
      setSelectedCity(value.city || "");
    }
    // Reset the flag after processing
    isInternalUpdate.current = false;
  }, [value.state, value.city]);

  const availableCities = getCitiesForState(selectedState);

  const handleFieldChange = (field: keyof AddressFormData, val: string) => {
    isInternalUpdate.current = true; // Mark this as an internal update
    const updatedData = { ...value, [field]: val };
    console.log(`AddressForm: Updating ${field} to "${val}"`, updatedData);
    onChange(updatedData);
  };

  return (
    <div className="space-y-4">
      {/* Address Line 1 */}
      <Input
        label="Address Line 1"
        value={value.address_line1 || ""}
        onChange={(e) => handleFieldChange("address_line1", e.target.value)}
        error={errors?.address_line1}
        required
        disabled={disabled}
        placeholder="House/Flat No., Building Name"
      />

      {/* Address Line 2 */}
      <Input
        label="Address Line 2"
        value={value.address_line2 || ""}
        onChange={(e) => handleFieldChange("address_line2", e.target.value)}
        disabled={disabled}
        placeholder="Apartment, Suite, Floor (optional)"
      />

      {/* Street */}
      <Input
        label="Street"
        value={value.street || ""}
        onChange={(e) => handleFieldChange("street", e.target.value)}
        disabled={disabled}
        placeholder="Street name (optional)"
      />

      {/* Area */}
      <Input
        label="Area/Locality"
        value={value.area || ""}
        onChange={(e) => handleFieldChange("area", e.target.value)}
        disabled={disabled}
        placeholder="Area or locality (optional)"
      />

      {/* State */}
      <Select
        label="State"
        value={selectedState}
        onChange={(e) => {
          const newState = e.target.value;
          setSelectedState(newState);

          // Reset city if state changes
          if (newState !== value.state && value.state) {
            setSelectedCity("");
            // Update both state and city together to avoid race condition
            const updatedData = { ...value, state: newState, city: "" };
            console.log(
              "AddressForm: State changed, resetting city",
              updatedData
            );
            onChange(updatedData);
          } else {
            // Just update state
            handleFieldChange("state", newState);
          }
        }}
        options={[
          { value: "", label: "Select State" },
          ...STATES.map((state) => ({ value: state, label: state })),
        ]}
        error={errors?.state}
        required
        disabled={disabled}
      />

      {/* City */}
      <Select
        label="City"
        value={selectedCity}
        onChange={(e) => {
          const newCity = e.target.value;
          setSelectedCity(newCity);
          handleFieldChange("city", newCity);
        }}
        options={[{ value: "", label: "Select City" }, ...availableCities]}
        error={errors?.city}
        required
        disabled={!selectedState || disabled}
      />

      {/* Postal Code */}
      <Input
        label="Postal Code"
        value={value.postal_code || ""}
        onChange={(e) => {
          const val = e.target.value.replace(/\D/g, "").slice(0, 6);
          handleFieldChange("postal_code", val);
        }}
        error={errors?.postal_code}
        required
        disabled={disabled}
        placeholder="6-digit PIN code"
        maxLength={6}
      />

      {/* Country (disabled, default India) */}
      <Input label="Country" value="India" disabled readOnly />
    </div>
  );
}
