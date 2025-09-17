import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, User, Building, AlertCircle } from 'lucide-react';
import { z } from 'zod';
import { useFormValidation } from '@/hooks/useFormValidation';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useOnboardingFlow } from '@/hooks/useOnboardingFlow';
import { useMerchantData } from '@/hooks/useMerchantData';
import { useDebounce } from '@/hooks/useDebounce';

// Validation schema for merchant registration
const merchantRegistrationSchema = z.object({
    fullName: z.string()
        .min(2, 'Full name must be at least 2 characters')
        .max(100, 'Full name cannot exceed 100 characters')
        .regex(/^[a-zA-Z\s.]+$/, 'Full name can only contain letters, spaces, and dots'),

    mobileNumber: z.string()
        .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit mobile number'),

    email: z.string()
        .email('Please enter a valid email address')
        .max(255, 'Email cannot exceed 255 characters'),

    panNumber: z.string()
        .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Please enter a valid PAN number (e.g., ABCDE1234F)')
        .transform(val => val.toUpperCase()),

    aadhaarNumber: z.string()
        .regex(/^[2-9]{1}[0-9]{3}[0-9]{4}[0-9]{4}$/, 'Please enter a valid 12-digit Aadhaar number')
        .transform(val => val.replace(/\s/g, '')),

    businessName: z.string()
        .min(2, 'Business name must be at least 2 characters')
        .max(200, 'Business name cannot exceed 200 characters'),

    gstNumber: z.string()
        .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Please enter a valid GST number')
        .transform(val => val.toUpperCase()),
});

type MerchantRegistrationData = z.infer<typeof merchantRegistrationSchema>;

interface MerchantRegistrationProps {
    onNext: () => void;
    onPrev: () => void;
}

