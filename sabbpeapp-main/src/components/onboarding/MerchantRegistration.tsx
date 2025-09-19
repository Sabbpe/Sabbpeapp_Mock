import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

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
    AlertTriangle,
    Settings
} from 'lucide-react';

// Supabase client (replace with your actual values)
import { supabase } from '@/integrations/supabase/client';

interface ExtractedData {
    panNumber?: string;
    aadhaarNumber?: string;
    extractedName?: string;
    dateOfBirth?: string;
    confidence: number;
}
interface DocumentUploadCardProps {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    file: File | null;
    processing?: boolean;
    progress?: number;
    onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    description: string;
    error?: string;
}
interface AutoFillInputProps {
    label: string;
    field: string;
    placeholder: string;
    type?: string;
    maxLength?: number;
    required?: boolean;
}

interface FormData {
    fullName: string;
    panNumber: string;
    aadhaarNumber: string;
    mobileNumber: string;
    email: string;
    businessName: string;
    gstNumber: string;
    hasGST: boolean;
}
interface MerchantRegistrationProps {
    onNext?: () => void;
    onPrev?: () => void;
    data?: FormData;
    onDataChange?: (data: FormData) => void;
}

// Real OCR Service using OCR.space
class RealOCRService {
    private apiKey = 'K88739396488957'; // Your OCR.space API key

