// src/services/ocrService.ts
import Tesseract from 'tesseract.js';

export interface OCRResult {
    text: string;
    confidence: number;
    boundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

export interface ExtractedData {
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

export interface DocumentType {
    type: 'PAN' | 'AADHAAR' | 'GST' | 'BUSINESS_PROOF';
    patterns: RegExp[];
    fieldMappings: Record<string, RegExp>;
}

class OCRService {
    private googleVisionApiKey: string;
    private tesseractWorker: Tesseract.Worker | null = null;

    constructor(apiKey?: string) {
        this.googleVisionApiKey = apiKey || process.env.NEXT_PUBLIC_GOOGLE_VISION_API_KEY || '';
    }

    // Document type definitions with patterns
    private documentTypes: Record<string, DocumentType> = {
        PAN: {
            type: 'PAN',
            patterns: [
                /INCOME\s*TAX\s*DEPARTMENT/i,
                /PERMANENT\s*ACCOUNT\s*NUMBER/i,
                /[A-Z]{5}[0-9]{4}[A-Z]{1}/
            ],
            fieldMappings: {
                panNumber: /([A-Z]{5}[0-9]{4}[A-Z]{1})/,
                name: /Name[:\s]*([A-Z\s]+)/i,
                fatherName: /Father['\s]*s?\s*Name[:\s]*([A-Z\s]+)/i,
                dateOfBirth: /(\d{2}[\\-]\d{2}[\\-]\d{4})/
            }
        },
        AADHAAR: {
            type: 'AADHAAR',
            patterns: [
                /UNIQUE\s*IDENTIFICATION\s*AUTHORITY/i,
                /GOVERNMENT\s*OF\s*INDIA/i,
                /[2-9]{1}[0-9]{3}[0-9]{4}[0-9]{4}/
            ],
            fieldMappings: {
                aadhaarNumber: /([2-9]{1}[0-9]{3}\s?[0-9]{4}\s?[0-9]{4})/,
                name: /^([A-Z\s]+)$/m,
                dateOfBirth: /DOB[:\s]*(\d{2}[\\-]\d{2}[\\-]\d{4})/i,
                address: /Address[:\s]*([A-Za-z0-9\s,.-]+)/i
            }
        },
        GST: {
            type: 'GST',
            patterns: [
                /GOODS\s*AND\s*SERVICES\s*TAX/i,
                /GSTIN/i,
                /[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}/
            ],
            fieldMappings: {
                gstNumber: /([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})/,
                businessName: /Legal\s*Name[:\s]*([A-Za-z0-9\s&.-]+)/i,
                address: /Address[:\s]*([A-Za-z0-9\s,.-]+)/i
            }
        }
    };

    // Initialize Tesseract worker
    private async initTesseract(): Promise<void> {
        if (!this.tesseractWorker) {
            this.tesseractWorker = await Tesseract.createWorker();
            await this.tesseractWorker.loadLanguage('eng');
            await this.tesseractWorker.initialize('eng');
        }
    }

    // Google Vision API OCR
    private async extractTextWithGoogleVision(imageFile: File): Promise<OCRResult> {
        if (!this.googleVisionApiKey) {
            throw new Error('Google Vision API key not configured');
        }

        const base64Image = await this.fileToBase64(imageFile);
        const imageData = base64Image.split(',')[1]; // Remove data:image/... prefix

        const response = await fetch(
            `https://vision.googleapis.com/v1/images:annotate?key=${this.googleVisionApiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    requests: [
                        {
                            image: {
                                content: imageData,
                            },
                            features: [
                                {
                                    type: 'TEXT_DETECTION',
                                    maxResults: 1,
                                },
                            ],
                        },
                    ],
                }),
            }
        );

        const result = await response.json();

        if (result.responses?.[0]?.textAnnotations?.[0]) {
            const annotation = result.responses[0].textAnnotations[0];
            return {
                text: annotation.description,
                confidence: 0.95, // Google Vision typically has high confidence
                boundingBox: annotation.boundingPoly?.vertices?.[0]
                    ? this.calculateBoundingBox(annotation.boundingPoly.vertices)
                    : undefined
            };
        }

        throw new Error('No text detected in image');
    }

    // Tesseract.js OCR (fallback)
    private async extractTextWithTesseract(imageFile: File): Promise<OCRResult> {
        await this.initTesseract();

        if (!this.tesseractWorker) {
            throw new Error('Failed to initialize Tesseract worker');
        }

        const result = await this.tesseractWorker.recognize(imageFile);

        return {
            text: result.data.text,
            confidence: result.data.confidence / 100, // Convert to 0-1 range
        };
    }

    // Main OCR extraction method
    public async extractText(imageFile: File, useGoogleVision: boolean = true): Promise<OCRResult> {
        try {
            // Try Google Vision first if enabled and API key available
            if (useGoogleVision && this.googleVisionApiKey) {
                try {
                    return await this.extractTextWithGoogleVision(imageFile);
                } catch (error) {
                    console.warn('Google Vision failed, falling back to Tesseract:', error);
                }
            }

            // Fallback to Tesseract
            return await this.extractTextWithTesseract(imageFile);
        } catch (error) {
            console.error('OCR extraction failed:', error);
            throw new Error('Failed to extract text from image');
        }
    }

    // Detect document type
    public detectDocumentType(text: string): DocumentType['type'] | null {
        for (const [key, docType] of Object.entries(this.documentTypes)) {
            const matchCount = docType.patterns.reduce((count, pattern) => {
                return count + (pattern.test(text) ? 1 : 0);
            }, 0);

            // If at least 2 patterns match, consider it a match
            if (matchCount >= 2) {
                return docType.type;
            }
        }
        return null;
    }

    // Extract structured data from text
    public extractStructuredData(text: string, documentType?: DocumentType['type']): ExtractedData {
        const detectedType = documentType || this.detectDocumentType(text);

        if (!detectedType) {
            return {
                confidence: 0,
                rawText: text
            };
        }

        const docConfig = this.documentTypes[detectedType];
        const extractedData: ExtractedData = {
            confidence: 0.8,
            rawText: text
        };

        // Extract fields based on document type
        for (const [field, pattern] of Object.entries(docConfig.fieldMappings)) {
            const match = text.match(pattern);
            if (match && match[1]) {
                (extractedData as any)[field] = match[1].trim();
            }
        }

        // Calculate confidence based on successful extractions
        const extractedFields = Object.keys(extractedData).filter(
            key => key !== 'confidence' && key !== 'rawText' && extractedData[key as keyof ExtractedData]
        );

        extractedData.confidence = Math.min(0.95, extractedFields.length / Object.keys(docConfig.fieldMappings).length);

        return extractedData;
    }

    // Process document (full pipeline)
    public async processDocument(
        imageFile: File,
        expectedType?: DocumentType['type'],
        useGoogleVision: boolean = true
    ): Promise<ExtractedData> {
        try {
            // Step 1: Extract text using OCR
            const ocrResult = await this.extractText(imageFile, useGoogleVision);

            // Step 2: Extract structured data
            const structuredData = this.extractStructuredData(ocrResult.text, expectedType);

            // Step 3: Apply OCR confidence to final confidence
            structuredData.confidence = Math.min(
                structuredData.confidence,
                ocrResult.confidence
            );

            return structuredData;
        } catch (error) {
            console.error('Document processing failed:', error);
            throw new Error('Failed to process document');
        }
    }

    // Utility methods
    private async fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to convert file to base64'));
            reader.readAsDataURL(file);
        });
    }

    private calculateBoundingBox(vertices: Array<{ x: number; y: number }>): {
        x: number;
        y: number;
        width: number;
        height: number;
    } {
        const xs = vertices.map(v => v.x);
        const ys = vertices.map(v => v.y);

        return {
            x: Math.min(...xs),
            y: Math.min(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys)
        };
    }

    // Cleanup
    public async cleanup(): Promise<void> {
        if (this.tesseractWorker) {
            await this.tesseractWorker.terminate();
            this.tesseractWorker = null;
        }
    }
}

export default OCRService;