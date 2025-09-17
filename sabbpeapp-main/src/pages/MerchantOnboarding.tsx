import React, { useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { WelcomeScreen } from '@/components/onboarding/WelcomeScreen';
import { MerchantRegistration } from '@/components/onboarding/MerchantRegistration.1';
import { KYCVerification } from '@/components/onboarding/KYCVerification';
import { BankDetails } from '@/components/onboarding/BankDetails';
import { ReviewSubmit } from '@/components/onboarding/ReviewSubmit';
import { OnboardingDashboard } from '@/components/onboarding/OnboardingDashboard';

const TOTAL_STEPS = 4;

export interface OnboardingData {
  // Personal Information
  fullName: string;
  mobileNumber: string;
  email: string;
  panNumber: string;
  aadhaarNumber: string;
  
  // Business Information
  businessName: string;
  gstNumber: string;
  
  // Documents
  documents: {
    panCard: File | null;
    aadhaarCard: File | null;
    businessProof: File | null;
    bankStatement: File | null;
    cancelledCheque: File | null;
  };
  
  // KYC Details
  kycCompleted: boolean;
  videoKycCompleted: boolean;
  locationCaptured: boolean;
  location: { latitude: number; longitude: number } | null;
  selfiePhoto: File | null;
  kycData: {
    isVideoCompleted: boolean;
    selfieCapture?: File;
    geoLocation?: { lat: number; lng: number; address: string };
  };
  
  // Bank Details
  bankDetails: {
    accountNumber: string;
    ifscCode: string;
    bankName: string;
  };
  
  // Agreement
  agreementAccepted: boolean;
}

const MerchantOnboarding = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    // Personal Information
    fullName: '',
    mobileNumber: '',
    email: '',
    panNumber: '',
    aadhaarNumber: '',
    
    // Business Information
    businessName: '',
    gstNumber: '',
    
    // Documents
    documents: {
      panCard: null,
      aadhaarCard: null,
      businessProof: null,
      bankStatement: null,
      cancelledCheque: null,
    },
    
    // KYC Details
    kycCompleted: false,
    videoKycCompleted: false,
    locationCaptured: false,
    location: null,
    selfiePhoto: null,
    kycData: {
      isVideoCompleted: false,
    },
    
    // Bank Details
    bankDetails: {
      accountNumber: '',
      ifscCode: '',
      bankName: '',
    },
    
    // Agreement
    agreementAccepted: false,
  });

  const updateData = (newData: Partial<OnboardingData>) => {
    setOnboardingData(prev => ({ ...prev, ...newData }));
  };

  const nextStep = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitted(true);
  };

  const getStepTitle = (step: number) => {
    switch (step) {
      case 0: return 'Welcome';
      case 1: return 'Registration';
      case 2: return 'KYC Verification';
      case 3: return 'Bank Details';
      case 4: return 'Review & Submit';
      default: return '';
    }
  };

  if (isSubmitted) {
    return <OnboardingDashboard />;
  }

  if (currentStep === 0) {
    return <WelcomeScreen onStart={() => setCurrentStep(1)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5">
      <div className="container max-w-4xl mx-auto px-4 py-8">
        {/* Progress Header */}
        <div className="bg-card rounded-2xl shadow-[var(--shadow-card)] p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-foreground">
              Merchant Onboarding
            </h1>
            <div className="text-sm text-muted-foreground">
              Step {currentStep} of {TOTAL_STEPS}
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-foreground">
                {getStepTitle(currentStep)}
              </span>
              <span className="text-muted-foreground">
                {Math.round((currentStep / TOTAL_STEPS) * 100)}% Complete
              </span>
            </div>
            <Progress 
              value={(currentStep / TOTAL_STEPS) * 100} 
              className="h-2"
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-card rounded-2xl shadow-[var(--shadow-card)] p-8">
          {currentStep === 1 && (
            <MerchantRegistration
              data={onboardingData}
              onDataChange={updateData}
              onNext={nextStep}
              onPrev={prevStep}
            />
          )}
          
          {currentStep === 2 && (
            <KYCVerification
              data={onboardingData}
              onDataChange={updateData}
              onNext={nextStep}
              onPrev={prevStep}
            />
          )}
          
          {currentStep === 3 && (
            <BankDetails
              data={onboardingData}
              onDataChange={updateData}
              onNext={nextStep}
              onPrev={prevStep}
            />
          )}
          
          {currentStep === 4 && (
            <ReviewSubmit
              data={onboardingData}
              onDataChange={updateData}
              onSubmit={handleSubmit}
              onPrev={prevStep}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default MerchantOnboarding;