    // Image preprocessing with resizing
    private async preprocessImage(file: File): Promise<Blob> {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = function () {
                console.log(`Original image size: ${img.width}x${img.height}`);

                // Calculate resize if needed (max 2MB, max 2048px width)
                let scaleFactor = 1;
                const maxWidth = 2048;
                const maxFileSize = 2 * 1024 * 1024; // 2MB

                if (img.width > maxWidth) {
                    scaleFactor = maxWidth / img.width;
                }

                canvas.width = img.width * scaleFactor;
                canvas.height = img.height * scaleFactor;

                // High-quality resizing
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Get image data for gentle enhancement
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                // Apply gentle enhancements for better OCR
                for (let i = 0; i < data.length; i += 4) {
                    // Convert to grayscale
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const gray = 0.299 * r + 0.587 * g + 0.114 * b;

                    // Gentle contrast enhancement
                    let enhanced = ((gray - 128) * 1.15) + 128;
                    enhanced += 5; // Slight brightness
                    enhanced = Math.max(0, Math.min(255, enhanced));

                    data[i] = data[i + 1] = data[i + 2] = enhanced;
                }

                ctx.putImageData(imageData, 0, 0);

                console.log(`Resized to: ${canvas.width}x${canvas.height} (${scaleFactor.toFixed(2)}x)`);

                canvas.toBlob((blob) => {
                    if (blob) {
                        console.log(`Final image size: ${(blob.size / 1024).toFixed(1)} KB`);
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create image blob'));
                    }
                }, 'image/png', 0.92);
            };

            img.onerror = () => reject(new Error('Failed to load image'));

            const reader = new FileReader();
            reader.onload = (e) => img.src = e.target?.result as string;
            reader.readAsDataURL(file);
        });
    }

    // Document type detection
    private detectDocumentType(text: string): 'pan_card' | 'aadhaar_card' | 'unknown' {
        const cleanText = text.toUpperCase().replace(/[^A-Z0-9\s]/g, ' ');

        const panPatterns = [
            /INCOME\s*TAX\s*DEPARTMENT/,
            /PERMANENT\s*ACCOUNT\s*NUMBER/,
            /GOVT?\s*OF\s*INDIA/,
            /PAN/
        ];

        const aadhaarPatterns = [
            /UNIQUE\s*IDENTIFICATION\s*AUTHORITY/,
            /GOVERNMENT\s*OF\s*INDIA/,
            /AADHAAR/,
            /\bUID\b/
        ];

        const panMatches = panPatterns.filter(pattern => pattern.test(cleanText)).length;
        const aadhaarMatches = aadhaarPatterns.filter(pattern => pattern.test(cleanText)).length;

        const panNumberPattern = /[A-Z]{5}[0-9]{4}[A-Z]{1}/;
        const aadhaarNumberPattern = /[2-9]{1}[0-9]{3}[\s-]?[0-9]{4}[\s-]?[0-9]{4}/;

        const hasPanNumber = panNumberPattern.test(cleanText);
        const hasAadhaarNumber = aadhaarNumberPattern.test(cleanText);

        if ((panMatches >= 1 || hasPanNumber) && panMatches >= aadhaarMatches) {
            return 'pan_card';
        } else if ((aadhaarMatches >= 1 || hasAadhaarNumber) && aadhaarMatches >= panMatches) {
            return 'aadhaar_card';
        } else {
            return 'unknown';
        }
    }

    // Extract PAN card data
    private extractPANData(text: string): ExtractedData {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        const cleanText = text.replace(/[^\w\s/-]/g, ' ').replace(/\s+/g, ' ');

        // Extract PAN number
        const panMatch = cleanText.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}/);
        const panNumber = panMatch ? panMatch[0] : undefined;

        // Extract date of birth
        const dobPatterns = [
            /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/,
            /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})/
        ];

        let dateOfBirth;
        for (const pattern of dobPatterns) {
            const dobMatch = cleanText.match(pattern);
            if (dobMatch) {
                dateOfBirth = dobMatch[0];
                break;
            }
        }

        // Extract name
        const excludeWords = ['INCOME', 'TAX', 'DEPARTMENT', 'GOVT', 'GOVERNMENT', 'INDIA', 'PERMANENT', 'ACCOUNT', 'NUMBER', 'SIGNATURE', 'PAN'];
        let extractedName;
        let maxScore = 0;

        for (const line of lines) {
            const words = line.toUpperCase().split(/\s+/);
            const hasExcluded = words.some(word => excludeWords.some(exc => word.includes(exc)));
            const isAllCaps = line === line.toUpperCase();
            const hasLetters = /[A-Z]/.test(line);
            const hasNumbers = /[0-9]/.test(line);

            if (!hasExcluded && isAllCaps && hasLetters && !hasNumbers && line.length > 3) {
                const score = line.length + (words.length * 2);
                if (score > maxScore) {
                    maxScore = score;
                    extractedName = line.trim();
                }
            }
        }

        return {
            panNumber,
            extractedName,
            dateOfBirth,
            confidence: panNumber ? 85 : 40
        };
    }

    // Extract Aadhaar card data
    private extractAadhaarData(text: string): ExtractedData {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        const cleanText = text.replace(/[^\w\s/-]/g, ' ').replace(/\s+/g, ' ');

        // Extract Aadhaar number
        const aadhaarPatterns = [
            /[2-9]{1}[0-9]{3}[\s-]?[0-9]{4}[\s-]?[0-9]{4}/,
            /[2-9][0-9]{11}/
        ];

        let aadhaarNumber;
        for (const pattern of aadhaarPatterns) {
            const match = cleanText.match(pattern);
            if (match) {
                const rawNumber = match[0].replace(/[\s-]/g, '');
                aadhaarNumber = rawNumber.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3');
                break;
            }
        }

        // Extract date of birth
        const dobPatterns = [
            /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/,
            /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})/
        ];

        let dateOfBirth;
        for (const pattern of dobPatterns) {
            const dobMatch = cleanText.match(pattern);
            if (dobMatch) {
                dateOfBirth = dobMatch[0];
                break;
            }
        }

        // Extract name
        const excludeWords = ['UNIQUE', 'IDENTIFICATION', 'AUTHORITY', 'GOVERNMENT', 'INDIA', 'AADHAAR', 'MALE', 'FEMALE', 'DOB', 'VID'];
        let extractedName;
        let maxScore = 0;

        for (const line of lines) {
            const words = line.toUpperCase().split(/\s+/);
            const hasExcluded = words.some(word => excludeWords.some(exc => word.includes(exc)));
            const isAllCaps = line === line.toUpperCase();
            const hasLetters = /[A-Z]/.test(line);
            const hasNumbers = /[0-9]/.test(line);

            if (!hasExcluded && isAllCaps && hasLetters && !hasNumbers && line.length > 3) {
                const score = line.length + (words.length * 2);
                if (score > maxScore) {
                    maxScore = score;
                    extractedName = line.trim();
                }
            }
        }

        return {
            aadhaarNumber,
            extractedName,
            dateOfBirth,
            confidence: aadhaarNumber ? 85 : 40
        };
    }

    async processDocument(
        file: File,
        onProgress?: (progress: number) => void
    ): Promise<ExtractedData> {
        console.log('Starting OCR processing:', file.name);

        try {
            onProgress?.(10);

            // Preprocess image
            const processedImage = await this.preprocessImage(file);
            onProgress?.(30);

            // Prepare form data
            const formData = new FormData();
            formData.append('file', processedImage, 'document.png');
            formData.append('apikey', this.apiKey);
            formData.append('language', 'eng');
            formData.append('isOverlayRequired', 'false');
            formData.append('detectOrientation', 'true');
            formData.append('scale', 'true');
            formData.append('OCREngine', '2');

            onProgress?.(50);

            // Call OCR.space API
            const response = await fetch('https://api.ocr.space/parse/image', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            onProgress?.(80);

            if (result.OCRExitCode === 1 && result.ParsedResults?.length > 0) {
                const extractedText = result.ParsedResults[0].ParsedText;
                console.log('OCR Text:', extractedText);

                // Detect document type and extract data
                const docType = this.detectDocumentType(extractedText);
                console.log('Document type detected:', docType);

                onProgress?.(100);

                if (docType === 'pan_card') {
                    return this.extractPANData(extractedText);
                } else if (docType === 'aadhaar_card') {
                    return this.extractAadhaarData(extractedText);
                } else {
                    throw new Error('Document type not recognized');
                }
            } else {
                throw new Error('OCR processing failed: ' + (result.ErrorMessage || 'Unknown error'));
            }

        } catch (error) {
            console.error('OCR processing error:', error);
            throw error;
        }
    }
}

