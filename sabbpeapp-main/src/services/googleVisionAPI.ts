// src/services/googleVisionAPI.ts
interface VisionAPIConfig {
    features: {
        type: string;
        maxResults?: number;
        model?: string;
    }[];
    imageContext?: {
        languageHints: string[];
        cropHintsParams?: any;
    };
}

class GoogleVisionService {
    private apiKey: string;
    private endpoint = 'https://vision.googleapis.com/v1/images:annotate';

    constructor() {
        this.apiKey = import.meta.env.VITE_GOOGLE_VISION_API_KEY || '';

        if (!this.apiKey) {
            console.warn('Google Vision API key not found. Please add VITE_GOOGLE_VISION_API_KEY to your .env file');
        }
    }

    private getConfigForDocumentType(documentType: string): VisionAPIConfig {
        const baseConfig: VisionAPIConfig = {
            features: [
                {
                    type: "DOCUMENT_TEXT_DETECTION",
                    maxResults: 50
                }
            ],
            imageContext: {
                languageHints: ["en"]
            }
        };

        switch (documentType) {
            case 'pan_card':
                return {
                    ...baseConfig,
                    imageContext: {
                        languageHints: ["en"]
                    }
                };

            case 'aadhaar_card':
                return {
                    ...baseConfig,
                    imageContext: {
                        languageHints: ["en", "hi"]
                    }
                };

            default:
                return baseConfig;
        }
    }

    async extractText(imageFile: File, documentType: string = 'general') {
        if (!this.apiKey) {
            throw new Error('Google Vision API key not configured');
        }

        try {
            const base64Image = await this.fileToBase64(imageFile);
            const config = this.getConfigForDocumentType(documentType);

            const requestBody = {
                requests: [
                    {
                        image: {
                            content: base64Image.split(',')[1]
                        },
                        features: config.features,
                        imageContext: config.imageContext
                    }
                ]
            };

            console.log('Vision API Request:', {
                documentType,
                features: config.features.map(f => f.type),
                languages: config.imageContext?.languageHints
            });

            const response = await fetch(`${this.endpoint}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Vision API error: ${response.statusText} - ${errorText}`);
            }

            const result = await response.json();

            if (result.responses[0]?.error) {
                throw new Error(`Vision API error: ${result.responses[0].error.message}`);
            }

            return this.processVisionResponse(result.responses[0], documentType);

        } catch (error) {
            console.error('Vision API Error:', error);
            throw error;
        }
    }

    private processVisionResponse(response: any, documentType: string) {
        const textAnnotations = response.textAnnotations || [];
        const fullTextAnnotation = response.fullTextAnnotation;

        const extractedText = fullTextAnnotation?.text ||
            textAnnotations[0]?.description || '';

        let totalConfidence = 0;
        let confidenceCount = 0;

        if (textAnnotations.length > 1) {
            for (let i = 1; i < textAnnotations.length; i++) {
                if (textAnnotations[i].confidence) {
                    totalConfidence += textAnnotations[i].confidence;
                    confidenceCount++;
                }
            }
        }

        const averageConfidence = confidenceCount > 0 ?
            Math.round((totalConfidence / confidenceCount) * 100) : 75;

        const extractedData = this.extractDocumentData(extractedText, documentType);

        return {
            extractedText,
            confidence: averageConfidence,
            documentType,
            ...extractedData
        };
    }

    private extractDocumentData(text: string, documentType: string) {
        switch (documentType) {
            case 'pan_card':
                return this.extractPANData(text);
            case 'aadhaar_card':
                return this.extractAadhaarData(text);
            default:
                return {};
        }
    }

    private extractPANData(text: string) {
        console.log('Extracting PAN data from:', text);

        const panPattern = /[A-Z]{5}[0-9]{4}[A-Z]{1}/g;
        const panMatch = text.match(panPattern);

        let extractedName = '';
        const namePatterns = [
            /(?:Name|नाम)[:\s]*([A-Z][A-Z\s]+)/i,
            /PERMANENT ACCOUNT NUMBER CARD[^A-Z]*([A-Z][A-Z\s]+)/i,
            /([A-Z][A-Z\s]+)(?:\s+(?:S[/]O|D[/]O|W[/]O|Father|पिता))/i,
        ];

        for (const pattern of namePatterns) {
            const nameMatch = text.match(pattern);
            if (nameMatch && nameMatch[1]) {
                extractedName = nameMatch[1].trim();
                extractedName = extractedName.split(/\s+/).map(word =>
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                ).join(' ');
                break;
            }
        }

        const result = {
            panNumber: panMatch ? panMatch[0] : null,
            extractedName,
            isPANDetected: !!panMatch,
            hasIncomeTextHeader: /INCOME TAX DEPARTMENT/i.test(text)
        };

        console.log('PAN extraction result:', result);
        return result;
    }

    private extractAadhaarData(text: string) {
        console.log('Extracting Aadhaar data from:', text);

        const aadhaarPatterns = [
            /\d{4}\s+\d{4}\s+\d{4}/g,
            /\d{4}-\d{4}-\d{4}/g,
            /(?<!\d)\d{12}(?!\d)/g
        ];

        let aadhaarNumber = null;
        for (const pattern of aadhaarPatterns) {
            const match = text.match(pattern);
            if (match) {
                const cleanNumber = match[0].replace(/[\s-]/g, '');
                if (cleanNumber.length === 12) {
                    aadhaarNumber = cleanNumber;
                    break;
                }
            }
        }

        let extractedName = '';
        const namePatterns = [
            /(?:Government of India|भारत सरकार)[^A-Z]*([A-Z][A-Z\s]+)/i,
            /\d{4}\s*\d{4}\s*\d{4}[^A-Z]*([A-Z][A-Z\s]+)/i,
        ];

        for (const pattern of namePatterns) {
            const nameMatch = text.match(pattern);
            if (nameMatch && nameMatch[1]) {
                extractedName = nameMatch[1].trim();
                extractedName = extractedName.split(/\s+/).map(word =>
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                ).join(' ');
                break;
            }
        }

        const dobPattern = /(?:DOB|जन्म)[:\s]*(\d{1,2}[/\-]\d{1,2}[/\-]\d{4})/i;
        const dobMatch = text.match(dobPattern);

        const genderPattern = /\b(Male|Female|पुरुष|महिला)\b/i;
        const genderMatch = text.match(genderPattern);

        const result = {
            aadhaarNumber: aadhaarNumber ?
                aadhaarNumber.replace(/(\d{4})(\d{4})(\d{4})/, '****-****-$3') : null,
            aadhaarNumberFull: aadhaarNumber,
            extractedName,
            dateOfBirth: dobMatch ? dobMatch[1] : null,
            gender: genderMatch ? genderMatch[1] : null,
            isAadhaarDetected: !!aadhaarNumber,
            hasGovernmentHeader: /Government of India|भारत सरकार/i.test(text)
        };

        console.log('Aadhaar extraction result:', result);
        return result;
    }

    private async fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    }
}

export default GoogleVisionService;