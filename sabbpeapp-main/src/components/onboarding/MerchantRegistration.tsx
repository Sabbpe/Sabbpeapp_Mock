import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
    Upload,
    FileText,
    User,
    Building,
    CheckCircle,
    RefreshCw,
    Sparkles,
    CreditCard,
    Camera,
    Trash2,
    Eye,
    AlertTriangle
} from 'lucide-react';

// Self-contained OCR interface
interface ExtractedData {
    panNumber?: string;
    aadhaarNumber?: string;
    name?: string;
    fatherName?: string;
    dateOfBirth?: string;
    address?: string;
    gstNumber?: string;
    businessName?: string;
    confidence: number;
    rawText: string;
}

// Self-contained OCR service
class InlineOCRService {
    private documentPatterns = {
        PAN: {
            panNumber: /([A-Z]{5}[0-9]{4}[A-Z]{1})/g,
            name: /(?:Name|नाम)[:\s]*([A-Z\s]{2,50})/i,
            fatherName: /(?:Father'?s?\s*Name|पिता का नाम)[:\s]*([A-Z\s]{2,50})/i,
            dateOfBirth: /(?:Date of Birth|जन्म तिथि)[:\s]*(\d{1,2}[\\-]\d{1,2}[\\-]\d{4})/i
        },
        AADHAAR: {
            aadhaarNumber: /([2-9]{1}[0-9]{3}\s?[0-9]{4}\s?[0-9]{4})/g,
            name: /(?:^|\n)([A-Z][A-Z\s]{2,50})(?=\n|$)/m,
            dateOfBirth: /(?:DOB|Date of Birth|जन्म तिथि)[:\s]*(\d{1,2}[\\-]\d{1,2}[\\-]\d{4})/i,
            address: /(?:Address|पता)[:\s]*([A-Za-z0-9\s,.-]{10,200})/i
        }
    };

    async processDocument(
        imageFile: File,
        documentType: 'PAN' | 'AADHAAR',
        onProgress?: (progress: number) => void
    ): Promise<ExtractedData> {
        console.log(`🚀 Processing ${documentType} document: ${imageFile.name}`);

        return new Promise((resolve) => {
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 15 + 5;
                onProgress?.(Math.min(progress, 95));
            }, 500);

            setTimeout(() => {
                clearInterval(interval);
                onProgress?.(100);

                if (documentType === 'PAN') {
                    resolve({
                        panNumber: `ABCPK${Math.floor(Math.random() * 9000) + 1000}L`,
                        name: 'RAJESH KUMAR SHARMA',
                        fatherName: 'SURESH KUMAR SHARMA',
                        dateOfBirth: '15/03/1985',
                        confidence: 0.89 + Math.random() * 0.1,
                        rawText: `INCOME TAX DEPARTMENT
PERMANENT ACCOUNT NUMBER CARD
Name: RAJESH KUMAR SHARMA
Father's Name: SURESH KUMAR SHARMA
Date of Birth: 15/03/1985
PAN: ABCPK${Math.floor(Math.random() * 9000) + 1000}L`
                    });
                } else {
                    const aadhaarNum = `${Math.floor(Math.random() * 8000) + 2000} ${Math.floor(Math.random() * 9000) + 1000} ${Math.floor(Math.random() * 9000) + 1000}`;
                    resolve({
                        aadhaarNumber: aadhaarNum,
                        name: 'RAJESH KUMAR SHARMA',
                        dateOfBirth: '15/03/1985',
                        address: '123 MG Road, Bangalore, Karnataka - 560001',
                        confidence: 0.85 + Math.random() * 0.1,
                        rawText: `GOVERNMENT OF INDIA
UNIQUE IDENTIFICATION AUTHORITY OF INDIA
Name: RAJESH KUMAR SHARMA
DOB: 15/03/1985
Male
Aadhaar: ${aadhaarNum}
Address: 123 MG Road, Bangalore, Karnataka - 560001`
                    });
                }
            }, 3000 + Math.random() * 2000);
        });
    }

    async cleanup(): Promise<void> {
        console.log('🧹 OCR cleanup (mock)');
    }
}

const ocrService = new InlineOCRService();

interface MerchantRegistrationProps {
    onNext?: () => void;
    onPrev?: () => void;
}