export const MerchantRegistration: React.FC<MerchantRegistrationProps> = ({
    onNext,
    onPrev,
}) => {
    const { nextStep, prevStep } = useOnboardingFlow();
    const { updateMerchantProfile, merchantProfile } = useMerchantData();
    const { uploadFile, getUploadStatus, validateFile } = useFileUpload();

    // Form state with initial values from merchant profile
    const [formData, setFormData] = React.useState<Partial<MerchantRegistrationData>>({
        fullName: merchantProfile?.full_name || '',
        businessName: merchantProfile?.business_name || '',
        mobileNumber: merchantProfile?.mobile_number || '',
        email: merchantProfile?.email || '',
        panNumber: merchantProfile?.pan_number || '',
        aadhaarNumber: merchantProfile?.aadhaar_number || '',
        gstNumber: merchantProfile?.gst_number || '',
    });

    // Document upload state
    const [uploadedDocs, setUploadedDocs] = React.useState<Record<string, File>>({});

    // Form validation hook
    const {
        errors,
        validateField,
        validateForm,
        clearFieldError,
        getFieldError
    } = useFormValidation(merchantRegistrationSchema);

    // Debounced validation for real-time feedback
    const debouncedFormData = useDebounce(formData, 500);

    // Validate form in real-time
    React.useEffect(() => {
        if (Object.keys(debouncedFormData).length > 0) {
            validateForm(debouncedFormData);
        }
    }, [debouncedFormData, validateForm]);

    const handleInputChange = (field: keyof MerchantRegistrationData) => (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const value = e.target.value;
        setFormData(prev => ({ ...prev, [field]: value }));

        // Clear field error on change
        if (getFieldError(field)) {
            clearFieldError(field);
        }

        // Real-time validation for specific fields
        if (value) {
            validateField(field, value);
        }
    };

    const handleFileUpload = (docType: string) => (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file before storing
        const validation = validateFile(file);
        if (!validation.valid) {
            return; // Error already shown by hook
        }

        setUploadedDocs(prev => ({ ...prev, [docType]: file }));
    };

    const handleNext = async () => {
        // Final form validation
        const validation = validateForm(formData);

        if (!validation.valid) {
            return;
        }

        // Check required documents
        const requiredDocs = ['panCard', 'aadhaar', 'businessProof'];
        const missingDocs = requiredDocs.filter(doc => !uploadedDocs[doc]);

        if (missingDocs.length > 0) {
            // Could add document validation errors here
            return;
        }

        try {
            // Update merchant profile
            await updateMerchantProfile({
                full_name: formData.fullName!,
                business_name: formData.businessName!,
                mobile_number: formData.mobileNumber!,
                email: formData.email!,
                pan_number: formData.panNumber!,
                aadhaar_number: formData.aadhaarNumber!,
                gst_number: formData.gstNumber!,
            });

            // Upload documents in parallel
            const uploads = Object.entries(uploadedDocs).map(([docType, file]) =>
                uploadFile(file, 'merchant-documents', `${merchantProfile?.user_id}/${docType}-${Date.now()}`)
            );

            await Promise.all(uploads);

            // Navigate to next step
            onNext();
        } catch (error) {
            console.error('Error saving registration data:', error);
        }
    };

    const documentTypes = [
        { key: 'panCard', label: 'PAN Card', required: true },
        { key: 'aadhaar', label: 'Aadhaar Card', required: true },
        { key: 'businessProof', label: 'Business Proof', required: true },
        { key: 'bankStatement', label: 'Bank Statement', required: false },
    ];

    return (
        <div className="space-y-8">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-foreground mb-2">
                    Merchant Registration
                </h2>
                <p className="text-muted-foreground">
                    Let's get your business details and documents ready
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Personal Information */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5 text-primary" />
                            Personal Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="fullName">Full Name *</Label>
                            <Input
                                id="fullName"
                                value={formData.fullName || ''}
                                onChange={handleInputChange('fullName')}
                                placeholder="Enter your full name"
                                className={getFieldError('fullName') ? 'border-destructive' : ''}
                            />
                            {getFieldError('fullName') && (
                                <div className="flex items-center gap-1 mt-1">
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                    <p className="text-sm text-destructive">{getFieldError('fullName')}</p>
                                </div>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="mobileNumber">Mobile Number *</Label>
                            <Input
                                id="mobileNumber"
                                value={formData.mobileNumber || ''}
                                onChange={handleInputChange('mobileNumber')}
                                placeholder="+91 9876543210"
                                className={getFieldError('mobileNumber') ? 'border-destructive' : ''}
                            />
                            {getFieldError('mobileNumber') && (
                                <div className="flex items-center gap-1 mt-1">
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                    <p className="text-sm text-destructive">{getFieldError('mobileNumber')}</p>
                                </div>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="email">Email Address *</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email || ''}
                                onChange={handleInputChange('email')}
                                placeholder="merchant@example.com"
                                className={getFieldError('email') ? 'border-destructive' : ''}
                            />
                            {getFieldError('email') && (
                                <div className="flex items-center gap-1 mt-1">
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                    <p className="text-sm text-destructive">{getFieldError('email')}</p>
                                </div>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="panNumber">PAN Number *</Label>
                            <Input
                                id="panNumber"
                                value={formData.panNumber || ''}
                                onChange={handleInputChange('panNumber')}
                                placeholder="ABCDE1234F"
                                className={getFieldError('panNumber') ? 'border-destructive' : ''}
                                maxLength={10}
                            />
                            {getFieldError('panNumber') && (
                                <div className="flex items-center gap-1 mt-1">
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                    <p className="text-sm text-destructive">{getFieldError('panNumber')}</p>
                                </div>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="aadhaarNumber">Aadhaar Number *</Label>
                            <Input
                                id="aadhaarNumber"
                                value={formData.aadhaarNumber || ''}
                                onChange={handleInputChange('aadhaarNumber')}
                                placeholder="1234 5678 9012"
                                className={getFieldError('aadhaarNumber') ? 'border-destructive' : ''}
                                maxLength={12}
                            />
                            {getFieldError('aadhaarNumber') && (
                                <div className="flex items-center gap-1 mt-1">
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                    <p className="text-sm text-destructive">{getFieldError('aadhaarNumber')}</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Business Information */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building className="h-5 w-5 text-primary" />
                            Business Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="businessName">Business Name *</Label>
                            <Input
                                id="businessName"
                                value={formData.businessName || ''}
                                onChange={handleInputChange('businessName')}
                                placeholder="Enter business name"
                                className={getFieldError('businessName') ? 'border-destructive' : ''}
                            />
                            {getFieldError('businessName') && (
                                <div className="flex items-center gap-1 mt-1">
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                    <p className="text-sm text-destructive">{getFieldError('businessName')}</p>
                                </div>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="gstNumber">GST Number *</Label>
                            <Input
                                id="gstNumber"
                                value={formData.gstNumber || ''}
                                onChange={handleInputChange('gstNumber')}
                                placeholder="22AAAAA0000A1Z5"
                                className={getFieldError('gstNumber') ? 'border-destructive' : ''}
                                maxLength={15}
                            />
                            {getFieldError('gstNumber') && (
                                <div className="flex items-center gap-1 mt-1">
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                    <p className="text-sm text-destructive">{getFieldError('gstNumber')}</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Document Upload */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Document Upload
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-2 gap-4">
                        {documentTypes.map((docType) => {
                            const uploadStatus = getUploadStatus(`merchant-documents-${docType.key}`);
                            const hasFile = uploadedDocs[docType.key];

                            return (
                                <div key={docType.key} className="p-4 border-2 border-dashed border-border rounded-lg">
                                    <Label className="cursor-pointer">
                                        <div className="text-center">
                                            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                            <p className="text-sm font-medium">
                                                {docType.label} {docType.required && '*'}
                                            </p>
                                            {hasFile ? (
                                                <div className="mt-2">
                                                    <p className="text-xs text-primary">
                                                        ✓ {hasFile.name}
                                                    </p>
                                                    {uploadStatus.uploading && (
                                                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                                            <div
                                                                className="bg-primary h-2 rounded-full transition-all duration-300"
                                                                style={{ width: `${uploadStatus.progress}%` }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Click to upload
                                                </p>
                                            )}
                                        </div>
                                        <input
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            onChange={handleFileUpload(docType.key)}
                                            className="hidden"
                                        />
                                    </Label>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                        <h4 className="font-semibold text-foreground mb-2">Upload Requirements:</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• File formats: PDF, JPEG, PNG only</li>
                            <li>• Maximum file size: 5MB per document</li>
                            <li>• Documents should be clear and readable</li>
                            <li>• Ensure all text is visible and not blurred</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between pt-6">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onPrev}
                    className="px-8"
                >
                    Back
                </Button>
                <Button
                    type="button"
                    onClick={handleNext}
                    disabled={Object.keys(errors).length > 0 || !formData.fullName}
                    className="px-8"
                >
                    Continue to KYC
                </Button>
            </div>
        </div>
    );
};