const ocrService = new RealOCRService();

const MerchantRegistration: React.FC<MerchantRegistrationProps> = ({
    onNext,
    onPrev,
    data,
    onDataChange
}) => {
    const { toast } = useToast();

    // Form state
    const [formData, setFormData] = useState({
        fullName: data?.fullName || '',
        panNumber: data?.panNumber || '',
        aadhaarNumber: data?.aadhaarNumber || '',
        mobileNumber: data?.mobileNumber || '',
        email: data?.email || '',
        businessName: data?.businessName || '',
        gstNumber: data?.gstNumber || '',
        hasGST: data?.hasGST ?? true // New GST toggle
    });

    // Document states
    const [panCard, setPanCard] = useState<File | null>(null);
    const [aadhaarCard, setAadhaarCard] = useState<File | null>(null);
    const [businessProof, setBusinessProof] = useState<File | null>(null);
    const [bankStatement, setBankStatement] = useState<File | null>(null);

    // Processing states
    const [panProcessing, setPanProcessing] = useState(false);
    const [aadhaarProcessing, setAadhaarProcessing] = useState(false);
    const [panProgress, setPanProgress] = useState(0);
    const [aadhaarProgress, setAadhaarProgress] = useState(0);
    const [ocrErrors, setOcrErrors] = useState<Record<string, string>>({});

    // Auto-filled fields
    const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());

    // Upload to Supabase
    const uploadToSupabase = async (file: File, folder: string): Promise<string> => {
        const fileName = `${Date.now()}_${file.name}`;
        const filePath = `${folder}/${fileName}`;

        const { data, error } = await supabase.storage
            .from('merchant-documents')
            .upload(filePath, file);

        if (error) {
            console.error('Supabase upload error:', error);
            throw new Error('Failed to upload to storage');
        }

        return filePath;
    };

    // Handle PAN upload and OCR
    const handlePanUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setOcrErrors(prev => ({ ...prev, pan: 'Please upload a valid image file' }));
            return;
        }

        setPanCard(file);
        setPanProcessing(true);
        setPanProgress(0);
        setOcrErrors(prev => ({ ...prev, pan: '' }));

        try {
            // Process with OCR
            const result = await ocrService.processDocument(file, setPanProgress);

            if (result.panNumber) {
                const newData = { ...formData, panNumber: result.panNumber };
                setFormData(newData);
                setAutoFilledFields(prev => new Set([...prev, 'panNumber']));
                onDataChange?.(newData);
            }

            if (result.extractedName && !formData.fullName) {
                const newData = { ...formData, fullName: result.extractedName };
                setFormData(newData);
                setAutoFilledFields(prev => new Set([...prev, 'fullName']));
                onDataChange?.(newData);
            }

            // Upload to Supabase
            const uploadPath = await uploadToSupabase(file, 'pan-cards');
            console.log('PAN card uploaded to:', uploadPath);

            toast({
                title: "PAN Card Processed",
                description: `Extracted: ${result.panNumber || 'Name only'} (${result.confidence}% confidence)`,
            });

        } catch (error) {
            console.error('PAN processing failed:', error);
            setOcrErrors(prev => ({
                ...prev,
                pan: error instanceof Error ? error.message : 'Processing failed'
            }));
            toast({
                variant: "destructive",
                title: "PAN Processing Failed",
                description: "Please try with a clearer image",
            });
        } finally {
            setPanProcessing(false);
        }
    }, [formData, onDataChange, toast]);

    // Handle Aadhaar upload and OCR
    const handleAadhaarUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setOcrErrors(prev => ({ ...prev, aadhaar: 'Please upload a valid image file' }));
            return;
        }

        setAadhaarCard(file);
        setAadhaarProcessing(true);
        setAadhaarProgress(0);
        setOcrErrors(prev => ({ ...prev, aadhaar: '' }));

        try {
            // Process with OCR
            const result = await ocrService.processDocument(file, setAadhaarProgress);

            if (result.aadhaarNumber) {
                const newData = { ...formData, aadhaarNumber: result.aadhaarNumber };
                setFormData(newData);
                setAutoFilledFields(prev => new Set([...prev, 'aadhaarNumber']));
                onDataChange?.(newData);
            }

            if (result.extractedName && !formData.fullName) {
                const newData = { ...formData, fullName: result.extractedName };
                setFormData(newData);
                setAutoFilledFields(prev => new Set([...prev, 'fullName']));
                onDataChange?.(newData);
            }

            // Upload to Supabase
            const uploadPath = await uploadToSupabase(file, 'aadhaar-cards');
            console.log('Aadhaar card uploaded to:', uploadPath);

            toast({
                title: "Aadhaar Card Processed",
                description: `Extracted: ${result.aadhaarNumber || 'Name only'} (${result.confidence}% confidence)`,
            });

        } catch (error) {
            console.error('Aadhaar processing failed:', error);
            setOcrErrors(prev => ({
                ...prev,
                aadhaar: error instanceof Error ? error.message : 'Processing failed'
            }));
            toast({
                variant: "destructive",
                title: "Aadhaar Processing Failed",
                description: "Please try with a clearer image",
            });
        } finally {
            setAadhaarProcessing(false);
        }
    }, [formData, onDataChange, toast]);

    // Handle other document uploads
    const handleDocUpload = (docType: 'business' | 'bank') => async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            // Upload to Supabase
            const folder = docType === 'business' ? 'business-proofs' : 'bank-statements';
            const uploadPath = await uploadToSupabase(file, folder);
            console.log(`${docType} document uploaded to:`, uploadPath);

            if (docType === 'business') {
                setBusinessProof(file);
            } else {
                setBankStatement(file);
            }

            toast({
                title: "Document Uploaded",
                description: `${docType === 'business' ? 'Business proof' : 'Bank statement'} uploaded successfully`,
            });

        } catch (error) {
            toast({
                variant: "destructive",
                title: "Upload Failed",
                description: "Failed to upload document",
            });
        }
    };

    // Handle form input changes
    const handleInputChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
        const newData = { ...formData, [field]: event.target.value };
        setFormData(newData);
        onDataChange?.(newData);
        setAutoFilledFields(prev => {
            const updated = new Set(prev);
            updated.delete(field);
            return updated;
        });
    };

    // Handle GST toggle
    const handleGSTToggle = (checked: boolean) => {
        const newData = { ...formData, hasGST: checked, gstNumber: checked ? formData.gstNumber : '' };
        setFormData(newData);
        onDataChange?.(newData);
    };

    // Document upload component
    const DocumentUploadCard = ({ title, icon: Icon, file, processing, progress, onUpload, description, error }: DocumentUploadCardProps) => (
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
                    </div>

                    <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={onUpload}
                        disabled={processing}
                    />
                </label>

                {processing && (
                    <div className="mt-3">
                        <Progress value={progress} className="w-full h-2" />
                    </div>
                )}

                {error && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                        {error}
                    </div>
                )}
            </CardContent>
        </Card>
    );

    // Auto-filled input component
    const AutoFillInput = ({ label, field, placeholder, type = "text", maxLength, required = false }: AutoFillInputProps) => {
        const isAutoFilled = autoFilledFields.has(field);
        const fieldValue = formData[field as keyof typeof formData];

        // Convert boolean to string for input value
        const inputValue = typeof fieldValue === 'boolean' ? fieldValue.toString() : fieldValue;

        return (
            <div>
                <Label className="flex items-center gap-2 mb-2">
                    {label} {required && <span className="text-red-500">*</span>}
                    {isAutoFilled && (
                        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                            <Sparkles className="h-3 w-3" />
                            Auto-filled
                        </span>
                    )}
                </Label>
                <Input
                    type={type}
                    value={inputValue}
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

            {/* GST Toggle */}
            <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Settings className="h-5 w-5 text-blue-600" />
                            <div>
                                <h4 className="font-semibold text-blue-900">Business Registration Type</h4>
                                <p className="text-sm text-blue-700">Choose your business registration status</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Label className={`text-sm ${!formData.hasGST ? 'font-semibold' : ''}`}>
                                Without GST
                            </Label>
                            <Switch
                                checked={formData.hasGST}
                                onCheckedChange={handleGSTToggle}
                            />
                            <Label className={`text-sm ${formData.hasGST ? 'font-semibold' : ''}`}>
                                With GST
                            </Label>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Document Uploads */}
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

            {/* Form Fields */}
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
                        required={true}
                    />

                    <AutoFillInput
                        label="PAN Number"
                        field="panNumber"
                        placeholder="ABCDE1234F"
                        maxLength={10}
                        required={true}
                    />

                    <AutoFillInput
                        label="Aadhaar Number"
                        field="aadhaarNumber"
                        placeholder="1234 5678 9012"
                        maxLength={14}
                        required={true}
                    />

                    <AutoFillInput
                        label="Mobile Number"
                        field="mobileNumber"
                        placeholder="+91 9876543210"
                        maxLength={10}
                        required={true}
                    />

                    <AutoFillInput
                        label="Email Address"
                        field="email"
                        type="email"
                        placeholder="merchant@example.com"
                        required={true}
                    />

                    <AutoFillInput
                        label="Business Name"
                        field="businessName"
                        placeholder="Enter business name"
                        required={true}
                    />

                    {/* Conditionally render GST field */}
                    {formData.hasGST && (
                        <div>
                            <AutoFillInput
                                label="GST Number"
                                field="gstNumber"
                                placeholder="22AAAAA0000A1Z5"
                                maxLength={15}
                                required={true}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Supporting Documents */}
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
                        description="Recent bank statement"
                    />
                </div>
            </div>

            {/* Processing Status Messages */}
            {(panProcessing || aadhaarProcessing) && (
                <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                            <span className="text-blue-800 font-medium">
                                Processing documents with OCR.space API...
                            </span>
                        </div>
                        <p className="text-blue-700 text-sm">
                            Our system is reading text from your document images. Form fields will be auto-filled when complete.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Success Message */}
            {(autoFilledFields.size > 0) && !panProcessing && !aadhaarProcessing && (
                <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-green-800 font-medium">
                                Success! {autoFilledFields.size} field(s) have been auto-filled from your documents.
                            </span>
                        </div>
                        <p className="text-green-700 text-sm mt-1">
                            Please review the auto-filled information and make any necessary corrections.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Image Quality Tips */}
            <Card className="bg-gray-50">
                <CardContent className="p-4">
                    <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Tips for Better OCR Results
                    </h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Clear photos: Ensure good lighting and avoid shadows</li>
                        <li>• Flat documents: Keep documents flat without wrinkles or folds</li>
                        <li>• High resolution: Use high-quality images when possible</li>
                        <li>• Crop properly: Make sure the entire document is visible</li>
                        <li>• File size: Images are automatically resized to under 2MB for processing</li>
                        <li>• Storage: All documents are securely uploaded to Supabase storage</li>
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
                    disabled={
                        !formData.fullName ||
                        !formData.panNumber ||
                        !formData.aadhaarNumber ||
                        !formData.mobileNumber ||
                        !formData.email ||
                        !formData.businessName ||
                        (formData.hasGST && !formData.gstNumber) ||
                        !panCard ||
                        !aadhaarCard ||
                        !businessProof
                    }
                >
                    Continue to KYC
                </Button>
            </div>
        </div>
    );
};

export default MerchantRegistration;