const MerchantRegistration: React.FC<MerchantRegistrationProps> = ({
    onNext,
    onPrev
}) => {
    // Form state
    const [formData, setFormData] = useState({
        fullName: '',
        panNumber: '',
        aadhaarNumber: '',
        mobileNumber: '',
        email: '',
        businessName: '',
        gstNumber: ''
    });

    // Document upload states
    const [panCard, setPanCard] = useState<File | null>(null);
    const [aadhaarCard, setAadhaarCard] = useState<File | null>(null);
    const [businessProof, setBusinessProof] = useState<File | null>(null);
    const [bankStatement, setBankStatement] = useState<File | null>(null);

    // OCR processing states
    const [panProcessing, setPanProcessing] = useState(false);
    const [aadhaarProcessing, setAadhaarProcessing] = useState(false);
    const [panProgress, setPanProgress] = useState(0);
    const [aadhaarProgress, setAadhaarProgress] = useState(0);
    const [ocrErrors, setOcrErrors] = useState<Record<string, string>>({});

    // Auto-filled field tracking
    const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());

    // Cleanup OCR service on unmount
    useEffect(() => {
        return () => {
            ocrService.cleanup();
        };
    }, []);

    // OCR processing function
    const processWithOCR = useCallback(async (
        file: File,
        documentType: 'PAN' | 'AADHAAR',
        setProgress: (progress: number) => void
    ): Promise<ExtractedData> => {
        try {
            console.log(`🚀 Starting OCR processing for ${documentType}`);

            const result = await ocrService.processDocument(
                file,
                documentType,
                (progress) => {
                    console.log(`OCR Progress: ${progress}%`);
                    setProgress(progress);
                }
            );

            console.log('✅ OCR processing completed:', result);
            return result;

        } catch (error) {
            console.error(`❌ OCR failed for ${documentType}:`, error);
            throw new Error(`Failed to process ${documentType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }, []);

    // Handle PAN card upload and OCR
    const handlePanUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
            setOcrErrors(prev => ({ ...prev, pan: 'Please upload a valid image file (JPG, PNG) or PDF' }));
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setOcrErrors(prev => ({ ...prev, pan: 'File size must be less than 5MB' }));
            return;
        }

        setPanCard(file);
        setPanProcessing(true);
        setPanProgress(0);
        setOcrErrors(prev => ({ ...prev, pan: '' }));

        try {
            const result = await processWithOCR(file, 'PAN', setPanProgress);

            if (result.panNumber) {
                setFormData(prev => ({ ...prev, panNumber: result.panNumber! }));
                setAutoFilledFields(prev => new Set([...prev, 'panNumber']));
                console.log('✅ Auto-filled PAN number:', result.panNumber);
            }

            if (result.name && !formData.fullName) {
                setFormData(prev => ({ ...prev, fullName: result.name! }));
                setAutoFilledFields(prev => new Set([...prev, 'fullName']));
                console.log('✅ Auto-filled name from PAN:', result.name);
            }

            if (result.confidence > 0.6) {
                console.log(`🎉 PAN card processed successfully with ${Math.round(result.confidence * 100)}% confidence`);
            } else {
                setOcrErrors(prev => ({
                    ...prev,
                    pan: `Low confidence (${Math.round(result.confidence * 100)}%). Please verify extracted data.`
                }));
            }

        } catch (error) {
            console.error('PAN OCR failed:', error);
            setOcrErrors(prev => ({
                ...prev,
                pan: error instanceof Error ? error.message : 'OCR processing failed'
            }));
        } finally {
            setPanProcessing(false);
            setPanProgress(100);
        }
    }, [formData.fullName, processWithOCR]);

    // Handle Aadhaar card upload and OCR
    const handleAadhaarUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
            setOcrErrors(prev => ({ ...prev, aadhaar: 'Please upload a valid image file (JPG, PNG) or PDF' }));
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setOcrErrors(prev => ({ ...prev, aadhaar: 'File size must be less than 5MB' }));
            return;
        }

        setAadhaarCard(file);
        setAadhaarProcessing(true);
        setAadhaarProgress(0);
        setOcrErrors(prev => ({ ...prev, aadhaar: '' }));

        try {
            const result = await processWithOCR(file, 'AADHAAR', setAadhaarProgress);

            if (result.name) {
                setFormData(prev => ({ ...prev, fullName: result.name! }));
                setAutoFilledFields(prev => new Set([...prev, 'fullName']));
                console.log('✅ Auto-filled name from Aadhaar:', result.name);
            }

            if (result.aadhaarNumber) {
                setFormData(prev => ({ ...prev, aadhaarNumber: result.aadhaarNumber! }));
                setAutoFilledFields(prev => new Set([...prev, 'aadhaarNumber']));
                console.log('✅ Auto-filled Aadhaar number:', result.aadhaarNumber);
            }

            if (result.confidence > 0.6) {
                console.log(`🎉 Aadhaar card processed successfully with ${Math.round(result.confidence * 100)}% confidence`);
            } else {
                setOcrErrors(prev => ({
                    ...prev,
                    aadhaar: `Low confidence (${Math.round(result.confidence * 100)}%). Please verify extracted data.`
                }));
            }

        } catch (error) {
            console.error('Aadhaar OCR failed:', error);
            setOcrErrors(prev => ({
                ...prev,
                aadhaar: error instanceof Error ? error.message : 'OCR processing failed'
            }));
        } finally {
            setAadhaarProcessing(false);
            setAadhaarProgress(100);
        }
    }, [processWithOCR]);

    // Handle form input changes
    const handleInputChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [field]: event.target.value }));
        setAutoFilledFields(prev => {
            const updated = new Set(prev);
            updated.delete(field);
            return updated;
        });
    };

    // Handle other document uploads
    const handleDocUpload = (docType: 'business' | 'bank') => (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (docType === 'business') {
            setBusinessProof(file);
        } else {
            setBankStatement(file);
        }
    };

    // Document upload component
    const DocumentUploadCard = ({
        title,
        icon: Icon,
        file,
        processing,
        progress,
        onUpload,
        accept = "image/*,.pdf",
        description,
        error
    }: {
        title: string;
        icon: React.ComponentType<{ className?: string }>;
        file: File | null;
        processing?: boolean;
        progress?: number;
        onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
        accept?: string;
        description: string;
        error?: string;
    }) => (
        <Card className={`relative ${error ? 'border-red-300' : ''}`}>
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Icon className="h-5 w-5 text-primary" />
                    {title}
                    {file && !processing && !error && <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />}
                    {processing && <RefreshCw className="h-4 w-4 animate-spin text-blue-500 ml-auto" />}
                    {error && <AlertTriangle className="h-4 w-4 text-red-500 ml-auto" />}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <label className={`
          flex flex-col items-center justify-center w-full h-32 
          border-2 border-dashed rounded-lg cursor-pointer transition-colors
          ${file && !error ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:bg-gray-50'}
          ${processing ? 'border-blue-300 bg-blue-50' : ''}
          ${error ? 'border-red-300 bg-red-50' : ''}
        `}>
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {processing ? (
                            <RefreshCw className="h-8 w-8 text-blue-500 animate-spin mb-2" />
                        ) : file && !error ? (
                            <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
                        ) : error ? (
                            <AlertTriangle className="h-8 w-8 text-red-500 mb-2" />
                        ) : (
                            <Upload className="h-8 w-8 text-gray-400 mb-2" />
                        )}

                        <p className="mb-2 text-sm text-gray-500">
                            {processing ? (
                                <span className="font-semibold">Processing... {Math.round(progress || 0)}%</span>
                            ) : file && !error ? (
                                <span className="font-semibold text-green-600">✓ {file.name}</span>
                            ) : error ? (
                                <span className="font-semibold text-red-600">Upload failed</span>
                            ) : (
                                <span className="font-semibold">{description}</span>
                            )}
                        </p>

                        {!file && !processing && !error && (
                            <p className="text-xs text-gray-500">PNG, JPG, PDF (Max 5MB)</p>
                        )}
                    </div>

                    <input
                        type="file"
                        className="hidden"
                        accept={accept}
                        onChange={onUpload}
                        disabled={processing}
                    />
                </label>

                {processing && progress !== undefined && (
                    <div className="mt-3">
                        <Progress value={progress} className="w-full h-2" />
                        <p className="text-xs text-gray-500 mt-1">
                            Reading text from image... This may take 3-5 seconds for demo.
                        </p>
                    </div>
                )}

                {error && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                        ⚠️ {error}
                    </div>
                )}

                {file && !processing && (
                    <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => window.open(URL.createObjectURL(file), '_blank')}>
                            <Eye className="h-4 w-4 mr-1" />
                            View
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => {
                            if (title.includes('PAN')) {
                                setPanCard(null);
                                setOcrErrors(prev => ({ ...prev, pan: '' }));
                            } else if (title.includes('Aadhaar')) {
                                setAadhaarCard(null);
                                setOcrErrors(prev => ({ ...prev, aadhaar: '' }));
                            } else if (title.includes('Business')) {
                                setBusinessProof(null);
                            } else if (title.includes('Bank')) {
                                setBankStatement(null);
                            }
                        }}>
                            <Trash2 className="h-4 w-4 mr-1" />
                            Remove
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );

    // Auto-filled input component
    const AutoFillInput = ({
        label,
        field,
        placeholder,
        type = "text",
        maxLength
    }: {
        label: string;
        field: string;
        placeholder: string;
        type?: string;
        maxLength?: number;
    }) => {
        const isAutoFilled = autoFilledFields.has(field);

        return (
            <div>
                <Label className="flex items-center gap-2 mb-2">
                    {label} <span className="text-red-500">*</span>
                    {isAutoFilled && (
                        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                            <Sparkles className="h-3 w-3" />
                            Auto-filled
                        </span>
                    )}
                </Label>
                <Input
                    type={type}
                    value={formData[field as keyof typeof formData]}
                    onChange={handleInputChange(field)}
                    placeholder={placeholder}
                    maxLength={maxLength}
                    className={isAutoFilled ? 'border-green-300 bg-green-50' : ''}
                />
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-8">
            {/* Header */}
            <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Merchant Registration</h1>
                <p className="text-gray-600">Upload your documents for automatic data extraction</p>
            </div>

            {/* TOP SECTION: Critical Document Uploads */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    <Camera className="h-5 w-5 text-primary" />
                    Upload Identity Documents
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                    <DocumentUploadCard
                        title="PAN Card"
                        icon={CreditCard}
                        file={panCard}
                        processing={panProcessing}
                        progress={panProgress}
                        onUpload={handlePanUpload}
                        description="Upload PAN Card for auto-fill"
                        error={ocrErrors.pan}
                    />

                    <DocumentUploadCard
                        title="Aadhaar Card"
                        icon={CreditCard}
                        file={aadhaarCard}
                        processing={aadhaarProcessing}
                        progress={aadhaarProgress}
                        onUpload={handleAadhaarUpload}
                        description="Upload Aadhaar Card for auto-fill"
                        error={ocrErrors.aadhaar}
                    />
                </div>
            </div>

            {/* MIDDLE SECTION: Form Fields */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Personal & Business Information
                </h2>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AutoFillInput
                        label="Full Name"
                        field="fullName"
                        placeholder="Enter your full name"
                    />

                    <AutoFillInput
                        label="PAN Number"
                        field="panNumber"
                        placeholder="ABCDE1234F"
                        maxLength={10}
                    />

                    <AutoFillInput
                        label="Aadhaar Number"
                        field="aadhaarNumber"
                        placeholder="1234 5678 9012"
                        maxLength={12}
                    />

                    <AutoFillInput
                        label="Mobile Number"
                        field="mobileNumber"
                        placeholder="+91 9876543210"
                        maxLength={10}
                    />

                    <AutoFillInput
                        label="Email Address"
                        field="email"
                        type="email"
                        placeholder="merchant@example.com"
                    />

                    <AutoFillInput
                        label="Business Name"
                        field="businessName"
                        placeholder="Enter business name"
                    />

                    <div className="lg:col-span-1">
                        <AutoFillInput
                            label="GST Number"
                            field="gstNumber"
                            placeholder="22AAAAA0000A1Z5"
                            maxLength={15}
                        />
                    </div>
                </div>
            </div>

            {/* BOTTOM SECTION: Supporting Documents */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Supporting Documents
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                    <DocumentUploadCard
                        title="Business Proof"
                        icon={Building}
                        file={businessProof}
                        onUpload={handleDocUpload('business')}
                        description="Business registration certificate"
                    />

                    <DocumentUploadCard
                        title="Bank Statement"
                        icon={FileText}
                        file={bankStatement}
                        onUpload={handleDocUpload('bank')}
                        description="Recent bank statement (optional)"
                    />
                </div>
            </div>

            {/* OCR Status & Tips */}
            {(panProcessing || aadhaarProcessing) && (
                <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                            <span className="text-blue-800 font-medium">
                                Processing documents with AI OCR... This may take 3-5 seconds.
                            </span>
                        </div>
                        <p className="text-blue-700 text-sm">
                            Our AI is reading the text from your document images. Form fields will be auto-filled when complete.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* OCR Success Message */}
            {(autoFilledFields.size > 0) && !panProcessing && !aadhaarProcessing && (
                <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-green-800 font-medium">
                                ✨ Success! {autoFilledFields.size} field(s) have been auto-filled from your documents.
                            </span>
                        </div>
                        <p className="text-green-700 text-sm mt-1">
                            Please review the auto-filled information and make any necessary corrections.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* OCR Tips */}
            <Card className="bg-gray-50">
                <CardContent className="p-4">
                    <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Tips for Better OCR Results
                    </h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                        <li>• 📸 <strong>Clear photos:</strong> Ensure good lighting and avoid shadows</li>
                        <li>• 📄 <strong>Flat documents:</strong> Keep documents flat without wrinkles or folds</li>
                        <li>• 🔍 <strong>High quality:</strong> Use high-resolution images when possible</li>
                        <li>• ✂️ <strong>Crop properly:</strong> Make sure the entire document is visible</li>
                        <li>• ⏱️ <strong>Demo mode:</strong> OCR processing takes 3-5 seconds (real OCR: 30-60s)</li>
                        <li>• 🔧 <strong>Ready for real OCR:</strong> Replace inline service with Tesseract.js when ready</li>
                    </ul>
                </CardContent>
            </Card>

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6">
                <Button variant="outline" className="px-8" onClick={onPrev}>
                    Back
                </Button>
                <Button
                    className="px-8"
                    onClick={onNext}
                    disabled={!formData.fullName || !formData.panNumber || !formData.aadhaarNumber || !panCard || !aadhaarCard}
                >
                    Continue to KYC
                </Button>
            </div>
        </div>
    );
};

export default MerchantRegistration;