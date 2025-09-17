// src/hooks/useGoogleVision.ts
import { useState } from 'react';
import GoogleVisionService from '@/services/googleVisionAPI';
import { useToast } from '@/hooks/use-toast';

export interface VisionResult {
    extractedText: string;
    confidence: number;
    documentType: string;

    // PAN-specific data
    panNumber?: string;
    extractedName?: string;
    isPANDetected?: boolean;
    hasIncomeTextHeader?: boolean;

    // Aadhaar-specific data
    aadhaarNumber?: string;
    aadhaarNumberFull?: string;
    dateOfBirth?: string;
    gender?: string;
    isAadhaarDetected?: boolean;
    hasGovernmentHeader?: boolean;

    validationIssues?: string[];
}

export const useGoogleVision = () => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [lastResult, setLastResult] = useState<VisionResult | null>(null);
    const { toast } = useToast();

    // Create service instance only once
    const [visionService] = useState(() => new GoogleVisionService());

    const extractFromDocument = async (
        file: File,
        documentType: 'pan_card' | 'aadhaar_card'
    ): Promise<VisionResult> => {
        setIsProcessing(true);

        try {
            toast({
                title: "Processing Document",
                description: `Extracting text from ${documentType.replace('_', ' ')}...`,
            });

            const result = await visionService.extractText(file, documentType);
            const validatedResult = validateExtractionResult(result, documentType);

            setLastResult(validatedResult);

            if (validatedResult.confidence > 70) {
                let extractedInfo = '';
                if (documentType === 'pan_card' && validatedResult.panNumber) {
                    extractedInfo = `PAN: ${validatedResult.panNumber}`;
                } else if (documentType === 'aadhaar_card' && validatedResult.aadhaarNumber) {
                    extractedInfo = `Aadhaar: ${validatedResult.aadhaarNumber}`;
                }

                toast({
                    title: "Document Processed Successfully",
                    description: `${extractedInfo} (${validatedResult.confidence}% confidence)`,
                });
            } else {
                toast({
                    variant: "destructive",
                    title: "Low Quality Extraction",
                    description: "Please try with a clearer image. Check lighting and focus.",
                });
            }

            return validatedResult;

        } catch (error: any) {
            console.error('Vision API Error:', error);

            let errorMessage = "Please try again with a different image";

            if (error.message.includes('API key')) {
                errorMessage = "Google Vision API not configured properly";
            } else if (error.message.includes('quota')) {
                errorMessage = "API quota exceeded. Please try again later";
            } else if (error.message.includes('invalid')) {
                errorMessage = "Invalid image format. Please use JPEG, PNG, or PDF";
            }

            toast({
                variant: "destructive",
                title: "Document Processing Failed",
                description: errorMessage,
            });

            throw error;
        } finally {
            setIsProcessing(false);
        }
    };

    const quickOCR = async (file: File): Promise<string> => {
        setIsProcessing(true);

        try {
            const result = await visionService.extractText(file, 'general');
            return result.extractedText;
        } catch (error) {
            console.error('Quick OCR Error:', error);
            throw error;
        } finally {
            setIsProcessing(false);
        }
    };

    return {
        extractFromDocument,
        quickOCR,
        isProcessing,
        lastResult,
        clearResult: () => setLastResult(null)
    };
};

function validateExtractionResult(result: VisionResult, documentType: string): VisionResult {
    let confidenceAdjustment = 0;
    const issues: string[] = [];

    switch (documentType) {
        case 'pan_card':
            if (!result.isPANDetected || !result.panNumber) {
                confidenceAdjustment -= 30;
                issues.push('PAN number not detected clearly');
            } else {
                const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
                if (!panPattern.test(result.panNumber)) {
                    confidenceAdjustment -= 20;
                    issues.push('PAN number format seems incorrect');
                }
            }

            if (!result.hasIncomeTextHeader) {
                confidenceAdjustment -= 10;
                issues.push('Income Tax Department header not clearly visible');
            }

            if (!result.extractedName || result.extractedName.length < 2) {
                confidenceAdjustment -= 15;
                issues.push('Name not clearly extracted');
            }
            break;

        case 'aadhaar_card':
            if (!result.isAadhaarDetected || !result.aadhaarNumberFull) {
                confidenceAdjustment -= 30;
                issues.push('Aadhaar number not detected clearly');
            } else {
                if (!/^[2-9]\d{11}$/.test(result.aadhaarNumberFull)) {
                    confidenceAdjustment -= 20;
                    issues.push('Aadhaar number format seems incorrect');
                }
            }

            if (!result.hasGovernmentHeader) {
                confidenceAdjustment -= 10;
                issues.push('Government of India header not clearly visible');
            }

            if (!result.extractedName || result.extractedName.length < 2) {
                confidenceAdjustment -= 15;
                issues.push('Name not clearly extracted');
            }
            break;
    }

    const finalConfidence = Math.max(0, Math.min(100, result.confidence + confidenceAdjustment));

    return {
        ...result,
        confidence: finalConfidence,
        validationIssues: issues
    };
}